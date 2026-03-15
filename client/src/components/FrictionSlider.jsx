import React from 'react';

export default function FrictionSlider({ value, onChange, color }) {
  return (
    <div className="pl-4">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={10}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="flex-1 h-1 rounded appearance-none cursor-pointer"
          style={{ accentColor: color }}
        />
        <span className="text-xs text-gray-400 w-4 text-right">{value}</span>
      </div>
      <div className="flex justify-between text-gray-600 mt-0.5" style={{ fontSize: '0.55rem' }}>
        <span>Supportive</span>
        <span>Devil's Advocate</span>
      </div>
    </div>
  );
}
