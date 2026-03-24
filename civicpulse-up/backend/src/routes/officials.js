const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { authMiddleware, requireRole } = require('../middleware/auth')

// ── Model imports ──────────────────────────────────────────────────────────
const Report = require('../models/Report')
const EvidenceSubmission = require('../models/EvidenceSubmission')
const SlaRecord = require('../models/SlaRecord')
const Ward = require('../models/Ward')

const upload = multer({ dest: path.join(__dirname, '../../uploads/'), limits: { fileSize: 5 * 1024 * 1024 } })

// ANTI-GAMING: max 5 closures/hour per worker
const closureTimestamps = new Map()
function checkClosureRateLimit(workerId) {
  const now = Date.now()
  const timestamps = (closureTimestamps.get(workerId) || []).filter(t => now - t < 3600000)
  if (timestamps.length >= 5) return false
  timestamps.push(now)
  closureTimestamps.set(workerId, timestamps)
  return true
}

// GET /api/official/dashboard
router.get('/dashboard', authMiddleware, requireRole('official'), async (req, res) => {
  try {
    const wards = await Ward.getAll()
    const summary = await Ward.getRiskSummary()
    // Raw aggregate on reports (no per-row model method needed)
    const db = require('../db/postgres')
    const { rows } = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status NOT IN ('closed','rejected')) AS pending,
         COUNT(*) FILTER (WHERE status = 'closed') AS closed,
         COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status NOT IN ('closed','rejected')) AS breaches
       FROM reports`
    )
    res.json({
      stats: {
        total: parseInt(rows[0].total),
        breaches: parseInt(rows[0].breaches),
        closed: parseInt(rows[0].closed),
        pending: parseInt(rows[0].pending),
        activeWorkers: 8,
      },
      wards,
      riskSummary: summary,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/official/sla-breaches
router.get('/sla-breaches', authMiddleware, requireRole('official'), async (req, res) => {
  try {
    const breaches = await SlaRecord.getPendingBreaches()
    res.json({ reports: breaches })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/official/reports/:id/assign
router.post('/reports/:id/assign', authMiddleware, requireRole('official'), async (req, res) => {
  try {
    const { worker_id } = req.body
    const updated = await Report.updateStatus(req.params.id, {
      status: 'assigned',
      assignedWorkerId: worker_id || req.user.id,
    })
    if (!updated) return res.status(404).json({ error: 'Report not found' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/official/reports/:id/close — 4-field mandatory evidence closure
router.post('/reports/:id/close', authMiddleware, requireRole('official'), upload.fields([
  { name: 'photo_before', maxCount: 1 },
  { name: 'photo_after', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params
    const { geo_lat, geo_lng, action_taken } = req.body
    const photoBefore = req.files?.photo_before?.[0]
    const photoAfter  = req.files?.photo_after?.[0]

    // ANTI-GAMING: Rate limit
    if (!checkClosureRateLimit(req.user.id)) {
      return res.status(429).json({ error: 'Rate limit: max 5 closures per hour' })
    }

    // ANTI-GAMING: Validate 4 mandatory fields
    const missing = []
    if (!photoBefore) missing.push('photo_before')
    if (!photoAfter)  missing.push('photo_after')
    if (!geo_lat || !geo_lng) missing.push('geo_tag')
    if (!action_taken || action_taken.trim().length < 20) missing.push('action_taken (min 20 chars)')
    if (missing.length > 0) {
      return res.status(400).json({ error: 'EVIDENCE_INCOMPLETE', missing, message: 'All 4 evidence fields required.' })
    }

    const report = await Report.findById(id)
    if (!report) return res.status(404).json({ error: 'Report not found' })

    const photoBeforeUrl = `/uploads/${photoBefore.filename}`
    const photoAfterUrl  = `/uploads/${photoAfter.filename}`

    // Submit evidence
    await EvidenceSubmission.create({
      reportId: id,
      submittedBy: req.user.id,
      photoBefore: photoBeforeUrl,
      photoAfter: photoAfterUrl,
      geoLat: parseFloat(geo_lat),
      geoLng: parseFloat(geo_lng),
      actionTaken: action_taken.trim(),
    })

    // ANTI-GAMING: 20% random + closed < 2 h → supervisor review
    const openHours = (Date.now() - new Date(report.created_at).getTime()) / 3600000
    const requiresReview = openHours < 2 || Math.random() < 0.2

    if (requiresReview) {
      await Report.updateStatus(id, { status: 'in_progress' })
      return res.json({ success: true, supervisorReview: true, message: 'Pending supervisor approval (anti-gaming check)' })
    }

    await Report.updateStatus(id, { status: 'closed' })
    console.log(`[Closure] Report ${id} closed with evidence by ${req.user.id}`)
    res.json({ success: true, message: 'Report closed successfully' })
  } catch (err) {
    console.error('[Closure] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/official/weekly-report
router.get('/weekly-report', authMiddleware, requireRole('official'), async (req, res) => {
  try {
    const db = require('../db/postgres')
    const { rows } = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status='closed') AS resolved,
         COUNT(*) FILTER (WHERE status NOT IN ('closed','rejected')) AS pending,
         COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status NOT IN ('closed','rejected')) AS breaches
       FROM reports WHERE created_at > NOW() - INTERVAL '7 days'`
    )
    const topWards = await Ward.getAll()
    res.json({ week: '7 days', ...rows[0], wards: topWards.slice(0, 5) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
