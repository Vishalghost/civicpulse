import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, differenceInMinutes } from 'date-fns'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const CAT_EMOJI = { drain:'🚰', garbage:'🗑️', water:'💧', mosquito:'🦟', other:'📌' }

export default function SLATracker() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchBreaches = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/official/sla-breaches')
      setReports(data.reports || [])
    } catch {
      // Demo data
      setReports([
        { id: 'r1', query_id: 'LKO-2024-00123', category: 'drain', description: 'Ward 12 main road drain blocked since 3 days', ward_id: 1, ward_name: 'Ward 12 Aminabad', status: 'submitted', sla_deadline: new Date(Date.now() - 6*3600*1000).toISOString(), breach_level: 2, duplicate_count: 4, created_at: new Date(Date.now() - 10*3600*1000).toISOString() },
        { id: 'r2', query_id: 'VNS-2024-00056', category: 'garbage', description: 'Garbage pile near school Kabir Nagar', ward_id: 2, ward_name: 'Ward 7 Chowk', status: 'assigned', sla_deadline: new Date(Date.now() - 2*3600*1000).toISOString(), breach_level: 1, duplicate_count: 2, created_at: new Date(Date.now() - 6*3600*1000).toISOString() },
        { id: 'r3', query_id: 'GKP-2024-00091', category: 'water', description: 'Water contamination reported near well', ward_id: 4, ward_name: 'Ward 9 Raptipur', status: 'submitted', sla_deadline: new Date(Date.now() - 26*3600*1000).toISOString(), breach_level: 3, duplicate_count: 9, created_at: new Date(Date.now() - 30*3600*1000).toISOString() },
      ])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchBreaches() }, [])

  const getBreach = (r) => {
    const mins = differenceInMinutes(new Date(), new Date(r.sla_deadline))
    if (mins > 24 * 60) return { label: `${Math.floor(mins/60)}h breached`, color: 'var(--danger)', tier: 'T3 — CMO' }
    if (mins > 8 * 60) return { label: `${Math.floor(mins/60)}h breached`, color: 'var(--danger)', tier: 'T2 — Councillor' }
    if (mins > 0) return { label: `${Math.floor(mins/60)}h breached`, color: 'var(--warning)', tier: 'T1 — Senior' }
    return { label: `${Math.abs(Math.floor(mins/60))}h left`, color: 'var(--success)', tier: '' }
  }

  const handleAssign = async (reportId) => {
    try {
      await api.post(`/official/reports/${reportId}/assign`, { worker_id: 'demo-worker' })
      toast.success('आवंटित किया')
      fetchBreaches()
    } catch { toast.error('आवंटन विफल') }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      <div className="page-header">
        <h1>⚠️ SLA Breach Tracker</h1>
        <p>Auto-escalation every 15 minutes</p>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card" style={{ borderTop: '4px solid var(--danger)' }}>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{reports.filter(r => r.breach_level >= 3).length}</div>
          <div className="stat-label">CMO Escalated</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid var(--warning)' }}>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{reports.filter(r => r.breach_level === 2).length}</div>
          <div className="stat-label">Councillor Tier</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{reports.filter(r => r.breach_level === 1).length}</div>
          <div className="stat-label">Senior Official</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{reports.reduce((s,r) => s + (r.duplicate_count || 1), 0)}</div>
          <div className="stat-label">Total Reports</div>
        </div>
      </div>

      {/* Breach List */}
      {reports.length === 0 ? (
        <div className="alert-banner success">✅ कोई SLA उल्लंघन नहीं — सभी रिपोर्ट समय पर</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reports.sort((a,b) => new Date(a.sla_deadline) - new Date(b.sla_deadline)).map(r => {
            const breach = getBreach(r)
            return (
              <div key={r.id} className="card" style={{ borderLeft: `5px solid ${breach.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span className="pulse-dot red" />
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.9rem' }}>{r.query_id}</span>
                      <span className="badge badge-danger">{breach.tier}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.ward_name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, color: breach.color, fontSize: '0.85rem' }}>{breach.label}</p>
                    {r.duplicate_count > 1 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{r.duplicate_count-1} dupes</p>}
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>{CAT_EMOJI[r.category]} {r.description?.slice(0,80)}</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => handleAssign(r.id)}>👷 Assign</button>
                  <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/official/close/${r.id}`)}>✅ Close with Evidence</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
