import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import api from '../../utils/api'

const RISK_COLOR = { LOW: '#388E3C', MEDIUM: '#F9A825', HIGH: '#E65100', CRITICAL: '#B71C1C' }
const MOCK_WARDS = [
  { id: 1, name: 'Ward 12 Aminabad', district: 'lucknow', risk_score: 0.78, risk_level: 'HIGH', open_reports: 14, predicted_diseases: ['dengue'], population: 45000,
    polygon: [[26.845,80.940],[26.852,80.940],[26.852,80.950],[26.845,80.950]] },
  { id: 2, name: 'Ward 7 Chowk', district: 'lucknow', risk_score: 0.45, risk_level: 'MEDIUM', open_reports: 7, predicted_diseases: ['typhoid'], population: 38000,
    polygon: [[26.860,80.918],[26.868,80.918],[26.868,80.928],[26.860,80.928]] },
  { id: 3, name: 'Ward 3 Sigra', district: 'varanasi', risk_score: 0.20, risk_level: 'LOW', open_reports: 2, predicted_diseases: [], population: 29000,
    polygon: [[25.315,82.985],[25.322,82.985],[25.322,82.995],[25.315,82.995]] },
  { id: 4, name: 'Ward 9 Raptipur', district: 'gorakhpur', risk_score: 0.91, risk_level: 'CRITICAL', open_reports: 23, predicted_diseases: ['dengue','cholera'], population: 52000,
    polygon: [[26.752,83.365],[26.759,83.365],[26.759,83.375],[26.752,83.375]] },
]

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png', iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png' })

export default function WardMap() {
  const [wards, setWards] = useState(MOCK_WARDS)
  const [selected, setSelected] = useState(null)
  const [layer, setLayer] = useState('risk') // risk | reports

  useEffect(() => {
    api.get('/official/dashboard').then(r => {
      if (r.data?.wards?.length) setWards(r.data.wards)
    }).catch(() => {})
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1>🗺️ Ward Risk Map</h1>
        <p>Live — Lucknow · Varanasi · Gorakhpur</p>
      </div>

      {/* Layer Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[['risk','🔴 Risk'],['reports','📋 Reports']].map(([k,l]) => (
          <button key={k} className={`btn btn-sm ${layer === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setLayer(k)}>{l}</button>
        ))}
      </div>

      {/* Map */}
      <div className="map-container map-container-lg" style={{ marginBottom: '1.25rem' }}>
        <MapContainer center={[26.85, 80.94]} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution='© <a href="https://osm.org">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {wards.map(w => (
            <Polygon key={w.id} positions={w.polygon}
              pathOptions={{ color: RISK_COLOR[w.risk_level], fillColor: RISK_COLOR[w.risk_level], fillOpacity: 0.35, weight: 2.5 }}
              eventHandlers={{ click: () => setSelected(w) }}>
              <Popup>
                <strong>{w.name}</strong><br />
                Risk: <span style={{ color: RISK_COLOR[w.risk_level], fontWeight: 700 }}>{w.risk_level} ({Math.round(w.risk_score * 100)}%)</span><br />
                Open Reports: {w.open_reports}
              </Popup>
            </Polygon>
          ))}
          {layer === 'reports' && wards.map(w => (
            <CircleMarker key={`m-${w.id}`} center={w.polygon[0]}
              radius={Math.min(5 + w.open_reports, 20)}
              pathOptions={{ color: RISK_COLOR[w.risk_level], fillOpacity: 0.8 }}>
              <Popup>{w.name} — {w.open_reports} open reports</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {Object.entries(RISK_COLOR).map(([l,c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: c, display: 'inline-block' }} />
            {l}
          </div>
        ))}
      </div>

      {/* Ward Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {wards.map(w => (
          <div key={w.id} className={`card ${selected?.id === w.id ? 'ring' : ''}`}
            style={{ borderLeft: `4px solid ${RISK_COLOR[w.risk_level]}`, cursor: 'pointer' }}
            onClick={() => setSelected(w)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{w.name}</p>
              <span className={`risk-chip risk-${w.risk_level.toLowerCase()}`}>{w.risk_level}</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>📋 {w.open_reports} open</span>
              <span>👥 {(w.population/1000).toFixed(0)}k</span>
              {w.predicted_diseases?.length > 0 && <span>🦠 {w.predicted_diseases[0]}</span>}
            </div>
            {w.risk_level === 'CRITICAL' && (
              <div className="alert-banner danger" style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem' }}>
                <span className="pulse-dot red" />
                आपातकालीन कार्रवाई जरूरी
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
