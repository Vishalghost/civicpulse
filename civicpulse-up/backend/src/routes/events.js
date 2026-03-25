/**
 * ISSUE 3 FIX — Live Dashboard Sync via Server-Sent Events (SSE)
 * ==============================================================
 * 
 * Strategy: SSE is the lightest possible real-time solution for a hackathon.
 * - No socket.io dependency
 * - Works through HTTP/1.1 and browser fetch
 * - Auto-reconnects on drop
 * - One endpoint pushes report updates to ALL connected officials/workers
 *
 * GET /api/events/stream
 *   Long-lived HTTP connection. Sends events when:
 *   - A new report is submitted (report:new)
 *   - A report status changes (report:updated)
 *   - Ward risk changes (ward:risk_update)
 *
 * Frontend usage (add to OfficialHome.jsx or WorkerHome.jsx):
 *   const es = new EventSource('/api/events/stream', { withCredentials: true })
 *   es.addEventListener('report:new', e => { const data = JSON.parse(e.data); refreshMap() })
 *   es.addEventListener('ward:risk_update', e => { updateRiskChip(JSON.parse(e.data)) })
 */

const express = require('express')
const router = express.Router()

// ── In-memory connected client registry ──────────────────────────────────────
/** @type {Map<string, {res: Response, role: string, wardId: number}>} */
const clients = new Map()

let nextClientId = 1

/**
 * Broadcast an event to all connected SSE clients.
 * Optionally filter by role or wardId.
 */
function broadcast(eventName, payload, { targetRole = null, targetWardId = null } = {}) {
  const data = JSON.stringify({ ...payload, ts: new Date().toISOString() })
  let sent = 0
  for (const [id, client] of clients.entries()) {
    try {
      if (targetRole && client.role !== targetRole) continue
      if (targetWardId && client.wardId !== targetWardId) continue
      client.res.write(`event: ${eventName}\ndata: ${data}\n\n`)
      sent++
    } catch {
      clients.delete(id) // clean up dead connection
    }
  }
  if (sent > 0) console.log(`[SSE] Broadcast "${eventName}" → ${sent} clients`)
}

// ── Helper: emit from route handlers ─────────────────────────────────────────
// Call this after any DB write in reports.js, officials.js, workers.js:
//   const { sseEmit } = require('./events')
//   sseEmit('report:new', { query_id, category, ward_id, lat, lng, status: 'submitted' })
function sseEmit(eventName, payload, opts = {}) {
  // Defer so the current HTTP response can complete first
  setImmediate(() => broadcast(eventName, payload, opts))
}

// ── SSE Endpoint ──────────────────────────────────────────────────────────────
// GET /api/events/stream
router.get('/stream', (req, res) => {
  // Required SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
  res.flushHeaders()

  const clientId = String(nextClientId++)
  const role    = req.query.role || 'official'
  const wardId  = parseInt(req.query.ward_id) || 1

  clients.set(clientId, { res, role, wardId })
  console.log(`[SSE] Client ${clientId} connected (role=${role}, ward=${wardId}). Total: ${clients.size}`)

  // Send connection confirmation + initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, message: 'SSE stream established' })}\n\n`)

  // Heartbeat every 25s to prevent proxy/nginx from closing the connection
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
      clients.delete(clientId)
    }
  }, 25000)

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(clientId)
    console.log(`[SSE] Client ${clientId} disconnected. Remaining: ${clients.size}`)
  })
})

// ── Short-poll fallback (for browsers where SSE is blocked) ──────────────────
// GET /api/events/poll?since=2026-03-25T01:00:00Z&ward_id=1
// The frontend can use this as a fallback: setInterval(() => poll(), 8000)
const db = require('../db/postgres')

router.get('/poll', async (req, res) => {
  try {
    const since  = req.query.since || new Date(Date.now() - 60000).toISOString()
    const wardId = parseInt(req.query.ward_id) || 1

    const { rows: newReports } = await db.query(
      `SELECT r.id, r.query_id, r.category, r.status, r.lat, r.lng,
              r.duplicate_count, r.created_at, r.ward_id
       FROM reports r
       WHERE r.ward_id = ? AND r.created_at > ?
       ORDER BY r.created_at DESC LIMIT 20`,
      [wardId, since]
    )

    const { rows: updatedReports } = await db.query(
      `SELECT r.id, r.query_id, r.status, r.ward_id, r.updated_at
       FROM reports r
       WHERE r.ward_id = ? AND r.updated_at > ?
         AND r.updated_at != r.created_at
       ORDER BY r.updated_at DESC LIMIT 20`,
      [wardId, since]
    )

    res.json({
      new_reports: newReports,
      updated_reports: updatedReports,
      server_time: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = { router, sseEmit, broadcast }
