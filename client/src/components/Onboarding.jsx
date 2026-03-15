import React, { useState } from 'react';

export default function Onboarding({ onJoin }) {
  const [mode, setMode]   = useState(null); // 'create' | 'join'
  const [form, setForm]   = useState({ roomName: '', username: '', inviteCode: '', serverPassword: '' });
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // { roomId, roomName, inviteCode, username }
  const [copied, setCopied] = useState(false);

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
      setCreated({ roomId: data.roomId, roomName: data.roomName, inviteCode: form.inviteCode, username: form.username });
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
      onJoin({ roomId: data.roomId, roomName: data.roomName, username: form.username, role: data.role || 'Member' });
    } catch (err) {
      setError(err.message);
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(created.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const inputClass = 'w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent';
  const btnPrimary = 'w-full bg-accent hover:bg-blue-600 text-white font-medium py-2 rounded text-sm transition-colors';
  const btnSecondary = 'w-full bg-surface-raised hover:bg-border text-gray-300 font-medium py-2 rounded text-sm transition-colors';

  // ── Room created screen ───────────────────────────────────────────────────
  if (created) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="w-80 space-y-4">
          <div className="text-center">
            <div className="text-3xl mb-2">🎉</div>
            <h2 className="text-xl font-semibold text-white">{created.roomName} is ready</h2>
            <p className="text-sm text-gray-400 mt-1">Share your invite code with guests.</p>
          </div>

          <div className="bg-surface-raised border border-border rounded-lg p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-gray-500">Invite code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-lg font-mono font-semibold text-white tracking-widest">
                {created.inviteCode}
              </code>
              <button
                onClick={copyInviteCode}
                className="text-xs px-2 py-1 bg-border hover:bg-accent text-gray-300 hover:text-white rounded transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Guests go to this app and click <em>Join with invite code</em>.
            </p>
          </div>

          <button
            className={btnPrimary}
            onClick={() => onJoin({ roomId: created.roomId, roomName: created.roomName, username: created.username, role: 'Owner' })}
          >
            Enter room →
          </button>
        </div>
      </div>
    );
  }

  // ── Landing ───────────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="w-80 space-y-4 text-center">
          <div>
            <h1 className="text-2xl font-semibold text-white">Welcome to SwitchAI</h1>
            <p className="text-sm text-gray-400 mt-1">A shared AI channel for your household or team.</p>
          </div>
          <button className={btnPrimary} onClick={() => setMode('create')}>Create a room</button>
          <button className={btnSecondary} onClick={() => setMode('join')}>Join with invite code</button>
        </div>
      </div>
    );
  }

  // ── Create room ───────────────────────────────────────────────────────────
  if (mode === 'create') {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <form onSubmit={handleCreate} className="w-80 space-y-3">
          <h2 className="text-xl font-semibold text-white">Set up your room</h2>
          <input className={inputClass} placeholder="Room name" value={form.roomName}
            onChange={(e) => setForm({ ...form, roomName: e.target.value })} required />
          <input className={inputClass} placeholder="Your display name" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <input className={inputClass} placeholder="Invite code (you'll share this)" value={form.inviteCode}
            onChange={(e) => setForm({ ...form, inviteCode: e.target.value })} required />
          <input className={inputClass} type="password" placeholder="Server password (if set by host)" value={form.serverPassword}
            onChange={(e) => setForm({ ...form, serverPassword: e.target.value })} />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" className={btnPrimary}>Create room</button>
          <button type="button" className={btnSecondary} onClick={() => setMode(null)}>Back</button>
        </form>
      </div>
    );
  }

  // ── Join room ─────────────────────────────────────────────────────────────
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
