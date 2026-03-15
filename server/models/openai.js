const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Call GPT-4 with streaming.
 */
async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const stream = await getClient().chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) onChunk(text);
  }
}

module.exports = { call, isConfigured };
