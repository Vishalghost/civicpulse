/**
 * Anti-Gaming Tests
 * Tests the closure rate limit and 4-field evidence validation logic
 * from backend/src/routes/officials.js
 */

// ── Rate limiter (extracted from officials.js for testability) ────────────────
const closureTimestamps = new Map()

function checkClosureRateLimit(workerId) {
  const now = Date.now()
  const timestamps = (closureTimestamps.get(workerId) || []).filter(t => now - t < 3600000)
  if (timestamps.length >= 5) return false
  timestamps.push(now)
  closureTimestamps.set(workerId, timestamps)
  return true
}

function resetRateLimit(workerId) {
  closureTimestamps.delete(workerId)
}

// ── Validation helper (mirrors officials.js closure logic) ───────────────────
function validateEvidence({ photo_before, photo_after, geo_lat, geo_lng, action_taken }) {
  const missing = []
  if (!photo_before)                                    missing.push('photo_before')
  if (!photo_after)                                     missing.push('photo_after')
  if (!geo_lat || !geo_lng)                             missing.push('geo_tag')
  if (!action_taken || action_taken.trim().length < 20) missing.push('action_taken (min 20 chars)')
  return missing
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Anti-Gaming: Closure Rate Limit', () => {
  beforeEach(() => resetRateLimit('worker-test-1'))

  test('allows first 5 closures within 1 hour', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkClosureRateLimit('worker-test-1')).toBe(true)
    }
  })

  test('blocks 6th closure within same hour', () => {
    for (let i = 0; i < 5; i++) checkClosureRateLimit('worker-test-1')
    expect(checkClosureRateLimit('worker-test-1')).toBe(false)
  })

  test('independent workers do not share limits', () => {
    resetRateLimit('worker-A')
    resetRateLimit('worker-B')
    for (let i = 0; i < 5; i++) checkClosureRateLimit('worker-A')
    // worker-B should still be allowed
    expect(checkClosureRateLimit('worker-B')).toBe(true)
  })

  test('first closure always returns true for fresh worker', () => {
    expect(checkClosureRateLimit('brand-new-worker')).toBe(true)
  })
})

describe('Anti-Gaming: 4-Field Evidence Validation', () => {
  const fullEvidence = {
    photo_before: 'uploads/before.jpg',
    photo_after:  'uploads/after.jpg',
    geo_lat:      '26.8467',
    geo_lng:      '80.9462',
    action_taken: 'Cleared blocked drain and removed debris from the culvert.',
  }

  test('passes with all 4 fields present', () => {
    const missing = validateEvidence(fullEvidence)
    expect(missing).toHaveLength(0)
  })

  test('fails when photo_before is missing', () => {
    const ev = { ...fullEvidence, photo_before: null }
    expect(validateEvidence(ev)).toContain('photo_before')
  })

  test('fails when photo_after is missing', () => {
    const ev = { ...fullEvidence, photo_after: undefined }
    expect(validateEvidence(ev)).toContain('photo_after')
  })

  test('fails when geo_lat is missing', () => {
    const ev = { ...fullEvidence, geo_lat: null }
    expect(validateEvidence(ev)).toContain('geo_tag')
  })

  test('fails when action_taken is < 20 chars', () => {
    const ev = { ...fullEvidence, action_taken: 'Done' }
    expect(validateEvidence(ev)).toContain('action_taken (min 20 chars)')
  })

  test('fails with multiple missing fields', () => {
    const ev = { photo_before: null, photo_after: null, geo_lat: null, geo_lng: null, action_taken: '' }
    const missing = validateEvidence(ev)
    expect(missing.length).toBeGreaterThanOrEqual(3)
  })
})
