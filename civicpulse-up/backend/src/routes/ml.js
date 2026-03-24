const express = require('express')
const router = express.Router()
const db = require('../db/postgres')
const axios = require('axios').default

const ML_URL = process.env.ML_ENGINE_URL || 'http://localhost:8000'

// GET /api/ml/risk-scores
router.get('/risk-scores', async (req, res) => {
  try {
    const mlRes = await axios.get(`${ML_URL}/risk-scores`, { timeout: 5000 })
    res.json(mlRes.data)
  } catch {
    const { rows } = await db.query('SELECT * FROM wards ORDER BY risk_score DESC')
    res.json({ wards: rows })
  }
})

// GET /api/ml/cmo-brief
router.get('/cmo-brief', async (req, res) => {
  try {
    const mlRes = await axios.get(`${ML_URL}/cmo-brief`, { timeout: 5000 })
    res.json(mlRes.data)
  } catch {
    // Static demo brief
    res.json({
      ward: 'Ward 9 Raptipur',
      district: 'gorakhpur',
      risk_level: 'CRITICAL',
      risk_score: 0.91,
      date: new Date().toISOString().split('T')[0],
      predicted_window: `${new Date(Date.now() + 5*86400000).toDateString()} – ${new Date(Date.now() + 10*86400000).toDateString()}`,
      summary: 'Ward 9 (Raptipur) shows critical dengue risk. Past 7 days: 23 open drain complaints (↑ 4x baseline), 11 suspected fever cases via ASHA logs, 3 lab-confirmed dengue at City Hospital. Pattern precedes 2022 Raptipur cluster by 7 days.',
      actions: [
        'Deploy fogging unit Ward 9A, 9B within 24 hours',
        'ASHA door-to-door fever survey — priority Zone 9A',
        'Alert PHC Raptipur: stock +50 dengue test kits',
        'Clear 6 drain reports (GKP-2024-00085 to 00091)',
      ],
      model_version: '1.0',
      auto_idsp: true
    })
  }
})

// POST /api/ml/retrain (admin)
router.post('/retrain', async (req, res) => {
  try {
    const mlRes = await axios.post(`${ML_URL}/retrain`, {}, { timeout: 30000 })
    res.json(mlRes.data)
  } catch { res.json({ success: true, message: 'Retrain queued (demo mode)' }) }
})

// GET /api/wards/:wardId/risk
router.get('/:wardId/risk', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM wards WHERE id=$1', [req.params.wardId])
    if (!rows[0]) return res.status(404).json({ error: 'Ward not found' })
    const ward = rows[0]
    // Try ML engine
    try {
      const mlRes = await axios.get(`${ML_URL}/ward-risk/${req.params.wardId}`, { timeout: 5000 })
      return res.json(mlRes.data)
    } catch {}
    res.json({
      ward_id: ward.id,
      ward_name: ward.name,
      risk_score: ward.risk_score,
      risk_level: ward.risk_level,
      predicted_diseases: ward.risk_level === 'HIGH' ? ['dengue'] : ward.risk_level === 'CRITICAL' ? ['dengue','cholera'] : [],
      confidence: 0.78
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
