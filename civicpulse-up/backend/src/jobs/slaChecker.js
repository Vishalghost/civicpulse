const cron = require('node-cron')

// ── Model imports ──────────────────────────────────────────────────────────
const SlaRecord = require('../models/SlaRecord')
const Ward = require('../models/Ward')

async function runSLACheck() {
  try {
    const breached = await SlaRecord.getPendingBreaches()

    for (const record of breached) {
      // Escalate: increments breach_level, sets breach_at, notified flags
      const updated = await SlaRecord.escalate(record.report_id)
      const newLevel = updated?.breach_level || 1

      const tierLabel = ['T0', 'T1 → Senior', 'T2 → Councillor', 'T3 → CMO'][newLevel] || 'T3'
      console.log(`[SLA] Report ${record.query_id} → Breach Level ${newLevel} (${tierLabel})`)

      // Stub: SMS / WhatsApp notification
      if (newLevel === 1) {
        console.log(`[SMS] Citizen ${record.citizen_id}: SLA breached — escalated to senior official`)
      } else if (newLevel === 2) {
        console.log(`[SMS] Ward ${record.ward_id}: Escalated to Councillor`)
      } else if (newLevel >= 3) {
        console.log(`[SMS] CMO ALERT: Report ${record.query_id} unresolved >24h`)
        // Auto-elevate ward risk via model
        await Ward.updateRisk(record.ward_id, { riskScore: 0.85, riskLevel: 'HIGH' })
      }
    }

    if (breached.length > 0) console.log(`[SLA Checker] Processed ${breached.length} breach(es)`)
  } catch (err) {
    console.error('[SLA Checker] Error:', err.message)
  }
}

function startSLAChecker() {
  cron.schedule('*/15 * * * *', runSLACheck)
  console.log('[SLA Checker] Started — runs every 15 minutes')
  setTimeout(runSLACheck, 5000)
}

module.exports = { startSLAChecker, runSLACheck }
