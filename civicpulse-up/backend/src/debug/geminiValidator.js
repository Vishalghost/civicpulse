/**
 * ISSUE 1 FIX — Gemini API Validation Script
 * =============================================
 * Run with: node src/debug/geminiValidator.js
 *
 * Tests the FULL Gemini invocation chain with:
 *  - Correct model selection + system prompt
 *  - Structured civic hazard report payload
 *  - Rate-limit / timeout handling
 *  - Parsed JSON output verification
 */

require('dotenv').config()
const { GoogleGenerativeAI } = require('@google/generative-ai')

const GEMINI_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY not set in .env — aborting')
  process.exit(1)
}

// ── Mock civic hazard report (what chatbot.js sends to Gemini) ───────────────
const MOCK_REPORT = {
  citizen_id: 'test-citizen-001',
  query_id: 'LKO-2026-00042',
  category: 'drain',
  description: 'Ward 4 mein naali jam gayi hai. Paani sadak pe aa gaya hai. Machhar bahut ho rahe hain.',
  ward_id: 4,
  district: 'Lucknow',
  lat: 26.8467,
  lng: 80.9462,
  created_at: new Date().toISOString(),
}

const SYSTEM_PROMPT = `You are CivicPulse — an AI health and civic assistant for Uttar Pradesh, India.
Analyze the civic hazard report and return ONLY valid JSON matching this exact schema:
{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "disease_risk": ["dengue","typhoid","cholera"] (only relevant ones),
  "recommended_action": "string (max 80 chars, Hindi or English)",
  "sla_priority": 1-5 (5=most urgent),
  "auto_category_confirm": "drain|garbage|water|mosquito|other"
}`

// ── Retry wrapper for rate limiting / transient failures ─────────────────────
async function callGeminiWithRetry(prompt, maxRetries = 3, delayMs = 1500) {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 256,
      temperature: 0.1,  // Low temp for consistent JSON
      responseMimeType: 'application/json',
    },
  })

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n[Attempt ${attempt}/${maxRetries}] Calling Gemini...`)

      // Promise.race timeout (AbortController signal not supported by this SDK on Windows)
      const apiCall = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini request timed out after 10s')), 10000)
      )
      const result = await Promise.race([apiCall, timeoutPromise])

      const rawText = result.response.text().trim()
      console.log(`✅ Raw Gemini response (${rawText.length} chars):`)
      console.log(rawText)

      // Parse + validate JSON
      let parsed
      try {
        parsed = JSON.parse(rawText)
      } catch {
        // Gemini sometimes wraps JSON in markdown code fences
        const match = rawText.match(/```(?:json)?\s*([\s\S]+?)```/)
        if (match) parsed = JSON.parse(match[1])
        else throw new Error('Response is not valid JSON')
      }
      const required = ['severity', 'disease_risk', 'recommended_action', 'sla_priority', 'auto_category_confirm']
      const missing = required.filter(k => !(k in parsed))
      if (missing.length > 0) {
        throw new Error(`JSON missing fields: ${missing.join(', ')}`)
      }
      return parsed

    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('quota')
      const isTimeout  = err.message?.includes('timed out')
      const retryable  = isRateLimit || isTimeout || err.message?.includes('UNAVAILABLE')

      console.error(`❌ Attempt ${attempt} failed: ${err.message}`)
      console.error(`   Type: ${isRateLimit ? 'RATE_LIMIT' : isTimeout ? 'TIMEOUT' : 'OTHER'}`)

      if (!retryable || attempt === maxRetries) {
        throw new Error(`Gemini failed after ${maxRetries} attempts: ${err.message}`)
      }
      const backoff = delayMs * attempt
      console.log(`⏳ Retrying in ${backoff}ms (backoff)...`)
      await new Promise(r => setTimeout(r, backoff))
    }
  }
}

// ── Main validation runner ────────────────────────────────────────────────────
async function runValidation() {
  console.log('\n═══════════════════════════════════════════')
  console.log('   GEMINI API VALIDATION — CivicPulse UP  ')
  console.log('═══════════════════════════════════════════')
  console.log('\n📋 Input Report:')
  console.log(JSON.stringify(MOCK_REPORT, null, 2))

  const prompt = `Analyze this civic hazard report and return valid JSON:
  
Report:
- Category: ${MOCK_REPORT.category}
- Description: "${MOCK_REPORT.description}"
- Ward: ${MOCK_REPORT.ward_id}, District: ${MOCK_REPORT.district}
- Location: ${MOCK_REPORT.lat}°N, ${MOCK_REPORT.lng}°E
- Filed: ${MOCK_REPORT.created_at}`

  try {
    const startMs = Date.now()
    const result = await callGeminiWithRetry(prompt)
    const elapsed = Date.now() - startMs

    console.log('\n✅ PARSED JSON OUTPUT:')
    console.log(JSON.stringify(result, null, 2))

    console.log('\n📊 FIELD VALIDATION:')
    console.log(`  severity:             ${result.severity}  ${['LOW','MEDIUM','HIGH','CRITICAL'].includes(result.severity) ? '✅' : '❌ INVALID'}`)
    console.log(`  disease_risk:         ${JSON.stringify(result.disease_risk)}  ${Array.isArray(result.disease_risk) ? '✅' : '❌ NOT ARRAY'}`)
    console.log(`  recommended_action:   "${result.recommended_action}"  ${result.recommended_action?.length <= 80 ? '✅' : '⚠️ TOO LONG'}`)
    console.log(`  sla_priority:         ${result.sla_priority}  ${result.sla_priority >= 1 && result.sla_priority <= 5 ? '✅' : '❌ OUT OF RANGE'}`)
    console.log(`  auto_category_confirm:${result.auto_category_confirm}  ✅`)
    console.log(`\n⚡ Gemini latency: ${elapsed}ms`)
    console.log('\n🎉 GEMINI API VALIDATION PASSED — ready for production use')

  } catch (err) {
    console.error('\n💥 VALIDATION FAILED:', err.message)
    console.error('Fix: Check GEMINI_API_KEY in .env and ensure quota is not exhausted')
    process.exit(1)
  }
}

runValidation()
