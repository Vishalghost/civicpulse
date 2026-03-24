import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import OfflineBanner from '../components/OfflineBanner'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function CitizenLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  return (
    <div className="app-shell">
      <OfflineBanner />
      <nav className="navbar">
        <div className="navbar-brand">
          <span>🏥</span>
          <div>
            <div>CivicPulse</div>
            <div className="tagline">नागरिक / Citizen</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <LanguageSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={logout} title="Logout">⇒</button>
        </div>
      </nav>
      <main className="app-main page-with-bottom-nav page-enter">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <NavLink to="/citizen" end><span className="bottom-nav-icon">🏠</span><span>{t('home')}</span></NavLink>
        <NavLink to="/citizen/report"><span className="bottom-nav-icon">📋</span><span>रिपोर्ट</span></NavLink>
        <NavLink to="/citizen/board"><span className="bottom-nav-icon">📊</span><span>बोर्ड</span></NavLink>
        <NavLink to="/citizen/chat"><span className="bottom-nav-icon">💬</span><span>{t('chat')}</span></NavLink>
      </nav>
    </div>
  )
}
