import React, { useState } from 'react'
import VideoCapture from '../../components/VideoCapture'
import useAuthStore from '../../store/authStore'

export default function VideoEvidencePage() {
  const { user } = useAuthStore()
  const [uploadedIds, setUploadedIds] = useState([])

  const handleUpload = (id) => {
    setUploadedIds(prev => [id, ...prev])
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>📹 Video Evidence</h1>
        <p>Record and upload field video evidence with GPS tagging</p>
      </div>

      {/* Live Video Capture */}
      <VideoCapture
        reportId={`ward-${user?.ward_id || 1}-${Date.now()}`}
        maxSeconds={60}
        onUpload={handleUpload}
      />

      {/* Uploaded Videos List */}
      {uploadedIds.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>✅ Uploaded Videos</h3>
          {uploadedIds.map((id, i) => (
            <div key={id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem'
            }}>
              <span>🎬 Video #{uploadedIds.length - i}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {id.slice(0, 12)}...
              </span>
              <a
                href={`http://localhost:3001/api/video/${id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
              >
                ▶ Play
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Info Banner */}
      <div className="alert-banner info" style={{ marginTop: '1rem' }}>
        📍 GPS coordinates are automatically attached to each video upload. Max 60 seconds per recording.
      </div>
    </div>
  )
}
