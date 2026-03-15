import React, { useState, useRef, useEffect } from 'react';
import { MODEL_KEYS, MODELS } from '../constants';

const MAX_CHARS = 4000;

export default function InputBar({ session, onSend }) {
  const [text, setText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const textareaRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') setShowPicker(false);
  }

  function handleChange(e) {
    const val = e.target.value;
    setText(val);

    // Detect @ trigger
    const match = val.match(/@(\w*)$/);
    if (match) {
      setPickerFilter(match[1].toLowerCase());
      setShowPicker(true);
    } else {
      setShowPicker(false);
    }
  }

  function insertMention(modelKey) {
    const newText = text.replace(/@\w*$/, `@${modelKey} `);
    setText(newText);
    setShowPicker(false);
    textareaRef.current?.focus();
  }

  function submit() {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    setShowPicker(false);
  }

  const filteredModels = MODEL_KEYS.filter((k) =>
    k.startsWith(pickerFilter) || 'everyone'.startsWith(pickerFilter)
  );
  const pickerOptions = [
    ...filteredModels,
    ...('everyone'.startsWith(pickerFilter) ? ['everyone'] : [])
  ];

  return (
    <div className="relative px-4 pb-4">
      {/* Model picker dropdown */}
      {showPicker && pickerOptions.length > 0 && (
        <div className="absolute bottom-full mb-1 left-4 bg-surface-raised border border-border rounded-lg shadow-lg overflow-hidden z-10">
          {pickerOptions.map((key) => {
            const model = MODELS[key];
            return (
              <button
                key={key}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-200 hover:bg-border transition-colors text-left"
                onMouseDown={() => insertMention(key)}
              >
                {model ? (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: model.color }}
                  />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                )}
                <span>{key === 'everyone' ? '@everyone — all models' : `@${key} — ${model?.name}`}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 bg-surface-raised border border-border rounded-lg px-3 py-2">
        {/* Paperclip — file upload placeholder */}
        <button className="text-gray-500 hover:text-gray-300 transition-colors pb-1" title="Upload file">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none min-h-[24px] max-h-40"
          placeholder="Message the room... (@ to mention a model)"
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          style={{ lineHeight: '1.5' }}
        />

        {/* Char count warning */}
        {text.length > MAX_CHARS - 200 && (
          <span className={`text-xs pb-1 ${text.length >= MAX_CHARS ? 'text-red-400' : 'text-yellow-500'}`}>
            {MAX_CHARS - text.length}
          </span>
        )}

        {/* Send button */}
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="pb-1 text-accent hover:text-blue-400 disabled:text-gray-600 transition-colors"
          title="Send (Enter)"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
