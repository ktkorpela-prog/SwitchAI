const Anthropic = require('@anthropic-ai/sdk');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('claude');
}

async function call(messages, systemPrompt, frictionLevel, onChunk, signal) {
  const client = new Anthropic({ apiKey: keystore.getKey('claude') });
  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages
  });

  for await (const chunk of stream) {
    if (signal?.aborted) break;
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      onChunk(chunk.delta.text);
    }
  }

  try {
    const final = await stream.finalMessage();
    const tokens = (final.usage?.input_tokens || 0) + (final.usage?.output_tokens || 0);
    return { tokens };
  } catch {
    return { tokens: 0 };
  }
}

module.exports = { call, isConfigured };
