/**
 * Lightweight token estimator — ~4 chars per token (GPT/Claude approximation).
 * Structured so an exact tokenizer (tiktoken, etc.) can be swapped in later.
 */
const CHARS_PER_TOKEN = 4;
const ROLE_OVERHEAD   = 4; // per-message overhead for role + formatting

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessageTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + ROLE_OVERHEAD, 0);
}

module.exports = { estimateTokens, estimateMessageTokens };
