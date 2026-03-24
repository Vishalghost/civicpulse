import React from 'react'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'bho', label: 'भोजपुरी', flag: '🌾' },
  { code: 'ur', label: 'اردو', flag: '🌙' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)

  const changeLanguage = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('civicpulse_lang', code)
    setOpen(false)
  }

  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setOpen(o => !o)} title="Language / भाषा">
        {current.flag} {current.label.slice(0,3)}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 200, minWidth: 140, overflow: 'hidden' }}>
          {LANGUAGES.map(l => (
            <button key={l.code} style={{ width: '100%', padding: '0.6rem 1rem', border: 'none', background: i18n.language === l.code ? 'var(--primary-light)' : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: i18n.language === l.code ? 700 : 400, color: i18n.language === l.code ? 'var(--primary)' : 'inherit' }}
              onClick={() => changeLanguage(l.code)}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
