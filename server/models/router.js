const fs      = require('fs');
const path    = require('path');
const claude  = require('./claude');
const openai  = require('./openai');
const gemini  = require('./gemini');
const mistral = require('./mistral');

const webSearch         = require('../search');
const { buildContext, chooseMaxOutputTokens } = require('../contextBuilder');
const { selectContextMode }                   = require('../promptClassifier');

const ROOMS_DIR = path.join(__dirname, '../rooms');

const MODEL_MAP = {
  claude:  claude,
  gpt4:    openai,
  gemini:  gemini,
  mistral: mistral
};

const MENTION_PATTERN  = /^@(claude|gpt4|gemini|mistral|everyone)\b/i;
const WEB_FLAG_PATTERN = /\+web\b/i;

// Active stream controllers keyed by `${roomId}:${model}`
const activeStreams = new Map();

function parseMention(text) {
  const match = text.trim().match(MENTION_PATTERN);
  if (!match) return { model: null, text };
  return {
    model: match[1].toLowerCase(),
    text:  text.trim().slice(match[0].length).trim()
  };
}

function parseWebFlag(text) {
  const hasFlag = WEB_FLAG_PATTERN.test(text);
  return {
    web:  hasFlag,
    text: hasFlag ? text.replace(WEB_FLAG_PATTERN, '').trim() : text
  };
}

function appendToHistory(roomId, author, content, meta = '') {
  const historyPath = path.join(ROOMS_DIR, roomId, 'history.md');
  const timestamp   = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const metaLine    = meta ? `> ${meta}\n\n` : '';
  fs.appendFileSync(historyPath, `\n## ${timestamp} | ${author}\n${metaLine}${content}\n`);
}

function getFrictionLevel(roomId, modelName) {
  const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
  if (!fs.existsSync(settingsPath)) return 5;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  return settings.friction?.[modelName] ?? 5;
}

/** Stop an active stream for a model in a room */
function stopModel(roomId, model) {
  const key        = `${roomId}:${model}`;
  const controller = activeStreams.get(key);
  if (controller) {
    controller.abort();
    activeStreams.delete(key);
  }
}

async function handleMessage(payload, io) {
  const { roomId, username, text } = payload;

  appendToHistory(roomId, username, text);

  const { model, text: afterMention } = parseMention(text);
  if (!model) return;

  const { web: useWeb, text: cleanText } = parseWebFlag(afterMention);

  // ── Web search ──────────────────────────────────────────────────────────────
  let searchContext = '';
  if (useWeb) {
    if (!webSearch.isConfigured()) {
      io.to(roomId).emit('system_message', {
        text: 'Web search is not configured. Add TAVILY_API_KEY to .env to enable +web.'
      });
    } else {
      try {
        searchContext = await webSearch.search(cleanText);
      } catch (err) {
        console.error('[search] error:', err.message);
        io.to(roomId).emit('system_message', { text: `Web search failed: ${err.message}` });
      }
    }
  }

  const userMessage = searchContext
    ? `The following web search results were fetched in real time to help answer this question. Use them to give an up-to-date response.\n\n${searchContext}\n\n---\n${cleanText}`
    : cleanText;

  // ── Context mode ────────────────────────────────────────────────────────────
  const contextMode = selectContextMode(cleanText);

  const targets = model === 'everyone' ? getEnabledModels(roomId) : [model];

  for (const target of targets) {
    const module = MODEL_MAP[target];
    if (!module) continue;
    if (!module.isConfigured()) {
      io.to(roomId).emit('model_error', {
        model: target,
        error: `@${target} is not configured. Add the API key in Manage API keys.`
      });
      continue;
    }

    io.to(roomId).emit('model_typing', { model: target });

    const frictionLevel = getFrictionLevel(roomId, target);
    const maxTokens     = chooseMaxOutputTokens(contextMode);
    const { systemPrompt, messages, estimatedInputTokens, tooLarge, debug } =
      buildContext(roomId, target, frictionLevel, contextMode, userMessage);

    // ── Fail-safe ceiling ───────────────────────────────────────────────────
    if (tooLarge) {
      io.to(roomId).emit('model_error', {
        model: target,
        error: 'This request is too large for the current context budget. Please narrow the request or reduce attached context.'
      });
      continue;
    }

    const controller = new AbortController();
    const streamKey  = `${roomId}:${target}`;
    activeStreams.set(streamKey, controller);

    try {
      let fullResponse = '';

      const result = await module.call(
        messages,
        systemPrompt,
        frictionLevel,
        (chunk) => {
          fullResponse += chunk;
          io.to(roomId).emit('model_chunk', { model: target, chunk });
        },
        controller.signal,
        maxTokens
      );

      const { tokens = 0, inputTokens = 0, outputTokens = 0 } = result;
      const interrupted = controller.signal.aborted;

      io.to(roomId).emit('model_response', {
        model: target,
        text:  fullResponse,
        tokens,
        inputTokens,
        outputTokens,
        contextMode,
        interrupted,
        timestamp: new Date().toISOString()
      });

      if (fullResponse) {
        const displayName = { claude: 'Claude', gpt4: 'GPT-4', gemini: 'Gemini', mistral: 'Mistral' }[target];
        const meta = `model: ${target} | tokens: ${tokens} | mode: ${contextMode}${interrupted ? ' | interrupted' : ''}`;
        appendToHistory(roomId, displayName, fullResponse, meta);
      }

      if (tokens > 0) {
        const totals = updateTokenTotals(roomId, target, tokens);
        io.to(roomId).emit('token_totals', totals);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error(`[model:${target}] error:`, err.message);
        io.to(roomId).emit('model_error', { model: target, error: err.message });
      }
    } finally {
      activeStreams.delete(streamKey);
    }
  }
}

function getEnabledModels(roomId) {
  const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
  const settings     = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    : {};
  const explicitlyDisabled = settings.models_disabled || [];
  return Object.keys(MODEL_MAP).filter(
    (m) => MODEL_MAP[m].isConfigured() && !explicitlyDisabled.includes(m)
  );
}

function updateTokenTotals(roomId, model, tokens) {
  const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
  if (!fs.existsSync(settingsPath)) return {};
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!settings.token_totals) settings.token_totals = {};
  settings.token_totals[model] = (settings.token_totals[model] || 0) + tokens;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return settings.token_totals;
}

module.exports = { handleMessage, parseMention, stopModel };
