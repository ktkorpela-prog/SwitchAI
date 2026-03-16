const fs   = require('fs');
const path = require('path');
const { estimateTokens, estimateMessageTokens } = require('./tokenizer');

const ROOMS_DIR = path.join(__dirname, 'rooms');

function getCfg() {
  return {
    MAX_CONTEXT_TOKENS:       parseInt(process.env.MAX_CONTEXT_TOKENS        || '8000',  10),
    MAX_RECENT_MESSAGES:      parseInt(process.env.MAX_RECENT_MESSAGES        || '30',    10),
    MAX_CONTEXT_CHARS:        parseInt(process.env.MAX_CONTEXT_CHARS          || '32000', 10),
    MAX_FILE_CONTEXT_CHARS:   parseInt(process.env.MAX_FILE_CONTEXT_CHARS     || '8000',  10),
    HARD_REQUEST_TOKEN_CEILING: parseInt(process.env.HARD_REQUEST_TOKEN_CEILING || '12000', 10),
    MAX_OUTPUT_TOKENS_DEFAULT:    parseInt(process.env.MAX_OUTPUT_TOKENS_DEFAULT    || '1024', 10),
    MAX_OUTPUT_TOKENS_SHORT_REPLY: parseInt(process.env.MAX_OUTPUT_TOKENS_SHORT_REPLY || '256',  10),
    MAX_OUTPUT_TOKENS_LONG_REPLY:  parseInt(process.env.MAX_OUTPUT_TOKENS_LONG_REPLY  || '4096', 10),
    ENABLE_TOKEN_DEBUG: process.env.ENABLE_TOKEN_DEBUG === 'true',
  };
}

function getFrictionModifier(level) {
  if (level <= 1) return "Be warm, encouraging, and focus on strengths. Support the user's ideas.";
  if (level <= 3) return 'Be kind and balanced. Offer honest feedback gently, with alternatives where helpful.';
  if (level <= 6) return 'Be direct and balanced. Answer questions honestly without bias.';
  if (level <= 8) return 'Note assumptions, ask clarifying questions, and offer alternative perspectives.';
  return "Challenge all assumptions. Point out flaws. Do not simply agree with the user. Play devil's advocate constructively.";
}

/**
 * Build a context-budgeted message array + system prompt for a model call.
 *
 * Layers (added in order, dropped when budget is exhausted):
 *   1. system prompt (friction modifier — always included)
 *   2. context.md    (skipped in minimal mode)
 *   3. recent history (newest-first, trimmed to fit budget)
 *   4. current user message (always appended last)
 *
 * @returns {{
 *   systemPrompt: string,
 *   messages: Array<{role,content}>,
 *   estimatedInputTokens: number,
 *   tooLarge: boolean,
 *   debug: object
 * }}
 */
