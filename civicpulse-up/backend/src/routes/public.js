const express = require('express')
const router = express.Router()
const db = require('../db/postgres')

// GET /api/public/board/:wardId
router.get('/board/:wardId', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.query_id, r.category, r.description, r.status, r.created_at, r.duplicate_count,
              s.breach_level
       FROM reports r LEFT JOIN sla_records s ON s.report_id=r.id
       WHERE r.ward_id=$1 ORDER BY r.created_at DESC LIMIT 30`,
      [req.params.wardId]
    )
    res.json({ reports: rows, ward_id: req.params.wardId })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/public/stats
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='closed') as closed,
              COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status NOT IN ('closed','rejected')) as breached
       FROM reports`
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/public/ward-risk
router.get('/ward-risk', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, district, risk_score, risk_level FROM wards ORDER BY risk_score DESC')
    res.json({ wards: rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
