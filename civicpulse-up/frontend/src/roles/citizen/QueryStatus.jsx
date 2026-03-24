import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import useReportStore from '../../store/reportStore'

const STATUS_CONFIG = {
  submitted:   { color: 'var(--primary)',  bg: '#E8F0FE', label: 'दर्ज की गई', emoji: '📋' },
  assigned:    { color: '#F57C00',         bg: '#FFF3E0', label: 'आवंटित',     emoji: '👷' },
  in_progress: { color: '#1976D2',         bg: '#E3F2FD', label: 'प्रक्रिया में', emoji: '🔧' },
  closed:      { color: 'var(--success)',  bg: '#E8F5E9', label: 'हल की गई',   emoji: '✅' },
  rejected:    { color: 'var(--danger)',   bg: '#FFEBEE', label: 'अस्वीकृत',   emoji: '❌' },
}

const CAT_EMOJI = { drain:'🚰', garbage:'🗑️', water:'💧', mosquito:'🦟', other:'📌' }

export default function QueryStatus() {
  const { queryId } = useParams()
  const { fetchByQueryId, currentReport: report, loading } = useReportStore()
  const navigate = useNavigate()

  useEffect(() => { if (queryId) fetchByQueryId(queryId) }, [queryId])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <div className="spinner" style={{ margin: '0 auto 1rem' }} />
      <p style={{ color: 'var(--text-muted)' }}>स्थिति लोड हो रही है...</p>
    </div>
  )

  if (!report) return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
      <h2 style={{ marginBottom: '0.5rem' }}>नहीं मिला</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Query ID: {queryId}</p>
      <button className="btn btn-primary" onClick={() => navigate('/citizen')}>← होम</button>
    </div>
  )

  const st = STATUS_CONFIG[report.status] || STATUS_CONFIG.submitted
  const slaOk = report.sla_deadline && new Date(report.sla_deadline) > new Date()
  const timelineSteps = [
    { key: 'submitted',   label: 'दर्ज की गई', done: true },
    { key: 'assigned',    label: 'आवंटित',    done: ['assigned','in_progress','closed'].includes(report.status) },
    { key: 'in_progress', label: 'कार्रवाई',  done: ['in_progress','closed'].includes(report.status) },
    { key: 'closed',      label: 'हल की गई', done: report.status === 'closed' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>🔍 शिकायत स्थिति</h1>
        <p>Query Status Tracker</p>
      </div>

      {/* Query ID Box */}
      <div className="query-id-box" style={{ marginBottom: '1.25rem' }}>
        <p className="query-id-label">शिकायत ID / Query ID</p>
        <p className="query-id-value">{report.query_id}</p>
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center', gap: '1rem', opacity: 0.85, fontSize: '0.85rem' }}>
          <span>{CAT_EMOJI[report.category]} {report.category}</span>
          <span>· Ward {report.ward_id}</span>
        </div>
      </div>

      {/* Status Badge */}
      <div style={{ background: st.bg, borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '2rem' }}>{st.emoji}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, color: st.color, fontSize: '1.1rem' }}>{st.label}</p>
          {report.sla_deadline && (
            <p style={{ fontSize: '0.8rem', color: slaOk ? 'var(--success)' : 'var(--danger)' }}>
              {slaOk ? `⏰ SLA: ${formatDistanceToNow(new Date(report.sla_deadline))} remaining` : '🚨 SLA breached — escalated'}
            </p>
          )}
        </div>
        {report.duplicate_count > 1 && (
          <span className="badge badge-warning" style={{ flexShrink: 0 }}>
            +{report.duplicate_count - 1} और
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>📅 प्रगति समयरेखा</h3>
        <div className="timeline">
          {timelineSteps.map(step => (
            <div key={step.key} className="timeline-item">
              <div className={`timeline-dot ${step.done ? (step.key === 'closed' ? 'done' : '') : ''}`}
                style={{ background: step.done ? 'var(--success)' : 'var(--border)' }} />
              <p style={{ fontWeight: step.done ? 600 : 400, color: step.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence (if closed) */}
      {report.status === 'closed' && report.evidence && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>📷 समाधान साक्ष्य</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {report.evidence.photo_before && <div><p style={{ fontSize: '0.75rem', marginBottom: '4px' }}>पहले / Before</p><img src={report.evidence.photo_before} style={{ borderRadius: 8, width: '100%', height: 120, objectFit: 'cover' }} alt="before" /></div>}
            {report.evidence.photo_after && <div><p style={{ fontSize: '0.75rem', marginBottom: '4px' }}>बाद में / After</p><img src={report.evidence.photo_after} style={{ borderRadius: 8, width: '100%', height: 120, objectFit: 'cover' }} alt="after" /></div>}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>🔧 {report.evidence.action_taken}</p>
        </div>
      )}

      {/* Rating */}
      {report.status === 'closed' && !report.citizen_rating && (
        <RatingWidget reportId={report.id} />
      )}

      <button className="btn btn-outline btn-full" onClick={() => navigate('/citizen')}>← होम</button>
    </div>
  )
}

function RatingWidget({ reportId }) {
  const [rating, setRating] = React.useState(0)
  const [submitted, setSubmitted] = React.useState(false)
  const { rateReport } = useReportStore()

  const handleRate = async (r) => {
    setRating(r)
    const ok = await rateReport(reportId, r)
    if (ok) setSubmitted(true)
  }

  if (submitted) return <div className="alert-banner success" style={{ marginBottom: '1rem' }}>✅ रेटिंग दर्ज हो गई — धन्यवाद!</div>

  return (
    <div className="card" style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
      <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>⭐ समाधान से कितने संतुष्ट हैं?</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', fontSize: '2rem' }}>
        {[1,2,3,4,5].map(r => (
          <button key={r} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: r <= rating ? 1 : 0.3, transition: 'opacity 0.2s, transform 0.1s', transform: r <= rating ? 'scale(1.2)' : 'scale(1)' }}
            onClick={() => handleRate(r)}>
            ⭐
          </button>
        ))}
      </div>
    </div>
  )
}
