require('dotenv').config()
const { Ollama } = require('ollama')
const lancedb = require('@lancedb/lancedb')

const ollama = new Ollama()
const { Client, GatewayIntentBits } = require('discord.js')  // Discord Library
const { App } = require('@slack/bolt')                       // Slack Library

// --- SLACK SETUP ---
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
})

// --- DISCORD SETUP ---
const discordClient = new Client({ 
  intents: [
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.Guilds
  ] 
})

// --- THE SHARED BRAIN ---
async function askAI(prompt) {
  const db = await lancedb.connect('data/memory_db')
  const table = await db.openTable('chat_history')

  // 1. Fetch the last 10 things said (the "Context")
  const recentMessages = await table.query()
    .limit(10)
    .toArray()

  // 2. Format those memories for Llama
  const contextStrings = recentMessages.map(m => m.text).join("\n")

  // 3. Send the Prompt + The Memories to Llama
  const response = await ollama.chat({
    model: 'llama3.2:1b',
    messages: [
      { 
        role: 'system', 
        content: `You are a helpful Slack bot. Here is what you remember so far:\n${contextStrings}` 
      },
      { role: 'user', content: prompt }
    ]
  })

  const aiReply = response.message.content

  // 4. Save the NEW interaction so you don't forget it later
  await table.add([{ 
    text: `User: ${prompt} | Assistant: ${aiReply}`, 
    vector: Array(384).fill(0) 
  }])

  return aiReply
}

// --- LISTENERS ---
slackApp.use(async ({ event, client, logger, next }) => {
  console.log("EVENT RECEIVED:", event.type)
  await next()
})

slackApp.message(async ({ message, say }) => {
  console.log(`MAC MINI RECEIVED: ${message.text}`)
  const reply = await askAI(message.text)
  await say(reply)
})

discordClient.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.mentions.has(discordClient.user)) return
  const reply = await askAI(msg.content)
  msg.reply(reply)
})

// --- START EVERYTHING ---
;(async () => {
  await slackApp.start()
  console.log('⚡️ Slack head is online')

  if (process.env.DISCORD_TOKEN) {
    await discordClient.login(process.env.DISCORD_TOKEN)
    console.log('🤖 Discord head is online')
  } else {
    console.log('⚠️ No Discord token found, skipping Discord head...')
  }
})()
