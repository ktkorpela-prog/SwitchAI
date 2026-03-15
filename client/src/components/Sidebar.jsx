import React, { useState, useEffect } from 'react';
import { MODELS, MODEL_KEYS } from '../constants';
import FrictionSlider from './FrictionSlider';

export default function Sidebar({ session, socket, isDark, onToggleTheme, onLeave }) {
  const [settings, setSettings]             = useState(null);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextText, setContextText]       = useState('');
  const [contextSaving, setContextSaving]   = useState(false);
  const [showKeysModal, setShowKeysModal]   = useState(false);
  const [keyStatus, setKeyStatus]           = useState({});
  const [keyInputs, setKeyInputs]           = useState({});
  const [keySaving, setKeySaving]           = useState({});

  useEffect(() => {
    fetch(`/api/rooms/${session.roomId}/settings`)
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }, [session.roomId]);

  async function openKeysModal() {
    const res = await fetch('/api/keys/status');
    const status = await res.json();
    setKeyStatus(status);
    setKeyInputs({});
    setShowKeysModal(true);
  }

  async function saveKey(model) {
    const apiKey = keyInputs[model] || '';
    setKeySaving((s) => ({ ...s, [model]: true }));
    const res = await fetch(`/api/keys/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    const data = await res.json();
    setKeyStatus((s) => ({ ...s, [model]: data.configured }));
    setKeyInputs((s) => ({ ...s, [model]: '' }));
    setKeySaving((s) => ({ ...s, [model]: false }));
    // Update sidebar model status
    const settingsRes = await fetch(`/api/rooms/${session.roomId}/settings`);
    setSettings(await settingsRes.json());
  }

  async function openContextEditor() {
    const res = await fetch(`/api/rooms/${session.roomId}/context`);
    const text = await res.text();
    setContextText(text);
    setShowContextEditor(true);
  }

  async function saveContext() {
    setContextSaving(true);
    await fetch(`/api/rooms/${session.roomId}/context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: contextText })
    });
    setContextSaving(false);
    setShowContextEditor(false);
    socket.emit('system_message_local', {
      roomId: session.roomId,
      text: `${session.username} updated room context`
    });
  }

  async function handleFrictionChange(model, value) {
    const updated = { ...settings, friction: { ...settings.friction, [model]: value } };
    setSettings(updated);
    await fetch(`/api/rooms/${session.roomId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friction: updated.friction })
    });
    socket.emit('friction_change', { roomId: session.roomId, model, value, username: session.username });
  }

  const isOwner = session.role === 'Owner';

  return (
    <>
      <div className="w-60 flex-shrink-0 bg-surface border-r border-border flex flex-col overflow-y-auto">
        {/* Room name + theme toggle */}
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-white truncate">{session.roomName || settings?.room_name || 'Room'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{isOwner ? '👑 Owner' : 'Member'}</p>
          </div>
          <button
            onClick={onToggleTheme}
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 mt-0.5"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              // Sun icon
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
              </svg>
            ) : (
              // Moon icon
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Members */}
        <div className="px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Members</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-200">{session.username}</span>
            {isOwner && <span className="text-xs text-yellow-400">👑</span>}
          </div>
        </div>

        {/* Models */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Models</p>
          {MODEL_KEYS.map((key) => {
            const model = MODELS[key];
            const enabled = settings?.models_enabled?.includes(key);
            const friction = settings?.friction?.[key] ?? 5;
            return (
              <div key={key} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: model.color }}>
                    {model.name}
                  </span>
                </div>
                {isOwner && (
                  <FrictionSlider value={friction} onChange={(v) => handleFrictionChange(key, v)} color={model.color} />
                )}
                {!isOwner && (
                  <p className="text-xs text-gray-500 ml-4">Friction: {friction}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* API Keys button — Owner only */}
        {isOwner && (
          <div className="px-4 pt-3">
            <button
              onClick={openKeysModal}
              className="w-full text-left text-xs text-gray-400 hover:text-gray-200 flex items-center gap-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Manage API keys
            </button>
          </div>
        )}

        {/* Leave room */}
        <div className="px-4 pt-2">
          <button
            onClick={onLeave}
            className="w-full text-left text-xs text-gray-500 hover:text-red-400 flex items-center gap-2 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Leave room
          </button>
        </div>

        {/* Context editor button */}
        {isOwner && (
          <div className="px-4 py-3 border-t border-border mt-auto">
            <button
              onClick={openContextEditor}
              className="w-full text-left text-xs text-gray-400 hover:text-gray-200 flex items-center gap-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit room context
            </button>
          </div>
        )}
      </div>

      {/* API Keys modal */}
      {showKeysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-white text-sm">API Keys</h3>
              <button onClick={() => setShowKeysModal(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <p className="px-4 pt-3 text-xs text-gray-500">
              Keys are stored only on this machine in <code className="font-mono">keys.local.json</code> and never shared with other users.
            </p>
            <div className="p-4 space-y-4">
              {MODEL_KEYS.map((key) => {
                const model = MODELS[key];
                const configured = keyStatus[key];
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: model.color }}>
                        {model.name}
                      </span>
                      <span className={`text-xs ${configured ? 'text-green-400' : 'text-gray-500'}`}>
                        {configured ? '✓ configured' : 'not set'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        className="flex-1 bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent font-mono"
                        placeholder={configured ? '••••••••••••••••' : 'Paste API key...'}
                        value={keyInputs[key] || ''}
                        onChange={(e) => setKeyInputs((s) => ({ ...s, [key]: e.target.value }))}
                      />
                      <button
                        onClick={() => saveKey(key)}
                        disabled={keySaving[key] || !keyInputs[key]}
                        className="px-3 py-1.5 bg-accent hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded transition-colors"
                      >
                        {keySaving[key] ? '...' : 'Save'}
                      </button>
                      {configured && (
                        <button
                          onClick={() => { setKeyInputs((s) => ({ ...s, [key]: '' })); saveKey(key); }}
                          className="px-3 py-1.5 bg-surface-raised hover:bg-red-900 text-gray-400 hover:text-red-300 text-xs rounded transition-colors"
                          title="Remove key"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowKeysModal(false)}
                className="w-full bg-surface-raised hover:bg-border text-gray-300 text-sm font-medium py-2 rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context editor modal */}
      {showContextEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-lg w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-white text-sm">Room Context (context.md)</h3>
              <button onClick={() => setShowContextEditor(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <p className="px-4 pt-3 text-xs text-gray-500">
              Prepended to every model's system prompt. Write preferences, ongoing projects, house rules.
            </p>
            <textarea
              className="flex-1 m-4 bg-surface-raised border border-border rounded p-3 text-sm text-gray-100 font-mono resize-none focus:outline-none focus:border-accent"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              rows={16}
            />
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={saveContext}
                disabled={contextSaving}
                className="flex-1 bg-accent hover:bg-blue-600 disabled:bg-blue-800 text-white text-sm font-medium py-2 rounded transition-colors"
              >
                {contextSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowContextEditor(false)}
                className="flex-1 bg-surface-raised hover:bg-border text-gray-300 text-sm font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
