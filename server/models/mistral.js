const { Mistral } = require('@mistralai/mistralai');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('mistral');
}

async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const client = new Mistral({ apiKey: keystore.getKey('mistral') });
  const model = process.env.MISTRAL_MODEL || 'mistral-large-latest';

  const stream = await client.chat.stream({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages]
  });

  for await (const chunk of stream) {
    const text = chunk.data?.choices[0]?.delta?.content;
    if (text) onChunk(text);
  }
}

module.exports = { call, isConfigured };
