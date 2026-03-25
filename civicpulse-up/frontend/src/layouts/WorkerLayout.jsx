import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import OfflineBanner from '../components/OfflineBanner'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function WorkerLayout() {
  const { t } = useTranslation()
  const { logout } = useAuthStore()
  return (
    <div className="app-shell">
      <OfflineBanner />
      <nav className="navbar">
        <div className="navbar-brand">
          <span>🧹</span>
          <div>
            <div>CivicPulse</div>
            <div className="tagline">कर्मचारी / Field Worker</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <LanguageSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={logout}>⇒</button>
        </div>
      </nav>
      <main className="app-main page-with-bottom-nav page-enter">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <NavLink to="/worker" end><span className="bottom-nav-icon">🏠</span><span>{t('home')}</span></NavLink>
        <NavLink to="/worker/log"><span className="bottom-nav-icon">🎤</span><span>दर्ज करें</span></NavLink>
        <NavLink to="/worker/activities"><span className="bottom-nav-icon">📋</span><span>गतिविधि</span></NavLink>
        <NavLink to="/worker/evidence"><span className="bottom-nav-icon">📷</span><span>साक्ष्य</span></NavLink>
        <NavLink to="/worker/video"><span className="bottom-nav-icon">📹</span><span>Video</span></NavLink>
      </nav>
    </div>
  )
}
