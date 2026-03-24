import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { getDB } from '../../db/localDB'
import useAuthStore from '../../store/authStore'

const ACTIVITIES = [
  { id: 'drain_cleaned', emoji: '🚰', label: 'नाली साफ की', bho: 'नाली साफ करलीं', prompt: 'Ka rauwa naali saaf kailein?' },
  { id: 'garbage_removed', emoji: '🗑️', label: 'कचरा हटाया', bho: 'कचरा हटइलीं', prompt: 'Ka rauwa kachra hatailen?' },
  { id: 'area_sprayed', emoji: '💨', label: 'छिड़काव किया', bho: 'छिड़काव करलीं', prompt: 'Ka rauwa chidkaaw kailen?' },
  { id: 'symptom_survey', emoji: '🏥', label: 'लक्षण सर्वेक्षण', bho: 'बीमारी जाँच', prompt: 'Ka rauwa bimaari jaanch kailen?' },
  { id: 'water_testing', emoji: '💧', label: 'पानी जाँच', bho: 'पानी जाँच', prompt: 'Ka rauwa pani jaanch kailen?' },
  { id: 'other', emoji: '📌', label: 'अन्य', bho: 'अउर', prompt: 'Apan kaam bataawein.' },
]

export default function VoiceLogger() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const [step, setStep] = useState(0) // 0=home, 1=confirm, 2=photo, 3=confirm-submit, 4=success
  const [selected, setSelected] = useState(null)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [location, setLocation] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef()
  const recognitionRef = useRef()

  const isBhojpuri = i18n.language === 'bho'

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Voice not supported — use text'); return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'hi-IN'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => setTranscript(e.results[0][0].transcript)
    rec.onend = () => setRecording(false)
    rec.onerror = () => { setRecording(false); toast.error('आवाज़ नहीं पहचानी — पुनः प्रयास करें') }
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
  }

  const stopVoice = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const selectActivity = (act) => {
    setSelected(act)
    // Auto-play audio prompt (speak using TTS)
    const utter = new SpeechSynthesisUtterance(isBhojpuri ? act.prompt : act.label + ' ठीक है?')
    utter.lang = 'hi-IN'
    utter.rate = 0.85
    window.speechSynthesis.speak(utter)
    setStep(1)
    // Auto-get location
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation({ lat: 26.8467, lng: 80.9462 }) // Default Lucknow
    )
  }

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
      setStep(3)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('activity_type', selected.id)
      fd.append('voice_transcript', transcript || selected.label)
      fd.append('language', i18n.language)
      fd.append('ward_id', user?.ward_id || 1)
      if (location) { fd.append('geo_lat', location.lat); fd.append('geo_lng', location.lng) }
      if (photo) fd.append('photo', photo)

      if (!navigator.onLine) {
        const db = await getDB()
        await db.put('sync_queue', { id: `wlog-${Date.now()}`, type: 'worker_log', data: { activity_type: selected.id, transcript, ward_id: user?.ward_id || 1 }, createdAt: new Date().toISOString() })
        toast.success(isBhojpuri ? 'ऑफलाइन सुरक्षित बा!' : 'Offline — सुरक्षित रखा गया')
      } else {
        await api.post('/worker/logs', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      // 🔊 Success audio
      const utter = new SpeechSynthesisUtterance(isBhojpuri ? 'Dhanyawaad! Aaapan kaam darj bha.' : 'धन्यवाद! आपकी गतिविधि दर्ज हो गई।')
      utter.lang = 'hi-IN'
      window.speechSynthesis.speak(utter)
      setStep(4)
    } catch {
      toast.error('Submit failed — पुनः प्रयास करें')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => { setStep(0); setSelected(null); setPhoto(null); setPhotoPreview(null); setTranscript('') }

  return (
    <div style={{ textAlign: 'center' }}>
      {/* SCREEN 0: Activity Grid */}
      {step === 0 && (
        <div className="page-enter">
          <div className="page-header" style={{ textAlign: 'left' }}>
            <h1>🎤 {t('log_activity')}</h1>
            <p>Bhojpuri / Hindi — Zero text needed</p>
          </div>
          <div className="pictogram-grid">
            {ACTIVITIES.map(act => (
              <button key={act.id} className="pictogram-btn" onClick={() => selectActivity(act)}>
                <span className="pictogram-icon">{act.emoji}</span>
                <span>{isBhojpuri ? act.bho : act.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SCREEN 1: Confirm + Voice */}
      {step === 1 && selected && (
        <div className="page-enter" style={{ maxWidth: 340, margin: '0 auto' }}>
          <div style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-xl)', padding: '2rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{selected.emoji}</div>
            <p style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>{isBhojpuri ? selected.bho : selected.label}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔊 {selected.prompt}</p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <button className="voice-record-btn" style={{ margin: '0 auto' }}
              onMouseDown={startVoice} onMouseUp={stopVoice}
              onTouchStart={startVoice} onTouchEnd={stopVoice}>
              {recording ? '⏹️' : '🎤'}
            </button>
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {recording ? '● बोल रहे हैं...' : t('hold_to_speak')}
            </p>
            {transcript && <p style={{ marginTop: '0.5rem', fontStyle: 'italic', color: 'var(--primary)' }}>"{transcript}"</p>}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={reset}>❌</button>
            <button className="btn btn-success btn-lg" style={{ flex: 1 }} onClick={() => { setStep(2) }}>✅ {t('yes')}</button>
          </div>
        </div>
      )}

      {/* SCREEN 2: Photo */}
      {step === 2 && (
        <div className="page-enter" style={{ maxWidth: 340, margin: '0 auto' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📷</div>
          <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{t('take_photo')}</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>🔊 Naali ki tasveer khinchein</p>
          <input type="file" accept="image/*" capture="environment" ref={fileRef} style={{ display: 'none' }} onChange={handlePhoto} />
          <button className="btn btn-primary btn-full btn-lg" onClick={() => fileRef.current.click()}>
            📷 Camera खोलें
          </button>
          <button className="btn btn-ghost btn-full" style={{ marginTop: '0.75rem' }} onClick={() => setStep(3)}>
            बिना फोटो आगे बढ़ें (supervisor review)
          </button>
        </div>
      )}

      {/* SCREEN 3: Confirm Submit */}
      {step === 3 && (
        <div className="page-enter" style={{ maxWidth: 340, margin: '0 auto' }}>
          {photoPreview && <img src={photoPreview} alt="work" style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: '1rem', maxHeight: 250, objectFit: 'cover' }} />}
          <div style={{ background: 'var(--success-light)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem', textAlign: 'left' }}>
            <p>✅ {photo ? 'फोटो मिली' : 'कोई फोटो नहीं'}</p>
            <p>📍 {location ? 'स्थान मिला' : 'स्थान नहीं'}</p>
            <p>🎤 {transcript || selected?.label || '—'}</p>
          </div>
          <p style={{ fontWeight: 700, marginBottom: '1rem' }}>🔊 Bhej dein?</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" onClick={reset}>❌</button>
            <button className="btn btn-success btn-full btn-lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '⏳...' : `✅ ${t('submit')}`}
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 4: Success */}
      {step === 4 && (
        <div className="page-enter" style={{ maxWidth: 340, margin: '4rem auto', textAlign: 'center' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1rem', animation: 'pulse-record 0.5s 2' }}>👍</div>
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--success)' }}>{t('thank_you')}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>गतिविधि सफलतापूर्वक दर्ज हो गई</p>
          <button className="btn btn-primary btn-full" onClick={reset}>🏠 नई गतिविधि दर्ज करें</button>
        </div>
      )}
    </div>
  )
}
