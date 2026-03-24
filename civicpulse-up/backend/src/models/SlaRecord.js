const db = require('../db/postgres')

/**
 * SlaRecord Model — PostgreSQL query helpers
 * Table: sla_records (SERIAL PK, report_id, breach_level, breach_at, notified_*, escalated_to)
 */
const SlaRecord = {
  /**
   * Create an SLA record for a new report (breach_level starts at 0)
   */
  create: async (reportId) => {
    const { rows } = await db.query(
      'INSERT INTO sla_records (report_id, breach_level) VALUES ($1, 0) RETURNING *',
      [reportId]
    )
    return rows[0]
  },

  /**
   * Get by report UUID
   */
  findByReportId: async (reportId) => {
    const { rows } = await db.query(
      'SELECT * FROM sla_records WHERE report_id = $1',
      [reportId]
    )
    return rows[0] || null
  },

  /**
   * Escalate: increment breach level, set timestamps, record escalated_to user
   */
  escalate: async (reportId, { escalatedTo } = {}) => {
    const { rows } = await db.query(
      `UPDATE sla_records
       SET breach_level       = breach_level + 1,
           breach_at          = NOW(),
           notified_citizen   = TRUE,
           notified_official  = TRUE,
           escalated_to       = COALESCE($2, escalated_to)
       WHERE report_id = $1
       RETURNING *`,
      [reportId, escalatedTo || null]
    )
    return rows[0] || null
  },

  /**
   * Get all SLA breaches that have not yet been escalated (breach_level = 0 and overdue)
   */
  getPendingBreaches: async () => {
    const { rows } = await db.query(
      `SELECT s.*, r.ward_id, r.category, r.query_id, r.citizen_id, r.assigned_official_id
       FROM sla_records s
       JOIN reports r ON r.id = s.report_id
       WHERE r.status NOT IN ('closed','rejected')
         AND r.sla_deadline < NOW()
       ORDER BY s.breach_level ASC, r.sla_deadline ASC`
    )
    return rows
  },
}

module.exports = SlaRecord
