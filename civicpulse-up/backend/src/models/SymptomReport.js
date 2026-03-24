const db = require('../db/postgres')

/**
 * SymptomReport Model — PostgreSQL query helpers
 * Table: symptom_reports (SERIAL PK, worker_log_id, ward_id, symptom_type, case_count, age_group, reported_at)
 */
const SymptomReport = {
  /**
   * Log a symptom observation linked to a worker log entry
   */
  create: async ({ workerLogId, wardId, symptomType, caseCount = 1, ageGroup }) => {
    const { rows } = await db.query(
      `INSERT INTO symptom_reports (worker_log_id, ward_id, symptom_type, case_count, age_group)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [workerLogId || null, wardId, symptomType, caseCount, ageGroup || null]
    )
    return rows[0]
  },

  /**
   * Aggregate fever/symptom case counts per ward over the last N days (used by ML engine)
   */
  getAggregateByWard: async (wardId, days = 7) => {
    const { rows } = await db.query(
      `SELECT symptom_type,
              SUM(case_count) AS total_cases,
              COUNT(*)        AS report_count
       FROM symptom_reports
       WHERE ward_id    = $1
         AND reported_at > NOW() - ($2 || ' days')::INTERVAL
       GROUP BY symptom_type
       ORDER BY total_cases DESC`,
      [wardId, days]
    )
    return rows
  },

  /**
   * Recent symptom reports for a specific ward — raw rows
   */
  getByWard: async (wardId, limit = 100) => {
    const { rows } = await db.query(
      `SELECT * FROM symptom_reports
       WHERE ward_id = $1
       ORDER BY reported_at DESC
       LIMIT $2`,
      [wardId, limit]
    )
    return rows
  },
}

module.exports = SymptomReport
