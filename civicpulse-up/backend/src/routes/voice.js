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

    // Guard: reject suspiciously small blobs (< 1 KB = empty recording)
    if (audio_base64.length < 1000) {
      return res.json({
        transcript: '',
        lang,
        success: false,
        fallback: true,
        message: 'Recording too short — please hold the button and speak clearly'
      })
    }

    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const langName = LANG_PROMPTS[lang] || 'Hindi'

    const transcriptionPrompt = `You are a transcription assistant for a civic complaint app in India.
Transcribe the audio accurately in ${langName}.
The person is reporting a civic problem (blocked drain, garbage, water issue, mosquito, etc.) to their local ward office.
Return ONLY the transcribed text, nothing else. Do not translate, do not add explanations.
If you cannot understand the audio, return: "आवाज़ स्पष्ट नहीं — कृपया फिर से बोलें"`

    // Try primary mime type, fall back to audio/wav if Gemini rejects webm
    let transcript = ''
    const mimeTypesToTry = [mime_type, 'audio/wav', 'audio/mp4'].filter((v, i, a) => a.indexOf(v) === i)

    for (const mimeType of mimeTypesToTry) {
      try {
        const result = await model.generateContent([
          { inlineData: { mimeType, data: audio_base64 } },
          transcriptionPrompt
        ])
        transcript = result.response.text().trim()
        break // success
      } catch (geminiErr) {
        const isFormatErr = geminiErr.message?.includes('mime') ||
                            geminiErr.message?.includes('format') ||
                            geminiErr.message?.includes('INVALID')
        if (!isFormatErr || mimeType === mimeTypesToTry[mimeTypesToTry.length - 1]) {
          throw geminiErr // rethrow if not a format error or last attempt
        }
        console.warn(`[Voice] ${mimeType} rejected, trying next format...`)
      }
    }

    // Log to SQLite (non-critical)
    try {
      sqliteDb.prepare(
        'INSERT INTO voice_logs (citizen_id, phone, lang, transcript) VALUES (?, ?, ?, ?)'
      ).run(citizen_id || null, phone || null, lang, transcript)
    } catch (_) { /* non-critical */ }

    res.json({ transcript, lang, success: true })

  } catch (err) {
    console.error('[Voice] Transcribe error:', err.message)
    // Return 200 with empty transcript instead of 500 so frontend doesn't crash
    res.json({
      transcript: '',
      lang: req.body?.lang || 'hi',
      success: false,
      fallback: true,
      message: err.message?.includes('API key') ? 'Invalid Gemini API key' : 'आवाज़ पहचान विफल — कृपया फिर से बोलें'
    })
  }
})

module.exports = router
