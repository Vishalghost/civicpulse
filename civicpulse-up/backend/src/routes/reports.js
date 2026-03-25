const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { authMiddleware } = require('../middleware/auth')
const { sseEmit } = require('./events')

// ── Model imports ──────────────────────────────────────────────────────────
const Report = require('../models/Report')
const SlaRecord = require('../models/SlaRecord')
const EvidenceSubmission = require('../models/EvidenceSubmission')

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 }
})

// Generate human-readable Query ID (e.g. LKO-2026-00042)
function generateQueryId(district, seq) {
  const codes = { lucknow: 'LKO', varanasi: 'VNS', gorakhpur: 'GKP' }
  const code = codes[(district || '').toLowerCase()] || 'LKO'
  const year = new Date().getFullYear()
  return `${code}-${year}-${String(seq).padStart(5, '0')}`
}

// POST /api/reports — Submit new report
router.post('/', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { category, description, ward_id, lat, lng, address, lang } = req.body
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null
    const wardId = parseInt(ward_id) || req.user.ward_id || 1
    const district = req.user.district || 'lucknow'

    // Deduplication via model
    const existing = await Report.findDuplicate(wardId, category, parseFloat(lat) || null, parseFloat(lng) || null)
    if (existing) {
      await Report.incrementDuplicateCount(existing.id)
      return res.json({
        queryId: existing.query_id,
        duplicate: true,
        message: 'Similar report exists — your submission linked for urgency scoring'
      })
    }

    // Sequential query ID
    const seq = (await Report.count()) + 1
    const queryId = generateQueryId(district, seq)
    const reportId = uuidv4()
    const slaDeadline = new Date(Date.now() + 4 * 60 * 60 * 1000)

    // Create via model
    await Report.create({
      id: reportId,
      queryId,
      citizenId: req.user.id || null,
      wardId,
      category,
      description,
      photoUrl: photoPath,
      voiceNoteUrl: null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      slaDeadline,
    })

    // Create SLA record
    await SlaRecord.create(reportId)

    // 🔴 Broadcast to all connected worker/official dashboards via SSE
    sseEmit('report:new', {
      query_id: queryId,
      category,
      ward_id: wardId,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      status: 'submitted',
      duplicate_count: 1,
      sla_deadline: slaDeadline,
    }, { targetWardId: wardId })

    res.status(201).json({ reportId, queryId, slaDeadline, message: 'Report submitted' })
  } catch (err) {
    console.error('[Reports] POST error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/reports/:queryId — Get report details by query ID
router.get('/:queryId', async (req, res) => {
  try {
    const report = await Report.findByQueryId(req.params.queryId)
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json({
      id: report.id,
      query_id: report.query_id,
      category: report.category,
      description: report.description,
      status: report.status,
      ward_id: report.ward_id,
      ward_name: report.ward_name,
      sla_deadline: report.sla_deadline,
      breach_level: report.breach_level,
      duplicate_count: report.duplicate_count,
      created_at: report.created_at,
      evidence: report.photo_before
        ? { photo_before: report.photo_before, photo_after: report.photo_after, action_taken: report.action_taken }
        : null,
      citizen_rating: report.citizen_rating,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/reports/public/ward/:wardId
router.get('/public/ward/:wardId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const rows = await Report.getByWard(req.params.wardId, limit)
    const stats = {
      total: rows.length,
      closed: rows.filter(r => r.status === 'closed').length,
      open: rows.filter(r => !['closed', 'rejected'].includes(r.status)).length,
    }
    res.json({ reports: rows, stats })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/reports/:id/rating — Citizen rates a resolved report
router.post('/:id/rating', authMiddleware, async (req, res) => {
  try {
    const { rating } = req.body
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' })
    await EvidenceSubmission.submitRating(req.params.id, rating)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
