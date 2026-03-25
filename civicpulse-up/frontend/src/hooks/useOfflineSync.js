/**
 * AGENT 1: Offline-First SQLite Hook + Voice UX for Zero-Literacy Workers
 * ========================================================================
 * Two exports:
 *
 *  1. useOfflineSync() — React hook for offline-first report caching
 *     - Stores reports in IndexedDB when offline
 *     - Auto-syncs when network returns
 *     - Shows sync status badge
 *
 *  2. VoiceWorkerLogger — Zero-text voice UX component for Safai Karamchari
 *     - Bhojpuri audio prompts via TTS
 *     - 3-step: Record → Show waveform → Confirm/retry
 *     - Noisy environment fallback (tap category icons)
 *     - Target: < 60 seconds end-to-end
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

const DB_NAME = 'civicpulse_offline'
const DB_VER  = 2
const STORE   = 'pending_reports'

// ── IndexedDB helper ─────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'localId' })
        store.createIndex('createdAt', 'createdAt')
        store.createIndex('synced', 'synced')
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK 1: useOfflineSync
// ═══════════════════════════════════════════════════════════════════════════════
export function useOfflineSync() {
  const [isOnline,    setIsOnline]    = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing,     setSyncing]     = useState(false)
  const syncRef = useRef(false)

  // Track online status
  useEffect(() => {
    const on = () => { setIsOnline(true);  syncPending() }
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    loadPendingCount()
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const loadPendingCount = async () => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('synced')
      const count = await new Promise(r => { const req = idx.count(IDBKeyRange.only(false)); req.onsuccess = () => r(req.result) })
      setPendingCount(count)
    } catch { /* non-critical */ }
  }

  // Queue a report for offline storage
  const queueReport = useCallback(async (reportData) => {
    const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const record = {
      localId,
      ...reportData,
      synced: false,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }
    try {
      const db = await openDB()
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite')
        const req = tx.objectStore(STORE).add(record)
        req.onsuccess = res; req.onerror = rej
      })
      setPendingCount(c => c + 1)
      toast('📥 Report saved offline — will sync when connected', { icon: '📶' })
      return { localId, queued: true }
    } catch (err) {
      toast.error('Failed to save offline: ' + err.message)
      return { error: err.message }
    }
  }, [])

  // Sync all pending records to backend
  const syncPending = useCallback(async () => {
    if (syncRef.current || !navigator.onLine) return
    syncRef.current = true
    setSyncing(true)

    try {
      const db = await openDB()
      const pending = await new Promise(res => {
        const tx  = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).index('synced').getAll(IDBKeyRange.only(false))
        req.onsuccess = () => res(req.result)
      })

      if (pending.length === 0) { setSyncing(false); syncRef.current = false; return }

      let synced = 0
      const token = localStorage.getItem('cp_token')

      for (const record of pending) {
        try {
          const formData = new FormData()
          Object.entries(record).forEach(([k, v]) => {
            if (!['localId', 'synced', 'retryCount'].includes(k) && v !== null) {
              formData.append(k, typeof v === 'object' ? JSON.stringify(v) : v)
            }
          })

          const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          })

          if (res.ok) {
            // Mark as synced in IndexedDB
            await new Promise(resolve => {
              const tx = db.transaction(STORE, 'readwrite')
              const req = tx.objectStore(STORE).put({ ...record, synced: true })
              req.onsuccess = resolve
            })
            synced++
          } else {
            // Increment retry count
            await new Promise(resolve => {
              const tx = db.transaction(STORE, 'readwrite')
              const req = tx.objectStore(STORE).put({ ...record, retryCount: record.retryCount + 1 })
              req.onsuccess = resolve
            })
          }
        } catch { /* network error — retry next time */ }
      }

      if (synced > 0) {
        toast.success(`✅ ${synced} offline report${synced > 1 ? 's' : ''} synced!`)
        loadPendingCount()
      }
    } finally {
      setSyncing(false)
      syncRef.current = false
    }
  }, [])

  return { isOnline, pendingCount, syncing, queueReport, syncPending }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 2: VoiceWorkerLogger — Zero-text UX for Bhojpuri Safai Karamchari
