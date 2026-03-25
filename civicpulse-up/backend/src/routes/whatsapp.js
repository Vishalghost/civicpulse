/**
 * AGENT 4: Bhashini NLP + WhatsApp 30-Second Emergency SOS
 * ==========================================================
 * Handles:
 *   - Bhashini/AI4Bharat language detection + NLP analysis
 *   - WhatsApp Business API webhook for context transfer
 *   - Emergency cluster detection → PHC + CMO alert in < 30s
 *
 * POST /api/chatbot/whatsapp-webhook   — incoming WhatsApp message
 * POST /api/chatbot/escalate-emergency — internal trigger from chatbot
 */

const express = require('express')
const router = express.Router()
const axios = require('axios')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const db = require('../db/postgres')

// ── Config ────────────────────────────────────────────────────────────────────
const WA_API_URL   = process.env.WA_API_URL        || 'https://graph.facebook.com/v19.0'
const WA_PHC_NUM   = process.env.WHATSAPP_PHC_NUMBER || '919999888800'
const WA_CMO_NUM   = process.env.WHATSAPP_CMO_NUMBER || '919999777700'
const WA_TOKEN     = process.env.WA_ACCESS_TOKEN   || ''
const WA_PHONE_ID  = process.env.WA_PHONE_NUMBER_ID || ''
const BHASHINI_KEY = process.env.BHASHINI_API_KEY  || ''
const GEMINI_KEY   = process.env.GEMINI_API_KEY    || ''

// Emergency symptoms that, in combination, trigger an SOS
const EMERGENCY_CLUSTERS = {
  dengue:  ['fever', 'rash', 'joint_pain', 'bleeding'],
  cholera: ['diarrhea', 'vomiting', 'dehydration'],
  typhoid: ['fever', 'abdominal_pain', 'weakness'],
}

// ── UTIL: Send WhatsApp message ───────────────────────────────────────────────
async function sendWhatsApp(to, text, templateName = null) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    // Dev mode: log instead of calling API
    console.log(`[WhatsApp→${to}] ${text.slice(0, 80)}`)
    return { success: true, dev: true }
  }
  try {
    const body = templateName ? {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: templateName, language: { code: 'hi' } }
    } : {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    }
    const r = await axios.post(`${WA_API_URL}/${WA_PHONE_ID}/messages`, body, {
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 8000,
    })
    return { success: true, wa_id: r.data?.messages?.[0]?.id }
  } catch (err) {
    console.error('[WhatsApp] Send failed:', err.message)
    return { success: false, error: err.message }
  }
}

// ── UTIL: Bhashini language detection + NLP ───────────────────────────────────
async function bhashiniAnalyze(text, sourceLang = 'hi') {
  if (!BHASHINI_KEY) {
    // Fallback: use Gemini for language detection
    return geminiLanguageFallback(text)
  }
  try {
    const r = await axios.post('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
      pipelineTasks: [
        { taskType: 'txt-lang-detection', config: { language: { sourceLanguage: '' } } }
      ],
      inputData: { input: [{ source: text }] }
    }, {
      headers: { Authorization: BHASHINI_KEY, 'Content-Type': 'application/json' },
      timeout: 5000,
    })
    const detectedLang = r.data?.pipelineResponse?.[0]?.output?.[0]?.langPrediction?.[0]?.langCode || sourceLang
    return { detectedLang, confidence: 0.9, source: 'bhashini' }
  } catch (err) {
    console.warn('[Bhashini] Falling back to Gemini:', err.message)
    return geminiLanguageFallback(text)
  }
}

async function geminiLanguageFallback(text) {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(
      `Detect language. Return ONLY: {"lang":"hi|bho|en|ta|mr","confidence":0.0-1.0}\nText: "${text.slice(0, 200)}"`
    )
    const parsed = JSON.parse(result.response.text().trim())
    return { detectedLang: parsed.lang, confidence: parsed.confidence, source: 'gemini_fallback' }
  } catch {
    return { detectedLang: 'hi', confidence: 0.5, source: 'default' }
  }
}

// ── UTIL: Emergency cluster detection ────────────────────────────────────────
function detectEmergencyCluster(symptoms) {
  if (!symptoms || symptoms.length === 0) return null
  for (const [disease, keys] of Object.entries(EMERGENCY_CLUSTERS)) {
    const matchCount = keys.filter(k => symptoms.some(s => s.toLowerCase().includes(k))).length
    if (matchCount >= 2) return { disease, matchCount, severity: matchCount >= 3 ? 'CRITICAL' : 'HIGH' }
  }
  return null
}

// ── UTIL: Build WhatsApp context summary for health worker ────────────────────
function buildContextMessage(session, citizenPhone, wardRisk) {
  const history = (session.history || []).slice(-5)
  const chatSummary = history.map(m => `${m.role === 'user' ? '👤' : '🤖'} ${m.content}`).join('\n')
  return `🚨 *CivicPulse Emergency Escalation*
━━━━━━━━━━━━━━━━━━━━━━━

📍 *Ward ${session.ward_id}* | ${new Date().toLocaleString('hi-IN', { timeZone: 'Asia/Kolkata' })}
📞 *Citizen:* ${citizenPhone || 'Anonymous'}
🔴 *Ward Risk:* ${wardRisk?.risk_level || 'UNKNOWN'} (${wardRisk?.risk_score ? Math.round(wardRisk.risk_score * 100) : '--'}%)

*Chat History (last 5 messages):*
${chatSummary || 'No prior messages'}

*Action Required:* Call citizen immediately. Session auto-closed after 30 min.
━━━━━━━━━━━━━━━━━━━━━━━
CivicPulse | Smart Cities Mission`
}

