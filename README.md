# AI Agent

Multi-platform AI agent with Slack and Discord integration, featuring intelligent routing between chat and research modes.

## Features

- **Multi-platform support**: Slack and Discord
- **Intelligent routing**: Automatically routes requests to either chat or research mode
- **RAG memory**: Uses LanceDB for conversation history
- **Queue-based processing**: Serialized message handling to prevent race conditions

## Prerequisites

- Node.js (v16 or higher)
- **Ollama** running locally with these named models:
    - `research-intent`: The classifier that decides if a message is CHAT or RESEARCH
    - `butler-chat`: The primary chat personality (used by chat.js)
    - `geek-research`: The deep-dive research model (used by researcher.js)
    - `memory-miner`: The model that extracts insights for LanceDB (used by memory.js)
    - `nomic-embed-text`: Used for semantic vector embeddings

## Setup

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file with:
   ```
   # Slack
   SLACK_BOT_TOKEN=xoxb-your-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token

   # Discord (optional)
   DISCORD_TOKEN=your-discord-token
   ```

3. **Setup local models**:
  ```
  ollama create research-intent -f ./ollama/Modelfile.router
  ollama create butler-chat -f ./ollama/Modelfile.chat
  ollama create geek-research -f ./ollama/Modelfile.researcher
  ollama create memory-miner -f ./ollama/Modelfile.memory
  ```

4. **Initialize the databases**:
   The LanceDB databases will be created automatically in `data/` on first run.

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
├── data/                       # LanceDB storage (gitignored)
├── modules/
│   ├── chat.js                 # Chat handler (butler-chat)
│   ├── researcher.js           # Research handler (geek-research)
│   ├── memory.js               # LanceDB & insight extraction (memory-miner)
│   ├── discord.js              # Discord integration
│   └── slack.js                # Slack integration
├── ollama/
│   ├── Modelfile.chat          # Chat personality model
│   └── Modelfile.geek          # Researcher model
│   └── Modelfile.intent        # Intent classification model
│   └── Modelfile.knowledge     # Long Term Memory model
├── server.js                   # Main server file
└── .env                        # Environment variables (gitignored)
```

## Internal Commands

The agent intercepts specific keywords at the start of a message to perform system tasks:

- `!sleep`: Manually triggers the memory "mining" process, consolidating the current conversation buffer into the long-term LanceDB knowledge base.

## Modules

- **chat.js**: Handles casual conversation using the `butler-chat` model
- **researcher.js**: Deep-dives into topics using the `geek-research` model
- **memory.js**: Manages LanceDB storage and uses `memory-miner` for insight extraction
- **discord.js / slack.js**: Platform-specific bot setup and message handling

## How It Works

1. Messages arrive via Slack or Discord
2. System checks if the message starts with a `!` command directive (see above) - if so, it attempts to execute that command
2. Otherwise, it classifies intent (CHAT vs RESEARCH)
3. Request is queued and processed serially
4. Response is generated using appropriate handler
5. Conversation is saved to LanceDB for context

## Contributing

Make changes, test locally, then:
```bash
git add .
git commit -m "Description of changes"
git push
```

## License

MIT
