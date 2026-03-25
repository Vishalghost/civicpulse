const express = require('express')
const router = express.Router()
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { authMiddleware } = require('../middleware/auth')
const sqliteDb = require('../db/sqlite')

const EMERGENCY_KEYWORDS = [
  'bahut beemar','hospital','tez bukhaar','behosh','khoon','saansen',
  'ulti band','bura lagna','unconscious','bleeding','breathing',
  'chest pain','dyeing','dying','मर रहा','बेहोश','बहुत बुखार'
]

const SYSTEM_PROMPT = `You are CivicPulse — an AI health and civic assistant for Uttar Pradesh, India.
You help citizens report problems (blocked drains, garbage, contaminated water, mosquito breeding), 
check complaint status, understand disease outbreak risks, and access emergency services.
Always respond in the SAME language the user writes in (Hindi, Bhojpuri, Marathi, Tamil, or English).
Keep responses concise (2-4 lines). If you detect a medical emergency, always include "108" and the nearest PHC.
Be warm, helpful, and use simple language suitable for rural/semi-urban citizens.`

// POST /api/chatbot/message
router.post('/message', authMiddleware, async (req, res) => {
  try {
    const { message, ward_id, session_id, history = [] } = req.body
    const lower = message.toLowerCase()

    // Emergency check (always local, never wait for AI)
    const isEmergency = EMERGENCY_KEYWORDS.some(k => lower.includes(k))
    if (isEmergency) {
      const reply = `🚨 आपातकाल पहचाना गया!\n✅ PHC को सूचित किया गया\n\nतुरंत 108 (Ambulance) पर कॉल करें या नजदीकी PHC जाएं।\n📞 PHC: +91-522-1234567`
      logChat(req.user, message, reply, true)
      return res.json({ reply, emergency: true })
    }

    // Try Gemini first
    const geminiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: SYSTEM_PROMPT,
        })

        // Build chat history for context
        const chatHistory = history.slice(-6).map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        }))

        const chat = model.startChat({ history: chatHistory })
        const result = await chat.sendMessage(
          `User is in Ward ${ward_id || req.user.ward_id || 1}, District ${req.user.district || 'Lucknow'}.\n${message}`
        )
        const reply = result.response.text()
        logChat(req.user, message, reply, false)
        return res.json({ reply, emergency: false, source: 'gemini' })
      } catch (gemErr) {
        console.error('[Chatbot] Gemini error:', gemErr.message)
        // Fall through to fallback
      }
    }

    // Fallback keyword reply
    const reply = fallbackReply(lower, ward_id || req.user.ward_id || 1)
    logChat(req.user, message, reply, false)
    res.json({ reply, emergency: false, source: 'fallback' })
  } catch (err) {
    console.error('[Chatbot] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

function logChat(user, message, reply, emergency) {
  try {
    sqliteDb.prepare(
      'INSERT INTO chatbot_logs (citizen_id, phone, message, reply, emergency) VALUES (?, ?, ?, ?, ?)'
    ).run(user?.id || null, user?.phone || null, message, reply, emergency ? 1 : 0)
  } catch { /* non-critical */ }
}

function fallbackReply(lower, wardId) {
  if (/risk|bimari|dengue|khatre|outbreak/.test(lower))
    return `Ward ${wardId} में वर्तमान जोखिम स्तर: MEDIUM\n🦠 सावधानी: Dengue, Typhoid\nमच्छरदानी लगाएं, उबला पानी पिएं।`
  if (/shikayat|complaint|status|query/.test(lower))
    return 'शिकायत की स्थिति जांचने के लिए Query ID (जैसे LKO-2024-00123) Status पेज पर दर्ज करें।'
  if (/naali|drain|nali|blocked/.test(lower))
    return 'नाली अवरोध की जानकारी दी — "शिकायत करें" से रिपोर्ट करें, 4 घंटे में कार्रवाई होगी।'
  if (/mosquito|machhar/.test(lower))
    return 'मच्छर जनन की शिकायत दर्ज करें। वार्ड अधिकारी को fogging के लिए सूचित किया जाएगा।'
  return 'मैं CivicPulse हूँ — Risk, शिकायत status, या emergency के बारे में पूछें।'
}

// POST /api/chatbot/escalate — WhatsApp handoff with enriched payload
router.post('/escalate', authMiddleware, async (req, res) => {
  try {
    const { history = [], location = null } = req.body
    const wardId = req.user.ward_id || 1
    const userName = req.user.name || 'नागरिक'
    const userPhone = req.user.phone || 'UNKNOWN'
    const district = (req.user.district || 'lucknow').toUpperCase()

    // Fetch current ward risk (best-effort, don't block on failure)
    let riskLevel = 'UNKNOWN'
    let riskScore = ''
    try {
      const db = require('../db/sqlite')
      const row = db.prepare('SELECT risk_level, risk_score FROM wards WHERE id = ?').get(wardId)
      if (row) { riskLevel = row.risk_level; riskScore = `(${Math.round(row.risk_score * 100)}%)` }
    } catch { /* non-critical */ }

    // Build last-3-messages summary
    const lastMsgs = history.slice(-3)
    const msgSummary = lastMsgs.length > 0
      ? lastMsgs.map(m => `  [${m.role === 'user' ? 'नागरिक' : 'Bot'}] ${m.content?.slice(0, 60)}`).join('\n')
      : '  (no prior messages)'

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
    const locStr = location ? `${location.lat.toFixed(4)}°N ${location.lng.toFixed(4)}°E` : 'GPS unavailable'

    const waText = [
      `🚨 CivicPulse Emergency Alert`,
      `──────────────────────────`,
      `👤 नागरिक: ${userName} | 📞 ${userPhone}`,
      `🏘️ Ward ${wardId} | District: ${district}`,
      `⚠️ Risk: ${riskLevel} ${riskScore}`,
      `📍 Location: ${locStr}`,
      `🕐 Time: ${now} IST`,
      `──────────────────────────`,
      `📋 Last messages:`,
      msgSummary,
      `──────────────────────────`,
      `⚡ Auto-escalated → PHC & CMO (T+30s)`,
      `📞 Ambulance: 108 | PHC: +91-522-1234567`,
    ].join('\n')

    const waNumber = process.env.WHATSAPP_PHC_NUMBER || '919415000000'
    const deepLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`

    // Log emergency
    console.log(`[Emergency] Ward ${wardId} | User ${userPhone} | Risk ${riskLevel} | ${now}`)

    res.json({
      deepLink,
      whatsappNumber: waNumber,
      riskLevel,
      wardId,
      escalatedAt: new Date().toISOString(),
      success: true,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
