const db = require('../db/postgres')

/**
 * WorkerLog Model — PostgreSQL query helpers
 * Table: worker_logs (SERIAL PK, worker_id, activity_type, voice_transcript, language, ...)
 */
const WorkerLog = {
  /**
   * Create a new worker log entry (voice report, survey visit, etc.)
   */
  create: async ({ workerId, activityType, voiceTranscript, language, audioUrl, geoLat, geoLng, photoUrl, wardId, synced = true }) => {
    const { rows } = await db.query(
      `INSERT INTO worker_logs
         (worker_id, activity_type, voice_transcript, language, audio_url, geo_lat, geo_lng, photo_url, ward_id, synced)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [workerId, activityType, voiceTranscript || null, language || 'hi', audioUrl || null, geoLat || null, geoLng || null, photoUrl || null, wardId, synced]
    )
    return rows[0]
  },

  /**
   * Get logs for a specific worker, newest first
   */
  getByWorker: async (workerId, limit = 20) => {
    const { rows } = await db.query(
      `SELECT wl.*, w.name AS ward_name
       FROM worker_logs wl
       LEFT JOIN wards w ON w.id = wl.ward_id
       WHERE wl.worker_id = $1
       ORDER BY wl.created_at DESC
       LIMIT $2`,
      [workerId, limit]
    )
    return rows
  },

  /**
   * Get recent logs for a ward (for ML feature extraction)
   */
  getByWard: async (wardId, days = 7) => {
    const { rows } = await db.query(
      `SELECT * FROM worker_logs
       WHERE ward_id = $1
         AND created_at > NOW() - ($2 || ' days')::INTERVAL
       ORDER BY created_at DESC`,
      [wardId, days]
    )
    return rows
  },

  /**
   * Mark offline-captured logs as synced
   */
  markSynced: async (ids) => {
    if (!ids.length) return
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    await db.query(
      `UPDATE worker_logs SET synced = TRUE WHERE id IN (${placeholders})`,
      ids
    )
  },
}

module.exports = WorkerLog
