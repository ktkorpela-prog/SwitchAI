require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const roomsRouter = require('./routes/rooms');
const filesRouter = require('./routes/files');
const keysRouter  = require('./routes/keys');
const { handleMessage } = require('./models/router');
const keystore = require('./keystore');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// ─── REST Routes ─────────────────────────────────────────────────────────────
app.use('/api/rooms', roomsRouter);
app.use('/api/files', filesRouter);
app.use('/api/keys',  keysRouter);

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    io.to(roomId).emit('system_message', { text: `${username} joined the room` });
    console.log(`[room] ${username} joined ${roomId}`);
  });

  socket.on('send_message', async (payload) => {
    // Broadcast human message to room immediately
    io.to(payload.roomId).emit('new_message', payload);

    // Check for @mention and route to model if found
    await handleMessage(payload, io);
  });

  socket.on('friction_change', ({ roomId, model, value, username }) => {
    io.to(roomId).emit('system_message', {
      text: `${model} friction set to ${value} by ${username}`
    });
  });

  socket.on('disconnect', () => {
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