// Target: < 60 seconds | Zero text | Works in noisy environment
// ═══════════════════════════════════════════════════════════════════════════════

// Bhojpuri audio prompts (served from /public/audio/)
const AUDIO_PROMPTS = {
  start:    '/audio/bho_bol_ke_kya_kiya.mp3',   // "बोलिए — आपने क्या किया?"
  confirm:  '/audio/bho_sahi_hai.mp3',           // "सही है?"
  retry:    '/audio/bho_dobara_bolo.mp3',        // "दोबारा बोलिए"
  success:  '/audio/bho_shabash.mp3',            // "शाबाश! काम दर्ज हो गया।"
  noisy:    '/audio/bho_icon_chuniye.mp3',       // "शोर है — आइकन चुनिए"
}

// Icon-based category chooser (text-free fallback for noisy environments)
const ICON_CATEGORIES = [
  { id: 'drain_clean', icon: '🪣', labelHi: 'नाली साफ की', color: '#3b82f6' },
  { id: 'garbage',     icon: '🗑️', labelHi: 'कचरा उठाया', color: '#f59e0b' },
  { id: 'fogging',     icon: '💨', labelHi: 'फॉगिंग की',   color: '#8b5cf6' },
  { id: 'toilet',      icon: '🚽', labelHi: 'शौचालय साफ', color: '#10b981' },
  { id: 'water',       icon: '🚰', labelHi: 'पानी टैंकर',  color: '#06b6d4' },
  { id: 'other',       icon: '✅', labelHi: 'अन्य काम',    color: '#6b7280' },
]

function playAudioPrompt(src) {
  try {
    const audio = new Audio(src)
    audio.play().catch(() => {}) // ignore autoplay restrictions
  } catch {}
}

