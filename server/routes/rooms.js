const express   = require('express');
const router    = express.Router();
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');

// Max 10 join attempts per IP per 15 minutes
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many join attempts. Please try again later.' }
});

const ROOMS_DIR = path.join(__dirname, '../rooms');

// ── roomId validation — only slugified alphanum/dash allowed ──────────────
router.param('roomId', (req, res, next, id) => {
  if (!/^[a-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid room ID' });
  }
  next();
});

function getRoomPath(roomId) {
  return path.join(ROOMS_DIR, roomId);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getAuthHeaders(req) {
  return {
    inviteCode: String(req.headers['x-invite-code'] || '').slice(0, 256),
    username:   String(req.headers['x-username']   || '').slice(0, 100),
  };
}

function verifyInviteCode(roomId, inviteCode) {
  const settingsPath = path.join(getRoomPath(roomId), 'settings.json');
  if (!fs.existsSync(settingsPath)) return false;
  try {
    const stored = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).invite_code;
    if (!stored || !inviteCode) return false;
    const a = Buffer.from(stored);
    const b = Buffer.from(inviteCode);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function verifyOwner(roomId, username) {
  const settingsPath = path.join(getRoomPath(roomId), 'settings.json');
  if (!fs.existsSync(settingsPath)) return false;
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8')).owner === username;
  } catch { return false; }
}

// Escape pipe characters so usernames can't break members.md table parsing
function escapeMd(str) {
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '');
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// POST /api/rooms/create
// Body: { roomName, username, inviteCode, serverPassword }
router.post('/create', (req, res) => {
  const { roomName, username, inviteCode, serverPassword } = req.body;
  if (!roomName || !username || !inviteCode) {
    return res.status(400).json({ error: 'roomName, username, and inviteCode are required' });
  }

  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(inviteCode)) {
    return res.status(400).json({ error: 'Invite code must be 4–64 characters (letters, numbers, hyphens, underscores)' });
  }

  // If ROOM_SECRET is set, require it to create a room (timing-safe compare)
  const secret = process.env.ROOM_SECRET;
  if (secret && secret !== 'change-this-to-a-random-string') {
    const secretBuf   = Buffer.from(secret);
    const passwordBuf = Buffer.from(typeof serverPassword === 'string' ? serverPassword : '');
    const match = secretBuf.length === passwordBuf.length &&
                  crypto.timingSafeEqual(secretBuf, passwordBuf);
    if (!match) return res.status(403).json({ error: 'Invalid server password' });
  }

  const roomId = slugify(roomName);
  const roomPath = getRoomPath(roomId);

  if (fs.existsSync(roomPath)) {
    return res.status(409).json({ error: 'A room with that name already exists' });
  }

  // Create room directory structure
  fs.mkdirSync(path.join(roomPath, 'uploads'), { recursive: true });

  // history.md — append-only conversation log
  fs.writeFileSync(path.join(roomPath, 'history.md'), '');

  // context.md — persistent room memory
  fs.writeFileSync(
    path.join(roomPath, 'context.md'),
    `# Room Context\nThis file is always included in every model's system prompt.\nEdit freely — it is your shared AI memory.\n\n## About this room\n${roomName}\n\n## Preferences\n\n## Ongoing projects\n`
  );

  // members.md — member list with roles
  const now = new Date().toISOString();
  fs.writeFileSync(
    path.join(roomPath, 'members.md'),
    `# Members\n\n| Username | Role | Joined |\n|----------|------|--------|\n| ${escapeMd(username)} | Owner | ${now} |\n`
  );

  // settings.json — friction and model config
  fs.writeFileSync(
    path.join(roomPath, 'settings.json'),
    JSON.stringify(
      {
        room_name: roomName,
        invite_code: inviteCode,
        owner: username,
        friction: { claude: 5, gpt4: 5, gemini: 5, mistral: 5 },
        models_enabled: getConfiguredModels()
      },
      null,
      2
    )
  );

  res.json({ roomId, roomName, inviteCode });
});

// POST /api/rooms/join
// Body: { inviteCode, username }
router.post('/join', joinLimiter, (req, res) => {
  const { inviteCode, username } = req.body;
  if (!inviteCode || !username) {
    return res.status(400).json({ error: 'inviteCode and username are required' });
  }

  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(inviteCode)) {
    return res.status(400).json({ error: 'Invalid invite code' });
  }

  const room = findRoomByInviteCode(inviteCode);
  if (!room) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }

  const role = room.settings.owner === username ? 'Owner' : 'Member';

  // Append member to members.md (skip if Owner rejoining)
  if (role === 'Member') {
    const membersPath = path.join(getRoomPath(room.roomId), 'members.md');
    const now = new Date().toISOString();
    fs.appendFileSync(membersPath, `| ${escapeMd(username)} | Member | ${now} |\n`);
  }

  res.json({ roomId: room.roomId, roomName: room.settings.room_name, role });
});

