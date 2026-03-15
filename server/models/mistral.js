const { Mistral } = require('@mistralai/mistralai');
const keystore    = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('mistral');
}

async function call(messages, systemPrompt, frictionLevel, onChunk, signal, maxTokens) {
  const client = new Mistral({ apiKey: keystore.getKey('mistral') });
  const model  = process.env.MISTRAL_MODEL || 'mistral-large-latest';

  const stream = await client.chat.stream({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: systemPrompt }, ...messages]
  });

  let inputTokens = 0, outputTokens = 0;
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    if (chunk.data?.usage) {
      inputTokens  = chunk.data.usage.prompt_tokens     || 0;
      outputTokens = chunk.data.usage.completion_tokens || 0;
    }
    const text = chunk.data?.choices[0]?.delta?.content;
    if (text) onChunk(text);
  }

  return { tokens: inputTokens + outputTokens, inputTokens, outputTokens };
}

module.exports = { call, isConfigured };
