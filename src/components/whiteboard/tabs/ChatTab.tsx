import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Sparkles, Bot } from 'lucide-react';
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

export function generateAiAnswer(q: string): string {
  const query = q.toLowerCase();
  if (query.includes('quadratic') || query.includes('factor')) {
    return `To solve ax² + bx + c = 0:\n• Discriminant Δ = b² - 4ac (Δ > 0: 2 real roots, Δ = 0: 1 double root, Δ < 0: 2 complex).\n• Quadratic Formula: x = (-b ± √Δ) / (2a).\n• Axis of symmetry: x = -b / (2a).`;
  }
  if (query.includes('derivative') || query.includes('calculus')) {
    return `Fundamental Derivative Rules:\n• Power Rule: d/dx [xⁿ] = n·xⁿ⁻¹\n• Product Rule: (u·v)' = u'v + uv'\n• Quotient Rule: (u/v)' = (u'v - uv') / v²\n• Chain Rule: d/dx [f(g(x))] = f'(g(x)) · g'(x).`;
  }
  if (query.includes('area') || query.includes('circle') || query.includes('triangle')) {
    return `Geometric Formulas:\n• Circle Area: A = πr², Circumference: C = 2πr\n• Triangle Area: A = ½ · base · height\n• Pythagorean Theorem: a² + b² = c² (for right triangles).`;
  }
  if (!q.trim()) {
    return `Hello! I am your AI Teaching Assistant. Type '/ask AI <your question>' (e.g. '/ask AI How do I solve quadratic equations?') to get instant math and science explanations.`;
  }
  return `Analyzing "${q}":\n1. Identify the given parameters and equations on your whiteboard.\n2. Apply the fundamental definition or formula.\n3. Verify your solution with your teacher in class!`;
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
  const cleanText = text.startsWith('[AI_RESPONSE]') ? text.replace('[AI_RESPONSE]', '') : text;
  const pattern = /~([^~]+)~\s*->\s*\*([^*]+)\*/g;
  if (!pattern.test(cleanText)) {
    return <span className="whitespace-pre-line">{cleanText}</span>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;

  let keyIndex = 0;
  while ((match = pattern.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      elements.push(cleanText.substring(lastIndex, match.index));
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

  if (lastIndex < cleanText.length) {
    elements.push(cleanText.substring(lastIndex));
  }

  return <span className="whitespace-pre-line">{elements}</span>;
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
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const allMessages = [...messages, ...internalMessages];

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length]);

  const isSlashPromptVisible = inputText.startsWith('/');

  const handleSelectSlashCommand = () => {
    setInputText('/ask AI ');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const isSlashAsk = /^\/(ask\s*ai|ask|ai)\b/i.test(trimmed);

    onSendMessage?.(trimmed);
    setInputText('');

    if (isSlashAsk) {
      const query = trimmed.replace(/^\/(ask\s*ai|ask|ai)\s*/i, '').trim();
      setTimeout(() => {
        const aiAnswer = generateAiAnswer(query);
        const aiMsg: ChatMessage = {
          id: `ai-reply-${Date.now()}`,
          senderId: 'ai-assistant',
          senderName: 'AI Teaching Assistant',
          senderRole: 'teacher',
          text: `[AI_RESPONSE]${aiAnswer}`,
          timestamp: Date.now(),
        };
        setInternalMessages((prev) => [...prev, aiMsg]);
        onSendMessage?.(`[AI_RESPONSE]${aiAnswer}`);
      }, 400);
    }
  };

  return (
    <div
      data-testid="chat-tab"
      className={`flex flex-col h-full overflow-hidden select-none bg-[#181614] text-stone-100 ${className}`}
    >
      {/* Messages List Container */}
      <div
        data-testid="chat-messages-list"
        className="flex-1 p-4 overflow-y-auto space-y-3"
      >
        {allMessages.length === 0 ? (
          <div
            data-testid="chat-empty-state"
            className="flex flex-col items-center justify-center h-full text-center text-stone-400 gap-2 p-4"
          >
            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-500">
              <MessageSquare className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-xs font-medium text-stone-200">No messages yet</p>
            <p className="text-[11px] text-stone-400 max-w-[200px]">
              Chat messages appear here. Type <code className="text-amber-400 font-mono">/ask AI</code> for teaching help!
            </p>
          </div>
        ) : (
          allMessages.map((msg) => {
            const isAi = msg.text.startsWith('[AI_RESPONSE]') || msg.senderId === 'ai-assistant';
            const isSelf = !isAi && (msg.isSelf || (currentUserId && msg.senderId === currentUserId));
            const isTeacher = msg.senderRole === 'teacher';

            return (
              <div
                key={msg.id}
                data-testid={`chat-message-${msg.id}`}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-full`}
              >
                {/* Sender Header */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {isAi && <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />}
                  <span className="text-[11px] font-medium text-stone-300">
                    {msg.senderName}
                  </span>
                  {isAi ? (
                    <span
                      data-testid={`message-role-badge-${msg.id}`}
                      className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                    >
                      <Bot className="w-2.5 h-2.5" />
                      AI Assistant
                    </span>
                  ) : msg.senderRole ? (
                    <span
                      data-testid={`message-role-badge-${msg.id}`}
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider ${
                        isTeacher
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-stone-800 text-stone-400 border border-stone-700'
                      }`}
                    >
                      {isTeacher ? 'Teacher' : 'Student'}
                    </span>
                  ) : null}
                  <span className="text-[10px] text-stone-500">
                    {formatChatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`px-3 py-2 rounded-2xl text-xs leading-relaxed max-w-[85%] break-words ${
                    isAi
                      ? 'bg-stone-900 text-stone-100 border border-amber-500/40 shadow-md rounded-tl-sm'
                      : isSelf
                      ? 'bg-amber-600 text-stone-950 font-medium rounded-br-sm shadow-md'
                      : 'bg-stone-800 text-stone-200 border border-stone-700 rounded-bl-sm shadow-sm'
                  }`}
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
      <div className="p-3 border-t border-stone-800 bg-[#1c1917] relative">
        {/* Slash Command Autocomplete Suggestion */}
        {isSlashPromptVisible && (
          <div
            data-testid="slash-command-suggestion"
            onClick={handleSelectSlashCommand}
            className="absolute -top-10 left-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900 border border-amber-500/40 text-amber-300 text-xs cursor-pointer shadow-lg hover:bg-stone-800 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono font-semibold">/ask AI</span>
            <span className="text-stone-400 text-[11px] truncate">Ask AI Assistant a question</span>
          </div>
        )}

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
            placeholder="Type a message or /ask AI..."
            aria-label="Chat message input"
            style={{ fontSize: '16px' }}
            className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-base text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          />
          <GlassButton
            type="submit"
            variant="primary"
            size="sm"
            data-testid="send-chat-btn"
            aria-label="Send message"
            disabled={!inputText.trim()}
            className="px-3 bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold"
          >
            <Send className="w-4 h-4" />
          </GlassButton>
        </form>
      </div>
    </div>
  );
};

export default ChatTab;
