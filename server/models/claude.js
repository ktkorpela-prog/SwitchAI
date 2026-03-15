const Anthropic = require('@anthropic-ai/sdk');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('claude');
}

async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const client = new Anthropic({ apiKey: keystore.getKey('claude') });
  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

  const stream = await client.messages.stream({
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
