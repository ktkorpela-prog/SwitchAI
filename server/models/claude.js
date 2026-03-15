const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Call Claude with streaming.
 * @param {Array}    messages     - Array of { role, content } objects
 * @param {string}   systemPrompt - System prompt (context.md + friction modifier)
 * @param {number}   frictionLevel - 0-10 (already baked into systemPrompt)
 * @param {Function} onChunk      - Called with each streamed text chunk
 */
async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

  const stream = await getClient().messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      onChunk(chunk.delta.text);
    }
  }
}

module.exports = { call, isConfigured };
