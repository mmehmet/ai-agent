const lancedb = require('@lancedb/lancedb')

const SESSION_WINDOW = 10
const TRIGGER = 15
const DATABASE = 'data/memory_db'
const SEMANTIC = 'semantic'
const PROCEDURAL = 'procedural'
const NOMIC = 'nomic-embed-text'

const session = []
const buffer = []
let db = null
const TABLES = { semantic: null, procedural: null }

const addTurn = async (text, reply, ollama ) => {
  session.push({ role: 'user', content: text })
  session.push({ role: 'assistant', content: reply })
  while (session.length > SESSION_WINDOW) {
    session.shift()
  }
  
  buffer.push({ text, reply, when: Date.now })
  if (buffer.length > TRIGGER) {
    await mine(ollama)
  }
}

const consolidate = () => {}

const getConfidence = (logprobs) => {
  if (!logprobs || logprobs.length === 0) return 0

  const structuralChars = /^[{}[]":,\s\n\\]+$/
  
  // Filter for content-bearing tokens only
  const relevantTokens = logprobs.filter(lp => !structuralChars.test(lp.token))
  if (relevantTokens.length === 0) return 0

  let totalCertainty = 0

  for (const lp of relevantTokens) {
    // Math.exp(logprob) of the chosen token
    const topProb = Math.exp(lp.logprob)
    
    // Check competition: if there are other high-probability candidates, 
    // the model is 'confused', even if it picked one.
    const others = lp.top_logprobs || []
    const margin = others.length > 1 
      ? topProb - Math.exp(others[1].logprob) 
      : topProb

    // Certainty is a factor of the chosen prob and its lead over the runner-up
    totalCertainty += (topProb * margin)
  }

  return totalCertainty / relevantTokens.length
}

const getContext = () => {
  return session
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
            scope: "global"
          }
        }])
      }
      return await db.openTable(tableName)
    }

    TABLES.semantic = await setupTable(SEMANTIC)
    TABLES.procedural = await setupTable(PROCEDURAL)

    console.log('🧠 Memory online')
  } catch (err) {
    console.error('☠️ Failed to initialise memory:', err)
  }
}

const mine = async (ollama) => {
  if (buffer.length === 0) return

  const transcript = buffer.map(t => `User: ${t.text}\nAssistant: ${t.reply}`).join('\n\n')

  try {
    const response = await ollama.chat({
      model: 'memory-miner',
      messages: [{ role: 'user', content: transcript }],
      format: 'json',
      options: {
        logprobs: true,
        top_logprobs: 5
      }
    })

    const findings = JSON.parse(response.message.content)

    if (findings.length) {
      console.log(`✅ Mined ${findings.length} insights from buffer.`)
      const confidence = getConfidence(response.message.content_logprobs)
      await upsert(findings, confidence, ollama)
    }
  } catch (err) {
    console.error("❌ Extraction failed:", err)
  } finally {
    buffer.length = 0
  }
};

const upsert = async (findings, confidence, ollama) => {
  if (!findings || findings.length === 0) {
    return
  }

  for (const item of findings) {
    if (!item.type || !item.content) continue

    const tableName = item.type.toLowerCase()
    if (!TABLES[tableName]) continue

    const vector = await getEmbedding(item.content, ollama)
    const table = TABLES[tableName]

    // Search for a close match (using L2 distance, so lower is closer)
    const results = await table.search(vector).limit(1).toArray()
    const match = results[0]
    let frequency = 0
    let scope = ""
    if (tableName === PROCEDURAL) {
      scope = item.scope || "global"
    }

    // If it's a tight match (distance < 0.4 usually means it's the same topic)
    if (match && match._distance < 0.4) {
      console.debug(`🔄 Updating existing memory: "${item.content.substring(0, 30)}..."`)
      frequency = match.metadata.frequency
      
      // We delete the old one and add the new one to avoid dealing with 
      // finicky SQL-style update syntax on embedded objects
      await table.delete(`text = '${match.text.replace(/'/g, "''")}'`)
    }

    await table.add([{
      text: item.content,
      vector: vector,
      metadata: {
        updated_at: Date.now(),
        confidence: confidence,
        frequency: frequency + 1,
        scope: scope
      }
    }])
  }

  console.log(`🧠 Knowledge base updated with ${findings.length} findings`)
}

module.exports = { addTurn, initMemory, getContext, getEmbedding }