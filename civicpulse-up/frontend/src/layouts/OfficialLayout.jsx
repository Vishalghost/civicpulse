import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import OfflineBanner from '../components/OfflineBanner'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function OfficialLayout() {
  const { logout } = useAuthStore()
  return (
    <div className="app-shell">
      <OfflineBanner />
      <nav className="navbar">
        <div className="navbar-brand">
          <span>🏛️</span>
          <div>
            <div>CivicPulse</div>
            <div className="tagline">अधिकारी / Official</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <LanguageSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={logout}>⇒</button>
        </div>
      </nav>
      <main className="app-main-wide page-with-bottom-nav page-enter">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <NavLink to="/official" end><span className="bottom-nav-icon">🏠</span><span>होम</span></NavLink>
        <NavLink to="/official/map"><span className="bottom-nav-icon">🗺️</span><span>मानचित्र</span></NavLink>
        <NavLink to="/official/sla"><span className="bottom-nav-icon">⚠️</span><span>SLA</span></NavLink>
        <NavLink to="/official/weekly"><span className="bottom-nav-icon">📄</span><span>रिपोर्ट</span></NavLink>
      </nav>
    </div>
  )
}
