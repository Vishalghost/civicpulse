import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import hi from './hi.json'
import bho from './bho.json'
import ur from './ur.json'

i18n.use(initReactI18next).init({
  resources: {
    hi: { translation: hi },
    bho: { translation: bho },
    ur: { translation: ur },
  },
  lng: localStorage.getItem('civicpulse_lang') || 'hi',
  fallbackLng: 'hi',
  interpolation: { escapeValue: false },
})

export default i18n
