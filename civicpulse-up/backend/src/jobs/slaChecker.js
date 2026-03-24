const cron = require('node-cron')
const db = require('../db/postgres')

async function runSLACheck() {
  try {
    const { rows: breached } = await db.query(
      `SELECT r.id, r.query_id, r.ward_id, r.citizen_id, s.breach_level
       FROM reports r
       JOIN sla_records s ON s.report_id = r.id
       WHERE r.status NOT IN ('closed','rejected')
         AND r.sla_deadline < NOW()
         AND s.breach_level < 3`
    )

    for (const report of breached) {
      const newLevel = (report.breach_level || 0) + 1
      await db.query(
        'UPDATE sla_records SET breach_level=$1, breach_at=NOW() WHERE report_id=$2',
        [newLevel, report.id]
      )

      // Log escalation
      const tierLabel = ['T0','T1 → Senior','T2 → Councillor','T3 → CMO'][newLevel] || 'T3'
      console.log(`[SLA] Report ${report.query_id} → Breach Level ${newLevel} (${tierLabel})`)

      // Stub: SMS notification
      if (newLevel === 1) {
        console.log(`[SMS] Citizen ${report.citizen_id}: SLA breached — escalated to senior official`)
      } else if (newLevel === 2) {
        console.log(`[SMS] Ward ${report.ward_id}: Escalated to Councillor`)
      } else if (newLevel >= 3) {
        console.log(`[SMS] CMO ALERT: Report ${report.query_id} unresolved >24h`)
        // Auto-update ward risk in DB
        await db.query('UPDATE wards SET risk_level=$1 WHERE id=$2', ['HIGH', report.ward_id])
      }
    }

    if (breached.length > 0) console.log(`[SLA Checker] Processed ${breached.length} breach(es)`)
  } catch (err) {
    console.error('[SLA Checker] Error:', err.message)
  }
}

function startSLAChecker() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', runSLACheck)
  console.log('[SLA Checker] Started — runs every 15 minutes')
  // Also run on startup
  setTimeout(runSLACheck, 5000)
}

module.exports = { startSLAChecker, runSLACheck }
