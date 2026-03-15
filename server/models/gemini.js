const { GoogleGenerativeAI } = require('@google/generative-ai');

let client = null;

function getClient() {
  if (!client) client = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  return client;
}

function isConfigured() {
  return !!process.env.GOOGLE_GEMINI_API_KEY;
}

/**
 * Call Gemini with streaming.
 * Note: Gemini uses a different message format — history is mapped accordingly.
 */
async function call(messages, systemPrompt, frictionLevel, onChunk) {
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  const model = getClient().getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt
  });

  // Gemini expects { role: 'user'|'model', parts: [{ text }] }
  // Last message is the new user prompt; the rest are history
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
