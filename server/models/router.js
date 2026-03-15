const fs = require('fs');
const path = require('path');
const claude = require('./claude');
const openai = require('./openai');
const gemini = require('./gemini');
const mistral = require('./mistral');

const ROOMS_DIR = path.join(__dirname, '../rooms');

// Map @mention aliases to model modules
const MODEL_MAP = {
  claude: claude,
  gpt4: openai,
  gemini: gemini,
  mistral: mistral
};

const MENTION_PATTERN = /^@(claude|gpt4|gemini|mistral|everyone)\b/i;

/**
 * Parse a message for a leading @mention.
 * Returns { model: 'claude'|'gpt4'|...|'everyone'|null, text: string }
 */
function parseMention(text) {
  const match = text.trim().match(MENTION_PATTERN);
  if (!match) return { model: null, text };
  return {
    model: match[1].toLowerCase(),
    text: text.trim().slice(match[0].length).trim()
  };
}

/**
 * Build the system prompt for a model call:
 * context.md + friction modifier
 */
function buildSystemPrompt(roomId, modelName, frictionLevel) {
  const contextPath = path.join(ROOMS_DIR, roomId, 'context.md');
  const context = fs.existsSync(contextPath)
    ? fs.readFileSync(contextPath, 'utf8')
    : '';

  const frictionModifier = getFrictionModifier(frictionLevel);
  return `${context}\n\n---\n${frictionModifier}`;
}

/**
 * Get the last N lines from history.md as context messages.
 */
function getHistoryMessages(roomId) {
  const historyPath = path.join(ROOMS_DIR, roomId, 'history.md');
  if (!fs.existsSync(historyPath)) return [];

  const raw = fs.readFileSync(historyPath, 'utf8');
  const limit = parseInt(process.env.HISTORY_CONTEXT_LINES || '50', 10);

  // Split into message blocks (separated by ## headings)
  const blocks = raw.split(/\n(?=## )/).filter(Boolean);
  const recent = blocks.slice(-limit);

  return recent.map((block) => {
    const firstLine = block.split('\n')[0];
    const isAI = /\|\s*(Claude|GPT-4|Gemini|Mistral)/i.test(firstLine);
    const content = block.split('\n').slice(1).join('\n').trim();
    return {
      role: isAI ? 'assistant' : 'user',
      content: content || block
    };
  });
}

/**
 * Append a message entry to history.md
 */
function appendToHistory(roomId, author, content, meta = '') {
  const historyPath = path.join(ROOMS_DIR, roomId, 'history.md');
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const metaLine = meta ? `> ${meta}\n\n` : '';
  const entry = `\n## ${timestamp} | ${author}\n${metaLine}${content}\n`;
  fs.appendFileSync(historyPath, entry);
}

/**
 * Get friction level for a model from settings.json
 */
function getFrictionLevel(roomId, modelName) {
  const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
  if (!fs.existsSync(settingsPath)) return 5;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  return settings.friction?.[modelName] ?? 5;
}

function getFrictionModifier(level) {
  if (level <= 1) return 'Be warm, encouraging, and focus on strengths. Support the user\'s ideas.';
  if (level <= 3) return 'Be kind and balanced. Offer honest feedback gently, with alternatives where helpful.';
  if (level <= 6) return 'Be direct and balanced. Answer questions honestly without bias.';
  if (level <= 8) return 'Note assumptions, ask clarifying questions, and offer alternative perspectives.';
  return 'Challenge all assumptions. Point out flaws. Do not simply agree with the user. Play devil\'s advocate constructively.';
}

/**
 * Main message handler — called from socket.io on 'send_message'
 */
async function handleMessage(payload, io) {
  const { roomId, username, text, timestamp } = payload;

  // Append human message to history
  appendToHistory(roomId, username, text);

  const { model, text: cleanText } = parseMention(text);
  if (!model) return; // No @mention — nothing to route

  const targets = model === 'everyone' ? getEnabledModels(roomId) : [model];

  for (const target of targets) {
    const module = MODEL_MAP[target];
    if (!module) continue;
    if (!module.isConfigured()) {
      io.to(roomId).emit('model_error', {
        model: target,
        error: `@${target} is not configured. Add the API key to your .env file.`
      });
      continue;
    }

    // Emit typing indicator
    io.to(roomId).emit('model_typing', { model: target });

    const frictionLevel = getFrictionLevel(roomId, target);
    const systemPrompt = buildSystemPrompt(roomId, target, frictionLevel);
    const history = getHistoryMessages(roomId);

    try {
      let fullResponse = '';

      await module.call(
        [...history, { role: 'user', content: cleanText }],
        systemPrompt,
        frictionLevel,
        (chunk) => {
          fullResponse += chunk;
          io.to(roomId).emit('model_chunk', { model: target, chunk });
        }
      );

      // Emit complete response
      io.to(roomId).emit('model_response', {
        model: target,
        text: fullResponse,
        timestamp: new Date().toISOString()
      });

      // Append AI response to history
      const displayName = { claude: 'Claude', gpt4: 'GPT-4', gemini: 'Gemini', mistral: 'Mistral' }[target];
      appendToHistory(roomId, displayName, fullResponse, `model: ${target}`);
    } catch (err) {
      console.error(`[model:${target}] error:`, err.message);
      io.to(roomId).emit('model_error', { model: target, error: err.message });
    }
  }
}

function getEnabledModels(roomId) {
  // @everyone targets all models that currently have a key configured.
  // models_enabled in settings.json can explicitly exclude a model even if it has a key.
  const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    : {};
  const explicitlyDisabled = settings.models_disabled || [];
  return Object.keys(MODEL_MAP).filter(
    (m) => MODEL_MAP[m].isConfigured() && !explicitlyDisabled.includes(m)
  );
}

module.exports = { handleMessage, parseMention };
