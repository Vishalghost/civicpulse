import React, { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../utils/api'

const WAVE_FRAMES = ['▁▂▃', '▂▃▄', '▃▄▅', '▄▅▆', '▅▆▇', '▆▇▆', '▇▆▅', '▆▅▄']

/**
 * VoiceReporter — mic button that records audio and transcribes via Gemini
 * Props:
 *   onTranscript(text: string) — called when transcription is ready
 *   lang?: string — override language (defaults to localStorage cp_voice_lang)
 */
export default function VoiceReporter({ onTranscript, lang }) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [waveIdx, setWaveIdx] = useState(0)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const waveTimerRef = useRef(null)

  const voiceLang = lang || localStorage.getItem('cp_voice_lang') || 'hi'
  const geminiKey = localStorage.getItem('cp_gemini_key') || ''

  const LANG_LABELS = { hi: 'हिंदी', bho: 'भोजपुरी', mr: 'मराठी', ta: 'தமிழ்', en: 'English' }

  const startRecording = async () => {
    if (!geminiKey) {
      toast.error('Settings में Gemini API Key दर्ज करें ⚙️')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mediaRecorder.ondataavailable = e => chunksRef.current.push(e.data)
      mediaRecorder.onstop = handleStop
      mediaRecorder.start(100)
      mediaRef.current = { recorder: mediaRecorder, stream }
      setRecording(true)
      waveTimerRef.current = setInterval(() => setWaveIdx(i => (i + 1) % WAVE_FRAMES.length), 150)
    } catch (e) {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (!mediaRef.current) return
    clearInterval(waveTimerRef.current)
    mediaRef.current.recorder.stop()
    mediaRef.current.stream.getTracks().forEach(t => t.stop())
    setRecording(false)
    setProcessing(true)
  }

  const handleStop = async () => {
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

      // Guard: don't send empty recordings
      if (blob.size < 500) {
        toast.error('Recording too short — hold the button and speak clearly 🎙️')
        setProcessing(false)
        return
      }

      const base64 = await blobToBase64(blob)

      const res = await api.post('/voice/transcribe', {
        audio_base64: base64,
        mime_type: 'audio/webm',
        lang: voiceLang,
      }, {
        headers: { 'x-gemini-key': geminiKey }
      })

      const { transcript, success, fallback, message } = res.data

      if (fallback || !success) {
        // Graceful degradation — show message, don't crash
        toast.error(message || 'आवाज़ पहचान विफल — कृपया फिर से बोलें')
      } else if (transcript) {
        onTranscript(transcript)
        toast.success('🎙️ आवाज़ पहचानी गई!')
      } else {
        toast('कोई आवाज़ नहीं मिली — फिर से बोलें', { icon: '🎙️' })
      }
    } catch (e) {
      // Network error or unexpected crash — show toast, never propagate
      toast.error('Transcription failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: '#ef4444', color: 'white', border: 'none',
            borderRadius: 'var(--radius)', padding: '0.6rem 1.2rem',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
            animation: 'pulse 1s infinite',
            boxShadow: '0 0 0 4px rgba(239,68,68,0.2)'
          }}>
          ⏹ {WAVE_FRAMES[waveIdx]} रोकें
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={processing}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: processing ? 'var(--text-muted)' : 'var(--primary)',
            color: 'white', border: 'none', borderRadius: 'var(--radius)',
            padding: '0.6rem 1.2rem', cursor: processing ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: '0.9rem'
          }}>
          {processing ? '⏳ Processing...' : `🎙️ बोलें (${LANG_LABELS[voiceLang] || voiceLang})`}
        </button>
      )}
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {recording ? 'Recording... बोलिए' : 'Voice से विवरण भरें'}
      </span>
    </div>
  )
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
