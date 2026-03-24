import React from 'react'
import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { emoji: '📋', title: 'Transparent Query Tracking', desc: 'Every complaint gets a public Query ID with real-time status' },
  { emoji: '🤖', title: 'AI Outbreak Prediction', desc: '5-10 day ward risk scores trained on community data' },
  { emoji: '🎤', title: 'Voice UI in 6 Languages', desc: 'Hindi, Bhojpuri, Awadhi, Maithili, Urdu — zero literacy needed' },
  { emoji: '⚡', title: 'Auto SLA Escalation', desc: '4-hour breach → auto-escalation + SMS to officials & CMO' },
  { emoji: '🗺️', title: 'Live Ward Dashboard', desc: 'Real-time Leaflet map with risk choropleth for officials' },
  { emoji: '📵', title: 'Offline-First', desc: '72-hour offline resilience; works on 2G network' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100dvh', background: '#0D1B3E', color: 'white', overflow: 'hidden' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #1A73E8 0%, #0D3A7A 60%, #081C3B 100%)', padding: '4rem 1.5rem 6rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.05) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏥</div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 800, marginBottom: '0.5rem', lineHeight: 1.2 }}>
          CivicPulse UP
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.85, marginBottom: '0.5rem' }}>नगरीय स्वास्थ्य मंच</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.65, marginBottom: '2rem', maxWidth: '480px', margin: '0 auto 2rem' }}>
          Community Civic-Health Platform — Lucknow · Varanasi · Gorakhpur
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-lg" style={{ background: 'white', color: '#1A73E8' }} onClick={() => navigate('/login')}>
            🚀 Get Started
          </button>
          <button className="btn btn-lg btn-outline" style={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}
            onClick={() => navigate('/public/board/1')}>
            📊 View Public Board
          </button>
        </div>
        {/* Role Badges */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
          {[['🏙️','Citizen'],['🧹','Field Worker'],['🏛️','Official']].map(([e,l]) => (
            <span key={l} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '100px', padding: '6px 16px', fontSize: '0.85rem', backdropFilter: 'blur(8px)' }}>
              {e} {l}
            </span>
          ))}
        </div>
      </div>

      {/* Stats Strip */}
      <div style={{ background: '#1A73E8', padding: '1.5rem', display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
        {[['3','Districts'],['6','Languages'],['4h','SLA Timer'],['5-10','Day AI Forecast']].map(([v,l]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{v}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ padding: '3rem 1.5rem', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Platform Features</h2>
        <p style={{ textAlign: 'center', opacity: 0.6, marginBottom: '2rem', fontSize: '0.9rem' }}>One app. Three roles. Shared data layer.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '1.25rem', transition: 'background 0.2s' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{f.emoji}</div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{f.title}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: 'rgba(26,115,232,0.15)', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <p style={{ opacity: 0.7, marginBottom: '1rem', fontSize: '0.9rem' }}>24-Hour Social Innovation Hackathon Demo</p>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>हर शिकायत का जवाब — हर बार / Every query resolved, every time</h2>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
          शुरू करें / Start Now →
        </button>
      </div>
    </div>
  )
}
