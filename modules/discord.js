const { Client, GatewayIntentBits } = require('discord.js')

let discordClient = null

/**
 * Splits long messages into chunks to respect Discord's character limit
 */
async function sendLongMessage(say, text) {
  const limit = 1900 // Leave buffer for safety
  
  if (text.length <= limit) {
    await say(text)
    return
  }

  const chunks = []
  let currentText = text

  while (currentText.length > 0) {
    if (currentText.length <= limit) {
      chunks.push(currentText)
      break
    }

    // Look for last newline before limit to keep formatting clean
    let splitIndex = currentText.lastIndexOf('\n', limit)
    if (splitIndex === -1) splitIndex = limit // No newline? Hard cut

    chunks.push(currentText.substring(0, splitIndex))
    currentText = currentText.substring(splitIndex).trim()
  }

  for (const chunk of chunks) {
    await say(chunk)
  }
}

/**
 * Initialize Discord client and set up message handling
 * @param {Function} routeRequest - Function to route messages through (text, say) => Promise<string>
 */
async function initDiscord(routeRequest) {
  if (!process.env.DISCORD_TOKEN) {
    console.log('⚠️  No Discord token provided, skipping Discord setup')
    return null
  }

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  })

  discordClient.on('messageCreate', async (msg) => {
    if (msg.author.bot) return
    if (!msg.mentions.has(discordClient.user)) return

    const cleanContent = msg.content.replace(/<@!?\d+>/g, '').trim()
    const say = async (text) => await msg.channel.send(text)

    try {
      const reply = await routeRequest(cleanContent, say)
      await sendLongMessage(say, reply)
    } catch (err) {
      console.error('Discord Error:', err)
      await msg.channel.send('Sorry, something went wrong processing that.')
    }
  })

  await discordClient.login(process.env.DISCORD_TOKEN)
  console.log('🤖 Discord Online')
  
  return discordClient
}

module.exports = { initDiscord }
