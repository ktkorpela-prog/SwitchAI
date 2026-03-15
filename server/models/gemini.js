const { GoogleGenerativeAI } = require('@google/generative-ai');
const keystore = require('../keystore');

function isConfigured() {
  return !!keystore.getKey('gemini');
}

async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const client = new GoogleGenerativeAI(keystore.getKey('gemini'));
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  const model = client.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const lastMessage = messages[messages.length - 1];

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage.content);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) onChunk(text);
  }
}

module.exports = { call, isConfigured };
