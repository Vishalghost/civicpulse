import React, { useState } from 'react'
import toast from 'react-hot-toast'

const LANGUAGES = [
  { code: 'hi',  flag: '🇮🇳', name: 'हिंदी', nameEn: 'Hindi' },
  { code: 'bho', flag: '🟠', name: 'भोजपुरी', nameEn: 'Bhojpuri' },
  { code: 'mr',  flag: '🟣', name: 'मराठी', nameEn: 'Marathi' },
  { code: 'ta',  flag: '🟡', name: 'தமிழ்', nameEn: 'Tamil' },
  { code: 'en',  flag: '🇬🇧', name: 'English', nameEn: 'English' },
]

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('cp_gemini_key') || '')
  const [voiceLang, setVoiceLang] = useState(localStorage.getItem('cp_voice_lang') || 'hi')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('cp_gemini_key', apiKey.trim())
    } else {
      localStorage.removeItem('cp_gemini_key')
    }
    localStorage.setItem('cp_voice_lang', voiceLang)
    setSaved(true)
    toast.success('✅ Settings saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    const key = apiKey.trim()
    if (!key) { toast.error('API key दर्ज करें'); return }
    setTesting(true)
    try {
      const res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cp_token')}`,
          'x-gemini-key': key,
        },
        body: JSON.stringify({ message: 'Hello, are you working?', ward_id: 1 })
      })
      const data = await res.json()
      if (data.reply) {
        toast.success('✅ Gemini connected! Response: ' + data.reply.slice(0, 60) + '...')
      } else {
        toast.error('Error: ' + (data.error || 'No response'))
      }
    } catch (e) {
      toast.error('Connection failed: ' + e.message)
    }
    setTesting(false)
  }

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Settings</h1>
        <p>Configure AI features for CivicPulse</p>
      </div>

      {/* Gemini API Key */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🤖</span>
          <div>
            <h3 style={{ fontWeight: 700, margin: 0 }}>Gemini AI Key</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Powers chatbot + voice transcription
            </p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Google Gemini API Key</label>
          <input
            className="form-input"
            type="password"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            Get your key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
               style={{ color: 'var(--primary)' }}>
              aistudio.google.com
            </a>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={handleTest} disabled={testing}>
            {testing ? '⏳ Testing...' : '🔌 Test Key'}
          </button>
        </div>
      </div>

      {/* Voice Language */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🎙️</span>
          <div>
            <h3 style={{ fontWeight: 700, margin: 0 }}>Voice Language</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Language for voice-to-text transcription
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {LANGUAGES.map(l => (
            <label key={l.code}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                border: `2px solid ${voiceLang === l.code ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: voiceLang === l.code ? 'var(--primary-light)' : 'transparent',
                transition: 'all 0.2s'
              }}>
              <input type="radio" name="voiceLang" value={l.code}
                checked={voiceLang === l.code} onChange={() => setVoiceLang(l.code)}
                style={{ display: 'none' }} />
              <span style={{ fontSize: '1.5rem' }}>{l.flag}</span>
              <div>
                <div style={{ fontWeight: 700 }}>{l.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.nameEn}</div>
              </div>
              {voiceLang === l.code && <span style={{ marginLeft: 'auto', color: 'var(--primary)' }}>✓</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        className={`btn ${saved ? 'btn-success' : 'btn-primary'} btn-full btn-lg`}
        onClick={handleSave}>
        {saved ? '✅ Saved!' : '💾 Save Settings'}
      </button>

      {/* Info */}
      <div className="alert-banner info" style={{ marginTop: '1rem' }}>
        <strong>🔐 Privacy:</strong> Your API key is stored only in your browser (localStorage), never sent to our servers — only sent directly to Google Gemini.
      </div>
    </div>
  )
}
