require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const rateLimit = require('express-rate-limit')

// Routes
const authRoutes = require('./routes/auth')
const reportRoutes = require('./routes/reports')
const workerRoutes = require('./routes/workers')
const officialRoutes = require('./routes/officials')
const chatbotRoutes = require('./routes/chatbot')
const publicRoutes = require('./routes/public')
const mlRoutes = require('./routes/ml')
const voiceRoutes = require('./routes/voice')
const citizenRoutes = require('./routes/citizen')

// Jobs
const { startSLAChecker } = require('./jobs/slaChecker')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Rate limiter
const limiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: 'Too many requests' } })
app.use('/api', limiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/worker', workerRoutes)
app.use('/api/official', officialRoutes)
app.use('/api/chatbot', chatbotRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/ml', mlRoutes)
app.use('/api/voice', voiceRoutes)
app.use('/api/wards', require('./routes/wards'))
app.use('/api/citizen', citizenRoutes)

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'CivicPulse Backend', time: new Date().toISOString() }))

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }))

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

// Start SLA checker cron
startSLAChecker()

app.listen(PORT, () => console.log(`🚀 CivicPulse Backend running on port ${PORT}`))

module.exports = app
