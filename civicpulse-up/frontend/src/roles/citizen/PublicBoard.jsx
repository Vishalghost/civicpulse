import React, { useEffect, useState } from 'react'
import useReportStore from '../../store/reportStore'
import useAuthStore from '../../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

const STATUS_CONFIG = {
  submitted:   { badge: 'badge-info',    label: 'दर्ज' },
  assigned:    { badge: 'badge-warning', label: 'आवंटित' },
  in_progress: { badge: 'badge-info',    label: 'कार्रवाई' },
  closed:      { badge: 'badge-success', label: 'हल' },
  rejected:    { badge: 'badge-danger',  label: 'अस्वीकृत' },
}
const CAT_EMOJI = { drain:'🚰', garbage:'🗑️', water:'💧', mosquito:'🦟', other:'📌' }

export default function PublicBoard() {
  const { user } = useAuthStore()
  const { reports, fetchWardReports, loading } = useReportStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchWardReports(user?.ward_id || 1) }, [user?.ward_id])

  const filtered = reports.filter(r => filter === 'all' || r.status === filter)
  const stats = {
    total: reports.length,
    open: reports.filter(r => !['closed','rejected'].includes(r.status)).length,
    closed: reports.filter(r => r.status === 'closed').length,
  }

  return (
    <div>
      <div className="page-header">
        <h1>📊 वार्ड बोर्ड</h1>
        <p>Public complaint resolution board — Ward {user?.ward_id || 1}</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">कुल शिकायतें</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.open}</div><div className="stat-label">खुली</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--success)' }}>{stats.closed}</div><div className="stat-label">हल की गईं</div></div>
        <div className="stat-card"><div className="stat-value">{stats.total ? Math.round((stats.closed / stats.total) * 100) : 0}%</div><div className="stat-label">समाधान दर</div></div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        {['all','submitted','in_progress','closed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} style={{ whiteSpace: 'nowrap' }}>
            {f === 'all' ? 'सभी' : STATUS_CONFIG[f]?.label || f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>कोई शिकायत नहीं</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(r => {
            const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.submitted
            const breached = r.sla_deadline && new Date(r.sla_deadline) < new Date() && r.status !== 'closed'
            return (
              <div key={r.id} className="card" style={{ cursor: 'pointer', borderLeft: `4px solid ${breached ? 'var(--danger)' : r.status === 'closed' ? 'var(--success)' : 'var(--primary)'}` }}
                onClick={() => navigate(`/citizen/status/${r.query_id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{CAT_EMOJI[r.category] || '📌'}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{r.query_id}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {breached && <span className="pulse-dot red" />}
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', lineHeight: 1.4 }}>
                  {r.description?.slice(0, 60)}...
                </p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : 'अभी'}</span>
                  {r.duplicate_count > 1 && <span>+{r.duplicate_count - 1} और रिपोर्ट</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