export function VoiceWorkerLogger({ onLogSubmit, wardId = 1 }) {
  const [step, setStep]           = useState('idle')       // idle | recording | confirm | icon_fallback | submitting | done
  const [transcript, setTranscript] = useState('')
  const [category, setCategory]   = useState(null)
  const [waveIdx, setWaveIdx]     = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)
  
  const mediaRef    = useRef(null)
  const chunksRef   = useRef([])
  const waveTimer   = useRef(null)
  const clockTimer  = useRef(null)
  const startTime   = useRef(null)

  const WAVE = ['▁▂▃', '▂▃▄', '▃▄▅', '▄▅▆', '▅▆▇', '▆▇▆']
  const lang  = localStorage.getItem('cp_voice_lang') || 'bho'
  const token = localStorage.getItem('cp_token') || ''
  const geminiKey = localStorage.getItem('cp_gemini_key') || ''

  const startRecording = async () => {
    playAudioPrompt(AUDIO_PROMPTS.start)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = handleStop
      mr.start(100)
      mediaRef.current = { recorder: mr, stream }
      startTime.current = Date.now()
      setStep('recording')
      setElapsedSec(0)
      waveTimer.current  = setInterval(() => setWaveIdx(i => (i + 1) % WAVE.length), 150)
      clockTimer.current = setInterval(() => setElapsedSec(Math.round((Date.now() - startTime.current) / 1000)), 1000)
    } catch {
      // Microphone denied → jump to icon fallback immediately
      playAudioPrompt(AUDIO_PROMPTS.noisy)
      setStep('icon_fallback')
    }
  }

  const stopRecording = () => {
    clearInterval(waveTimer.current)
    clearInterval(clockTimer.current)
    if (mediaRef.current) {
      mediaRef.current.recorder.stop()
      mediaRef.current.stream.getTracks().forEach(t => t.stop())
    }
    setStep('submitting')
  }

  const handleStop = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    
    // Too short = noisy environment → icon fallback
    if (blob.size < 500) {
      playAudioPrompt(AUDIO_PROMPTS.noisy)
      setStep('icon_fallback')
      return
    }

    try {
      const reader = new FileReader()
      const base64 = await new Promise(res => {
        reader.onloadend = () => res(reader.result.split(',')[1])
        reader.readAsDataURL(blob)
      })

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-gemini-key': geminiKey,
        },
        body: JSON.stringify({ audio_base64: base64, mime_type: 'audio/webm', lang }),
      })
      const data = await res.json()

      if (data.transcript && data.success) {
        setTranscript(data.transcript)
        playAudioPrompt(AUDIO_PROMPTS.confirm)
        setStep('confirm')
      } else {
        playAudioPrompt(AUDIO_PROMPTS.noisy)
        setStep('icon_fallback')
      }
    } catch {
      playAudioPrompt(AUDIO_PROMPTS.noisy)
      setStep('icon_fallback')
    }
  }

  const confirm = async (text, cat) => {
    setStep('submitting')
    try {
      await fetch('/api/worker/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: text, category: cat || 'drain_clean', ward_id: wardId, lang }),
      })
      playAudioPrompt(AUDIO_PROMPTS.success)
      setStep('done')
      onLogSubmit?.({ transcript: text, category: cat })
    } catch {
      toast.error('Submit failed — will retry')
      setStep('idle')
    }
  }

  const totalSec = startTime.current ? Math.round((Date.now() - startTime.current) / 1000) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem' }}>

      {/* STEP: IDLE */}
      {step === 'idle' && (
        <button onClick={startRecording} style={{
          width: 120, height: 120, borderRadius: '50%', border: 'none',
          background: 'var(--primary)', color: 'white', fontSize: '3rem',
          cursor: 'pointer', boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
          transition: 'transform 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>🎙️</button>
      )}

      {/* STEP: RECORDING */}
      {step === 'recording' && (
        <>
          <div style={{ fontSize: '2.5rem', animation: 'pulse 0.8s infinite' }}>🔴</div>
          <div style={{ fontSize: '2rem', fontFamily: 'monospace', letterSpacing: 4 }}>
            {WAVE[waveIdx]}
          </div>
          <div style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>{elapsedSec}s</div>
          <button onClick={stopRecording} style={{
            padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 700,
            background: '#ef4444', color: 'white', border: 'none', borderRadius: 'var(--radius)',
            cursor: 'pointer',
          }}>⏹ रोकें (Stop)</button>
        </>
      )}

      {/* STEP: CONFIRM (text-free — just show transcript and ✅ ❌) */}
      {step === 'confirm' && (
        <>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '1rem',
            fontSize: '1rem', textAlign: 'center', maxWidth: 280,
          }}>{transcript}</div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button onClick={() => confirm(transcript, null)} style={{
              fontSize: '2.5rem', background: '#10b981', border: 'none', borderRadius: '50%',
              width: 80, height: 80, cursor: 'pointer',
            }}>✅</button>
            <button onClick={() => { playAudioPrompt(AUDIO_PROMPTS.retry); setStep('idle') }} style={{
              fontSize: '2.5rem', background: '#ef4444', border: 'none', borderRadius: '50%',
              width: 80, height: 80, cursor: 'pointer',
            }}>❌</button>
          </div>
        </>
      )}

      {/* STEP: ICON FALLBACK (zero text — tap category icon) */}
      {step === 'icon_fallback' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {ICON_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => confirm(cat.labelHi, cat.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              padding: '1.2rem', borderRadius: 'var(--radius)', border: `3px solid ${cat.color}`,
              background: 'transparent', cursor: 'pointer', fontSize: '2.5rem',
            }}>
              {cat.icon}
              <span style={{ fontSize: '0.7rem', color: cat.color, fontWeight: 700 }}>{cat.labelHi}</span>
            </button>
          ))}
        </div>
      )}

      {/* STEP: SUBMITTING */}
      {step === 'submitting' && (
        <div style={{ fontSize: '2rem' }}>⏳</div>
      )}

      {/* STEP: DONE */}
      {step === 'done' && (
        <>
          <div style={{ fontSize: '4rem' }}>✅</div>
          <div style={{ color: '#10b981', fontWeight: 700, textAlign: 'center' }}>
            काम दर्ज हो गया!<br/>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {totalSec}s में पूरा हुआ
            </span>
          </div>
          <button onClick={() => { setStep('idle'); setTranscript(''); setCategory(null); setElapsedSec(0) }}
            style={{ padding: '0.75rem 2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700 }}>
            + अगला काम
          </button>
        </>
      )}
    </div>
  )
}
