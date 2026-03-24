const express = require('express')
const router = express.Router()
const { authMiddleware, requireRole } = require('../middleware/auth')

// ── Model imports ──────────────────────────────────────────────────────────
const Ward = require('../models/Ward')
const WardRiskHistory = require('../models/WardRiskHistory')

// GET /api/wards/:wardId/risk — Ward risk data with latest ML prediction
router.get('/:wardId/risk', async (req, res) => {
  try {
    const ward = await Ward.findById(req.params.wardId)
    if (!ward) return res.status(404).json({ error: 'Ward not found' })

    const latest = await WardRiskHistory.getLatest(ward.id)

    res.json({
      ward_id: ward.id,
      ward_name: ward.name,
      district: ward.district,
      risk_score: ward.risk_score,
      risk_level: ward.risk_level,
      predicted_diseases: latest?.predicted_diseases || [],
      confidence: latest?.confidence || 0.75,
      predicted_at: latest?.predicted_at || null,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/wards — All wards with risk summary
router.get('/', async (req, res) => {
  try {
    const wards = await Ward.getAll()
    res.json({ wards })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/wards/summary — Risk distribution summary (CMO dashboard)
router.get('/summary', authMiddleware, requireRole('official'), async (req, res) => {
  try {
    const summary = await Ward.getRiskSummary()
    res.json(summary)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
