const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://civicpulse:civicpulse123@localhost:5432/civicpulse',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => console.error('[DB] Unexpected pool error:', err))

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}
