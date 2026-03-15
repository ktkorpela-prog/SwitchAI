const { Mistral } = require('@mistralai/mistralai');

let client = null;

function getClient() {
  if (!client) client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  return client;
}

function isConfigured() {
  return !!process.env.MISTRAL_API_KEY;
}

/**
 * Call Mistral with streaming.
 */
async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const model = process.env.MISTRAL_MODEL || 'mistral-large-latest';

  const stream = await getClient().chat.stream({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  });

  for await (const chunk of stream) {
    const text = chunk.data?.choices[0]?.delta?.content;
    if (text) onChunk(text);
  }
}

module.exports = { call, isConfigured };