// ── ROUTE: Emergency SOS trigger ─────────────────────────────────────────────
// POST /api/chatbot/escalate-emergency
// Called by chatbot.js when emergency keywords detected
router.post('/escalate-emergency', async (req, res) => {
  const t0 = Date.now()
  try {
    const { session_id, citizen_phone, ward_id, symptoms = [], message, history = [] } = req.body

    // 1. Detect emergency cluster
    const cluster = detectEmergencyCluster(symptoms)
    const isCritical = cluster?.severity === 'CRITICAL' || !cluster

    // 2. Get ward risk from DB
    const { rows: riskRows } = await db.query(
      `SELECT risk_level, risk_score FROM ward_risk_scores
       WHERE ward_id = ? ORDER BY computed_at DESC LIMIT 1`,
      [ward_id || 1]
    )
    const wardRisk = riskRows[0] || { risk_level: 'UNKNOWN', risk_score: 0 }

    // 3. Build context message
    const session = { ward_id, history }
    const contextMsg = buildContextMessage(session, citizen_phone, wardRisk)

    // 4. Send alerts in PARALLEL (target: < 30s total)
    const alerts = await Promise.allSettled([
      // → PHC health worker
      sendWhatsApp(WA_PHC_NUM, contextMsg),
      // → CMO (if CRITICAL)
      isCritical ? sendWhatsApp(WA_CMO_NUM,
        `🔴 CRITICAL ALERT — Ward ${ward_id}\n${cluster ? `Disease cluster: ${cluster.disease.toUpperCase()}` : 'Emergency reported'}\nCitizen: ${citizen_phone || 'Anonymous'}\nImmediate action required.`
      ) : Promise.resolve({ skipped: true }),
      // → Log in DB
      db.query(
        `UPDATE chat_sessions SET emergency = TRUE, escalated_at = NOW(), escalated_to = 'PHC'
         WHERE id = ?`,
        [session_id]
      ).catch(() => {}),
    ])

    const elapsed = Date.now() - t0
    const phcResult = alerts[0].value
    const cmoResult = alerts[1].value

    console.log(`[Emergency] Escalation complete in ${elapsed}ms | PHC:${phcResult?.success} | CMO:${cmoResult?.success || cmoResult?.skipped}`)

    res.json({
      success: true,
      elapsed_ms: elapsed,
      under_30s: elapsed < 30000,
      phc_notified: phcResult?.success,
      cmo_notified: cmoResult?.success || false,
      cluster_detected: cluster,
      message: `🚨 Emergency escalated! PHC notified. Call 108 immediately.`,
      whatsapp_url: `https://wa.me/${WA_PHC_NUM}?text=${encodeURIComponent('Emergency — CivicPulse Ward ' + ward_id)}`
    })
  } catch (err) {
    console.error('[Emergency] Escalation error:', err.message)
    // Even on error, return 200 so citizen sees action taken
    res.json({
      success: false,
      error: err.message,
      whatsapp_url: `https://wa.me/${WA_PHC_NUM}`,
      message: '⚠️ Alert partially sent — please call 108 directly'
    })
  }
})

// ── ROUTE: WhatsApp Webhook (incoming messages from citizens via WA) ──────────
// POST /api/chatbot/whatsapp-webhook
// Verified by Meta via GET /api/chatbot/whatsapp-webhook?hub.verify_token=...
router.get('/whatsapp-webhook', (req, res) => {
  const mode  = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    res.send(challenge)
  } else {
    res.status(403).send('Forbidden')
  }
})

router.post('/whatsapp-webhook', async (req, res) => {
  res.sendStatus(200) // Acknowledge to Meta immediately (< 15s requirement)

  try {
    const entry = req.body?.entry?.[0]
    const change = entry?.changes?.[0]?.value
    const message = change?.messages?.[0]
    if (!message) return

    const from = message.from   // citizen's WhatsApp number
    const text = message.type === 'text' ? message.text?.body : null
    if (!text) return

    console.log(`[WA Webhook] From: ${from} | Text: ${text.slice(0, 60)}`)

    // Language detection via Bhashini
    const { detectedLang } = await bhashiniAnalyze(text, 'hi')

    // Forward to internal chatbot handler
    const chatRes = await axios.post('http://localhost:3001/api/chatbot/message', {
      message: text,
      ward_id: 1,
      session_id: `wa_${from}`,
      channel: 'whatsapp',
      lang: detectedLang,
    }, { headers: { 'x-api-key': process.env.INTERNAL_API_KEY || 'internal' }, timeout: 10000 })

    const { reply, emergency, whatsapp_url } = chatRes.data

    // Reply back to citizen on WhatsApp
    if (reply) {
      await sendWhatsApp(from, reply)
    }

    // If emergency, trigger full SOS flow
    if (emergency) {
      await axios.post('http://localhost:3001/api/chatbot/escalate-emergency', {
        citizen_phone: from,
        ward_id: 1,
        message: text,
        session_id: `wa_${from}`,
        history: [{ role: 'user', content: text }]
      }, { timeout: 30000 })
    }
  } catch (err) {
    console.error('[WA Webhook] Processing error:', err.message)
  }
})

// ── ROUTE: Context transfer summary (for health worker landing page) ──────────
// GET /api/chatbot/context/:sessionId
router.get('/context/:sessionId', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cs.*, wr.risk_level, wr.risk_score
       FROM chat_sessions cs
       LEFT JOIN ward_risk_scores wr ON wr.ward_id = cs.ward_id
       WHERE cs.id = ? OR cs.whatsapp_thread = ?
       ORDER BY wr.computed_at DESC LIMIT 1`,
      [req.params.sessionId, req.params.sessionId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
