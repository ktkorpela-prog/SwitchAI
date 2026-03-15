const { GoogleGenerativeAI } = require('@google/generative-ai');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('gemini');
}

async function call(messages, systemPrompt, frictionLevel, onChunk, signal, maxTokens) {
  const client    = new GoogleGenerativeAI(keystore.getKey('gemini'));
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  const model     = client.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens }
  });

  const history     = messages.slice(0, -1).map((m) => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const lastMessage = messages[messages.length - 1];

  const chat   = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage.content);

  for await (const chunk of result.stream) {
    if (signal?.aborted) break;
    const text = chunk.text();
    if (text) onChunk(text);
  }

  try {
    const response     = await result.response;
    const meta         = response.usageMetadata || {};
    const inputTokens  = meta.promptTokenCount      || 0;
    const outputTokens = meta.candidatesTokenCount   || 0;
    return { tokens: inputTokens + outputTokens, inputTokens, outputTokens };
  } catch {
    return { tokens: 0, inputTokens: 0, outputTokens: 0 };
  }
}

module.exports = { call, isConfigured };
