require('dotenv').config()

const lancedb = require('@lancedb/lancedb')
const { handleChat } = require('./modules/chat')
const { handleResearch } = require('./modules/researcher')
const { initDiscord } = require('./modules/discord')
const { initSlack } = require('./modules/slack')
const { Ollama } = require('ollama')

const ollama = new Ollama()

// RAG memory
let db
let table
let isProcessing = false
const queue = []
const session = []
const SESSION_WINDOW = 100

;(async () => {
  try {
    db = await lancedb.connect('data/memory_db')
    table = await db.openTable('chat_history')
    console.log('🗄️ Database Connected once and ready.')
  } catch (err) {
    console.error("Failed to initialise database:", err)
  }
})()




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
    const context = session.slice(-6)
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
      session.push({ role: 'user', content: text })
      session.push({ role: 'assistant', content: reply })
      while (session.length > SESSION_WINDOW) {
        session.shift()
      }
    }

    // TODO: update the vector table
    // await table.add([{ 
    //   text: `User: ${text}\nAssistant: ${reply}`
    // }])

    return reply
  })
}






// Start Everything
;(async () => {
  await initSlack(routeRequest)
  
  await initDiscord(routeRequest)
})()
