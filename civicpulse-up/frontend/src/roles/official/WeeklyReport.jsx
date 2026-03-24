import React from 'react'

export default function WeeklyReport() {
  const data = {
    week: 'March 18 – 24, 2026',
    district: 'Lucknow + Varanasi + Gorakhpur',
    total: 124, resolved: 91, pending: 33, sla_breaches: 18,
    resolution_rate: '73%',
    top_wards: [
      { name: 'Ward 9 Raptipur', count: 23, status: 'CRITICAL' },
      { name: 'Ward 12 Aminabad', count: 18, status: 'HIGH' },
      { name: 'Ward 7 Chowk', count: 11, status: 'MEDIUM' },
    ],
    by_category: [
      { cat: '🚰 Drain', count: 47 },
      { cat: '🗑️ Garbage', count: 38 },
      { cat: '💧 Water', count: 21 },
      { cat: '🦟 Mosquito', count: 18 },
    ],
    disease_risk: 'HIGH — Dengue (Ward 9, 12) · Typhoid (Ward 7)',
    worker_logs: 312, asha_surveys: 87
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>📄 साप्ताहिक रिपोर्ट</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{data.week}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨️ Print</button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, #E8F0FE, #fff)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>📊 Overview — {data.district}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
          {[['Total',data.total,'var(--primary)'],['Resolved',data.resolved,'var(--success)'],['Pending',data.pending,'var(--warning)'],['SLA Breach',data.sla_breaches,'var(--danger)'],['Rate',data.resolution_rate,'var(--success)'],['Workers',data.worker_logs,'var(--primary)']].map(([l,v,c]) => (
            <div key={l} style={{ padding: '0.75rem', background: 'white', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🔴 Top Breach Wards</h3>
        {data.top_wards.map(w => (
          <div key={w.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem' }}>{w.name}</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>{w.count}</span>
              <span className={`risk-chip risk-${w.status.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{w.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📋 Category Breakdown</h3>
        {data.by_category.map(b => (
          <div key={b.cat} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ minWidth: 120, fontSize: '0.875rem' }}>{b.cat}</span>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 8 }}>
              <div style={{ width: `${(b.count / data.total) * 100}%`, background: 'var(--primary)', height: '100%', borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{b.count}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🤖 AI Risk Summary</h3>
        <div className="alert-banner danger" style={{ marginBottom: '0.75rem' }}>🦠 Disease Risk: {data.disease_risk}</div>
        <div style={{ fontSize: '0.85rem', display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
          <span>🧹 Worker logs: {data.worker_logs}</span>
          <span>🏥 ASHA surveys: {data.asha_surveys}</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Auto-generated IDSP S/P forms attached · NIC compliant</p>
      </div>
    </div>
  )
}
