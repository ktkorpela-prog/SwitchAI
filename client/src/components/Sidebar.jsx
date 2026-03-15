import React, { useState, useEffect } from 'react';
import { MODELS, MODEL_KEYS } from '../constants';
import FrictionSlider from './FrictionSlider';

export default function Sidebar({ session, socket }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch(`/api/rooms/${session.roomId}/settings`)
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }, [session.roomId]);

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
    <div className="w-60 flex-shrink-0 bg-surface border-r border-border flex flex-col overflow-y-auto">
      {/* Room name */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-white truncate">{session.roomName || settings?.room_name || 'Room'}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {isOwner ? '👑 Owner' : 'Member'}
        </p>
      </div>

      {/* Members — placeholder, would be populated via socket presence */}
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
    </div>
  );
}
