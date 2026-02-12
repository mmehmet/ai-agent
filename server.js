require('dotenv').config()

const fs = require('fs')
const path = require('path')
const lancedb = require('@lancedb/lancedb')
const { App } = require('@slack/bolt')
const { Client, GatewayIntentBits } = require('discord.js')
const { handleChat } = require('./modules/chat')
const { handleResearch } = require('./modules/researcher')
const { Ollama } = require('ollama')

const ollama = new Ollama()

const loadPrompt = (name) => fs.readFileSync(path.join(__dirname, 'prompts', `${name}.txt`), 'utf8')

const processed = new Set()

// RAG memory
let db
let table
;(async () => {
  try {
    db = await lancedb.connect('data/memory_db')
    table = await db.openTable('chat_history')
    console.log('🗄️ Database Connected once and ready.')

    await slackApp.start()
    console.log('⚡️ Slack Online')

    if (process.env.DISCORD_TOKEN) {
      await discordClient.login(process.env.DISCORD_TOKEN)
      console.log('🤖 Discord Online')
    }
  } catch (err) {
    console.error("Failed to start server:", err)
  }
})()




async function sendLongMessage(say, text) {
  const limit = 1900; // Leave some buffer for safety
  if (text.length <= limit) {
    await say(text);
    return;
  }

  const chunks = [];
  let currentText = text;

  while (currentText.length > 0) {
    if (currentText.length <= limit) {
      chunks.push(currentText);
      break;
    }

    // Look for the last newline before the limit to keep formatting clean
    let splitIndex = currentText.lastIndexOf('\n', limit);
    if (splitIndex === -1) splitIndex = limit; // No newline? Just hard cut.

    chunks.push(currentText.substring(0, splitIndex));
    currentText = currentText.substring(splitIndex).trim();
  }

  for (const chunk of chunks) {
    await say(chunk);
  }
}




// --- SERIALIZATION ENGINE ---
let isProcessing = false
const queue = []

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
    processQueue() // Keep the line moving
  }
}

function enqueueTask(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject })
    processQueue()
  })
}

// --- SLACK SETUP ---
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signing_secret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
})

// --- RETRY BOUNCER ---
slackApp.use(async ({ body, next }) => {
  if (body && body.headers && body.headers['X-Slack-Retry-Num']) {
    console.log(`[SLACK] Dropping retry attempt: ${body.headers['X-Slack-Retry-Num']}`)
    return
  }
  await next()
})

// --- DISCORD SETUP ---
const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
})







// Centralized Routing Logic
async function routeRequest(text, say=null) {
  console.debug(text)
  return await enqueueTask(async () => {
    const classifier = await ollama.chat({
      model: 'llama3.2:3b',
      messages: [
        { role: 'system', content: fs.readFileSync('./prompts/router.txt', 'utf8') },
        { role: 'user', content: text }
      ],
      options: { temperature: 0 }
    })

    const raw = classifier.message.content.trim().toUpperCase().replace(/[^A-Z]/g, '')
    const intent = (raw === "RESEARCH") ? raw : "CHAT"
    console.debug("row", raw, "intent", intent)

    // history (Ideally use vector search here, but let's just get it working)
    const history = await table.query().limit(10).toArray()
    const context = history.map(h => h.text).join('\n')

    let reply
    if (intent === 'RESEARCH') {
      if (say) await say("looking into it...")
      reply = await handleResearch(text, context)
    } else {
      reply = await handleChat(text, context)
    }

    // We save both the user's prompt and the reply so the context makes sense later
    await table.add([{ 
      text: `User: ${text}\nAssistant: ${reply}`
    }])

    return reply
  })
}









// Slack Listener
const handleSlackRequest = async ({ event, say, body, ack }) => {
  if (ack) await ack()


  const messageId = event?.client_msg_id || event?.ts
  if (!messageId || processed.has(messageId)) return

  if (!event?.text) return

  const retryNum = body?.headers?.['x-slack-retry-num'] || body?.headers?.['X-Slack-Retry-Num']
  if (retryNum) {
    console.log(`[SLACK] Ignoring retry attempt #${retryNum}`)
    return
  }
  
  processed.add(messageId)
  setTimeout(() => processed.delete(messageId), 30000)
  const cleanText = event.text.replace(/<@.*?>/g, '').trim()

  try {
    const reply = await routeRequest(cleanText, say)
    await say(reply)
  } catch (err) {
    console.error('Slack Error:', err)
  }
}

slackApp.event('app_mention', async (args) => {
  await handleSlackRequest(args)
})

// For Direct Messages
slackApp.message(async (args) => {
  // Only respond if it's a DM (Instant Message)
  if (args.message.channel_type === 'im') {
    // We map 'message' to 'event' so handleSlackRequest stays happy
    await handleSlackRequest({ ...args, event: args.message })
  }
})








// Discord Listener
discordClient.on('messageCreate', async (msg) => {
  if (msg.author.bot) return

  if (!msg.mentions.has(discordClient.user)) return

  const cleanContent = msg.content.replace(/<@!?\d+>/g, '').trim()

  // This function is what routeRequest will use to send "Please wait..."
  const say = async (text) => await msg.channel.send(text)

  const reply = await routeRequest(cleanContent, say)
  
  await sendLongMessage(say, reply)
})




// Start Everything
;(async () => {
  await slackApp.start()
  console.log('⚡️ Slack Head Online')
  
  if (process.env.DISCORD_TOKEN) {
    await discordClient.login(process.env.DISCORD_TOKEN)
    console.log('🤖 Discord Head Online')
  }
})()
