const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')

const JWT_SECRET = process.env.JWT_SECRET || 'civicpulse-hackathon-secret'
const OTP_STORE = new Map()   // phone → { otp, expiresAt }
const USER_STORE = new Map()  // phone → user  (in-memory fallback)

// Try to load DB — fail gracefully if Postgres is down
let db = null
try {
  db = require('../db/postgres')
} catch (e) {
  console.warn('[Auth] DB module load failed — using in-memory mode')
}

async function getUser(phone) {
  if (db) {
    try {
      const { rows } = await db.query('SELECT * FROM users WHERE phone = $1', [phone])
      return rows[0] || null
    } catch { /* fall through to in-memory */ }
  }
  return USER_STORE.get(phone) || null
}

async function createUser(phone, role) {
  const names = { citizen: 'नागरिक', worker: 'कर्मचारी', official: 'अधिकारी' }
  const user = { id: uuidv4(), phone, role, name: names[role] || role, ward_id: 1, district: 'lucknow' }
  if (db) {
    try {
      const { rows } = await db.query(
        'INSERT INTO users (id, phone, role, name, ward_id, district) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [user.id, phone, role, user.name, user.ward_id, user.district]
      )
      return rows[0]
    } catch { /* fall through to in-memory */ }
  }
  USER_STORE.set(phone, user)
  return user
}

// POST /api/auth/otp-send
router.post('/otp-send', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone || !/^[6-9]\d{9}$/.test(phone))
      return res.status(400).json({ error: 'Invalid phone number' })

    OTP_STORE.set(phone, { otp: '123456', expiresAt: Date.now() + 5 * 60 * 1000 })
    console.log(`[OTP] Phone: ${phone} → OTP: 123456 (demo)`)
    res.json({ success: true, message: 'OTP sent (demo: 123456)' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/auth/otp-verify
router.post('/otp-verify', async (req, res) => {
  try {
    const { phone, otp, role } = req.body
    if (!phone || !otp || !role)
      return res.status(400).json({ error: 'phone, otp, role required' })

    const stored = OTP_STORE.get(phone)
    // Demo mode: always accept 123456
    if (otp !== '123456' && (!stored || stored.otp !== otp || Date.now() > stored.expiresAt))
      return res.status(401).json({ error: 'Invalid or expired OTP' })

    OTP_STORE.delete(phone)

    let user = await getUser(phone)
    if (!user) user = await createUser(phone, role)

    const payload = {
      id: user.id, phone: user.phone, role: user.role,
      ward_id: user.ward_id, name: user.name, district: user.district
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: payload })
  } catch (err) {
    console.error('[Auth] otp-verify error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'No token' })
    const user = jwt.verify(token, JWT_SECRET)
    res.json({ user })
  } catch { res.status(401).json({ error: 'Invalid token' }) }
})

module.exports = router
