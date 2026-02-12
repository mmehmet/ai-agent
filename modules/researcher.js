const { Ollama } = require('ollama')
const fs = require('fs')
const path = require('path')
const ollama = new Ollama()

// Helper to load the geek prompt
const geekPrompt = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'geek.txt'), 'utf8')

async function handleResearch(prompt, context) {
  console.log("Mistral 7B is deep-diving...")
  
  const response = await ollama.chat({
    model: 'mistral:7b',
    messages: [
      { role: 'system', content: geekPrompt },
      { role: 'system', content: `Context from previous conversations:\n${context}` },
      { role: 'user', content: `Provide a comprehensive report on: ${prompt}` }
    ]
  })

  return `*Research Report:* \n\n ${response.message.content}`
}

module.exports = { handleResearch }
