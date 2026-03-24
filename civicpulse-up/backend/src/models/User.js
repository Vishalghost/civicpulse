const db = require('../db/postgres')

/**
 * User Model — PostgreSQL query helpers
 * Table: users (UUID PK, phone, role, name, ward_id, district, preferred_language, ...)
 */
const User = {
  /**
   * Find a user by their UUID id
   */
  findById: async (id) => {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id])
    return rows[0] || null
  },

  /**
   * Find a user by phone number
   */
  findByPhone: async (phone) => {
    const { rows } = await db.query('SELECT * FROM users WHERE phone = $1', [phone])
    return rows[0] || null
  },

  /**
   * Create a new user; returns the created row
   */
  create: async ({ id, phone, role, name, ward_id = 1, district = 'lucknow', preferred_language = 'hi' }) => {
    const { rows } = await db.query(
      `INSERT INTO users (id, phone, role, name, ward_id, district, preferred_language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, phone, role, name, ward_id, district, preferred_language]
    )
    return rows[0]
  },

  /**
   * Update specific fields of a user by id
   */
  update: async (id, fields) => {
    const keys = Object.keys(fields)
    if (!keys.length) return null
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    const values = [id, ...Object.values(fields)]
    const { rows } = await db.query(
      `UPDATE users SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    )
    return rows[0] || null
  },

  /**
   * Get all workers in a given ward
   */
  getWorkersByWard: async (wardId) => {
    const { rows } = await db.query(
      `SELECT id, name, phone, district FROM users WHERE role = 'worker' AND ward_id = $1`,
      [wardId]
    )
    return rows
  },

  /**
   * Get all officials in a given district
   */
  getOfficialsByDistrict: async (district) => {
    const { rows } = await db.query(
      `SELECT id, name, phone, district FROM users WHERE role = 'official' AND district = $1`,
      [district]
    )
    return rows
  },
}

module.exports = User
