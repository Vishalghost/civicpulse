/**
 * SSE Hook — add to the top of your frontend dashboard components
 * to get live updates without a hard refresh.
 *
 * Usage in OfficialHome.jsx / WorkerHome.jsx:
 *   import { useLiveSync } from '../../hooks/useLiveSync'
 *   const { isLive } = useLiveSync({ wardId: user.ward_id, onUpdate: refreshDashboard })
 */

import { useEffect, useRef, useState, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * @param {object} options
 * @param {number} options.wardId        — ward to subscribe for
 * @param {string} options.role          — 'official' | 'worker'
 * @param {Function} options.onNewReport — called with report data on new pin
 * @param {Function} options.onUpdate    — called with any update payload
 * @param {boolean} options.enabled      — set false to pause subscription
 */
export function useLiveSync({ wardId = 1, role = 'official', onNewReport, onUpdate, enabled = true } = {}) {
  const esRef = useRef(null)
  const pollRef = useRef(null)
  const [isLive, setIsLive] = useState(false)
  const [lastEventAt, setLastEventAt] = useState(null)
  const sinceRef = useRef(new Date().toISOString())

  // ── SSE connection ──────────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (esRef.current) esRef.current.close()

    const url = `${API_BASE}/api/events/stream?role=${role}&ward_id=${wardId}`
    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.addEventListener('connected', () => {
      setIsLive(true)
      console.log('[SSE] Connected')
    })

    es.addEventListener('report:new', (e) => {
      const data = JSON.parse(e.data)
      setLastEventAt(new Date())
      sinceRef.current = data.ts || new Date().toISOString()
      onNewReport?.(data)
      onUpdate?.({ type: 'report:new', data })
    })

    es.addEventListener('report:updated', (e) => {
      const data = JSON.parse(e.data)
      setLastEventAt(new Date())
      onUpdate?.({ type: 'report:updated', data })
    })

    es.addEventListener('ward:risk_update', (e) => {
      const data = JSON.parse(e.data)
      setLastEventAt(new Date())
      onUpdate?.({ type: 'ward:risk_update', data })
    })

    es.onerror = () => {
      setIsLive(false)
      es.close()
      // Auto-reconnect after 5s if SSE drops
      setTimeout(connectSSE, 5000)
    }

    return es
  }, [wardId, role, onNewReport, onUpdate])

  // ── Short-poll fallback (runs alongside SSE as insurance) ──────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(
          `${API_BASE}/api/events/poll?ward_id=${wardId}&since=${sinceRef.current}`,
          { credentials: 'include' }
        )
        if (!r.ok) return
        const { new_reports, updated_reports, server_time } = await r.json()
        sinceRef.current = server_time
        if (new_reports?.length > 0) {
          new_reports.forEach(rep => {
            onNewReport?.(rep)
            onUpdate?.({ type: 'report:new', data: rep })
          })
          setLastEventAt(new Date())
        }
        if (updated_reports?.length > 0) {
          updated_reports.forEach(rep => onUpdate?.({ type: 'report:updated', data: rep }))
          setLastEventAt(new Date())
        }
      } catch { /* silent */ }
    }, 8000) // poll every 8s
  }, [wardId, onNewReport, onUpdate])

  useEffect(() => {
    if (!enabled) return
    const es = connectSSE()
    startPolling()
    return () => {
      es?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [enabled, connectSSE, startPolling])

  return { isLive, lastEventAt }
}
