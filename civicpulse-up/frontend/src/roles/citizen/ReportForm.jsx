import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import useReportStore from '../../store/reportStore'
import useAuthStore from '../../store/authStore'
import VoiceReporter from '../../components/VoiceReporter'
import CameraCapture from '../../components/CameraCapture'

const CATEGORIES = [
  { id: 'drain', emoji: '🚰', label: 'नाली बंद', sublabel: 'Blocked Drain' },
  { id: 'garbage', emoji: '🗑️', label: 'कचरा', sublabel: 'Garbage Dump' },
  { id: 'water', emoji: '💧', label: 'दूषित पानी', sublabel: 'Contaminated Water' },
  { id: 'mosquito', emoji: '🦟', label: 'मच्छर', sublabel: 'Mosquito Breeding' },
  { id: 'other', emoji: '📌', label: 'अन्य', sublabel: 'Other' },
]

export default function ReportForm() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { submitReport, submitting } = useReportStore()
  const { user } = useAuthStore()
  const fileRef = useRef()
  const galleryRef = useRef()

  const [step, setStep] = useState(1)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [showCamera, setShowCamera] = useState(false)
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const getLocation = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      () => { toast.error('Location unavailable — मैन्युअल जारी रखें'); setLocating(false) },
      { timeout: 8000 }
    )
  }

  const handleSubmit = async () => {
    if (!category) { toast.error('कृपया श्रेणी चुनें'); return }
    if (!description.trim() || description.length < 10) { toast.error('कम से कम 10 अक्षर का विवरण दर्ज करें'); return }

    const fd = new FormData()
    fd.append('category', category)
    fd.append('description', description)
    fd.append('ward_id', user?.ward_id || 1)
    if (photo) fd.append('photo', photo)
    if (location) { fd.append('lat', location.lat); fd.append('lng', location.lng) }

    const result = await submitReport(fd)
    if (result) {
      toast.success(result.offline ? '📵 ऑफलाइन — नेटवर्क पर भेजा जाएगा' : '✅ शिकायत दर्ज हो गई!')
      if (!result.offline) navigate(`/citizen/status/${result.queryId}`)
      else navigate('/citizen')
    } else {
      toast.error('Submit failed — कृपया पुनः प्रयास करें')
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>📋 शिकायत दर्ज करें</h1>
        <p>Submit a hazard report for your ward</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: step >= s ? 'var(--primary)' : 'var(--border)', transition: 'background 0.3s' }} />
        ))}
      </div>

      {/* STEP 1: Category */}
      {step === 1 && (
        <div className="page-enter">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '1rem' }}>समस्या का प्रकार चुनें</p>
            <div className="pictogram-grid">
              {CATEGORIES.map(c => (
                <button key={c.id} className={`pictogram-btn ${category === c.id ? 'active' : ''}`}
                  onClick={() => setCategory(c.id)}>
                  <span className="pictogram-icon">{c.emoji}</span>
                  <span>{c.label}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{c.sublabel}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" onClick={() => { if (!category) { toast.error('श्रेणी चुनें'); return }; setStep(2) }}>
            आगे → Next
          </button>
        </div>
      )}

      {/* STEP 2: Details */}
      {step === 2 && (
        <div className="page-enter">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '2rem' }}>{CATEGORIES.find(c=>c.id===category)?.emoji}</span>
              <div>
                <p style={{ fontWeight: 700 }}>{CATEGORIES.find(c=>c.id===category)?.label}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{CATEGORIES.find(c=>c.id===category)?.sublabel}</p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">विवरण / Description</label>
              <VoiceReporter onTranscript={t => setDescription(prev => prev ? prev + ' ' + t : t)} />
              <textarea className="form-textarea" placeholder="समस्या का विस्तार से वर्णन करें... (min 10 chars)"
                value={description} onChange={e => setDescription(e.target.value)} rows={4} />
              <span style={{ fontSize: '0.75rem', color: description.length >= 10 ? 'var(--success)' : 'var(--text-muted)' }}>
                {description.length} / 10 minimum
              </span>
            </div>

            {/* Photo */}
            <div className="form-group">
              <label className="form-label">📷 फोटो (वैकल्पिक)</label>
              {/* Camera — opens device camera directly */}
              <input type="file" accept="image/*" capture="environment" ref={fileRef} style={{ display: 'none' }} onChange={handlePhoto} />
              {/* Gallery — lets user pick existing photo */}
              <input type="file" accept="image/*" ref={galleryRef} style={{ display: 'none' }} onChange={handlePhoto} />
              {photoPreview
                ? <div style={{ position: 'relative' }}>
                    <img src={photoPreview} style={{ width: '100%', borderRadius: 'var(--radius-sm)', maxHeight: 200, objectFit: 'cover' }} alt="preview" />
                    <button style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }} onClick={() => { setPhoto(null); setPhotoPreview(null) }}>✕</button>
                  </div>
                : <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowCamera(true)}>
                      📸 Camera
                    </button>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => galleryRef.current.click()}>
                      🖼️ Gallery
                    </button>
                  </div>
              }
            </div>

            {/* Live webcam overlay */}
            {showCamera && (
              <CameraCapture
                onCapture={(file) => {
                  setPhoto(file)
                  setPhotoPreview(URL.createObjectURL(file))
                  setShowCamera(false)
                }}
                onClose={() => setShowCamera(false)}
              />
            )}

            {/* Location */}
            <div className="form-group">
              <label className="form-label">📍 स्थान</label>
              {location
                ? <div className="alert-banner success">✅ स्थान दर्ज हुआ ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</div>
                : <button className="btn btn-outline btn-full" onClick={getLocation} disabled={locating}>
                    {locating ? '⏳ स्थान ढूंढ रहे हैं...' : '📍 Location लें (GPS)'}
                  </button>
              }
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>← वापस</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)}>
              आगे → Review
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Submit */}
      {step === 3 && (
        <div className="page-enter">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>📝 समीक्षा करें / Review</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>{CATEGORIES.find(c=>c.id===category)?.emoji}</span>
                <div>
                  <p style={{ fontWeight: 600 }}>{CATEGORIES.find(c=>c.id===category)?.label}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{description.slice(0, 80)}...</p>
                </div>
              </div>
              {photoPreview && <img src={photoPreview} style={{ borderRadius: 'var(--radius-sm)', maxHeight: 150, objectFit: 'cover' }} alt="report" />}
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                <span>{location ? '📍 Location: ✅' : '📍 Location: Skipped'}</span>
                <span>🗂️ Ward {user?.ward_id || 1}</span>
              </div>
            </div>
          </div>
          <div className="alert-banner info" style={{ marginBottom: '1rem' }}>
            📌 आपकी शिकायत को एक Public Query ID मिलेगा और 4 घंटे में कार्रवाई होगी
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)}>← संपादित करें</button>
            <button className="btn btn-success btn-lg" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>
              {submitting ? '⏳ जमा हो रहा है...' : '✅ जमा करें / Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
