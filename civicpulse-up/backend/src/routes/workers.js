const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const db = require('../db/postgres')
const { authMiddleware, requireRole } = require('../middleware/auth')

const upload = multer({ dest: path.join(__dirname, '../../uploads/') })

// POST /api/worker/logs
router.post('/logs', authMiddleware, requireRole('worker'), upload.single('photo'), async (req, res) => {
  try {
    const { activity_type, voice_transcript, language, ward_id, geo_lat, geo_lng } = req.body
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null
    await db.query(
      `INSERT INTO worker_logs (worker_id, activity_type, voice_transcript, language, geo_lat, geo_lng, photo_url, ward_id, synced)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id`,
      [req.user.id, activity_type, voice_transcript, language || 'hi', geo_lat || null, geo_lng || null, photoUrl, parseInt(ward_id) || req.user.ward_id || 1]
    )
    res.status(201).json({ success: true, message: 'Activity logged' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/worker/symptoms
router.post('/symptoms', authMiddleware, requireRole('worker'), async (req, res) => {
  try {
    const { ward_id, symptom_type, case_count, age_group, worker_log_id } = req.body
    await db.query(
      'INSERT INTO symptom_reports (worker_log_id, ward_id, symptom_type, case_count, age_group) VALUES ($1,$2,$3,$4,$5)',
      [worker_log_id || null, parseInt(ward_id) || req.user.ward_id || 1, symptom_type, parseInt(case_count) || 1, age_group || 'adult']
    )
    res.status(201).json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/worker/my-reports
router.get('/my-reports', authMiddleware, requireRole('worker'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM worker_logs WHERE worker_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    )
    res.json({ logs: rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/worker/sync — batch offline sync
router.post('/sync', authMiddleware, requireRole('worker'), async (req, res) => {
  try {
    const { items } = req.body
    let synced = 0
    for (const item of (items || [])) {
      if (item.type === 'worker_log') {
        await db.query(
          'INSERT INTO worker_logs (worker_id, activity_type, voice_transcript, language, ward_id, synced) VALUES ($1,$2,$3,$4,$5,true)',
          [req.user.id, item.data.activity_type, item.data.transcript, item.data.language || 'hi', item.data.ward_id || 1]
        )
        synced++
      }
    }
    res.json({ synced, message: `${synced} item(s) synced` })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
