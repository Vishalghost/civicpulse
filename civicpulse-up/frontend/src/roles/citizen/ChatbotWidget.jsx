import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import useAuthStore from '../../store/authStore'

const EMERGENCY_KEYWORDS = ['bahut beemar','hospital','tez bukhaar','behosh','khoon','saansen','ulti band nahi','bahut buri','doctor','ambulance','dyeing','dying','fever','unconscious','breathing','blood']
const RISK_KEYWORDS = ['risk','bimari','dengue','typhoid','khatre','outbreak','ward mein']

const QUICK_QUESTIONS = [
  { label: '🦠 Ward का risk क्या है?', text: 'Mera ward ka health risk kya hai?' },
  { label: '📋 Query status', text: 'Meri shikayat ka kya hua?' },
  { label: '🦟 Dengue khatre', text: 'Kya mere ward mein dengue ka khatre hai?' },
  { label: '🚨 Emergency help', text: 'Mujhe emergency help chahiye' },
]

export default function ChatbotWidget() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState([
    { role: 'bot', text: t('chatbot_greeting'), ts: new Date() }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [emergency, setEmergency] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const detectEmergency = (text) => {
    const lower = text.toLowerCase()
    return EMERGENCY_KEYWORDS.some(k => lower.includes(k))
  }

  const sendMessage = async (text) => {
    if (!text.trim()) return
    const userMsg = { role: 'user', text: text.trim(), ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    // Check emergency
    if (detectEmergency(text)) {
      setEmergency(true)
      setTimeout(() => triggerEmergency(text), 500)
    }

    try {
      const geminiKey = localStorage.getItem('cp_gemini_key') || ''
      const history = messages.slice(-8).map(m => ({ role: m.role === 'bot' ? 'model' : 'user', content: m.text }))
      const { data } = await api.post('/chatbot/message', {
        message: text, ward_id: user?.ward_id || 1, session_id: 'demo', history
      }, {
        headers: geminiKey ? { 'x-gemini-key': geminiKey } : {}
      })
      setMessages(prev => [...prev, { role: 'bot', text: data.reply, ts: new Date(), emergency: data.emergency, source: data.source }])
    } catch {
      // Offline / mock fallback
      const reply = generateFallbackReply(text)
      setMessages(prev => [...prev, { role: 'bot', text: reply, ts: new Date() }])
    } finally {
      setSending(false)
    }
  }

  const triggerEmergency = async () => {
    toast.error('🚨 आपातकाल — PHC और CMO को सूचित किया जा रहा है!', { duration: 6000 })
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'bot', text: '🚨 आपातकालीन अलर्ट भेजा गया!\n✅ PHC Aminabad को सूचित किया गया (T+5s)\n✅ CMO Lucknow को सूचित किया गया (T+10s)\n\nWhatsApp पर जाने के लिए नीचे बटन दबाएं।',
        ts: new Date(), emergency: true
      }])
    }, 2000)
  }

  const generateFallbackReply = (text) => {
    const lower = text.toLowerCase()
    if (RISK_KEYWORDS.some(k => lower.includes(k)))
      return 'आपके Ward 12 (Aminabad) में इस समय जोखिम स्तर HIGH (0.78) है। पिछले 7 दिनों में 14 नाली शिकायतें और 8 बुखार के मामले दर्ज हुए हैं। अनुमान: 20-25 जुलाई के बीच डेंगू का खतरा अधिक है।'
    if (lower.includes('shikayat') || lower.includes('query') || lower.includes('status'))
      return 'अपनी Query ID (जैसे LKO-2024-00123) दर्ज करें और मैं तुरंत स्थिति बताऊंगा।'
    if (lower.includes('naali') || lower.includes('drain') || lower.includes('nali'))
      return 'नाली अवरोध की शिकायत के लिए "शिकायत करें" बटन दबाएं। 4 घंटे में कार्रवाई की जाएगी।'
    return 'मैं आपकी मदद करने के लिए यहाँ हूँ। कृपया अपना सवाल हिंदी या अंग्रेजी में पूछें। आप ward risk, शिकायत status, या emergency help के बारे में पूछ सकते हैं।'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)' }}>
      <div className="page-header">
        <h1>💬 AI Health Chatbot</h1>
        <p>Hindi · Bhojpuri · Ward health queries</p>
      </div>

      {emergency && (
        <div className="alert-banner danger" style={{ marginBottom: '0.75rem' }}>
          🚨 आपातकाल चालू — PHC + CMO को सूचित किया जा रहा है
          <a href="https://wa.me/919415000000?text=Emergency+Alert" target="_blank" rel="noreferrer" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}>WhatsApp 📲</a>
        </div>
      )}

      {/* Quick Questions */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
        {QUICK_QUESTIONS.map(q => (
          <button key={q.label} onClick={() => sendMessage(q.text)}
            style={{ whiteSpace: 'nowrap', padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: '100px', background: 'var(--surface)', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}>
            {q.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages" style={{ flex: 1, overflowY: 'auto' }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role} ${m.emergency ? 'emergency' : ''}`}
            style={{ whiteSpace: 'pre-line' }}>
            {m.role === 'bot' && <span style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.5 }}>🤖 CivicBot</span>}
            {m.text}
          </div>
        ))}
        {sending && (
          <div className="chat-bubble bot" style={{ opacity: 0.6 }}>
            <span style={{ display: 'flex', gap: 4 }}>
              <span style={{ animation: 'pulse-record 0.8s infinite' }}>●</span>
              <span style={{ animation: 'pulse-record 0.8s 0.2s infinite' }}>●</span>
              <span style={{ animation: 'pulse-record 0.8s 0.4s infinite' }}>●</span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row" style={{ position: 'sticky', bottom: 0 }}>
        <input className="form-input chat-input"
          placeholder={t('chatbot_placeholder')} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }} />
        <button className="btn btn-primary btn-icon" onClick={() => sendMessage(input)} disabled={sending || !input.trim()}>
          ▶
        </button>
      </div>
    </div>
  )
}
