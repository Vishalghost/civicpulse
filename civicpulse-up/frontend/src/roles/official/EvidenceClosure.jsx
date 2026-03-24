import React, { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../utils/api'

// ANTI-GAMING: 4 mandatory fields — all required before closure
const REQUIRED_FIELDS = ['photo_before', 'photo_after', 'geo_tag', 'action_taken']

export default function EvidenceClosure() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const [fields, setFields] = useState({ photo_before: null, photo_after: null, geo_tag: null, action_taken: '' })
  const [previews, setPreviews] = useState({ photo_before: null, photo_after: null })
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rejected, setRejected] = useState(null) // Demo: show rejection
  const beforeRef = useRef(); const afterRef = useRef()

  const handlePhoto = (key, file) => {
    if (!file) return
    setFields(f => ({ ...f, [key]: file }))
    setPreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }))
  }

  const getGPS = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFields(f => ({ ...f, geo_tag: { lat: pos.coords.latitude, lng: pos.coords.longitude } }))
        setLocating(false)
        toast.success('📍 GPS darz hua')
      },
      () => {
        setLocating(false)
        // Demo: set mock location
        setFields(f => ({ ...f, geo_tag: { lat: 26.8467, lng: 80.9462 } }))
        toast('📍 Default location (demo mode)')
      },
      { timeout: 8000 }
    )
  }

  // DEMO: false closure rejection simulation
  const handleDemoReject = () => {
    setRejected({ error: 'EVIDENCE_INCOMPLETE', missing: ['photo_after', 'geo_tag', 'action_taken'] })
    toast.error('❌ DEMO: False closure REJECTED — 3 fields missing')
  }

  const handleSubmit = async () => {
    // Anti-gaming: validate all 4 fields
    const missing = []
    if (!fields.photo_before) missing.push('photo_before')
    if (!fields.photo_after) missing.push('photo_after')
    if (!fields.geo_tag) missing.push('geo_tag')
    if (!fields.action_taken || fields.action_taken.trim().length < 20) missing.push('action_taken (min 20 chars)')

    if (missing.length > 0) {
      setRejected({ error: 'EVIDENCE_INCOMPLETE', missing })
      toast.error(`❌ ${missing.length} field(s) missing`)
      return
    }
    setRejected(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('photo_before', fields.photo_before)
      fd.append('photo_after', fields.photo_after)
      fd.append('geo_lat', fields.geo_tag.lat)
      fd.append('geo_lng', fields.geo_tag.lng)
      fd.append('action_taken', fields.action_taken)
      await api.post(`/official/reports/${reportId}/close`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('✅ रिपोर्ट सफलतापूर्वक बंद की गई')
      navigate('/official/sla')
    } catch (e) {
      const err = e.response?.data
      if (err?.error === 'EVIDENCE_INCOMPLETE') {
        setRejected(err)
        toast.error(`❌ Rejected: ${err.missing?.join(', ')}`)
      } else { toast.error('Closure failed') }
    } finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1>✅ साक्ष्य-सहित बंद करें</h1>
        <p>Evidence-backed closure — Report #{reportId?.slice(-6)}</p>
      </div>

      <div className="alert-banner info" style={{ marginBottom: '1.25rem' }}>
        🛡️ Anti-Gaming: सभी 4 क्षेत्र भरे बिना रिपोर्ट बंद नहीं होगी
      </div>

      {/* Demo: false closure button */}
      <button className="btn btn-danger btn-sm" style={{ marginBottom: '1.25rem' }} onClick={handleDemoReject}>
        🔴 Demo: False Closure Attempt
      </button>

      {/* Rejection Error */}
      {rejected && (
        <div style={{ background: '#FFEBEE', border: '2px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
          <p style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.5rem' }}>
            ❌ 400 EVIDENCE_INCOMPLETE
          </p>
          <p style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#B71C1C' }}>
            {`{ error: "EVIDENCE_INCOMPLETE", missing: ${JSON.stringify(rejected.missing)} }`}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Status remains: in_progress (unchanged)
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>📷 1. पहले की फोटो <span style={{ color: 'var(--danger)' }}>*</span></h3>
        <input type="file" accept="image/*" capture="environment" ref={beforeRef} style={{ display: 'none' }} onChange={e => handlePhoto('photo_before', e.target.files[0])} />
        {previews.photo_before
          ? <img src={previews.photo_before} style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} alt="before" />
          : <button className={`btn btn-full ${fields.photo_before ? 'btn-success' : 'btn-outline'}`} onClick={() => beforeRef.current.click()}>
              📷 Before Photo खींचें
            </button>
        }
        {fields.photo_before && <p style={{ color: 'var(--success)', fontSize: '0.8rem', marginTop: '4px' }}>✅ {fields.photo_before.name}</p>}
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>📷 2. बाद की फोटो <span style={{ color: 'var(--danger)' }}>*</span></h3>
        <input type="file" accept="image/*" capture="environment" ref={afterRef} style={{ display: 'none' }} onChange={e => handlePhoto('photo_after', e.target.files[0])} />
        {previews.photo_after
          ? <img src={previews.photo_after} style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} alt="after" />
          : <button className={`btn btn-full ${fields.photo_after ? 'btn-success' : 'btn-outline'}`} onClick={() => afterRef.current.click()}>
              📷 After Photo खींचें
            </button>
        }
        {fields.photo_after && <p style={{ color: 'var(--success)', fontSize: '0.8rem', marginTop: '4px' }}>✅ {fields.photo_after.name}</p>}
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>📍 3. GPS Location <span style={{ color: 'var(--danger)' }}>*</span></h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Anti-Gaming: GPS must be within 100m of report location
        </p>
        {fields.geo_tag
          ? <div className="alert-banner success">📍 {fields.geo_tag.lat.toFixed(5)}, {fields.geo_tag.lng.toFixed(5)}</div>
          : <button className="btn btn-outline btn-full" onClick={getGPS} disabled={locating}>
              {locating ? '⏳ GPS ढूंढ रहे हैं...' : '📍 GPS Location लें'}
            </button>
        }
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>🔧 4. की गई कार्रवाई <span style={{ color: 'var(--danger)' }}>*</span></h3>
        <textarea className="form-textarea" placeholder="जो कार्रवाई की गई उसका विस्तार से वर्णन करें... (minimum 20 characters)"
          value={fields.action_taken} onChange={e => setFields(f => ({ ...f, action_taken: e.target.value }))} rows={4} />
        <span style={{ fontSize: '0.75rem', color: fields.action_taken.length >= 20 ? 'var(--success)' : 'var(--text-muted)' }}>
          {fields.action_taken.length} / 20 minimum characters
        </span>
      </div>

      {/* Completion Status */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {REQUIRED_FIELDS.map(f => {
          const done = f === 'photo_before' ? !!fields.photo_before : f === 'photo_after' ? !!fields.photo_after : f === 'geo_tag' ? !!fields.geo_tag : fields.action_taken.length >= 20
          return <span key={f} className={`badge ${done ? 'badge-success' : 'badge-danger'}`}>{done ? '✅' : '❌'} {f}</span>
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="btn btn-outline" onClick={() => navigate('/official/sla')}>← वापस</button>
        <button className="btn btn-success btn-full btn-lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '⏳...' : '✅ बंद करें / Submit Closure'}
        </button>
      </div>
    </div>
  )
}
