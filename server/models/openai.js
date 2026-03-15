const OpenAI = require('openai');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('gpt4');
}

async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const client = new OpenAI({ apiKey: keystore.getKey('gpt4') });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: 'system', content: systemPrompt }, ...messages]
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) onChunk(text);
  }
}

module.exports = { call, isConfigured };
