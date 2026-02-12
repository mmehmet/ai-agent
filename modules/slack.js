const { App } = require('@slack/bolt')

let slackApp = null
const processed = new Set()

/**
 * Handle Slack requests (mentions and DMs)
 */
const handleSlackRequest = async ({ event, say, body, ack }, routeRequest) => {
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

/**
 * Initialize Slack app and set up event handlers
 * @param {Function} routeRequest - Function to route messages through (text, say) => Promise<string>
 */
async function initSlack(routeRequest) {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    console.log('⚠️  Missing Slack configuration, skipping Slack setup')
    return null
  }

  slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
  })

  // Retry bouncer middleware
  slackApp.use(async ({ body, next }) => {
    if (body && body.headers && body.headers['X-Slack-Retry-Num']) {
      console.log(`[SLACK] Dropping retry attempt: ${body.headers['X-Slack-Retry-Num']}`)
      return
    }
    await next()
  })

  // App mentions
  slackApp.event('app_mention', async (args) => {
    await handleSlackRequest(args, routeRequest)
  })

  // Direct messages
  slackApp.message(async (args) => {
    // Skip if this is a mention (app_mention handler will get it)
    if (args.message.text?.includes(`<@${slackApp.client.auth.test().user_id}>`)) {
      return
    }

    // Only respond if it's a DM (Instant Message) AND not a mention (mentions are handled separately)
    if (args.message.channel_type === 'im' && args.message.subtype !== 'bot_message') {
      await handleSlackRequest({ ...args, event: args.message }, routeRequest)
    }
  })

  await slackApp.start()
  console.log('⚡️ Slack Online')
  
  return slackApp
}

module.exports = { initSlack }