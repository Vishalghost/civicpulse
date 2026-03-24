const db = require('../db/postgres')

/**
 * WardRiskHistory Model — PostgreSQL query helpers
 * Table: ward_risk_history (SERIAL PK, ward_id, risk_score, predicted_diseases[], confidence, feature_snapshot JSONB, model_version)
 */
const WardRiskHistory = {
  /**
   * Insert a new prediction snapshot
   */
  create: async ({ wardId, riskScore, predictedDiseases = [], confidence, featureSnapshot = {}, modelVersion = '1.0' }) => {
    const { rows } = await db.query(
      `INSERT INTO ward_risk_history
         (ward_id, risk_score, predicted_diseases, confidence, feature_snapshot, model_version)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [wardId, riskScore, predictedDiseases, confidence, JSON.stringify(featureSnapshot), modelVersion]
    )
    return rows[0]
  },

  /**
   * Get the most recent prediction for a ward
   */
  getLatest: async (wardId) => {
    const { rows } = await db.query(
      `SELECT * FROM ward_risk_history
       WHERE ward_id = $1
       ORDER BY predicted_at DESC
       LIMIT 1`,
      [wardId]
    )
    return rows[0] || null
  },

  /**
   * Get the last N predictions for a ward (trend data for the dashboard)
   */
  getTrend: async (wardId, limit = 14) => {
    const { rows } = await db.query(
      `SELECT risk_score, risk_score, predicted_diseases, confidence, predicted_at
       FROM ward_risk_history
       WHERE ward_id = $1
       ORDER BY predicted_at DESC
       LIMIT $2`,
      [wardId, limit]
    )
    return rows
  },

  /**
   * Get the highest-risk ward snapshot across all wards (for CMO brief)
   */
  getTopRiskWard: async () => {
    const { rows } = await db.query(
      `SELECT wrh.*, w.name AS ward_name, w.district
       FROM ward_risk_history wrh
       JOIN wards w ON w.id = wrh.ward_id
       WHERE wrh.predicted_at = (
         SELECT MAX(predicted_at) FROM ward_risk_history wrh2 WHERE wrh2.ward_id = wrh.ward_id
       )
       ORDER BY wrh.risk_score DESC
       LIMIT 1`
    )
    return rows[0] || null
  },
}

module.exports = WardRiskHistory
