import React, { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import api from '../../utils/api'
import useAuthStore from '../../store/authStore'

const ACT_CONFIG = {
  drain_cleaned:  { emoji: '🚰', label: 'नाली साफ की', color: '#1565C0' },
  garbage_removed:{ emoji: '🗑️', label: 'कचरा हटाया', color: '#6A1B9A' },
  area_sprayed:   { emoji: '💨', label: 'छिड़काव किया', color: '#00695C' },
  symptom_survey: { emoji: '🏥', label: 'लक्षण सर्वे',  color: '#C62828' },
  water_testing:  { emoji: '💧', label: 'पानी जाँच',   color: '#0277BD' },
  other:          { emoji: '📌', label: 'अन्य',        color: '#558B2F' },
}

const DEMO_LOGS = [
  { id: 'l1', activity_type: 'drain_cleaned', voice_transcript: 'नाली साफ करलीं', created_at: new Date(Date.now() - 7200000).toISOString(), geo_lat: 26.848, geo_lng: 80.944, photo_url: null, synced: 1, ward_id: 1 },
  { id: 'l2', activity_type: 'garbage_removed', voice_transcript: 'कचरा हटइलीं गली से', created_at: new Date(Date.now() - 18000000).toISOString(), geo_lat: 26.851, geo_lng: 80.947, photo_url: null, synced: 1, ward_id: 1 },
  { id: 'l3', activity_type: 'area_sprayed', voice_transcript: 'छिड़काव करलीं', created_at: new Date(Date.now() - 86400000).toISOString(), geo_lat: 26.845, geo_lng: 80.941, photo_url: null, synced: 0, ward_id: 1 },
  { id: 'l4', activity_type: 'symptom_survey', voice_transcript: 'दस घरों का सर्वे, 3 बुखार', created_at: new Date(Date.now() - 172800000).toISOString(), geo_lat: 26.847, geo_lng: 80.943, photo_url: null, synced: 1, ward_id: 1 },
]

export default function ActivityFeed() {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const todayCount  = logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length
  const syncPending = logs.filter(l => !l.synced).length

  useEffect(() => {
    api.get('/worker/my-reports')
      .then(r => setLogs(r.data.logs || []))
      .catch(() => setLogs(DEMO_LOGS))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1>📋 Activity Feed</h1>
        <p>Recent worker activity logs — {user?.name || 'कर्मचारी'}</p>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-value">{todayCount}</div>
          <div className="stat-label">आज के काम</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{logs.length}</div>
          <div className="stat-label">कुल लॉग्स</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: syncPending > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {syncPending}
          </div>
          <div className="stat-label">Sync बाकी</div>
        </div>
      </div>

      {syncPending > 0 && (
        <div className="alert-banner warning" style={{ marginBottom: '1rem' }}>
          📵 {syncPending} लॉग ऑफलाइन हैं — नेटवर्क मिलने पर sync होगा
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📭</div>
          <p>अभी तक कोई गतिविधि दर्ज नहीं।</p>
          <p style={{ fontSize: '0.8rem' }}>Voice Logger से काम दर्ज करें।</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {logs.map(log => {
            const cfg = ACT_CONFIG[log.activity_type] || ACT_CONFIG.other
            const isToday = new Date(log.created_at).toDateString() === new Date().toDateString()
            return (
              <div key={log.id} className="card" style={{
                borderLeft: `4px solid ${cfg.color}`,
                opacity: log.synced ? 1 : 0.75,
              }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{cfg.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', color: cfg.color }}>{cfg.label}</p>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                        {!log.synced && <span style={{ fontSize: '0.65rem', background: 'var(--warning)', color: 'white', padding: '2px 6px', borderRadius: 100, fontWeight: 700 }}>OFFLINE</span>}
                        {isToday && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 100, fontWeight: 700 }}>आज</span>}
                      </div>
                    </div>
                    {log.voice_transcript && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🎤 "{log.voice_transcript.slice(0, 55)}"
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>🕐 {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : '—'}</span>
                      {log.geo_lat && <span>📍 {Number(log.geo_lat).toFixed(3)}°, {Number(log.geo_lng).toFixed(3)}°</span>}
                      {log.photo_url && <span>📷</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
