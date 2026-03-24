const db = require('../db/postgres')

/**
 * ChatbotSession Model — PostgreSQL query helpers
 * Table: chatbot_sessions (UUID PK, user_id, channel, whatsapp_number, messages JSONB, emergency_flagged, ...)
 */
const ChatbotSession = {
  /**
   * Find an existing session by UUID
   */
  findById: async (id) => {
    const { rows } = await db.query('SELECT * FROM chatbot_sessions WHERE id = $1', [id])
    return rows[0] || null
  },

  /**
   * Get the most recent open session for a user
   */
  getLatestByUser: async (userId) => {
    const { rows } = await db.query(
      `SELECT * FROM chatbot_sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    )
    return rows[0] || null
  },

  /**
   * Create a new session
   */
  create: async ({ id, userId, channel = 'in_app', whatsappNumber }) => {
    const { rows } = await db.query(
      `INSERT INTO chatbot_sessions (id, user_id, channel, whatsapp_number)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [id, userId || null, channel, whatsappNumber || null]
    )
    return rows[0]
  },

  /**
   * Append a message object to the session's messages JSONB array
   * message: { role: 'user'|'bot', text: string, intent?: string, timestamp: ISO }
   */
  appendMessage: async (sessionId, message) => {
    const { rows } = await db.query(
      `UPDATE chatbot_sessions
       SET messages    = messages || $2::jsonb,
           updated_at  = NOW()
       WHERE id = $1
       RETURNING messages`,
      [sessionId, JSON.stringify([message])]
    )
    return rows[0]?.messages || []
  },

  /**
   * Flag a session as an emergency and record the timestamp
   */
  flagEmergency: async (sessionId) => {
    const { rows } = await db.query(
      `UPDATE chatbot_sessions
       SET emergency_flagged = TRUE,
           emergency_sent_at = NOW(),
           updated_at        = NOW()
       WHERE id = $1
       RETURNING *`,
      [sessionId]
    )
    return rows[0] || null
  },
}

module.exports = ChatbotSession
