/**
 * ISSUE 2 FIX — Cross-Role Spatial Query Route
 * =============================================
 * GET /api/reports/spatial/open
 *   Returns all open reports for a worker/official's map, ordered by urgency.
 *   Works for both PostGIS (real GPS distance) and SQLite (Haversine in JS).
 *
 * GET /api/reports/public/ward/:wardId
 *   Returns ward-scoped reports for CitizenPinMap.jsx with stats.
 */

const express = require('express')
const router = express.Router()
const { authMiddleware } = require('../middleware/auth')
const db = require('../db/postgres')

// ── Haversine for SQLite (no PostGIS) ────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── ROUTE 1: Open tickets for Field Workers & Officials ──────────────────────
// GET /api/reports/spatial/open?lat=26.84&lng=80.94&radius_km=5
// Used by: WorkerHome map, OfficialHome WardMap
router.get('/spatial/open', authMiddleware, async (req, res) => {
  try {
    const role = req.user?.role
    if (!['worker', 'official'].includes(role)) {
      return res.status(403).json({ error: 'Only workers and officials can access spatial data' })
    }

    const wardId   = req.user.ward_id || 1
    const centerLat = parseFloat(req.query.lat) || 26.8467
    const centerLng = parseFloat(req.query.lng) || 80.9462
    const radiusKm  = parseFloat(req.query.radius_km) || 3

    // Try PostGIS first (fast, server-side spatial)
    let rows
    try {
      const result = await db.query(`
        SELECT
          r.id, r.query_id, r.category, r.description,
          r.status, r.lat, r.lng, r.address,
          r.duplicate_count, r.sla_deadline,
          r.created_at, r.citizen_id,
          s.breach_level,
          EXTRACT(EPOCH FROM (NOW() - r.created_at))/3600 AS hours_open,
          ST_Distance(
            ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) / 1000 AS distance_km
        FROM reports r
        LEFT JOIN sla_records s ON s.report_id = r.id
        WHERE r.status NOT IN ('closed', 'rejected')
          AND r.ward_id = $3
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $4 * 1000  /* radius in metres */
          )
        ORDER BY s.breach_level DESC NULLS LAST, r.duplicate_count DESC, r.created_at ASC
        LIMIT 200
      `, [centerLng, centerLat, wardId, radiusKm])
      rows = result.rows
      console.log('[Spatial] PostGIS query returned', rows.length, 'pins')
    } catch (pgErr) {
      // Fall back to SQLite — fetch all open in ward, filter in JS
      console.log('[Spatial] PostGIS unavailable, using JS Haversine:', pgErr.message)
      const { rows: allRows } = await db.query(
        `SELECT r.*, s.breach_level
         FROM reports r
         LEFT JOIN sla_records s ON s.report_id = r.id
         WHERE r.status NOT IN ('closed','rejected') AND r.ward_id = ?
         ORDER BY r.created_at ASC`,
        [wardId]
      )
      rows = allRows
        .filter(r => r.lat && r.lng)
        .map(r => ({
          ...r,
          distance_km: haversineKm(centerLat, centerLng, r.lat, r.lng),
          hours_open: (Date.now() - new Date(r.created_at).getTime()) / 3600000,
        }))
        .filter(r => r.distance_km <= radiusKm)
        .sort((a, b) => (b.breach_level || 0) - (a.breach_level || 0) || b.duplicate_count - a.duplicate_count)
    }

    // Enrich with SLA breach flag + urgency score for map radius/colour
    const enriched = rows.map(r => {
      const slaBreached = r.sla_deadline && new Date(r.sla_deadline) < new Date()
      const urgency = Math.min(1 + (r.duplicate_count || 1) * 0.1 + (r.breach_level || 0) * 0.3, 5)
      return { ...r, sla_breached: slaBreached, urgency_score: Math.round(urgency * 10) / 10 }
    })

    res.json({
      reports: enriched,
      meta: { total: enriched.length, center: { lat: centerLat, lng: centerLng }, radius_km: radiusKm }
    })
  } catch (err) {
    console.error('[Spatial/Open]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── ROUTE 2: Ward-scoped reports for CitizenPinMap ───────────────────────────
// GET /api/reports/public/ward/:wardId
// Used by: CitizenPinMap.jsx
router.get('/public/ward/:wardId', async (req, res) => {
  try {
    const wardId = parseInt(req.params.wardId) || 1

    const { rows } = await db.query(
      `SELECT r.id, r.query_id, r.category, r.description,
              r.status, r.lat, r.lng, r.duplicate_count, r.sla_deadline, r.created_at,
              s.breach_level
       FROM reports r
       LEFT JOIN sla_records s ON s.report_id = r.id
       WHERE r.ward_id = ?
       ORDER BY r.created_at DESC
       LIMIT 150`,
      [wardId]
    )

    const total  = rows.length
    const open   = rows.filter(r => !['closed','rejected'].includes(r.status)).length
    const closed = rows.filter(r => r.status === 'closed').length

    res.json({ reports: rows, stats: { total, open, closed } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
