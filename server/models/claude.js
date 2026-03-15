const Anthropic = require('@anthropic-ai/sdk');
const keystore  = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('claude');
}

async function call(messages, systemPrompt, frictionLevel, onChunk, signal, maxTokens) {
  const client = new Anthropic({ apiKey: keystore.getKey('claude') });
  const model  = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
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
    const final        = await stream.finalMessage();
    const inputTokens  = final.usage?.input_tokens  || 0;
    const outputTokens = final.usage?.output_tokens || 0;
    return { tokens: inputTokens + outputTokens, inputTokens, outputTokens };
  } catch {
    return { tokens: 0, inputTokens: 0, outputTokens: 0 };
  }
}

module.exports = { call, isConfigured };
