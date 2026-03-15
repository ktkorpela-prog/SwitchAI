import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Onboarding from './components/Onboarding';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';

const socket = io();

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('switchai-theme');
  const isDark = saved ? saved === 'dark' : true;
  document.documentElement.classList.toggle('dark', isDark);
  return isDark;
}

// ─── Session persistence ──────────────────────────────────────────────────────
function loadSession() {
  try {
    const raw = localStorage.getItem('switchai-session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem('switchai-session', JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem('switchai-session');
}

export default function App() {
  const [session, setSession]           = useState(loadSession);
  const [messages, setMessages]         = useState([]);
  const [typingModels, setTypingModels] = useState([]);
  const [connected, setConnected]       = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [isDark, setIsDark]             = useState(initTheme);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('switchai-theme', next ? 'dark' : 'light');
  }

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      if (reconnecting) {
        setReconnecting(false);
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 2500);
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setReconnecting(true);
    });

    socket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: 'human' }]);
    });

    socket.on('system_message', ({ text }) => {
      setMessages((prev) => [...prev, { type: 'system', text, id: Date.now() }]);
    });

    socket.on('model_typing', ({ model }) => {
      setTypingModels((prev) => [...new Set([...prev, model])]);
    });

    socket.on('model_chunk', ({ model, chunk }) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === 'ai' && last.model === model && last.streaming) {
          return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
        }
        setTypingModels((t) => t.filter((m) => m !== model));
        return [...prev, { type: 'ai', model, text: chunk, streaming: true, id: Date.now() }];
      });
    });

    socket.on('model_response', ({ model, timestamp }) => {
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.type === 'ai' && m.model === model && m.streaming);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = { ...updated[realIdx], streaming: false, timestamp };
        return updated;
      });
      setTypingModels((t) => t.filter((m) => m !== model));
    });

    socket.on('model_error', ({ model, error }) => {
      setTypingModels((t) => t.filter((m) => m !== model));
      setMessages((prev) => [...prev, { type: 'error', model, text: error, id: Date.now() }]);
    });

    return () => socket.off();
  }, [reconnecting]);

  // Re-join socket room on session restore
  useEffect(() => {
    if (session) {
      socket.emit('join_room', { roomId: session.roomId, username: session.username });
    }
  }, []);

  function handleJoin({ roomId, roomName, username, role }) {
    const s = { roomId, roomName, username, role };
    setSession(s);
    saveSession(s);
    socket.emit('join_room', { roomId, username });
  }

  function handleLeave() {
    clearSession();
    setSession(null);
    setMessages([]);
  }

  function sendMessage(text, replyTo) {
    if (!text.trim() || !session) return;
    const msg = {
      roomId: session.roomId,
      username: session.username,
      text,
      replyTo: replyTo
        ? { id: replyTo.id, username: replyTo.username || replyTo.model, text: replyTo.text }
        : null,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    socket.emit('send_message', msg);
  }

  if (!session) {
    return <Onboarding onJoin={handleJoin} />;
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Disconnected banner */}
      {!connected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-800 text-yellow-100 text-sm text-center py-1.5 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Reconnecting...
        </div>
      )}

      {/* Reconnected toast */}
      {justReconnected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-700 text-green-100 text-sm text-center py-1.5">
          Reconnected ✓
        </div>
      )}

      <Sidebar session={session} socket={socket} isDark={isDark} onToggleTheme={toggleTheme} onLeave={handleLeave} />
      <ChatWindow
        messages={messages}
        typingModels={typingModels}
        session={session}
        onSend={sendMessage}
      />
    </div>
  );
}
