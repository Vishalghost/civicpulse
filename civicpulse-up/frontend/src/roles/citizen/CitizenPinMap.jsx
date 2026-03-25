import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../../utils/api'
import useAuthStore from '../../store/authStore'

const CAT_EMOJI = { drain: '🚰', garbage: '🗑️', water: '💧', mosquito: '🦟', other: '📌' }

// Ward centre coordinates for fallback
const WARD_CENTERS = {
  1: [26.848, 80.944],
  2: [26.864, 80.923],
  3: [25.318, 82.990],
  4: [26.755, 83.370],
  5: [25.320, 82.993],
}

const DEFAULT_CENTER = [26.848, 80.944] // Lucknow

export default function CitizenPinMap() {
  const { user } = useAuthStore()
  const wardId = user?.ward_id || 1
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, closed: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | open | closed
  const center = WARD_CENTERS[wardId] || DEFAULT_CENTER

  useEffect(() => {
    setLoading(true)
    api.get(`/reports/public/ward/${wardId}`)
      .then(r => {
        setReports(r.data.reports || [])
        setStats(r.data.stats || { total: 0, open: 0, closed: 0 })
      })
      .catch(() => {
        // Offline demo pins
        setReports([
          { id: 'demo1', query_id: 'LKO-2026-00001', category: 'drain', description: 'नाली बंद है मुख्य चौराहे पर', status: 'submitted', lat: center[0] + 0.002, lng: center[1] - 0.001, duplicate_count: 7, sla_deadline: new Date(Date.now() - 3600000).toISOString() },
          { id: 'demo2', query_id: 'LKO-2026-00002', category: 'garbage', description: 'कचरे का ढेर लग गया है', status: 'in_progress', lat: center[0] - 0.003, lng: center[1] + 0.002, duplicate_count: 3, sla_deadline: new Date(Date.now() + 7200000).toISOString() },
          { id: 'demo3', query_id: 'LKO-2026-00003', category: 'mosquito', description: 'पानी जमा होने से मच्छर', status: 'closed', lat: center[0] + 0.001, lng: center[1] + 0.003, duplicate_count: 1 },
          { id: 'demo4', query_id: 'LKO-2026-00004', category: 'water', description: 'दूषित पानी आ रहा है', status: 'submitted', lat: center[0] - 0.001, lng: center[1] - 0.003, duplicate_count: 12, sla_deadline: new Date(Date.now() - 7200000).toISOString() },
        ])
        setStats({ total: 4, open: 3, closed: 1 })
      })
      .finally(() => setLoading(false))
  }, [wardId])

  const filtered = reports.filter(r => {
    if (filter === 'open') return !['closed', 'rejected'].includes(r.status)
    if (filter === 'closed') return r.status === 'closed'
    return true
  }).filter(r => r.lat && r.lng)

  const getColor = (report) => {
    if (report.status === 'closed') return '#43A047'
    const breached = report.sla_deadline && new Date(report.sla_deadline) < new Date()
    if (breached) return '#B71C1C'
    if (report.status === 'in_progress') return '#F9A825'
    return '#E53935'
  }

  const getRadius = (dup) => Math.min(8 + (dup - 1) * 2.5, 28)

  return (
    <div>
      <div className="page-header">
        <h1>🗺️ वार्ड हज़ार्ड मैप</h1>
        <p>Ward {wardId} — live hazard pins · tap to see details</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">कुल पिन</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.open}</div>
          <div className="stat-label">खुले</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.closed}</div>
          <div className="stat-label">हल</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {[['all', 'सभी'], ['open', '🔴 खुले'], ['closed', '🟢 हल']].map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {/* Map */}
      {loading ? (
        <div className="skeleton" style={{ height: 340, borderRadius: 'var(--radius-lg)' }} />
      ) : (
        <div className="map-container map-container-lg" style={{ marginBottom: '1rem' }}>
          <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer
              attribution='© <a href="https://osm.org">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map(r => (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lng]}
                radius={getRadius(r.duplicate_count || 1)}
                pathOptions={{
                  color: getColor(r),
                  fillColor: getColor(r),
                  fillOpacity: 0.75,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {CAT_EMOJI[r.category] || '📌'} {r.query_id}
                    </div>
                    <div style={{ marginBottom: 4, color: '#555' }}>{r.description?.slice(0, 60)}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                      <span style={{ background: r.status === 'closed' ? '#E8F5E9' : '#FFEBEE', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
                        {r.status === 'closed' ? '✅ हल' : r.status === 'in_progress' ? '🔄 कार्रवाई' : '🔴 खुला'}
                      </span>
                      {(r.duplicate_count || 1) > 1 && (
                        <span style={{ background: '#FFF3E0', borderRadius: 4, padding: '2px 6px', fontWeight: 600, color: '#E65100' }}>
                          +{r.duplicate_count - 1} और रिपोर्ट
                        </span>
                      )}
                    </div>
                    {r.sla_deadline && r.status !== 'closed' && (
                      <div style={{ marginTop: 6, fontSize: 11, color: new Date(r.sla_deadline) < new Date() ? '#B71C1C' : '#555' }}>
                        {new Date(r.sla_deadline) < new Date() ? '⚠️ SLA उल्लंघन!' : `⏱️ Deadline: ${new Date(r.sla_deadline).toLocaleTimeString('hi-IN')}`}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
        {[
          ['#E53935', 'खुला (submitted)'],
          ['#B71C1C', 'SLA उल्लंघन'],
          ['#F9A825', 'कार्रवाई में'],
          ['#43A047', 'हल हो गया'],
        ].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: c, display: 'inline-block' }} />
            {l}
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        📌 पिन का आकार = रिपोर्ट की संख्या (बड़ा = ज्यादा ज़रूरी)
      </p>
    </div>
  )
}
