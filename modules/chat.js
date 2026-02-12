const { Ollama } = require('ollama')

const ollama = new Ollama()

async function handleChat(prompt, context) {
  const response = await ollama.chat({
    model: 'butler-chat',
    messages: [
      { role: 'system', content: `Historical Context:\n${context}` },
      { role: 'user', content: prompt }
    ]
  })

  return response.message.content
}

module.exports = { handleChat }
