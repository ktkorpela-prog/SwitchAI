import React, { useEffect, useRef, useState } from 'react';
import Message from './Message';
import InputBar from './InputBar';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ messages, typingModels, session, onSend }) {
  const bottomRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [replyTo, setReplyTo] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingModels]);

  // Drag-and-drop file upload
  useEffect(() => {
    const el = dropZoneRef.current;
    if (!el) return;

    function onDragOver(e) {
      e.preventDefault();
      setDragging(true);
    }
    function onDragLeave(e) {
      if (!el.contains(e.relatedTarget)) setDragging(false);
    }
    async function onDrop(e) {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      // Delegate to the same upload logic via a synthetic event on the hidden input
      // Instead, emit directly
      uploadDroppedFile(file);
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
      const res = await fetch(`/api/files/${session.roomId}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const isImage = file.type.startsWith('image/');
      const msgText = isImage
        ? `![${data.originalname}](${data.url})`
        : `📎 [${data.originalname}](${data.url})`;
      onSend(msgText, null);
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

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg, i) => (
          <Message
            key={msg.id || i}
            message={msg}
            currentUser={session.username}
            onReply={setReplyTo}
          />
        ))}
        {typingModels.map((model) => (
          <TypingIndicator key={model} model={model} />
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
