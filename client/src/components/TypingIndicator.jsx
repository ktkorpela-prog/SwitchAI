import React from 'react';
import { MODELS } from '../constants';

export default function TypingIndicator({ model }) {
  const m = MODELS[model] || { name: model, color: '#6B7280' };

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg border-l-[3px]"
      style={{ backgroundColor: '#1E2235', borderColor: m.color }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
        style={{ backgroundColor: m.color }}
      >
        {m.name[0]}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">{m.name} is thinking</span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
