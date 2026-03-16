require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const fs      = require('fs');
const helmet  = require('helmet');

const ROOMS_DIR = path.join(__dirname, 'rooms');

function getRoomOwner(roomId) {
  const settingsPath = path.join(ROOMS_DIR, roomId, 'settings.json');
  if (!fs.existsSync(settingsPath)) return null;
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')).owner || null; } catch { return null; }
}

const roomsRouter = require('./routes/rooms');
const filesRouter = require('./routes/files');
const keysRouter  = require('./routes/keys');
const { handleMessage, stopModel } = require('./models/router');
const keystore = require('./keystore');

const app    = express();
const server = http.createServer(app);

// Restrict Socket.io to same origin (or ALLOWED_ORIGINS if set)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : false; // false = same-origin only

const io = new Server(server, {
  cors: allowedOrigins ? { origin: allowedOrigins, credentials: true } : {}
});

const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// Helmet sets X-Frame-Options, X-Content-Type-Options, HSTS, etc.
// contentSecurityPolicy is relaxed to allow the inline styles Tailwind needs.
app.use(helmet({
  strictTransportSecurity:  false, // LAN HTTP app — HSTS would break access
  crossOriginOpenerPolicy:  false, // Avoid COOP warnings on plain HTTP origins
  contentSecurityPolicy: {
    useDefaults: false,            // Don't include upgrade-insecure-requests
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc:  ["'self'", 'ws:', 'wss:'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
    }
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../client/dist')));

// ─── REST Routes ─────────────────────────────────────────────────────────────
app.use('/api/rooms', roomsRouter);
app.use('/api/files', filesRouter);
app.use('/api/keys',  keysRouter);

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ─── Presence ─────────────────────────────────────────────────────────────────
const roomPresence = new Map(); // roomId -> Set<username>

function emitPresence(roomId) {
  const online = roomPresence.has(roomId) ? [...roomPresence.get(roomId)] : [];
  io.to(roomId).emit('presence_update', { online });
}

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, username }) => {
    if (!roomId || !/^[a-z0-9-]+$/.test(roomId)) return;
    if (!username || typeof username !== 'string') return;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Set());
    roomPresence.get(roomId).add(username);
    io.to(roomId).emit('system_message', { text: `${username} joined the room` });
    io.to(roomId).emit('member_joined', { username });
    emitPresence(roomId);
    console.log(`[room] ${username} joined ${roomId}`);
  });

  socket.on('send_message', async (payload) => {
    const roomId   = socket.data.roomId;
    const username = socket.data.username;
    if (!roomId || !username) return;
    if (typeof payload.text !== 'string' || payload.text.length > 32000) return;

    // Broadcast human message to room immediately
    const safePayload = { ...payload, roomId, username };
    io.to(roomId).emit('new_message', safePayload);

    // Check for @mention and route to model if found
    await handleMessage(safePayload, io);
  });

  socket.on('friction_change', ({ model, value }) => {
    const roomId   = socket.data.roomId;
    const username = socket.data.username;
    if (!roomId || !username) return;
    io.to(roomId).emit('system_message', {
      text: `${model} friction set to ${value} by ${username}`
    });
  });

  socket.on('stop_model', ({ model }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    stopModel(roomId, model);
  });

  socket.on('clear_messages', () => {
    const roomId   = socket.data.roomId;
    const username = socket.data.username;
    if (!roomId || !username) return;
    io.to(roomId).emit('messages_cleared', { username });
  });

  socket.on('kick_member', ({ targetUsername }) => {
    const roomId   = socket.data.roomId;
    const requester = socket.data.username;
    if (!roomId || !requester) return;

    // Only the room owner may kick
    const owner = getRoomOwner(roomId);
    if (!owner || requester !== owner) return;

    // Find target's socket(s) and emit kicked event
    for (const [, s] of io.sockets.sockets) {
      if (s.data.roomId === roomId && s.data.username === targetUsername) {
        s.emit('kicked', { by: requester });
        s.leave(roomId);
      }
    }
    if (roomPresence.has(roomId)) roomPresence.get(roomId).delete(targetUsername);
    io.to(roomId).emit('system_message', { text: `${targetUsername} was removed from the room` });
    emitPresence(roomId);
  });

  socket.on('member_joined', () => {
    const roomId   = socket.data.roomId;
    const username = socket.data.username;
    if (!roomId || !username) return;
    io.to(roomId).emit('member_joined', { username });
  });

  socket.on('disconnect', () => {
    const { roomId, username } = socket.data;
    if (roomId && username && roomPresence.has(roomId)) {
      roomPresence.get(roomId).delete(username);
      emitPresence(roomId);
    }
    console.log(`[socket] client disconnected: ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\nSwitchAI running at http://localhost:${PORT}`);
  console.log('Configured models:', getConfiguredModels().join(', ') || 'none');
});

function getConfiguredModels() {
  const status = keystore.getStatus();
  return Object.keys(status).filter((m) => status[m]);
}
