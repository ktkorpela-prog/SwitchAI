import React from 'react';
import ReactMarkdown from 'react-markdown';
import { MODELS } from '../constants';

function Avatar({ name, color }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
      style={{ backgroundColor: color || '#4B5563' }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function Timestamp({ ts }) {
  if (!ts) return null;
  const d = new Date(ts);
  return (
    <span className="text-gray-500 ml-2" style={{ fontSize: '0.6875rem' }}>
      {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

function QuotedReply({ replyTo }) {
  if (!replyTo) return null;
  const preview = replyTo.text?.replace(/!\[.*?\]\(.*?\)/g, '[image]').slice(0, 80);
  return (
    <div className="mb-1.5 pl-2 border-l-2 border-gray-500 text-xs text-gray-400 italic truncate">
      <span className="text-gray-300 font-medium not-italic">{replyTo.username}: </span>
      {preview}{replyTo.text?.length > 80 ? '...' : ''}
    </div>
  );
}

export default function Message({ message, onReply }) {
  if (message.type === 'system') {
    return (
      <div className="text-center text-xs text-gray-500 py-1">
        {message.text}
      </div>
    );
  }

  if (message.type === 'error') {
    const model = MODELS[message.model];
    return (
      <div className="flex items-start gap-3 py-1 px-2">
        <Avatar name={model?.name || '!'} color={model?.color || '#EF4444'} />
        <p className="text-sm" style={{ color: model?.color || '#EF4444' }}>
          {message.text}
        </p>
      </div>
    );
  }

  if (message.type === 'ai') {
    const model = MODELS[message.model] || { name: message.model, color: '#6B7280' };
    return (
      <div
        className="group flex items-start gap-3 py-2 px-3 rounded-lg border-l-[3px]"
        style={{ backgroundColor: '#1E2235', borderColor: model.color }}
      >
        <Avatar name={model.name} color={model.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: model.color }}
            >
              {model.name}
            </span>
            <Timestamp ts={message.timestamp} />
            {message.streaming && (
              <span className="text-xs text-gray-500 animate-pulse">streaming...</span>
            )}
            {!message.streaming && onReply && (
              <button
                onClick={() => onReply(message)}
                className="ml-auto opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity text-xs"
                title="Reply"
              >
                ↩ Reply
              </button>
            )}
          </div>
          <QuotedReply replyTo={message.replyTo} />
          <div className="text-sm text-gray-100 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Human message
  return (
    <div className="group flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-surface transition-colors">
      <Avatar name={message.username} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-medium text-gray-100">{message.username}</span>
          <Timestamp ts={message.timestamp} />
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="ml-auto opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity text-xs"
              title="Reply"
            >
              ↩ Reply
            </button>
          )}
        </div>
        <QuotedReply replyTo={message.replyTo} />
        <div className="text-sm text-gray-200 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
