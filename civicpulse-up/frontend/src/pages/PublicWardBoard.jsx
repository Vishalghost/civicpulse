import React from 'react'
export default function PublicWardBoard() {
  return <div style={{ minHeight: '100dvh', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>📊 Public Ward Board</h1>
    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>No login required — publicly accessible resolution board</p>
    <div className="card"><p>Public board data loads here. Use the Citizen role to see the full board with live data.</p></div>
    <a href="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>← Home</a>
  </div>
}
