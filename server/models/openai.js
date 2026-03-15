const OpenAI = require('openai');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('gpt4');
}

async function call(messages, systemPrompt, frictionLevel, onChunk, signal) {
  const client = new OpenAI({ apiKey: keystore.getKey('gpt4') });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: 'system', content: systemPrompt }, ...messages]
  });

  let tokens = 0;
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    if (chunk.usage) tokens = chunk.usage.total_tokens;
    const text = chunk.choices[0]?.delta?.content;
    if (text) onChunk(text);
  }

  return { tokens };
}

module.exports = { call, isConfigured };
