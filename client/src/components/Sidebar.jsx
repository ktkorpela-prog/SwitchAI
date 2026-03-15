import React, { useState, useEffect } from 'react';
import { MODELS, MODEL_KEYS } from '../constants';
import FrictionSlider from './FrictionSlider';

export default function Sidebar({ session, socket }) {
  const [settings, setSettings] = useState(null);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextText, setContextText] = useState('');
  const [contextSaving, setContextSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/rooms/${session.roomId}/settings`)
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }, [session.roomId]);

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
    socket.emit('friction_change', {
      roomId: session.roomId,
      model: 'context',
      value: '',
      username: session.username
    });
  }

  async function handleFrictionChange(model, value) {
    const updated = {
      ...settings,
      friction: { ...settings.friction, [model]: value }
    };
    setSettings(updated);
    await fetch(`/api/rooms/${session.roomId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friction: updated.friction })
    });
    socket.emit('friction_change', {
      roomId: session.roomId,
      model,
      value,
      username: session.username
    });
  }

  const isOwner = session.role === 'Owner';

  return (
    <>
      <div className="w-60 flex-shrink-0 bg-surface border-r border-border flex flex-col overflow-y-auto">
        {/* Room name */}
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-white truncate">{session.roomName || settings?.room_name || 'Room'}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{isOwner ? '👑 Owner' : 'Member'}</p>
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
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: model.color }}
                  >
                    {model.name}
                  </span>
                </div>
                {isOwner && enabled && (
                  <FrictionSlider
                    value={friction}
                    onChange={(v) => handleFrictionChange(key, v)}
                    color={model.color}
                  />
                )}
                {!isOwner && enabled && (
                  <p className="text-xs text-gray-500 ml-4">Friction: {friction}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Context editor button — Owner only */}
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

      {/* Context editor modal */}
      {showContextEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-lg w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-white text-sm">Room Context (context.md)</h3>
              <button
                onClick={() => setShowContextEditor(false)}
                className="text-gray-500 hover:text-gray-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <p className="px-4 pt-3 text-xs text-gray-500">
              This is prepended to every model's system prompt. Write anything — preferences, ongoing projects, house rules.
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