function buildContext(roomId, modelName, frictionLevel, contextMode, userMessage) {
  if (!/^[a-z0-9-]+$/.test(roomId)) {
    return { systemPrompt: '', messages: [], estimatedInputTokens: 0, tooLarge: true, debug: {} };
  }

  const cfg   = getCfg();
  const debug = { mode: contextMode, layers: [], excluded: [], truncations: [] };

  let budget = cfg.MAX_CONTEXT_TOKENS;

  // ── Layer 1: system prompt (always) ────────────────────────────────────────
  const frictionText = getFrictionModifier(frictionLevel);

  // ── Layer 2: context.md (skip in minimal mode) ────────────────────────────
  let contextMd = '';
  if (contextMode !== 'minimal') {
    const ctxPath = path.join(ROOMS_DIR, roomId, 'context.md');
    if (fs.existsSync(ctxPath)) {
      let raw = fs.readFileSync(ctxPath, 'utf8').trim();
      if (raw.length > cfg.MAX_CONTEXT_CHARS) {
        raw = raw.slice(0, cfg.MAX_CONTEXT_CHARS);
        debug.truncations.push('context.md truncated to MAX_CONTEXT_CHARS');
      }
      contextMd = raw;
    }
  }

  const systemPrompt = contextMd ? `${contextMd}\n\n---\n${frictionText}` : frictionText;
  const systemTokens = estimateTokens(systemPrompt);
  budget -= systemTokens;
  debug.layers.push(`system_prompt: ~${systemTokens} tok`);

  // ── Reserve space for user message (always) ───────────────────────────────
  const userTokens = estimateTokens(userMessage) + 4;
  budget -= userTokens;
  debug.layers.push(`user_message: ~${userTokens} tok`);

  // ── Layer 3: recent history ───────────────────────────────────────────────
  const messages        = [];
  const maxMsgs         = contextMode === 'minimal' ? 3 : cfg.MAX_RECENT_MESSAGES;
  const historyPath     = path.join(ROOMS_DIR, roomId, 'history.md');
  let   historyTokens   = 0;
  let   includedCount   = 0;
  let   excludedCount   = 0;

  if (fs.existsSync(historyPath) && budget > 0) {
    const raw       = fs.readFileSync(historyPath, 'utf8');
    const blocks    = raw.split(/\n(?=## )/).filter(Boolean);
    const candidates = blocks.slice(-maxMsgs).map((block) => {
      const firstLine = block.split('\n')[0];
      const isAI      = /\|\s*(Claude|GPT-4|Gemini|Mistral)/i.test(firstLine);
      const content   = block.split('\n').slice(1).join('\n').trim();
      return { role: isAI ? 'assistant' : 'user', content: content || block };
    });

    // Walk newest → oldest; include until budget exhausted
    for (let i = candidates.length - 1; i >= 0; i--) {
      const msgTok = estimateTokens(candidates[i].content) + 4;
      if (budget - msgTok < 0) {
        excludedCount = i + 1;
        break;
      }
      budget         -= msgTok;
      historyTokens  += msgTok;
      includedCount++;
      messages.unshift(candidates[i]);
    }
  }

  if (excludedCount > 0) debug.excluded.push(`${excludedCount} older messages excluded (budget)`);
  debug.layers.push(`history: ${includedCount} messages (~${historyTokens} tok)`);

  // ── Append current user message ───────────────────────────────────────────
  messages.push({ role: 'user', content: userMessage });

  // ── Ceiling check ─────────────────────────────────────────────────────────
  const estimatedInputTokens = systemTokens + estimateMessageTokens(messages);
  const tooLarge             = estimatedInputTokens > cfg.HARD_REQUEST_TOKEN_CEILING;

  if (cfg.ENABLE_TOKEN_DEBUG) {
    console.log(`[ctx] room=${roomId} model=${modelName} mode=${contextMode} est=${estimatedInputTokens} tok`);
    debug.layers.forEach((l) => console.log(`[ctx]   ${l}`));
    if (debug.excluded.length)    debug.excluded.forEach((e) => console.log(`[ctx]   excluded: ${e}`));
    if (debug.truncations.length) debug.truncations.forEach((t) => console.log(`[ctx]   truncated: ${t}`));
    if (tooLarge) console.warn(`[ctx] CEILING EXCEEDED: ${estimatedInputTokens} > ${getCfg().HARD_REQUEST_TOKEN_CEILING}`);
  }

  return { systemPrompt, messages, estimatedInputTokens, tooLarge, debug };
}

/**
 * Choose max output tokens based on the context mode.
 */
function chooseMaxOutputTokens(contextMode) {
  const cfg = getCfg();
  const map = {
    minimal:  cfg.MAX_OUTPUT_TOKENS_SHORT_REPLY,
    normal:   cfg.MAX_OUTPUT_TOKENS_DEFAULT,
    extended: cfg.MAX_OUTPUT_TOKENS_LONG_REPLY,
  };
  return map[contextMode] ?? cfg.MAX_OUTPUT_TOKENS_DEFAULT;
}

module.exports = { buildContext, chooseMaxOutputTokens };
