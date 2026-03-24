const express = require('express')
const router = express.Router()
const { GoogleGenerativeAI } = require('@google/generative-ai')
const sqliteDb = require('../db/sqlite')

const SUPPORTED_LANGUAGES = [
  { code: 'hi',  name: 'हिंदी',    nameEn: 'Hindi' },
  { code: 'bho', name: 'भोजपुरी',  nameEn: 'Bhojpuri' },
  { code: 'mr',  name: 'मराठी',    nameEn: 'Marathi' },
  { code: 'ta',  name: 'தமிழ்',    nameEn: 'Tamil' },
  { code: 'en',  name: 'English',  nameEn: 'English' },
]

const LANG_PROMPTS = {
  hi:  'हिंदी',
  bho: 'भोजपुरी',
  mr:  'मराठी',
  ta:  'தமிழ்',
  en:  'English',
}

// GET /api/voice/languages
router.get('/languages', (req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES })
})

// POST /api/voice/transcribe
// Body: { audio_base64: string, mime_type: string, lang: string }
router.post('/transcribe', async (req, res) => {
  try {
    const geminiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY
    if (!geminiKey) return res.status(400).json({ error: 'Gemini API key required' })

    const { audio_base64, mime_type = 'audio/webm', lang = 'hi', citizen_id, phone } = req.body
    if (!audio_base64) return res.status(400).json({ error: 'audio_base64 required' })

    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const langName = LANG_PROMPTS[lang] || 'Hindi'

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mime_type,
          data: audio_base64,
        }
      },
      `You are a transcription assistant for a civic complaint app in India.
Transcribe the audio accurately in ${langName}.
The person is reporting a civic problem (blocked drain, garbage, water issue, mosquito, etc.) to their local ward office.
Return ONLY the transcribed text, nothing else. Do not translate, do not add explanations.
If you cannot understand the audio, return: "आवाज़ स्पष्ट नहीं — कृपया फिर से बोलें"`
    ])

    const transcript = result.response.text().trim()

    // Log to SQLite
    try {
      sqliteDb.prepare(
        'INSERT INTO voice_logs (citizen_id, phone, lang, transcript) VALUES (?, ?, ?, ?)'
      ).run(citizen_id || null, phone || null, lang, transcript)
    } catch (e) { /* non-critical */ }

    res.json({ transcript, lang, success: true })
  } catch (err) {
    console.error('[Voice] Transcribe error:', err.message)
    res.status(500).json({ error: 'Transcription failed: ' + err.message })
  }
})

module.exports = router
