import React, { useEffect, useRef, useState } from 'react';
import Message from './Message';
import InputBar from './InputBar';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ messages, typingModels, session, onSend, onStop, onClear }) {
  const bottomRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [replyTo, setReplyTo] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingModels]);

  useEffect(() => {
    const el = dropZoneRef.current;
    if (!el) return;

    function onDragOver(e) { e.preventDefault(); setDragging(true); }
    function onDragLeave(e) { if (!el.contains(e.relatedTarget)) setDragging(false); }
    async function onDrop(e) {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      await uploadDroppedFile(file);
    }

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [session.roomId]);

  async function uploadDroppedFile(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/files/${session.roomId}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const isImage = file.type.startsWith('image/');
      onSend(isImage ? `![${data.originalname}](${data.url})` : `📎 [${data.originalname}](${data.url})`, null);
    } catch (err) {
      onSend(`⚠️ Upload failed: ${err.message}`, null);
    }
  }

  function handleSend(text, replyToMsg) {
    onSend(text, replyToMsg);
    setReplyTo(null);
  }

  return (
    <div ref={dropZoneRef} className="flex flex-col flex-1 min-w-0 bg-bg relative">
      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-20 bg-accent/10 border-2 border-dashed border-accent rounded flex items-center justify-center pointer-events-none">
          <p className="text-accent font-medium">Drop file to upload</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface flex-shrink-0">
        <span className="text-sm font-medium text-gray-200"># {session.roomName}</span>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
          title="Clear chat view for everyone"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear view
        </button>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg, i) => (
          <Message
            key={msg.id || i}
            message={msg}
            currentUser={session.username}
            onReply={setReplyTo}
            onStop={onStop}
          />
        ))}
        {typingModels.map((model) => (
          <TypingIndicator key={model} model={model} onStop={onStop} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <InputBar
        session={session}
        onSend={handleSend}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
    </div>
  );
}
