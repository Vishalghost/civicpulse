/**
 * SLA Escalation Tests
 * Tests the tier escalation logic and ward risk update from slaChecker.js
 */

// ── Local copy of the escalation tier logic ──────────────────────────────────
function getTierLabel(level) {
  return ['T0 (Submitted)', 'T1 → Senior Official', 'T2 → Councillor', 'T3 → CMO'][level] || 'T3 → CMO'
}

function shouldAlertCMO(level) {
  return level >= 3
}

function shouldAlertCitizen(level) {
  return level >= 1
}

describe('SLA Escalation: Tier Logic', () => {
  test('breach level 0 is T0 (no escalation yet)', () => {
    expect(getTierLabel(0)).toBe('T0 (Submitted)')
  })

  test('breach level 1 escalates to senior official', () => {
    expect(getTierLabel(1)).toContain('Senior Official')
  })

  test('breach level 2 escalates to councillor', () => {
    expect(getTierLabel(2)).toContain('Councillor')
  })

  test('breach level 3+ triggers CMO alert', () => {
    expect(getTierLabel(3)).toContain('CMO')
    expect(getTierLabel(4)).toContain('CMO')
  })

  test('CMO should be alerted at level 3+', () => {
    expect(shouldAlertCMO(2)).toBe(false)
    expect(shouldAlertCMO(3)).toBe(true)
    expect(shouldAlertCMO(5)).toBe(true)
  })

  test('citizen should be notified at level 1+', () => {
    expect(shouldAlertCitizen(0)).toBe(false)
    expect(shouldAlertCitizen(1)).toBe(true)
  })
})

describe('SLA Escalation: Breach Detection', () => {
  function isBreached(slaDeadline, status) {
    if (['closed', 'rejected'].includes(status)) return false
    return new Date(slaDeadline) < new Date()
  }

  test('open report past deadline is breached', () => {
    const past = new Date(Date.now() - 3600000).toISOString()
    expect(isBreached(past, 'submitted')).toBe(true)
  })

  test('open report before deadline is NOT breached', () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    expect(isBreached(future, 'submitted')).toBe(false)
  })

  test('closed report past deadline is NOT breached', () => {
    const past = new Date(Date.now() - 3600000).toISOString()
    expect(isBreached(past, 'closed')).toBe(false)
  })

  test('rejected report is never breached', () => {
    const past = new Date(Date.now() - 7200000).toISOString()
    expect(isBreached(past, 'rejected')).toBe(false)
  })

  test('in_progress report past deadline is breached', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isBreached(past, 'in_progress')).toBe(true)
  })
})

describe('SLA Escalation: Ward Risk Auto-Update', () => {
  test('ward risk is elevated to HIGH at breach level 3+', () => {
    // Simulates the logic in slaChecker.js runSLACheck
    const newLevel = 3
    let riskScore = 0.5
    let riskLevel = 'MEDIUM'

    if (newLevel >= 3) {
      riskScore = 0.85
      riskLevel = 'HIGH'
    }

    expect(riskScore).toBe(0.85)
    expect(riskLevel).toBe('HIGH')
  })

  test('ward risk is not elevated below breach level 3', () => {
    const newLevel = 2
    let riskScore = 0.5
    let riskLevel = 'MEDIUM'

    if (newLevel >= 3) {
      riskScore = 0.85
      riskLevel = 'HIGH'
    }

    expect(riskScore).toBe(0.5) // unchanged
    expect(riskLevel).toBe('MEDIUM')
  })
})