// GET /api/rooms/:roomId/history  (raw markdown)
router.get('/:roomId/history', (req, res) => {
  const historyPath = path.join(getRoomPath(req.params.roomId), 'history.md');
  if (!fs.existsSync(historyPath)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.send(fs.readFileSync(historyPath, 'utf8'));
});

// GET /api/rooms/:roomId/messages  (parsed JSON for the client)
// Query params: ?limit=100&skip=0
// Returns: { messages, hasMore, total }
router.get('/:roomId/messages', (req, res) => {
  const historyPath = path.join(getRoomPath(req.params.roomId), 'history.md');
  if (!fs.existsSync(historyPath)) {
    return res.json({ messages: [], hasMore: false, total: 0 });
  }

  const all   = parseHistory(fs.readFileSync(historyPath, 'utf8'));
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
  const skip  = Math.min(Math.max(parseInt(req.query.skip || '0', 10), 0), 100000);
  const total = all.length;

  const end      = total - skip;
  const start    = Math.max(0, end - limit);
  const messages = all.slice(start, end > 0 ? end : 0);

  res.json({ messages, hasMore: start > 0, total });
});

// POST /api/rooms/:roomId/archive  — Owner archives history and starts fresh
router.post('/:roomId/archive', (req, res) => {
  const { inviteCode, username } = getAuthHeaders(req);
  if (!verifyInviteCode(req.params.roomId, inviteCode)) {
    return res.status(403).json({ error: 'Invalid invite code' });
  }
  if (!verifyOwner(req.params.roomId, username)) {
    return res.status(403).json({ error: 'Only the room owner can archive history' });
  }

  const roomPath    = getRoomPath(req.params.roomId);
  const historyPath = path.join(roomPath, 'history.md');

  if (!fs.existsSync(historyPath)) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const content = fs.readFileSync(historyPath, 'utf8');
  if (!content.trim()) {
    return res.json({ ok: true, archived: false });
  }

  const timestamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivePath = path.join(roomPath, `history-archive-${timestamp}.md`);
  fs.writeFileSync(archivePath, content);
  fs.writeFileSync(historyPath, '');

  res.json({ ok: true, archived: true });
});

const AI_AUTHORS = { claude: 'claude', gpt4: 'gpt-4', gemini: 'gemini', mistral: 'mistral' };
const AI_NAMES   = ['Claude', 'GPT-4', 'Gemini', 'Mistral'];

function parseHistory(raw) {
  const blocks = raw.split(/\n(?=## )/).map((b) => b.trim()).filter(Boolean);
  const messages = [];
  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.split('\n');
    const header = lines[0].replace(/^## /, '');
    const [timestampPart, ...authorParts] = header.split(' | ');
    const author = authorParts.join(' | ').trim();

    // Skip metadata lines (starting with >) and empty lines to get content
    const contentLines = lines.slice(1).filter((l) => !l.startsWith('>'));
    const content = contentLines.join('\n').trim();
    if (!content) continue;

    const isAI = AI_NAMES.some((n) => author.startsWith(n));

    if (isAI) {
      const modelKey = Object.keys(AI_AUTHORS).find((k) =>
        author.toLowerCase().startsWith(AI_AUTHORS[k])
      ) || 'claude';
      messages.push({
        type: 'ai',
        model: modelKey,
        text: content,
        timestamp: timestampPart,
        streaming: false,
        id: idCounter++
      });
    } else {
      messages.push({
        type: 'human',
        username: author,
        text: content,
        timestamp: timestampPart,
        id: idCounter++
      });
    }
  }

  return messages;
}

// GET /api/rooms/:roomId/settings
router.get('/:roomId/settings', (req, res) => {
  const settingsPath = path.join(getRoomPath(req.params.roomId), 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
});

// PATCH /api/rooms/:roomId/settings
router.patch('/:roomId/settings', (req, res) => {
  const { inviteCode, username } = getAuthHeaders(req);
  if (!verifyInviteCode(req.params.roomId, inviteCode)) {
    return res.status(403).json({ error: 'Invalid invite code' });
  }
  if (!verifyOwner(req.params.roomId, username)) {
    return res.status(403).json({ error: 'Only the room owner can change settings' });
  }

  const settingsPath = path.join(getRoomPath(req.params.roomId), 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const current = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  // Only allow updating friction values — prevent arbitrary field overwrites
  if (req.body.friction && typeof req.body.friction === 'object') {
    current.friction = { ...current.friction, ...req.body.friction };
  }
  fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2));
  res.json(current);
});

// GET /api/rooms/:roomId/context
router.get('/:roomId/context', (req, res) => {
  const contextPath = path.join(getRoomPath(req.params.roomId), 'context.md');
  if (!fs.existsSync(contextPath)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.send(fs.readFileSync(contextPath, 'utf8'));
});

// PUT /api/rooms/:roomId/context
router.put('/:roomId/context', (req, res) => {
  const { inviteCode, username } = getAuthHeaders(req);
  if (!verifyInviteCode(req.params.roomId, inviteCode)) {
    return res.status(403).json({ error: 'Invalid invite code' });
  }
  if (!verifyOwner(req.params.roomId, username)) {
    return res.status(403).json({ error: 'Only the room owner can edit context' });
  }

  const contextPath = path.join(getRoomPath(req.params.roomId), 'context.md');
  if (!fs.existsSync(contextPath)) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const content = String(req.body.content || '');
  if (content.length > 50000) {
    return res.status(413).json({ error: 'Context too large (max 50 KB)' });
  }
  fs.writeFileSync(contextPath, content);
  res.json({ ok: true });
});

// GET /api/rooms/:roomId/members
router.get('/:roomId/members', (req, res) => {
  const membersPath = path.join(getRoomPath(req.params.roomId), 'members.md');
  if (!fs.existsSync(membersPath)) return res.json([]);
  res.json(parseMembers(fs.readFileSync(membersPath, 'utf8')));
});

// DELETE /api/rooms/:roomId/members/:username  — kick a member (Owner only)
router.delete('/:roomId/members/:username', (req, res) => {
  const { roomId, username } = req.params;
  const { inviteCode, username: requester } = getAuthHeaders(req);
  if (!verifyInviteCode(roomId, inviteCode)) {
    return res.status(403).json({ error: 'Invalid invite code' });
  }
  if (!verifyOwner(roomId, requester)) {
    return res.status(403).json({ error: 'Only the room owner can kick members' });
  }

  const membersPath = path.join(getRoomPath(roomId), 'members.md');
  if (!fs.existsSync(membersPath)) return res.status(404).json({ error: 'Room not found' });

  const raw = fs.readFileSync(membersPath, 'utf8');
  // Remove all rows matching the username
  const filtered = raw.split('\n').filter((line) => {
    const col = line.split('|')[1]?.trim();
    return !col || col === 'Username' || col !== username;
  }).join('\n');
  fs.writeFileSync(membersPath, filtered);
  res.json({ ok: true });
});

function parseMembers(raw) {
  const seen = new Set();
  return raw.split('\n')
    .filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('Username'))
    .map((l) => {
      const [, username, role, joined] = l.split('|').map((s) => s.trim());
      return { username, role, joined };
    })
    .filter(({ username }) => {
      if (!username || seen.has(username)) return false;
      seen.add(username);
      return true;
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function findRoomByInviteCode(inviteCode) {
  if (!fs.existsSync(ROOMS_DIR)) return null;
  for (const roomId of fs.readdirSync(ROOMS_DIR)) {
    const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
    if (!fs.existsSync(settingsPath)) continue;
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.invite_code === inviteCode) return { roomId, settings };
  }
  return null;
}

function getConfiguredModels() {
  const models = [];
  if (process.env.ANTHROPIC_API_KEY) models.push('claude');
  if (process.env.OPENAI_API_KEY) models.push('gpt4');
  if (process.env.GOOGLE_GEMINI_API_KEY) models.push('gemini');
  if (process.env.MISTRAL_API_KEY) models.push('mistral');
  return models;
}

module.exports = router;
