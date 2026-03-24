import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function OfflineBanner() {
  const { t } = useTranslation()
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOff = () => setOffline(true)
    const goOn = () => setOffline(false)
    window.addEventListener('offline', goOff)
    window.addEventListener('online', goOn)
    return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn) }
  }, [])

  if (!offline) return null
  return (
    <div className="offline-banner">
      📵 {t('offline')}
    </div>
  )
}
