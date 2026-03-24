const db = require('../db/postgres')

/**
 * Ward Model — PostgreSQL query helpers
 * Table: wards (SERIAL PK, name, district, geojson, population, risk_score, risk_level, ...)
 */
const Ward = {
  /**
   * Get all wards
   */
  getAll: async () => {
    const { rows } = await db.query('SELECT * FROM wards ORDER BY id')
    return rows
  },

  /**
   * Get a single ward by id
   */
  findById: async (id) => {
    const { rows } = await db.query('SELECT * FROM wards WHERE id = $1', [id])
    return rows[0] || null
  },

  /**
   * Get all wards in a district
   */
  getByDistrict: async (district) => {
    const { rows } = await db.query(
      'SELECT * FROM wards WHERE district = $1 ORDER BY risk_score DESC',
      [district]
    )
    return rows
  },

  /**
   * Update the ML-derived risk score and level for a ward
   */
  updateRisk: async (id, { riskScore, riskLevel }) => {
    const { rows } = await db.query(
      `UPDATE wards
       SET risk_score = $2, risk_level = $3, risk_updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, riskScore, riskLevel]
    )
    return rows[0] || null
  },

  /**
   * Return summary stats across all wards (used by CMO dashboard)
   */
  getRiskSummary: async () => {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE risk_level = 'CRITICAL') AS critical,
         COUNT(*) FILTER (WHERE risk_level = 'HIGH')     AS high,
         COUNT(*) FILTER (WHERE risk_level = 'MEDIUM')   AS medium,
         COUNT(*) FILTER (WHERE risk_level = 'LOW')      AS low,
         ROUND(AVG(risk_score)::numeric, 3)              AS avg_risk
       FROM wards`
    )
    return rows[0]
  },
}

module.exports = Ward
