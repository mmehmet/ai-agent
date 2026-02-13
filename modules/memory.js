const lancedb = require('@lancedb/lancedb')

const SESSION_WINDOW = 100
const DATABASE = 'data/memory_db'
const SEMANTIC = 'semantic'
const PROCEDURAL = 'procedural'
const NOMIC = 'nomic-embed-text'

const session = []
let db = null
let semantic = null
let procedural = null

const addTurn = (text, reply) => {
  session.push({ role: 'user', content: text })
  session.push({ role: 'assistant', content: reply })

  while (session.length > SESSION_WINDOW) {
    session.shift()
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
    semantic = await db.openTable(SEMANTIC)
    procedural = await db.openTable(PROCEDURAL)
    console.log('🧠 Memory online')
  } catch (err) {
    console.error('Failed to initialise memory:', err)
  }
}

const mine = () => {}

const upsert = () => {}

module.exports = { addTurn, initMemory, getContext, getEmbedding }