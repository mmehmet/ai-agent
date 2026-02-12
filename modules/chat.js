const { Ollama } = require('ollama')
const fs = require('fs')
const path = require('path')

const ollama = new Ollama()

const butlerPrompt = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'butler.txt'), 'utf8')

async function handleChat(prompt, context) {
  const response = await ollama.chat({
    model: 'gemma2:2b',
    messages: [
      { role: 'system', content: butlerPrompt },
      { role: 'system', content: `Historical Context:\n${context}` },
      { role: 'user', content: prompt }
    ]
  })

  return response.message.content
}

module.exports = { handleChat }
