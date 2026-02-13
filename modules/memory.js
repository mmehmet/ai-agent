const lancedb = require('@lancedb/lancedb')

const SESSION_WINDOW = 100
const TRIGGER = 15
const DATABASE = 'data/memory_db'
const SEMANTIC = 'semantic'
const PROCEDURAL = 'procedural'
const NOMIC = 'nomic-embed-text'

const session = []
const buffer = []
let db = null
let semantic = null
let procedural = null

const addTurn = async (text, reply, ollama ) => {
  session.push({ role: 'user', content: text })
  session.push({ role: 'assistant', content: reply })
  while (session.length > SESSION_WINDOW) {
    session.shift()
  }
  
  buffer.push({ text: text, reply: reply })
  if (buffer.length > TRIGGER) {
    await mine(ollama)
  }
}

const consolidate = () => {}

const getContext = () => {
  return session.slice(-6)
}

const getEmbedding = async (text, ollama) => {
  const response = await ollama.embed({ model: NOMIC, input: text })
  return response.embeddings[0]
}

const initMemory = async () => {
  try {
    db = await lancedb.connect(DATABASE)
    const tables = await db.tableNames()

    const setupTable = async (tableName) => {
      if (!tables.includes(tableName)) {
        console.log(`Creating table: ${tableName}`)
        return await db.createTable(tableName, [{
          text: 'seed',
          vector: Array(768).fill(0),
          metadata: {
            updated_at: new Date().toISOString(),
            confidence: 1.0,
            frequency: 1,
            scope: null
          }
        }])
      }
      return await db.openTable(tableName)
    }

    semantic = await setupTable(SEMANTIC)
    procedural = await setupTable(PROCEDURAL)

    console.log('🧠 Memory online')
  } catch (err) {
    console.error('☠️ Failed to initialise memory:', err)
  }
}

const mine = async (ollama) => {
  console.log(`🧹 ${TRIGGER} turns - mining short term memory...`)
  // TODO: pass things into a model
  buffer.splice(0)
}

const upsert = () => {}

module.exports = { addTurn, initMemory, getContext, getEmbedding }