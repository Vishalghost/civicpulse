import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import api from '../../utils/api'
import CitizenImpactCard from './CitizenImpactCard'

export default function CitizenHome() {
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [queryId, setQueryId] = useState('')

  const handleCheck = (e) => {
    e.preventDefault()
    if (queryId.trim()) navigate(`/citizen/status/${queryId.trim().toUpperCase()}`)
  }

  return (
    <div style={{ paddingTop: '0.5rem' }}>
      {/* Greeting */}
      <div style={{ background: 'linear-gradient(135deg, #1A73E8, #1557B0)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem', color: 'white' }}>
        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>नमस्ते / Hello</p>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{user?.name || 'नागरिक'}</h1>
        <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>वार्ड {user?.ward_id || '12'} · {user?.district || 'लखनऊ'}</p>
      </div>

      {/* Quick Actions */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <button className="stat-card" onClick={() => navigate('/citizen/report')} style={{ cursor: 'pointer', border: '2px solid var(--primary)' }}>
          <div style={{ fontSize: '1.75rem' }}>📋</div>
          <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: '0.25rem', fontSize: '0.9rem' }}>शिकायत करें</div>
          <div className="stat-label">Submit Report</div>
        </button>
        <button className="stat-card" onClick={() => navigate('/citizen/board')} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '1.75rem' }}>📊</div>
          <div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.9rem' }}>वार्ड बोर्ड</div>
          <div className="stat-label">Ward Board</div>
        </button>
        <button className="stat-card" onClick={() => navigate('/citizen/map')} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '1.75rem' }}>🗺️</div>
          <div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.9rem' }}>नक्शा</div>
          <div className="stat-label">OSM Pin Map</div>
        </button>
        <button className="stat-card" onClick={() => navigate('/citizen/chat')} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '1.75rem' }}>💬</div>
          <div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.9rem' }}>AI चैट</div>
          <div className="stat-label">Health Chatbot</div>
        </button>
        <a className="stat-card" href={`https://wa.me/919415000000`} target="_blank" rel="noreferrer" style={{ cursor: 'pointer', textDecoration: 'none' }}>
          <div style={{ fontSize: '1.75rem' }}>📲</div>
          <div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.9rem', color: '#25D366' }}>WhatsApp</div>
          <div className="stat-label">Emergency</div>
        </a>
      </div>

      {/* Check Query Status */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '1rem' }}>🔍 शिकायत स्थिति जाँचें</h2>
        <form onSubmit={handleCheck} style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="form-input" style={{ flex: 1 }} placeholder="LKO-2024-00123"
            value={queryId} onChange={e => setQueryId(e.target.value)} />
          <button type="submit" className="btn btn-primary">जाँचें</button>
        </form>
      </div>

      {/* Ward Risk */}
      <WardRiskCard wardId={user?.ward_id || 1} />

      {/* Community Impact / Gamification */}
      <CitizenImpactCard />
    </div>
  )
}

function WardRiskCard({ wardId }) {
  const [risk, setRisk] = React.useState(null)
  React.useEffect(() => {
    api.get(`/wards/${wardId}/risk`).then(r => setRisk(r.data)).catch(() =>
      setRisk({ risk_level: 'MEDIUM', risk_score: 0.54, predicted_diseases: ['dengue'], ward_name: 'Ward 12 Aminabad' })
    )
  }, [wardId])

  if (!risk) return <div className="card"><div className="skeleton" style={{ height: 80 }} /></div>

  const levelMap = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' }
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>आपके वार्ड का जोखिम</p>
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>{risk.ward_name || `Ward ${wardId}`}</p>
        </div>
        <span className={`risk-chip risk-${levelMap[risk.risk_level] || 'medium'}`}>
          {risk.risk_level} · {Math.round((risk.risk_score || 0.5) * 100)}%
        </span>
      </div>
      {risk.predicted_diseases?.length > 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          🦠 जोखिम: {risk.predicted_diseases.join(', ')}
        </p>
      )}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>AI Model — 5-10 day forecast</p>
    </div>
  )
}
