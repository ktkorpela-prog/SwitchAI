import React, { useState, useRef } from 'react';
import { MODEL_KEYS, MODELS } from '../constants';

const MAX_CHARS = 4000;

export default function InputBar({ session, onSend, replyTo, onClearReply }) {
  const [text, setText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      setShowPicker(false);
      onClearReply?.();
    }
  }

  function handleChange(e) {
    const val = e.target.value;
    setText(val);
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
    onSend(text.trim(), replyTo || null);
    setText('');
    setShowPicker(false);
    onClearReply?.();
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileInputRef.current.value = '';
    await uploadFile(file);
  }

  async function uploadFile(file) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/files/${session.roomId}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Send as a regular message so it goes through history + socket broadcast
      const isImage = file.type.startsWith('image/');
      const msgText = isImage
        ? `![${data.originalname}](${data.url})`
        : `📎 [${data.originalname}](${data.url})`;
      onSend(msgText, null);
    } catch (err) {
      onSend(`⚠️ Upload failed: ${err.message}`, null);
    } finally {
      setUploading(false);
    }
  }

  const filteredModels = MODEL_KEYS.filter((k) => k.startsWith(pickerFilter));
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
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: model.color }} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                )}
                <span>{key === 'everyone' ? '@everyone — all models' : `@${key} — ${model?.name}`}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-start gap-2 mb-1 px-3 py-1.5 bg-surface-raised border-l-2 border-accent rounded text-xs text-gray-400">
          <div className="flex-1 min-w-0">
            <span className="text-gray-300 font-medium">{replyTo.username}</span>
            <span className="ml-2 truncate italic">
              {replyTo.text?.replace(/!\[.*?\]\(.*?\)/g, '[image]').slice(0, 80)}
              {replyTo.text?.length > 80 ? '...' : ''}
            </span>
          </div>
          <button
            onClick={onClearReply}
            className="text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-surface-raised border border-border rounded-lg px-3 py-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.md,.csv,.json,.xml"
          onChange={handleFileSelect}
        />

        {/* Paperclip */}
        <button
          className={`pb-1 transition-colors ${uploading ? 'text-accent animate-pulse' : 'text-gray-500 hover:text-gray-300'}`}
          title="Upload file"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
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
