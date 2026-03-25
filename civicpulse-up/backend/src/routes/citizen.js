const express = require('express')
const router = express.Router()
const { authMiddleware } = require('../middleware/auth')
const db = require('../db/postgres')

/**
 * Dengue case prevention model:
 * - Every civic hazard RESOLVED within 4h SLA → prevents ~4 dengue cases (stagnant water broken up)
 * - Every hazard resolved 4–24h → prevents ~2 cases
 * - Every hazard resolved >24h or still open → 0 prevention value
 * Ward risk delta: compares current risk snapshot vs 30 days ago
 */
function estimateDenguePrevented(reports) {
  let total = 0
  for (const r of reports) {
    if (r.status !== 'closed') continue
    const created = new Date(r.created_at)
    const closed = r.closed_at ? new Date(r.closed_at) : new Date()
    const hoursToClose = (closed - created) / 3600000
    if (hoursToClose <= 4) total += 4
    else if (hoursToClose <= 24) total += 2
    else total += 0
  }
  return Math.max(total, 0)
}

// GET /api/citizen/impact/:userId
router.get('/impact/:userId', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId

    // Fetch all reports by this citizen
    const { rows: reports } = await db.query(
      `SELECT r.id, r.status, r.created_at, r.sla_deadline,
              e.submitted_at AS closed_at, r.duplicate_count
       FROM reports r
       LEFT JOIN evidence_submissions e ON e.report_id = r.id
       WHERE r.citizen_id = $1
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [userId]
    )

    const totalReports   = reports.length
    const resolvedReports = reports.filter(r => r.status === 'closed').length
    const denguePreventedEstimate = estimateDenguePrevented(reports)

    // Streak: count consecutive days with at least one report (most recent first)
    let streakDays = 0
    const today = new Date(); today.setHours(0,0,0,0)
    const daySet = new Set(reports.map(r => new Date(r.created_at).toDateString()))
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      if (daySet.has(d.toDateString())) streakDays++
      else break
    }

    // Badge tier
    let badge = 'newcomer'
    if (totalReports >= 20) badge = 'champion'
    else if (totalReports >= 10) badge = 'guardian'
    else if (totalReports >= 5)  badge = 'hero'
    else if (totalReports >= 1)  badge = 'reporter'

    // Ward risk delta (last 30 days)
    let wardRiskDelta = 0
    try {
      const wardId = req.user.ward_id || 1
      const { rows: riskRows } = await db.query(
        `SELECT risk_score, predicted_at FROM ward_risk_history
         WHERE ward_id = $1
         ORDER BY predicted_at DESC LIMIT 2`,
        [wardId]
      )
      if (riskRows.length >= 2) {
        wardRiskDelta = riskRows[1].risk_score - riskRows[0].risk_score
      }
    } catch { /* non-critical */ }

    res.json({
      userId,
      totalReports,
      resolvedReports,
      denguePreventedEstimate,
      badge,
      streakDays,
      wardRiskDelta: Math.round(wardRiskDelta * 100) / 100,
    })
  } catch (err) {
    console.error('[Citizen Impact] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
