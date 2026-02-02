'use client';

/**
 * ExecutingPhase Component
 *
 * Chatbot-style scrollable area showing:
 * - Compact progress bar with todos
 * - Extended thinking / reasoning (collapsible)
 * - Agent streaming text
 * - Chat messages (user + assistant)
 * - Thinking indicator
 *
 * ChatInput is rendered separately by the parent (fixed at bottom).
 */

import { useRef, useEffect, useState } from 'react';
import { CheckCircle, Circle, Loader2, ChevronDown, ChevronRight, Brain, Bot, User } from 'lucide-react';
import type { AnimationTodo, AnimationMessage } from '../types';

interface ExecutingPhaseProps {
  todos: AnimationTodo[];
  thinking?: string;
  messages?: AnimationMessage[];
  streamingText?: string;
  reasoning?: string;
  onCancel?: () => void;
  isLoading?: boolean;
}

function TodoItem({ todo }: { todo: AnimationTodo }) {
  const statusIcons = {
    pending: <Circle className="h-3 w-3 text-zinc-600 flex-shrink-0" />,
    active: <Loader2 className="h-3 w-3 text-blue-400 animate-spin flex-shrink-0" />,
    done: <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />,
  };

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all ${
        todo.status === 'active'
          ? 'bg-blue-500/10 text-blue-300'
          : todo.status === 'done'
          ? 'text-zinc-500 line-through'
          : 'text-zinc-400'
      }`}
    >
      {statusIcons[todo.status]}
      <span className="truncate">{todo.label}</span>
    </div>
  );
}

export function ExecutingPhase({
  todos,
  thinking,
  messages = [],
  streamingText,
  reasoning,
}: ExecutingPhaseProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, thinking, reasoning]);

  // Calculate progress
  const completedCount = todos.filter((t) => t.status === 'done').length;
  const activeCount = todos.filter((t) => t.status === 'active').length;
  const progressPercent = todos.length > 0 ? ((completedCount + activeCount * 0.5) / todos.length) * 100 : 0;

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent pr-1"
      style={{ maxHeight: '350px' }}
    >
      {/* ── Compact Progress Section ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span className="font-medium uppercase tracking-wide">
            Progress ({completedCount}/{todos.length})
          </span>
          <span>{Math.round(progressPercent)}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Todo items - compact scrollable list */}
        {todos.length > 0 && (
          <div className="space-y-0.5 max-h-[100px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {todos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
          </div>
        )}
      </div>

      {/* ── Extended Thinking / Reasoning ── */}
      {reasoning && (
        <div className="rounded-lg bg-purple-500/5 border border-purple-500/20">
          <button
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-purple-400 uppercase tracking-wide hover:bg-purple-500/10 transition-colors rounded-lg"
          >
            <Brain className="h-3 w-3 flex-shrink-0" />
            <span>Extended Thinking</span>
            {reasoningExpanded ? (
              <ChevronDown className="h-3 w-3 ml-auto" />
            ) : (
              <ChevronRight className="h-3 w-3 ml-auto" />
            )}
          </button>
          {reasoningExpanded && (
            <div className="px-2.5 pb-2 max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
              <p className="text-[11px] text-purple-300/70 whitespace-pre-wrap leading-relaxed">
                {reasoning}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Chat Messages ── */}
      {messages.length > 0 && (
        <div className="space-y-1.5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3 w-3 text-blue-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600/20 text-blue-100 rounded-br-sm'
                    : 'bg-zinc-800/60 text-zinc-300 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3 w-3 text-zinc-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Streaming Agent Text (live) ── */}
      {streamingText && (
        <div className="flex gap-1.5">
          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="h-3 w-3 text-blue-400" />
          </div>
          <div className="flex-1 px-2.5 py-1.5 rounded-lg rounded-bl-sm bg-zinc-800/60 text-xs text-zinc-300 leading-relaxed">
            {streamingText}
            <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-0.5 animate-pulse rounded-sm" />
          </div>
        </div>
      )}

      {/* ── Thinking Indicator ── */}
      {thinking && !streamingText && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
          <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wide">
              Thinking
            </span>
            <p className="text-xs text-zinc-400 mt-0.5 break-words">{thinking}</p>
          </div>
        </div>
      )}
    </div>
  );
}
