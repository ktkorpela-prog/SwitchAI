import React, { useEffect, useRef } from 'react';
import Message from './Message';
import InputBar from './InputBar';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ messages, typingModels, session, onSend }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingModels]);

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-bg">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg, i) => (
          <Message key={msg.id || i} message={msg} currentUser={session.username} />
        ))}
        {typingModels.map((model) => (
          <TypingIndicator key={model} model={model} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <InputBar session={session} onSend={onSend} />
    </div>
  );
}
