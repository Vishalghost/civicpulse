const db = require('../db/postgres')

/**
 * Report Model — PostgreSQL query helpers
 * Table: reports (UUID PK, query_id, citizen_id, ward_id, category, status, sla_deadline, ...)
 */
const Report = {
  /**
   * Find report by internal UUID
   */
  findById: async (id) => {
    const { rows } = await db.query('SELECT * FROM reports WHERE id = $1', [id])
    return rows[0] || null
  },

  /**
   * Find report by human-readable query ID (e.g. LKO-2024-00042)
   */
  findByQueryId: async (queryId) => {
    const { rows } = await db.query(
      `SELECT r.*, e.photo_before, e.photo_after, e.action_taken, e.citizen_rating,
              s.breach_level, w.name AS ward_name
       FROM reports r
       LEFT JOIN evidence_submissions e ON e.report_id = r.id
       LEFT JOIN sla_records s         ON s.report_id  = r.id
       LEFT JOIN wards w               ON w.id          = r.ward_id
       WHERE r.query_id = $1`,
      [queryId.toUpperCase()]
    )
    return rows[0] || null
  },

  /**
   * Create a new report; callers must supply a pre-generated UUID and queryId
   */
  create: async ({ id, queryId, citizenId, wardId, category, description, photoUrl, voiceNoteUrl, lat, lng, slaDeadline }) => {
    const { rows } = await db.query(
      `INSERT INTO reports
         (id, query_id, citizen_id, ward_id, category, description, photo_url, voice_note_url, lat, lng, sla_deadline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [id, queryId, citizenId, wardId, category, description, photoUrl || null, voiceNoteUrl || null, lat || null, lng || null, slaDeadline]
    )
    return rows[0]
  },

  /**
   * Update status and/or assigned worker/official
   */
  updateStatus: async (id, { status, assignedWorkerId, assignedOfficialId } = {}) => {
    const { rows } = await db.query(
      `UPDATE reports
       SET status = COALESCE($2, status),
           assigned_worker_id   = COALESCE($3, assigned_worker_id),
           assigned_official_id = COALESCE($4, assigned_official_id),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status || null, assignedWorkerId || null, assignedOfficialId || null]
    )
    return rows[0] || null
  },

  /**
   * Get all reports for a ward, ordered newest-first
   */
  getByWard: async (wardId, limit = 50) => {
    const { rows } = await db.query(
      `SELECT r.*, s.breach_level
       FROM reports r
       LEFT JOIN sla_records s ON s.report_id = r.id
       WHERE r.ward_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [wardId, limit]
    )
    return rows
  },

  /**
   * Get all open reports assigned to a worker
   */
  getByWorker: async (workerId) => {
    const { rows } = await db.query(
      `SELECT r.*, w.name AS ward_name, s.breach_level
       FROM reports r
       LEFT JOIN wards w       ON w.id = r.ward_id
       LEFT JOIN sla_records s ON s.report_id = r.id
       WHERE r.assigned_worker_id = $1
         AND r.status NOT IN ('closed','rejected')
       ORDER BY r.sla_deadline ASC`,
      [workerId]
    )
    return rows
  },

  /**
   * Detect a potential duplicate within the same ward+category in last 48 h
   * and within ~500 m (0.05 degree threshold on lat/lng)
   */
  findDuplicate: async (wardId, category, lat, lng) => {
    const { rows } = await db.query(
      `SELECT id, query_id, duplicate_count FROM reports
       WHERE ward_id  = $1
         AND category = $2
         AND status NOT IN ('closed','rejected')
         AND created_at > NOW() - INTERVAL '48 hours'
         AND (lat IS NULL OR $3 IS NULL
              OR (lat - $3)^2 + (lng - $4)^2 < 0.0025)
       ORDER BY created_at ASC
       LIMIT 1`,
      [wardId, category, lat || null, lng || null]
    )
    return rows[0] || null
  },

  /**
   * Increment the duplicate counter on an existing report
   */
  incrementDuplicateCount: async (id) => {
    await db.query(
      'UPDATE reports SET duplicate_count = duplicate_count + 1, updated_at = NOW() WHERE id = $1',
      [id]
    )
  },

  /**
   * Count all reports (used to generate sequential query IDs)
   */
  count: async () => {
    const { rows } = await db.query('SELECT COUNT(*) AS cnt FROM reports')
    return parseInt(rows[0].cnt, 10)
  },

  /**
   * Fetch reports that are overdue and still open (used by SLA job)
   */
  getOverdue: async () => {
    const { rows } = await db.query(
      `SELECT r.*, s.id AS sla_id, s.breach_level
       FROM reports r
       JOIN sla_records s ON s.report_id = r.id
       WHERE r.status NOT IN ('closed','rejected')
         AND r.sla_deadline < NOW()`,
    )
    return rows
  },
}

module.exports = Report
