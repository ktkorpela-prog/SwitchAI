const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const ROOMS_DIR        = path.join(__dirname, '../rooms');
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);

// ── Allowed extensions (whitelist beats MIME-only check) ───────────────────
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.pdf', '.txt', '.md', '.csv', '.json', '.xml'
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv',
  'application/json', 'application/xml', 'text/xml'
]);

// ── roomId validation ──────────────────────────────────────────────────────
router.param('roomId', (req, res, next, id) => {
  if (!/^[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid room ID' });
  }
  next();
});

// ── Multer storage — UUID filenames, no original name in path ─────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(ROOMS_DIR, req.params.roomId, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(`File type not supported`));
    }
    cb(null, true);
  }
});

// POST /api/files/:roomId/upload
router.post('/:roomId/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  res.json({
    filename:     req.file.filename,
    originalname: req.file.originalname,
    size:         req.file.size,
    mimetype:     req.file.mimetype,
    url:          `/api/files/${req.params.roomId}/${req.file.filename}`
  });
});

// GET /api/files/:roomId/:filename
router.get('/:roomId/:filename', (req, res) => {
  // Strip any path components from filename to prevent traversal
  const safeFilename = path.basename(req.params.filename);
  const uploadsDir   = path.resolve(path.join(ROOMS_DIR, req.params.roomId, 'uploads'));
  const filePath     = path.resolve(path.join(uploadsDir, safeFilename));

  // Verify resolved path stays inside uploads directory
  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` });
  }
  res.status(400).json({ error: err.message });
});

module.exports = router;
