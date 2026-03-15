/**
 * keystore.js — local API key management
 *
 * Keys are stored in keys.local.json (gitignored, server-side only).
 * .env values are used as fallback if no local key is set.
 * Changes take effect immediately — no restart required.
 */
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '../keys.local.json');

const ENV_MAP = {
  claude:  'ANTHROPIC_API_KEY',
  gpt4:    'OPENAI_API_KEY',
  gemini:  'GOOGLE_GEMINI_API_KEY',
  mistral: 'MISTRAL_API_KEY'
};

function loadFile() {
  try {
    return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveFile(keys) {
  fs.writeFileSync(KEY_FILE, JSON.stringify(keys, null, 2));
}

/** Get the active API key for a model (local file takes precedence over .env) */
function getKey(model) {
  const local = loadFile();
  return local[model] || process.env[ENV_MAP[model]] || '';
}

/** Save a key to the local file. Pass empty string to remove. */
function setKey(model, apiKey) {
  const keys = loadFile();
  if (apiKey) {
    keys[model] = apiKey;
  } else {
    delete keys[model];
  }
  saveFile(keys);
}

/** Returns which models have a key configured (without revealing the keys) */
function getStatus() {
  return Object.fromEntries(
    Object.keys(ENV_MAP).map((model) => [model, !!getKey(model)])
  );
}

module.exports = { getKey, setKey, getStatus };
