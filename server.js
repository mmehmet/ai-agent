require('dotenv').config()

const { handleChat } = require('./modules/chat')
const { handleResearch } = require('./modules/researcher')
const { initDiscord } = require('./modules/discord')
const { initMemory, addTurn, getContext } = require('./modules/memory')
const { initSlack } = require('./modules/slack')
const { Ollama } = require('ollama')

const ollama = new Ollama()

const queue = []
let isProcessing = false

const processQueue = async () => {
  if (isProcessing || queue.length === 0) return

  isProcessing = true
  const { task, resolve, reject } = queue.shift()
  try {
    const result = await task()
    resolve(result)
  } catch (err) {
    reject(err)
  } finally {
    isProcessing = false
    await processQueue() // Keep the line moving
  }
}

function enqueueTask(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject })
    processQueue().then()
  })
}

// Centralized Routing Logic
async function routeRequest(text, say=null) {
  console.debug(text)
  return await enqueueTask(async () => {
    const context = getContext()
    const classifier = await ollama.chat({
      model: 'research-intent',
      messages: [...context, { role: 'user', content: text }]
    })

    const raw = classifier.message.content.trim().toUpperCase().replace(/[^A-Z]/g, '')
    const intent = (raw === "RESEARCH") ? raw : "CHAT"
    console.debug("row", raw, "intent", intent)

    let reply
    if (intent === 'RESEARCH') {
      if (say) await say("looking into it...")
      reply = await handleResearch(text, context)
    } else {
      reply = await handleChat(text, context)
    }
    
    if (reply !== null) {
      addTurn(text, reply, ollama).then()
    }

    return reply
  })
}

// Start Everything
;(async () => {
  await initMemory()
  await initSlack(routeRequest)
  await initDiscord(routeRequest)
})()
