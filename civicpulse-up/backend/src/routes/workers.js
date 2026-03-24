const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { authMiddleware, requireRole } = require('../middleware/auth')

// ── Model imports ──────────────────────────────────────────────────────────
const WorkerLog = require('../models/WorkerLog')
const SymptomReport = require('../models/SymptomReport')

const upload = multer({ dest: path.join(__dirname, '../../uploads/') })

// POST /api/worker/logs — Log a worker activity (voice, survey, site visit)
router.post('/logs', authMiddleware, requireRole('worker'), upload.single('photo'), async (req, res) => {
  try {
    const { activity_type, voice_transcript, language, ward_id, geo_lat, geo_lng } = req.body
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null
    await WorkerLog.create({
      workerId: req.user.id,
      activityType: activity_type,
      voiceTranscript: voice_transcript || null,
      language: language || 'hi',
      audioUrl: null,
      geoLat: geo_lat ? parseFloat(geo_lat) : null,
      geoLng: geo_lng ? parseFloat(geo_lng) : null,
      photoUrl,
      wardId: parseInt(ward_id) || req.user.ward_id || 1,
      synced: true,
    })
    res.status(201).json({ success: true, message: 'Activity logged' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/worker/symptoms — Report symptom observations
router.post('/symptoms', authMiddleware, requireRole('worker'), async (req, res) => {
  try {
    const { ward_id, symptom_type, case_count, age_group, worker_log_id } = req.body
    await SymptomReport.create({
      workerLogId: worker_log_id || null,
      wardId: parseInt(ward_id) || req.user.ward_id || 1,
      symptomType: symptom_type,
      caseCount: parseInt(case_count) || 1,
      ageGroup: age_group || 'adult',
    })
    res.status(201).json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/worker/my-reports — Get logged activities for the current worker
router.get('/my-reports', authMiddleware, requireRole('worker'), async (req, res) => {
  try {
    const logs = await WorkerLog.getByWorker(req.user.id)
    res.json({ logs })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/worker/sync — Batch offline sync
router.post('/sync', authMiddleware, requireRole('worker'), async (req, res) => {
  try {
    const { items } = req.body
    let synced = 0
    for (const item of (items || [])) {
      if (item.type === 'worker_log') {
        await WorkerLog.create({
          workerId: req.user.id,
          activityType: item.data.activity_type,
          voiceTranscript: item.data.transcript || null,
          language: item.data.language || 'hi',
          wardId: item.data.ward_id || 1,
          synced: true,
        })
        synced++
      } else if (item.type === 'symptom_report') {
        await SymptomReport.create({
          wardId: item.data.ward_id || 1,
          symptomType: item.data.symptom_type,
          caseCount: item.data.case_count || 1,
          ageGroup: item.data.age_group || null,
        })
        synced++
      }
    }
    res.json({ synced, message: `${synced} item(s) synced` })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
