import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { GlassButton } from '../../ui/GlassButton';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: 'teacher' | 'student';
  text: string;
  timestamp: number | string;
  isSelf?: boolean;
}

export interface ChatTabProps {
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserRole?: 'teacher' | 'student';
  className?: string;
}

function formatChatTime(timestamp: number | string): string {
  try {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(date.getTime())) {
      return String(timestamp);
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function renderMessageText(text: string): React.ReactNode {
  const pattern = /~([^~]+)~\s*->\s*\*([^*]+)\*/g;
  if (!pattern.test(text)) {
    return text;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;

  let keyIndex = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    const wrong = match[1];
    const correct = match[2];

    elements.push(
      <span key={`corr-${keyIndex++}`} className="inline-flex items-center gap-1 mx-1 my-0.5 align-middle">
        <span className="line-through text-rose-400 bg-rose-950/50 border border-rose-800/40 px-1 py-0.5 rounded text-[11px] font-mono">
          {wrong}
        </span>
        <span className="text-stone-400 text-xs">→</span>
        <span className="font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-1.5 py-0.5 rounded text-[11px] font-mono shadow-sm">
          {correct}
        </span>
      </span>
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return <>{elements}</>;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages = [],
  onSendMessage,
  currentUserId = 'self',
  currentUserName = 'You',
  currentUserRole = 'student',
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage?.(trimmed);
    setInputText('');
  };

  return (
    <div
      data-testid="chat-tab"
      className={`flex flex-col h-full overflow-hidden select-none ${className}`}
    >
      {/* Messages List Container */}
      <div
        data-testid="chat-messages-list"
        className="flex-1 p-4 overflow-y-auto space-y-3"
      >
        {messages.length === 0 ? (
          <div
            data-testid="chat-empty-state"
            className="flex flex-col items-center justify-center h-full text-center text-zinc-400 gap-2 p-4"
          >
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-500">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-zinc-300">No messages yet</p>
            <p className="text-[11px] text-zinc-500 max-w-[200px]">
              Chat messages sent during the whiteboard session appear here in real-time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.isSelf || (currentUserId && msg.senderId === currentUserId);
            const isTeacher = msg.senderRole === 'teacher';

            return (
              <div
                key={msg.id}
                data-testid={`chat-message-${msg.id}`}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-full`}
              >
                {/* Sender Header */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-medium text-zinc-300">
                    {msg.senderName}
                  </span>
                  {msg.senderRole && (
                    <span
                      data-testid={`message-role-badge-${msg.id}`}
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider ${
                        isTeacher
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30'
                      }`}
                    >
                      {isTeacher ? 'Teacher' : 'Student'}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500">
                    {formatChatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`px-3 py-2 rounded-2xl text-xs leading-relaxed max-w-[85%] break-words ${
                    isSelf
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-zinc-800/80 text-zinc-200 border border-white/[0.08] rounded-bl-sm'
                  }`}
                  style={{
                    boxShadow: isSelf
                      ? '0 2px 10px -2px rgba(79, 70, 229, 0.4)'
                      : '0 2px 8px -2px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {renderMessageText(msg.text)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field Section */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-md">
        <form
          onSubmit={handleSubmit}
          data-testid="chat-form"
          className="flex items-center gap-2"
        >
          <input
            type="text"
            data-testid="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            aria-label="Chat message input"
            // Requirement 3: Input field with font-size >= 16px to prevent iOS auto-zoom
            style={{ fontSize: '16px' }}
            className="flex-1 bg-white/[0.05] border border-white/[0.12] rounded-xl px-3.5 py-2 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          <GlassButton
            type="submit"
            variant="primary"
            size="sm"
            data-testid="send-chat-btn"
            aria-label="Send message"
            disabled={!inputText.trim()}
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </GlassButton>
        </form>
      </div>
    </div>
  );
};

export default ChatTab;
