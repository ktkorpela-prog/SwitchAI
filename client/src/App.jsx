import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Onboarding from './components/Onboarding';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';

const socket = io();

export default function App() {
  const [session, setSession] = useState(null); // { roomId, roomName, username, role }
  const [messages, setMessages] = useState([]);
  const [typingModels, setTypingModels] = useState([]); // models currently "thinking"
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

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
        // Start a new streaming AI message
        setTypingModels((t) => t.filter((m) => m !== model));
        return [...prev, { type: 'ai', model, text: chunk, streaming: true, id: Date.now() }];
      });
    });

    socket.on('model_response', ({ model, text, timestamp }) => {
      // Mark streaming as complete
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
  }, []);

  function handleJoin({ roomId, roomName, username, role }) {
    setSession({ roomId, roomName, username, role });
    socket.emit('join_room', { roomId, username });
  }

  function sendMessage(text) {
    if (!text.trim() || !session) return;
    const msg = {
      roomId: session.roomId,
      username: session.username,
      text,
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
      {!connected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-800 text-yellow-100 text-sm text-center py-1">
          Reconnecting...
        </div>
      )}
      <Sidebar session={session} socket={socket} />
      <ChatWindow
        messages={messages}
        typingModels={typingModels}
        session={session}
        onSend={sendMessage}
      />
    </div>
  );
}
