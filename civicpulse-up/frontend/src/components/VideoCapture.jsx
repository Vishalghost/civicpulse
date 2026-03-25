import React, { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'

/**
 * VideoCapture — field video evidence recorder
 * Props:
 *   onCapture(blob, url) — called when recording stops and preview is ready
 *   onUpload(videoId)    — called after successful upload
 *   reportId             — associated complaint/report ID (optional)
 *   maxSeconds           — max recording duration (default 60)
 */
export default function VideoCapture({ onCapture, onUpload, reportId, maxSeconds = 60 }) {
  const [phase, setPhase] = useState('idle') // idle | preview | recording | review | uploading | done
  const [elapsed, setElapsed] = useState(0)
  const [videoBlob, setVideoBlob] = useState(null)
  const [videoUrl, setVideoUrl]   = useState(null)
  const [uploadedId, setUploadedId] = useState(null)
  const [location, setLocation] = useState(null)

  const streamRef    = useRef(null)
  const recorderRef  = useRef(null)
  const chunksRef    = useRef([])
  const timerRef     = useRef(null)
  const liveRef      = useRef(null)  // live preview video element
  const reviewRef    = useRef(null)  // review video element

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
      clearInterval(timerRef.current)
    }
  }, [])

  // Set review src when blob arrives
  useEffect(() => {
    if (videoUrl && reviewRef.current) {
      reviewRef.current.src = videoUrl
    }
  }, [videoUrl])

  // Grab geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }),
        () => setLocation(null)
      )
    }
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
      streamRef.current = stream
      if (liveRef.current) { liveRef.current.srcObject = stream; liveRef.current.play() }
      setPhase('preview')
    } catch (e) {
      toast.error('Camera access denied. Please allow camera permission.')
      console.error('[VideoCapture] getUserMedia error:', e)
    }
  }

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const rec = new MediaRecorder(streamRef.current, { mimeType })
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = finishRecording
    recorderRef.current = rec
    rec.start(100)
    setPhase('recording')
    setElapsed(0)
    timerRef.current = setInterval(() => {
      setElapsed(s => {
        if (s + 1 >= maxSeconds) { stopRecording(); return s }
        return s + 1
      })
    }, 1000)
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    recorderRef.current?.stop()
  }

  function finishRecording() {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const url  = URL.createObjectURL(blob)
    setVideoBlob(blob)
    setVideoUrl(url)
    setPhase('review')
    stopStream()
    onCapture?.(blob, url)
  }

  function retake() {
    URL.revokeObjectURL(videoUrl)
    setVideoBlob(null); setVideoUrl(null); setElapsed(0)
    setPhase('idle')
  }

  async function uploadVideo() {
    if (!videoBlob) return
    setPhase('uploading')
    try {
      const fd = new FormData()
      fd.append('video', videoBlob, `evidence_${Date.now()}.webm`)
      if (reportId) fd.append('report_id', reportId)
      if (location)  fd.append('lat', location.lat), fd.append('lng', location.lng)

      const token = localStorage.getItem('cp_token')
      const res = await fetch('/api/video/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setUploadedId(json.id)
      setPhase('done')
      toast.success('📹 वीडियो सहेजा गया! ID: ' + json.id)
      onUpload?.(json.id)
    } catch (e) {
      toast.error('Upload failed: ' + e.message)
      setPhase('review')
    }
  }

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const progress = Math.round((elapsed / maxSeconds) * 100)

  return (
    <div className="video-capture" style={{
      background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '1rem',
      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>📹</span>
        <strong style={{ color: 'var(--primary)' }}>वीडियो साक्ष्य / Video Evidence</strong>
        {location && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>📍 ±{location.acc}m</span>}
      </div>

      {/* Live preview */}
      {(phase === 'preview' || phase === 'recording') && (
        <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#000' }}>
          <video ref={liveRef} muted playsInline style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }} />
          {phase === 'recording' && (
            <div style={{ position: 'absolute', top: 8, left: 8, right: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '0.8rem', marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  REC
                </span>
                <span>{fmtTime(elapsed)} / {fmtTime(maxSeconds)}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 4, height: 4 }}>
                <div style={{ background: '#ef4444', height: '100%', borderRadius: 4, width: progress + '%', transition: 'width 1s linear' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review video */}
      {phase === 'review' && videoUrl && (
        <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#000' }}>
          <video ref={reviewRef} controls style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Done confirmation */}
      {phase === 'done' && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--success)' }}>
          <div style={{ fontSize: '2rem' }}>✅</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>वीडियो अपलोड हुआ!</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>ID: {uploadedId}</div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {phase === 'idle' && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={openCamera} id="video-open-camera">
            📷 Camera खोलें
          </button>
        )}
        {phase === 'preview' && (
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={startRecording} id="video-start-rec">
            🔴 रिकॉर्ड शुरू करें
          </button>
        )}
        {phase === 'recording' && (
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={stopRecording} id="video-stop-rec">
            ⏹ रोकें
          </button>
        )}
        {phase === 'review' && (
          <>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={retake} id="video-retake">
              🔄 फिर से लें
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={uploadVideo} id="video-upload">
              ☁️ सहेजें व अपलोड
            </button>
          </>
        )}
        {phase === 'uploading' && (
          <div style={{ flex: 1, textAlign: 'center', color: 'var(--primary)', padding: '0.5rem' }}>
            ⏳ अपलोड हो रहा है...
          </div>
        )}
        {phase === 'done' && (
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={retake} id="video-new">
            📹 नया वीडियो
          </button>
        )}
      </div>
    </div>
  )
}
