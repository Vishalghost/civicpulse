const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { authMiddleware } = require('../middleware/auth')
const sqliteDb = require('../db/sqlite')

// Try PostgreSQL, fall back gracefully
let pgDb = null
try { pgDb = require('../db/postgres') } catch { /* no PG */ }

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 }
})

// Generate Query ID
function generateQueryId(district, seq) {
  const codes = { lucknow: 'LKO', varanasi: 'VNS', gorakhpur: 'GKP' }
  const code = codes[district] || 'LKO'
  const year = new Date().getFullYear()
  return `${code}-${year}-${String(seq).padStart(5, '0')}`
}

// Deduplication check (SQLite)
function findDuplicateSQLite(wardId, category, lat, lng) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const row = sqliteDb.prepare(`
    SELECT id, query_id, duplicate_count FROM reports
    WHERE ward_id=? AND category=? AND status NOT IN ('closed','rejected')
      AND created_at > ?
      AND (lat IS NULL OR ?=0 OR (lat - ?)*(lat - ?) + (lng - ?)*(lng - ?) < 0.0025)
    ORDER BY created_at ASC LIMIT 1
  `).get(wardId, category, cutoff, lat || 0, lat || 0, lat || 0, lng || 0, lng || 0)
  return row || null
}

// POST /api/reports — Submit new report
router.post('/', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { category, description, ward_id, lat, lng, address, lang } = req.body
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null
    const wardId = parseInt(ward_id) || req.user.ward_id || 1
    const district = req.user.district || 'lucknow'

    // Deduplication (SQLite)
    const existing = findDuplicateSQLite(wardId, category, parseFloat(lat), parseFloat(lng))
    if (existing) {
      sqliteDb.prepare('UPDATE reports SET duplicate_count = duplicate_count + 1, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), existing.id)
      return res.json({
        queryId: existing.query_id,
        duplicate: true,
        message: 'Similar report exists — your submission linked for urgency scoring'
      })
    }

    // Seq for query ID
    const { cnt } = sqliteDb.prepare('SELECT COUNT(*) as cnt FROM reports').get()
    const seq = parseInt(cnt) + 1
    const queryId = generateQueryId(district, seq)
    const reportId = uuidv4()
    const slaDeadline = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()

    // Write to SQLite (always)
    sqliteDb.prepare(`
      INSERT INTO reports (id, query_id, citizen_id, citizen_phone, ward_id, district, category, description, photo_path, lat, lng, address, lang, sla_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId, queryId, req.user.id || null, req.user.phone || null,
      wardId, district, category, description,
      photoPath, lat ? parseFloat(lat) : null, lng ? parseFloat(lng) : null,
      address || null, lang || 'hi', slaDeadline
    )

    // Also try PostgreSQL (optional)
    if (pgDb) {
      pgDb.query(
        `INSERT INTO reports (id,query_id,citizen_id,ward_id,category,description,photo_url,lat,lng,sla_deadline)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [reportId, queryId, req.user.id, wardId, category, description, photoPath, lat || null, lng || null, slaDeadline]
      ).then(() => pgDb.query('INSERT INTO sla_records (report_id,breach_level) VALUES ($1,0)', [reportId]))
        .catch(() => {})
    }

    res.status(201).json({ reportId, queryId, slaDeadline, message: 'Report submitted' })
  } catch (err) {
    console.error('[Reports] POST error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/reports/:queryId
router.get('/:queryId', async (req, res) => {
  try {
    const { queryId } = req.params
    const { rows } = await db.query(
      `SELECT r.*, e.photo_before, e.photo_after, e.action_taken, e.citizen_rating,
       s.breach_level, w.name as ward_name
       FROM reports r
       LEFT JOIN evidence_submissions e ON e.report_id = r.id
       LEFT JOIN sla_records s ON s.report_id = r.id
       LEFT JOIN wards w ON w.id = r.ward_id
       WHERE r.query_id = $1`,
      [queryId.toUpperCase()]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' })
    const r = rows[0]
    res.json({
      id: r.id, query_id: r.query_id, category: r.category, description: r.description,
      status: r.status, ward_id: r.ward_id, ward_name: r.ward_name,
      sla_deadline: r.sla_deadline, breach_level: r.breach_level,
      duplicate_count: r.duplicate_count, created_at: r.created_at,
      evidence: r.photo_before ? { photo_before: r.photo_before, photo_after: r.photo_after, action_taken: r.action_taken } : null,
      citizen_rating: r.citizen_rating
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/reports/public/ward/:wardId
router.get('/public/ward/:wardId', async (req, res) => {
  try {
    const { wardId } = req.params
    const limit = parseInt(req.query.limit) || 50
    const { rows } = await db.query(
      `SELECT r.id, r.query_id, r.category, r.description, r.status, r.ward_id,
              r.sla_deadline, r.duplicate_count, r.created_at, r.updated_at,
              s.breach_level
       FROM reports r
       LEFT JOIN sla_records s ON s.report_id = r.id
       WHERE r.ward_id = $1 ORDER BY r.created_at DESC LIMIT $2`,
      [wardId, limit]
    )
    const stats = {
      total: rows.length,
      closed: rows.filter(r => r.status === 'closed').length,
      open: rows.filter(r => !['closed','rejected'].includes(r.status)).length,
    }
    res.json({ reports: rows, stats })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/reports/:id/rating
router.post('/:id/rating', authMiddleware, async (req, res) => {
  try {
    const { rating } = req.body
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' })
    await db.query(
      'UPDATE evidence_submissions SET citizen_rating=$1 WHERE report_id=$2',
      [rating, req.params.id]
    )
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
