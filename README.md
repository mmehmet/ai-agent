# AI Agent

Multi-platform AI agent with Slack and Discord integration, featuring intelligent routing between chat and research modes.

## Features

- **Multi-platform support**: Slack and Discord
- **Intelligent routing**: Automatically routes requests to either chat or research mode
- **RAG memory**: Uses LanceDB for conversation history
- **Queue-based processing**: Serialized message handling to prevent race conditions

## Prerequisites

- Node.js (v16 or higher)
- Ollama running locally with required models:
  - `llama3.2:3b` (for routing)
  - `gemma2:2b` (for chat)
  - Model for research (check `modules/researcher.js`)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file with:
   ```bash
   # Slack
   SLACK_BOT_TOKEN=xoxb-your-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token

   # Discord (optional)
   DISCORD_TOKEN=your-discord-token
   ```

3. **Initialize the database**:
   The LanceDB database will be created automatically in `data/memory_db` on first run.

## Running the Server

### Development
```bash
node server.js
```

### Production with PM2
```bash
# Start the server
pm2 start server.js

# Restart after making changes
pm2 restart server

# Stop the server
pm2 stop server

# View logs
pm2 logs server

# Check status
pm2 status
```

## Project Structure

```
ai-agent/
├── modules/
│   ├── chat.js         # Chat handler using Gemma2
│   ├── discord.js      # Discord integration
│   └── researcher.js   # Research mode handler
├── prompts/
│   ├── butler.txt      # Chat personality prompt
│   └── router.txt      # Intent classification prompt
├── data/               # LanceDB storage (gitignored)
├── server.js           # Main server file
└── .env                # Environment variables (gitignored)
```

## How It Works

1. Messages arrive via Slack or Discord
2. Router classifies intent (CHAT vs RESEARCH)
3. Request is queued and processed serially
4. Response is generated using appropriate handler
5. Conversation is saved to LanceDB for context

## Modules

- **chat.js**: Handles casual conversation using Gemma2
- **researcher.js**: Handles research requests (implementation varies)
- **discord.js**: Discord bot setup and message handling

## Contributing

Make changes, test locally, then:
```bash
git add .
git commit -m "Description of changes"
git push
```

## License

MIT
