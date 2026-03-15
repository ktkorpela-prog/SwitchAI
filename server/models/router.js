const fs = require('fs');
const path = require('path');
const claude = require('./claude');
const openai = require('./openai');
const gemini = require('./gemini');
const mistral = require('./mistral');

const ROOMS_DIR = path.join(__dirname, '../rooms');

const MODEL_MAP = {
  claude: claude,
  gpt4: openai,
  gemini: gemini,
  mistral: mistral
};

const MENTION_PATTERN = /^@(claude|gpt4|gemini|mistral|everyone)\b/i;

// Active stream controllers keyed by `${roomId}:${model}`
const activeStreams = new Map();

function parseMention(text) {
  const match = text.trim().match(MENTION_PATTERN);
  if (!match) return { model: null, text };
  return {
    model: match[1].toLowerCase(),
    text: text.trim().slice(match[0].length).trim()
  };
}

function buildSystemPrompt(roomId, modelName, frictionLevel) {
  const contextPath = path.join(ROOMS_DIR, roomId, 'context.md');
  const context = fs.existsSync(contextPath)
    ? fs.readFileSync(contextPath, 'utf8')
    : '';
  return `${context}\n\n---\n${getFrictionModifier(frictionLevel)}`;
}

function getHistoryMessages(roomId) {
  const historyPath = path.join(ROOMS_DIR, roomId, 'history.md');
  if (!fs.existsSync(historyPath)) return [];

  const raw = fs.readFileSync(historyPath, 'utf8');
  const limit = parseInt(process.env.HISTORY_CONTEXT_LINES || '50', 10);
  const blocks = raw.split(/\n(?=## )/).filter(Boolean);
  const recent = blocks.slice(-limit);

  return recent.map((block) => {
    const firstLine = block.split('\n')[0];
    const isAI = /\|\s*(Claude|GPT-4|Gemini|Mistral)/i.test(firstLine);
    const content = block.split('\n').slice(1).join('\n').trim();
    return { role: isAI ? 'assistant' : 'user', content: content || block };
  });
}

function appendToHistory(roomId, author, content, meta = '') {
  const historyPath = path.join(ROOMS_DIR, roomId, 'history.md');
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const metaLine = meta ? `> ${meta}\n\n` : '';
  const entry = `\n## ${timestamp} | ${author}\n${metaLine}${content}\n`;
  fs.appendFileSync(historyPath, entry);
}

function getFrictionLevel(roomId, modelName) {
  const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
  if (!fs.existsSync(settingsPath)) return 5;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  return settings.friction?.[modelName] ?? 5;
}

function getFrictionModifier(level) {
  if (level <= 1) return "Be warm, encouraging, and focus on strengths. Support the user's ideas.";
  if (level <= 3) return 'Be kind and balanced. Offer honest feedback gently, with alternatives where helpful.';
  if (level <= 6) return 'Be direct and balanced. Answer questions honestly without bias.';
  if (level <= 8) return 'Note assumptions, ask clarifying questions, and offer alternative perspectives.';
  return "Challenge all assumptions. Point out flaws. Do not simply agree with the user. Play devil's advocate constructively.";
}

/** Stop an active stream for a model in a room */
function stopModel(roomId, model) {
  const key = `${roomId}:${model}`;
  const controller = activeStreams.get(key);
  if (controller) {
    controller.abort();
    activeStreams.delete(key);
  }
}

async function handleMessage(payload, io) {
  const { roomId, username, text } = payload;

  appendToHistory(roomId, username, text);

  const { model, text: cleanText } = parseMention(text);
  if (!model) return;

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
    const systemPrompt = buildSystemPrompt(roomId, target, frictionLevel);
    const history = getHistoryMessages(roomId);

    const controller = new AbortController();
    const streamKey = `${roomId}:${target}`;
    activeStreams.set(streamKey, controller);

    try {
      let fullResponse = '';

      const result = await module.call(
        [...history, { role: 'user', content: cleanText }],
        systemPrompt,
        frictionLevel,
        (chunk) => {
          fullResponse += chunk;
          io.to(roomId).emit('model_chunk', { model: target, chunk });
        },
        controller.signal
      );

      const tokens = result?.tokens || 0;
      const interrupted = controller.signal.aborted;

      io.to(roomId).emit('model_response', {
        model: target,
        text: fullResponse,
        tokens,
        interrupted,
        timestamp: new Date().toISOString()
      });

      if (fullResponse) {
        const displayName = { claude: 'Claude', gpt4: 'GPT-4', gemini: 'Gemini', mistral: 'Mistral' }[target];
        const meta = `model: ${target} | tokens: ${tokens}${interrupted ? ' | interrupted' : ''}`;
        appendToHistory(roomId, displayName, fullResponse, meta);
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
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    : {};
  const explicitlyDisabled = settings.models_disabled || [];
  return Object.keys(MODEL_MAP).filter(
    (m) => MODEL_MAP[m].isConfigured() && !explicitlyDisabled.includes(m)
  );
}

module.exports = { handleMessage, parseMention, stopModel };
