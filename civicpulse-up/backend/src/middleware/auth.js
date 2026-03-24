const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'civicpulse-hackathon-secret'

function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch { res.status(401).json({ error: 'Invalid token' }) }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}

module.exports = { authMiddleware, requireRole }
