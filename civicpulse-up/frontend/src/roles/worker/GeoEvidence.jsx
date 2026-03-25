import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import useAuthStore from '../../store/authStore'
import VideoCapture from '../../components/VideoCapture'

const speak = (text, lang = 'hi-IN', rate = 0.85) => {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang; u.rate = rate
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch { /* no TTS available */ }
}

export default function GeoEvidence() {
  const { i18n } = useTranslation()
  const { user } = useAuthStore()
  const isBhojpuri = i18n.language === 'bho'

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState(0) // 0=list, 1=photo-before, 2=photo-after, 3=confirm, 4=success
  const [photoBefore, setPhotoBefore] = useState(null)
  const [photoBeforePreview, setPhotoBeforePreview] = useState(null)
  const [photoAfter, setPhotoAfter] = useState(null)
  const [photoAfterPreview, setPhotoAfterPreview] = useState(null)
  const [location, setLocation] = useState(null)
  const [actionNote, setActionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [videoEvidenceId, setVideoEvidenceId] = useState(null)

  const beforeRef = useRef()
  const afterRef = useRef()

  useEffect(() => {
    api.get('/worker/my-reports')
      .then(r => {
        const assigned = (r.data.logs || []).filter(l => l.activity_type === 'assigned' || l.status === 'assigned')
        // Also show all open from my-reports
        setReports(r.data.logs?.slice(0, 10) || [])
      })
      .catch(() => {
        // Demo data for offline/demo mode
        setReports([
          { id: 'r1', query_id: 'LKO-2026-00001', activity_type: 'drain_cleaned', created_at: new Date().toISOString(), ward_id: 1, voice_transcript: 'नाली साफ की' },
          { id: 'r2', query_id: 'LKO-2026-00002', activity_type: 'garbage_removed', created_at: new Date(Date.now() - 3600000).toISOString(), ward_id: 1, voice_transcript: 'कचरा हटाया' },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const getLocation = () => new Promise(resolve =>
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({ lat: 26.8467, lng: 80.9462 }) // Lucknow fallback
    )
  )

  const startEvidence = async (report) => {
    setSelected(report)
    const loc = await getLocation()
    setLocation(loc)
    speak(isBhojpuri ? 'पहिले से पहले वाला फोटो खींचीं।' : 'पहले की स्थिति का फोटो लें।')
    setStep(1)
  }

  const handlePhotoBefore = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoBefore(file)
    setPhotoBeforePreview(URL.createObjectURL(file))
    speak(isBhojpuri ? 'अब काम करके बाद में फोटो खींचीं।' : 'अब काम करने के बाद का फोटो लें।')
    setStep(2)
  }

  const handlePhotoAfter = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoAfter(file)
    setPhotoAfterPreview(URL.createObjectURL(file))
    speak(isBhojpuri ? 'का काम कईलीं, बताईं।' : 'क्या काम किया, बताएं।')
    setStep(3)
  }

  const handleSubmit = async () => {
    if (!photoBefore || !photoAfter) {
      toast.error('दोनों फोटो जरूरी हैं'); return
    }
    if (actionNote.trim().length < 20) {
      toast.error('कम से कम 20 अक्षर का विवरण दर्ज करें'); return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('photo_before', photoBefore)
      fd.append('photo_after', photoAfter)
      fd.append('geo_lat', location?.lat || 26.8467)
      fd.append('geo_lng', location?.lng || 80.9462)
      fd.append('action_taken', actionNote.trim())

      // Use selected report id or fallback to demo
      const reportId = selected?.report_id || selected?.id || 'demo'
      await api.post(`/official/reports/${reportId}/close`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      speak(isBhojpuri ? 'शाबाश! काम दर्ज हो गइल।' : 'शाबाश! काम दर्ज हो गया।')
      setStep(4)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error
      if (msg?.includes('supervisor')) {
        speak('जाँच के लिए भेजा गया। धन्यवाद।')
        toast.success('✅ सुपरवाइज़र समीक्षा के लिए भेजा गया')
        setStep(4)
      } else {
        toast.error('Submit नहीं हुआ — पुनः प्रयास करें')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep(0); setSelected(null)
    setPhotoBefore(null); setPhotoBeforePreview(null)
    setPhotoAfter(null); setPhotoAfterPreview(null)
    setActionNote(''); setLocation(null)
  }

  const CAT_EMOJI = { drain_cleaned: '🚰', garbage_removed: '🗑️', area_sprayed: '💨', symptom_survey: '🏥', water_testing: '💧', assigned: '📋', other: '📌' }

  return (
    <div>
      {/* SCREEN 0: Report List */}
      {step === 0 && (
        <div className="page-enter">
          <div className="page-header">
            <h1>📷 Geo-tagged Evidence</h1>
            <p>Photo + GPS proof for completed work</p>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
            </div>
          ) : reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📋</div>
              <p>कोई काम असाइन नहीं है।</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {reports.map(r => (
                <div key={r.id} className="card" style={{ cursor: 'pointer', borderLeft: '4px solid var(--primary)' }}
                  onClick={() => startEvidence(r)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.75rem' }}>{CAT_EMOJI[r.activity_type] || '📌'}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{r.query_id || r.id}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.voice_transcript?.slice(0, 40) || r.activity_type}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '1.25rem' }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="alert-banner info" style={{ marginTop: '1rem' }}>
            📷 प्रत्येक काम के लिए पहले और बाद का फोटो + GPS जरूरी है
          </div>
        </div>
      )}

      {/* SCREEN 1: Photo Before */}
      {step === 1 && (
        <div className="page-enter" style={{ textAlign: 'center', maxWidth: 340, margin: '0 auto' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📸</div>
          <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>पहले की स्थिति</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>🔊 काम शुरू करने से पहले फोटो लें</p>
          <input type="file" accept="image/*" capture="environment" ref={beforeRef} style={{ display: 'none' }} onChange={handlePhotoBefore} />
          <button className="btn btn-primary btn-full btn-lg" onClick={() => beforeRef.current.click()}>
            📷 BEFORE फोटो खींचें
          </button>
          <button className="btn btn-ghost btn-full" style={{ marginTop: '0.75rem' }} onClick={reset}>❌ रद्द करें</button>
        </div>
      )}

      {/* SCREEN 2: Photo After */}
      {step === 2 && (
        <div className="page-enter" style={{ textAlign: 'center', maxWidth: 340, margin: '0 auto' }}>
          {photoBeforePreview && <img src={photoBeforePreview} alt="before" style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: '1rem', maxHeight: 180, objectFit: 'cover' }} />}
          <div className="alert-banner success" style={{ marginBottom: '1rem' }}>✅ पहले का फोटो मिला</div>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔨</div>
          <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>अब काम करें, फिर AFTER फोटो लें</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>🔊 Kaam karne ke baad photo khainchein</p>
          <input type="file" accept="image/*" capture="environment" ref={afterRef} style={{ display: 'none' }} onChange={handlePhotoAfter} />
          <button className="btn btn-success btn-full btn-lg" onClick={() => afterRef.current.click()}>
            📷 AFTER फोटो खींचें
          </button>
        </div>
      )}

      {/* SCREEN 3: Note + Video + Submit */}
      {step === 3 && (
        <div className="page-enter" style={{ maxWidth: 380, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
            {photoBeforePreview && <div><p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>BEFORE</p><img src={photoBeforePreview} alt="before" style={{ width: '100%', borderRadius: 'var(--radius-sm)', height: 100, objectFit: 'cover' }} /></div>}
            {photoAfterPreview && <div><p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>AFTER</p><img src={photoAfterPreview} alt="after" style={{ width: '100%', borderRadius: 'var(--radius-sm)', height: 100, objectFit: 'cover' }} /></div>}
          </div>
          <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
            📍 GPS: {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'मिल रहा है...'}
          </div>

          {/* ── Video Evidence (optional) ── */}
          <VideoCapture
            reportId={selected?.query_id || selected?.id}
            maxSeconds={60}
            onUpload={id => setVideoEvidenceId(id)}
          />

          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">🔊 क्या काम किया? (min 20 chars)</label>
            <textarea className="form-textarea" rows={3} placeholder="विवरण लिखें..."
              value={actionNote} onChange={e => setActionNote(e.target.value)} />
            <span style={{ fontSize: '0.75rem', color: actionNote.length >= 20 ? 'var(--success)' : 'var(--text-muted)' }}>
              {actionNote.length} / 20 minimum
            </span>
          </div>
          {videoEvidenceId && (
            <div className="alert-banner info" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
              📹 वीडियो जुड़ा: <strong>{videoEvidenceId.slice(0, 8)}...</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" onClick={reset}>❌</button>
            <button className="btn btn-success btn-full btn-lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '⏳ भेज रहे हैं...' : '✅ Evidence जमा करें'}
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 4: Success */}
      {step === 4 && (
        <div className="page-enter" style={{ textAlign: 'center', maxWidth: 340, margin: '4rem auto' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>👍</div>
          <h2 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Evidence दर्ज हो गया!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Supervisor review के बाद शिकायत बंद होगी।</p>
          <button className="btn btn-primary btn-full" onClick={reset}>📋 दूसरा काम दर्ज करें</button>
        </div>
      )}
    </div>
  )
}
