const express = require('express')
const router = express.Router()
const db = require('../db/postgres')

router.get('/:wardId/risk', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM wards WHERE id=$1', [req.params.wardId])
    if (!rows[0]) return res.status(404).json({ error: 'Ward not found' })
    const w = rows[0]
    res.json({ ward_id: w.id, ward_name: w.name, risk_score: w.risk_score, risk_level: w.risk_level, predicted_diseases: [], confidence: 0.75 })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
