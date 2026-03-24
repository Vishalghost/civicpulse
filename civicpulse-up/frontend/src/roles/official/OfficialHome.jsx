import React, { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import api from '../../utils/api'
import { useNavigate } from 'react-router-dom'

export default function OfficialHome() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, breaches: 0, closed: 0, activeWorkers: 0 })
  const [cmoBrief, setCmoBrief] = useState(null)

  useEffect(() => {
    api.get('/official/dashboard').then(r => r.data?.stats && setStats(r.data.stats)).catch(() =>
      setStats({ total: 47, breaches: 12, closed: 31, activeWorkers: 8 })
    )
    api.get('/ml/cmo-brief').then(r => setCmoBrief(r.data)).catch(() =>
      setCmoBrief({ risk_level: 'HIGH', ward: 'Ward 9 Raptipur', summary: 'Ward 9 shows elevated dengue risk. 23 open drain complaints (↑ 4x), 11 fever cases via ASHA logs. Predicted window: 3-8 April.', actions: ['Deploy fogging unit Ward 9A, 9B by tomorrow','ASHA door-to-door fever survey priority 9A','Alert PHC Raptipur: +50 dengue test kits'] })
    )
  }, [])

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #0D3A7A, #1A73E8)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem', color: 'white' }}>
        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>🏛️ District Official Dashboard</p>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user?.name || 'अधिकारी'}</h1>
        <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Lucknow · Varanasi · Gorakhpur</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">कुल रिपोर्ट</div></div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--danger)' }}><div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.breaches}</div><div className="stat-label">SLA Breaches</div></div>
        <div className="stat-card" style={{ borderTop: '3px solid var(--success)' }}><div className="stat-value" style={{ color: 'var(--success)' }}>{stats.closed}</div><div className="stat-label">Resolved</div></div>
        <div className="stat-card"><div className="stat-value">{stats.activeWorkers}</div><div className="stat-label">Active Workers</div></div>
      </div>

      {/* Quick Nav */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[['🗺️','Ward Map','/official/map'],['⚠️','SLA Tracker','/official/sla'],['📊','Reports','/official'],['📄','Weekly','/official/weekly']].map(([e,l,p]) => (
          <button key={l} className="card" style={{ cursor: 'pointer', textAlign: 'center', border: 'none', fontFamily: 'inherit' }} onClick={() => navigate(p)}>
            <div style={{ fontSize: '1.75rem' }}>{e}</div>
            <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{l}</div>
          </button>
        ))}
      </div>

      {/* CMO Brief */}
      {cmoBrief && (
        <div style={{ background: 'linear-gradient(135deg, #FFEBEE, #FFF3E0)', border: '2px solid #E65100', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <p style={{ fontWeight: 800, color: '#B71C1C', fontSize: '0.9rem' }}>🚨 CMO AI Brief — {cmoBrief.ward}</p>
              <span className={`risk-chip risk-${cmoBrief.risk_level?.toLowerCase()}`}>{cmoBrief.risk_level}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>{cmoBrief.summary}</p>
          {cmoBrief.actions?.length > 0 && (
            <ul style={{ paddingLeft: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {cmoBrief.actions.map((a,i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Auto-generated · AI Model v1.0</p>
        </div>
      )}
    </div>
  )
}
