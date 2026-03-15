import React, { useState } from 'react';

export default function Onboarding({ onJoin }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [form, setForm] = useState({ roomName: '', username: '', inviteCode: '' });
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onJoin({ roomId: data.roomId, roomName: data.roomName, username: form.username, role: 'Owner' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: form.inviteCode, username: form.username })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onJoin({ roomId: data.roomId, roomName: data.roomName, username: form.username, role: 'Member' });
    } catch (err) {
      setError(err.message);
    }
  }

  const inputClass = 'w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent';
  const btnPrimary = 'w-full bg-accent hover:bg-blue-600 text-white font-medium py-2 rounded text-sm transition-colors';
  const btnSecondary = 'w-full bg-surface-raised hover:bg-border text-gray-300 font-medium py-2 rounded text-sm transition-colors';

  if (!mode) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="w-80 space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-white">Welcome to SwitchAI</h1>
          <p className="text-sm text-gray-400">A shared AI channel for your household or team.</p>
          <button className={btnPrimary} onClick={() => setMode('create')}>Create a room</button>
          <button className={btnSecondary} onClick={() => setMode('join')}>Join with invite code</button>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <form onSubmit={handleCreate} className="w-80 space-y-3">
          <h2 className="text-xl font-semibold text-white">Set up your room</h2>
          <input className={inputClass} placeholder="Room name" value={form.roomName}
            onChange={(e) => setForm({ ...form, roomName: e.target.value })} required />
          <input className={inputClass} placeholder="Your display name" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <input className={inputClass} placeholder="Invite code (share this with guests)" value={form.inviteCode}
            onChange={(e) => setForm({ ...form, inviteCode: e.target.value })} required />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" className={btnPrimary}>Create room</button>
          <button type="button" className={btnSecondary} onClick={() => setMode(null)}>Back</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <form onSubmit={handleJoin} className="w-80 space-y-3">
        <h2 className="text-xl font-semibold text-white">Join a room</h2>
        <input className={inputClass} placeholder="Invite code" value={form.inviteCode}
          onChange={(e) => setForm({ ...form, inviteCode: e.target.value })} required />
        <input className={inputClass} placeholder="Your display name" value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" className={btnPrimary}>Join room</button>
        <button type="button" className={btnSecondary} onClick={() => setMode(null)}>Back</button>
      </form>
    </div>
  );
}
