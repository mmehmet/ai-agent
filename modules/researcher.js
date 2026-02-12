const { Ollama } = require('ollama')

const ollama = new Ollama()

async function handleResearch(prompt, context) {
  console.log("Mistral 7B is deep-diving...")
  
  const response = await ollama.chat({
    model: 'geek-research',
    messages: [
      { role: 'system', content: `Context from previous conversations:\n${context}` },
      { role: 'user', content: `Provide a comprehensive report on: ${prompt}` }
    ]
  })

  return `*Research Report:* \n\n ${response.message.content}`
}

module.exports = { handleResearch }
