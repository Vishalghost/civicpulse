const db = require('../db/postgres')

/**
 * EvidenceSubmission Model — PostgreSQL query helpers
 * Table: evidence_submissions (SERIAL PK, report_id UNIQUE, submitted_by, photo_before, photo_after, ...)
 */
const EvidenceSubmission = {
  /**
   * Find evidence by report UUID
   */
  findByReportId: async (reportId) => {
    const { rows } = await db.query(
      'SELECT * FROM evidence_submissions WHERE report_id = $1',
      [reportId]
    )
    return rows[0] || null
  },

  /**
   * Submit evidence for a report (one per report enforced by UNIQUE constraint)
   */
  create: async ({ reportId, submittedBy, photoBefore, photoAfter, geoLat, geoLng, actionTaken }) => {
    const { rows } = await db.query(
      `INSERT INTO evidence_submissions
         (report_id, submitted_by, photo_before, photo_after, geo_lat, geo_lng, action_taken)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [reportId, submittedBy, photoBefore, photoAfter, geoLat, geoLng, actionTaken]
    )
    return rows[0]
  },

  /**
   * Supervisor approves or rejects submission ('approved' | 'rejected')
   */
  review: async (reportId, supervisorReview) => {
    const { rows } = await db.query(
      `UPDATE evidence_submissions
       SET supervisor_review = $2
       WHERE report_id = $1
       RETURNING *`,
      [reportId, supervisorReview]
    )
    return rows[0] || null
  },

  /**
   * Citizen rates the resolution (1–5)
   */
  submitRating: async (reportId, rating) => {
    const { rows } = await db.query(
      `UPDATE evidence_submissions
       SET citizen_rating = $2
       WHERE report_id = $1
       RETURNING citizen_rating`,
      [reportId, rating]
    )
    return rows[0] || null
  },

  /**
   * Average ratings for a worker's submissions
   */
  getWorkerRatingAvg: async (workerId) => {
    const { rows } = await db.query(
      `SELECT ROUND(AVG(citizen_rating)::numeric, 2) AS avg_rating,
              COUNT(*) AS total_reviews
       FROM evidence_submissions
       WHERE submitted_by = $1
         AND citizen_rating IS NOT NULL`,
      [workerId]
    )
    return rows[0]
  },
}

module.exports = EvidenceSubmission
