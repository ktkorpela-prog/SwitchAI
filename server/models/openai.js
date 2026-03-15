const OpenAI   = require('openai');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('gpt4');
}

async function call(messages, systemPrompt, frictionLevel, onChunk, signal, maxTokens) {
  const client = new OpenAI({ apiKey: keystore.getKey('gpt4') });
  const model  = process.env.OPENAI_MODEL || 'gpt-4o';

  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: 'system', content: systemPrompt }, ...messages]
  });

  let inputTokens = 0, outputTokens = 0;
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    if (chunk.usage) {
      inputTokens  = chunk.usage.prompt_tokens     || 0;
      outputTokens = chunk.usage.completion_tokens || 0;
    }
    const text = chunk.choices[0]?.delta?.content;
    if (text) onChunk(text);
  }

  return { tokens: inputTokens + outputTokens, inputTokens, outputTokens };
}

module.exports = { call, isConfigured };
