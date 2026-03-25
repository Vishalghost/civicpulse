const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const { v4: uuidv4 } = require('uuid')
const { authMiddleware } = require('../middleware/auth')

// Ensure uploads dir exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads/videos')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// Multer — store videos on disk with unique names
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm'
    cb(null, `${uuidv4()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (_req, file, cb) => {
    const ok = /video\/(webm|mp4|ogg|quicktime)/.test(file.mimetype)
    if (ok) cb(null, true)
    else cb(new Error('Only video files allowed'))
  }
})

// In-memory index (use DB in production)
const videoIndex = []

/**
 * POST /api/video/upload
 * Multipart: video file + optional report_id, lat, lng
 */
router.post('/upload', authMiddleware, upload.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file provided' })

    const entry = {
      id:         uuidv4(),
      filename:   req.file.filename,
      path:       req.file.path,
      size:       req.file.size,
      mimetype:   req.file.mimetype,
      report_id:  req.body.report_id || null,
      lat:        req.body.lat ? parseFloat(req.body.lat) : null,
      lng:        req.body.lng ? parseFloat(req.body.lng) : null,
      uploaded_by: req.user.id,
      uploaded_at: new Date().toISOString(),
      ward_id:    req.user.ward_id,
    }
    videoIndex.push(entry)

    console.log(`[Video] Saved by ${req.user.phone}: ${req.file.filename} (${Math.round(req.file.size/1024)}KB)`)
    res.json({
      id:       entry.id,
      filename: entry.filename,
      size:     entry.size,
      url:      `/api/video/${entry.id}`,
      message:  'वीडियो सफलतापूर्वक सहेजा गया'
    })
  } catch (err) {
    console.error('[Video] Upload error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/video/:id  — stream/download a video
 */
router.get('/:id', authMiddleware, (req, res) => {
  const entry = videoIndex.find(v => v.id === req.params.id)
  if (!entry) return res.status(404).json({ error: 'Video not found' })
  if (!fs.existsSync(entry.path)) return res.status(404).json({ error: 'File missing on disk' })

  res.setHeader('Content-Type', entry.mimetype || 'video/webm')
  res.setHeader('Content-Disposition', `inline; filename="${entry.filename}"`)
  fs.createReadStream(entry.path).pipe(res)
})

/**
 * GET /api/video  — list videos for this user (worker sees own; official sees all in ward)
 */
router.get('/', authMiddleware, (req, res) => {
  const videos = videoIndex.filter(v =>
    req.user.role === 'official'
      ? v.ward_id === req.user.ward_id
      : v.uploaded_by === req.user.id
  )
  res.json({ videos: videos.map(v => ({ id: v.id, size: v.size, report_id: v.report_id, uploaded_at: v.uploaded_at, url: `/api/video/${v.id}` })) })
})

module.exports = router
