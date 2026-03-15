const express = require('express');
const router = express.Router();
const keystore = require('../keystore');

const VALID_MODELS = ['claude', 'gpt4', 'gemini', 'mistral'];

// GET /api/keys/status — returns which models are configured (no key values)
router.get('/status', (req, res) => {
  res.json(keystore.getStatus());
});

// POST /api/keys/:model — save or clear a key
// Body: { apiKey: 'sk-...' }  (empty string to clear)
router.post('/:model', (req, res) => {
  const { model } = req.params;
  if (!VALID_MODELS.includes(model)) {
    return res.status(400).json({ error: 'Unknown model' });
  }
  const { apiKey } = req.body;
  keystore.setKey(model, apiKey || '');
  res.json({ ok: true, configured: !!apiKey });
});

module.exports = router;
