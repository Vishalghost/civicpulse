import React, { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import api from '../../utils/api'
import { useNavigate } from 'react-router-dom'

export default function WorkerHome() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])

  useEffect(() => {
    api.get('/worker/my-reports').then(r => setLogs(r.data?.logs || [])).catch(() =>
      setLogs([{ id: 1, activity_type: 'drain_cleaned', created_at: new Date().toISOString(), ward_id: 1, synced: true }])
    )
  }, [])

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #2E7D32, #388E3C)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.25rem', color: 'white' }}>
        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>🧹 Field Worker</p>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user?.name || 'कर्मचारी'}</h1>
        <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Ward {user?.ward_id || 1}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button className="card" style={{ cursor: 'pointer', textAlign: 'center', border: 'none', fontFamily: 'inherit' }} onClick={() => navigate('/worker/log')}>
          <div style={{ fontSize: '2rem' }}>🎤</div><div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.85rem' }}>Log Activity</div>
        </button>
        <button className="card" style={{ cursor: 'pointer', textAlign: 'center', border: 'none', fontFamily: 'inherit' }} onClick={() => navigate('/worker/evidence')}>
          <div style={{ fontSize: '2rem' }}>📷</div><div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.85rem' }}>Evidence</div>
        </button>
        <button className="card" style={{ cursor: 'pointer', textAlign: 'center', border: 'none', fontFamily: 'inherit', background: 'linear-gradient(135deg,#1a237e11,#7c4dff11)', borderTop: '3px solid #7c4dff' }} onClick={() => navigate('/worker/video')}>
          <div style={{ fontSize: '2rem' }}>📹</div><div style={{ fontWeight: 700, marginTop: '0.25rem', fontSize: '0.85rem', color: '#7c4dff' }}>Live Video</div>
        </button>
      </div>
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📋 आज की गतिविधि</h3>
        {logs.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>कोई गतिविधि नहीं</p> :
          logs.slice(0,5).map((l,i) => <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
            <span>🔧 {l.activity_type?.replace('_',' ')}</span>
            <span className={`badge ${l.synced ? 'badge-success' : 'badge-warning'}`}>{l.synced ? '✅ Synced' : '⏳ Pending'}</span>
          </div>)
        }
      </div>
    </div>
  )
}
