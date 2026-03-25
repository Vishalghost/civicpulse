import React, { useEffect, useState } from 'react'
import api from '../../utils/api'
import useAuthStore from '../../store/authStore'

const BADGE_TIERS = [
  { min: 0,  id: 'newcomer',  label: 'Newcomer',  icon: '🌱', color: '#558B2F', desc: 'पहली रिपोर्ट करें' },
  { min: 1,  id: 'reporter',  label: 'Reporter',  icon: '📋', color: '#1565C0', desc: 'नागरिक पत्रकार' },
  { min: 5,  id: 'hero',      label: 'Hero',      icon: '⭐', color: '#F57F17', desc: 'वार्ड हीरो' },
  { min: 10, id: 'guardian',  label: 'Guardian',  icon: '🛡️', color: '#6A1B9A', desc: 'समुदाय रक्षक' },
  { min: 20, id: 'champion',  label: 'Champion',  icon: '🏆', color: '#B71C1C', desc: 'स्वास्थ्य चैंपियन' },
]

function getBadge(reportCount) {
  return [...BADGE_TIERS].reverse().find(t => reportCount >= t.min) || BADGE_TIERS[0]
}
function getNextTier(reportCount) {
  return BADGE_TIERS.find(t => t.min > reportCount)
}

export default function CitizenImpactCard() {
  const { user } = useAuthStore()
  const [impact, setImpact] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/citizen/impact/${user?.id || 'demo'}`)
      .then(r => setImpact(r.data))
      .catch(() => {
        // Demo fallback
        setImpact({
          totalReports: 7,
          resolvedReports: 5,
          denguePreventedEstimate: 16,
          wardRiskDelta: -0.12,
          badge: 'hero',
          streakDays: 4,
        })
      })
      .finally(() => setLoading(false))
  }, [user?.id])

  if (loading) return <div className="card"><div className="skeleton" style={{ height: 90 }} /></div>
  if (!impact) return null

  const count = impact.totalReports || 0
  const badge = getBadge(count)
  const nextTier = getNextTier(count)
  const progress = nextTier ? Math.round((count / nextTier.min) * 100) : 100
  const prevented = impact.denguePreventedEstimate || Math.round(count * 2.3)

  return (
    <div className="card" style={{ marginBottom: '1.25rem', borderLeft: `4px solid ${badge.color}`, background: 'var(--surface)' }}>
      {/* Badge Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>आपका योगदान</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>{badge.icon}</span>
            <div>
              <p style={{ fontWeight: 800, fontSize: '1rem', color: badge.color }}>{badge.label}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{badge.desc}</p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>आपकी रिपोर्टें</p>
          <p style={{ fontWeight: 900, fontSize: '1.5rem', color: badge.color, lineHeight: 1 }}>{count}</p>
        </div>
      </div>

      {/* Impact statement */}
      {prevented > 0 && (
        <div style={{ background: '#E8F5E9', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🦟</span>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1B5E20' }}>
            आपकी {count} रिपोर्टों ने ~<strong>{prevented}</strong> डेंगू मामले रोके
          </p>
        </div>
      )}

      {/* Progress to Next Tier */}
      {nextTier && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>अगला: {nextTier.icon} {nextTier.label}</span>
            <span>{count}/{nextTier.min} रिपोर्ट</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: badge.color, borderRadius: 99, transition: 'width 0.8s ease' }} />
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
            {nextTier.min - count} और रिपोर्ट चाहिए
          </p>
        </div>
      )}
      {!nextTier && (
        <div style={{ textAlign: 'center', padding: '0.5rem', background: '#FFF3E0', borderRadius: 'var(--radius-sm)' }}>
          🏆 आप सर्वोच्च स्तर पर हैं — शाबाश!
        </div>
      )}

      {/* Streak */}
      {impact.streakDays > 1 && (
        <p style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          🔥 {impact.streakDays} दिन की streak — बहुत बढ़िया!
        </p>
      )}
    </div>
  )
}
