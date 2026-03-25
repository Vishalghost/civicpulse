import React, { useRef, useState, useEffect } from 'react'

/**
 * CameraCapture — opens laptop/phone webcam via getUserMedia
 * Props:
 *   onCapture(file) — called with a File object when user snaps a photo
 *   onClose()       — called when user dismisses
 */
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [captured, setCaptured] = useState(null)

  useEffect(() => {
    // Start webcam
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 720 }, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setReady(true)
        }
      })
      .catch(() => {
        // Fallback: try any camera (works on laptops with no env camera)
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then(stream => {
            streamRef.current = stream
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              videoRef.current.play()
              setReady(true)
            }
          })
          .catch(e => setError('Camera access denied. Please allow camera in browser settings.'))
      })

    return () => {
      // Cleanup: stop all tracks when component unmounts
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const snap = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      setCaptured(URL.createObjectURL(blob))
      // Stop camera
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(file)
    }, 'image/jpeg', 0.9)
  }

  const retake = () => {
    setCaptured(null)
    setReady(false)
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setReady(true)
      })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '1rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>📸 Camera</span>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose() }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: '1rem' }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: '#ef5350', color: 'white', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
            ⚠️ {error}
            <br /><button onClick={onClose} style={{ marginTop: 8, background: 'white', color: '#ef5350', border: 'none', padding: '0.4rem 1rem', borderRadius: 6, cursor: 'pointer' }}>Close</button>
          </div>
        )}

        {/* Live preview */}
        {!captured && !error && (
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#111' }}>
            <video ref={videoRef} style={{ width: '100%', display: 'block', borderRadius: 12 }} muted playsInline />
            {!ready && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                ⏳ Starting camera...
              </div>
            )}
          </div>
        )}

        {/* Captured preview */}
        {captured && (
          <div style={{ borderRadius: 12, overflow: 'hidden' }}>
            <img src={captured} style={{ width: '100%', display: 'block', borderRadius: 12 }} alt="captured" />
          </div>
        )}

        {/* Hidden canvas for snap */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          {!captured ? (
            <button onClick={snap} disabled={!ready}
              style={{ flex: 1, background: ready ? '#fff' : '#555', color: '#222', border: 'none', borderRadius: 50, padding: '0.75rem', fontWeight: 700, fontSize: '1.1rem', cursor: ready ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
              📸 Snap
            </button>
          ) : (
            <>
              <button onClick={retake}
                style={{ flex: 1, background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 50, padding: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                🔄 Retake
              </button>
              <button onClick={onClose}
                style={{ flex: 1, background: '#4caf50', color: 'white', border: 'none', borderRadius: 50, padding: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                ✅ Use Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
