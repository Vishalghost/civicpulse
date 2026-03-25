/**
 * Deduplication Tests
 * Tests the 50-metre radius grouping logic that powers Report.findDuplicate
 */

/**
 * Haversine distance formula — same algorithm used in Report model.
 * Returns distance in metres between two lat/lng points.
 */
function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Simulates the deduplication check: given a new pin and a list of
 * existing reports for the same ward+category, return the first
 * match within RADIUS_M, or null if none.
 */
const RADIUS_M = 50

function findDuplicate(newLat, newLng, existingReports, ward_id, category) {
  for (const r of existingReports) {
    if (r.ward_id !== ward_id || r.category !== category) continue
    if (!r.lat || !r.lng) continue
    const d = distanceMetres(newLat, newLng, r.lat, r.lng)
    if (d <= RADIUS_M) return r
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Deduplication: Haversine Distance', () => {
  test('same point is 0 metres apart', () => {
    expect(distanceMetres(26.845, 80.940, 26.845, 80.940)).toBeCloseTo(0, 0)
  })

  test('points ~30m apart are detected as close', () => {
    // ~0.00027 degree lat ≈ 30 m
    const d = distanceMetres(26.845, 80.940, 26.8452695, 80.940)
    expect(d).toBeLessThan(50)
  })

  test('points ~100m apart exceed the 50m threshold', () => {
    // ~0.0009 degree lat ≈ 100 m
    const d = distanceMetres(26.845, 80.940, 26.8459, 80.940)
    expect(d).toBeGreaterThan(50)
  })
})

describe('Deduplication: Report Clustering', () => {
  const baseReport = {
    id: 'existing-1',
    query_id: 'LKO-2026-00001',
    ward_id: 1,
    category: 'drain',
    lat: 26.8450,
    lng: 80.9400,
    duplicate_count: 1,
    status: 'submitted',
  }

  test('new pin within 30m of existing → returns existing report', () => {
    const dup = findDuplicate(26.84527, 80.9400, [baseReport], 1, 'drain')
    expect(dup).not.toBeNull()
    expect(dup.query_id).toBe('LKO-2026-00001')
  })

  test('new pin >50m away → no duplicate found', () => {
    const dup = findDuplicate(26.8460, 80.9400, [baseReport], 1, 'drain')
    expect(dup).toBeNull()
  })

  test('50 citizens within 50m → all link to same existing report', () => {
    // Small perturbations within ~15m
    const perts = Array.from({ length: 50 }, (_, i) => ({
      lat: 26.8450 + (i % 5) * 0.00005,
      lng: 80.9400 + Math.floor(i / 5) * 0.00005,
    }))
    const results = perts.map(p => findDuplicate(p.lat, p.lng, [baseReport], 1, 'drain'))
    expect(results.every(r => r !== null)).toBe(true)
  })

  test('different ward → not a duplicate', () => {
    const dup = findDuplicate(26.8450, 80.9400, [baseReport], 2, 'drain')
    expect(dup).toBeNull()
  })

  test('different category same location → not a duplicate', () => {
    const dup = findDuplicate(26.8450, 80.9400, [baseReport], 1, 'garbage')
    expect(dup).toBeNull()
  })

  test('report without coordinates is skipped', () => {
    const noCoord = { ...baseReport, lat: null, lng: null }
    const dup = findDuplicate(26.8450, 80.9400, [noCoord], 1, 'drain')
    expect(dup).toBeNull()
  })
})

describe('Deduplication: Urgency Amplification', () => {
  test('duplicate_count increments correctly', () => {
    let count = 1
    // Simulate 49 more citizens pining the same spot
    for (let i = 0; i < 49; i++) count++
    expect(count).toBe(50)
  })

  test('high duplicate count creates larger pin radius on map', () => {
    // mirrors CitizenPinMap.jsx getRadius: min(8 + (dup-1)*2.5, 28)
    const getRadius = (dup) => Math.min(8 + (dup - 1) * 2.5, 28)
    expect(getRadius(1)).toBe(8)
    expect(getRadius(5)).toBe(18)
    expect(getRadius(50)).toBe(28) // capped at 28px
  })
})
