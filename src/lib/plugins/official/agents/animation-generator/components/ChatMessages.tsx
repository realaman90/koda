'use client';

/**
 * Chat Message Components
 *
 * Sub-components for the unified chat UI, matching the Pencil design spec:
 * "Animation Generator — Chat UI Anatomy"
 *
 * Colors, spacing, and typography are pixel-matched to the design.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Terminal,
  CircleCheck,
  Circle,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Check,
  X,
  TriangleAlert,
  RotateCcw,
  Pencil,
  ArrowUp,
  Sparkles,
} from 'lucide-react';
import type {
  AnimationTodo,
  AnimationQuestion,
  AnimationPlan,
  ToolCallItem,
} from '../types';

// ─── User Message Bubble ─────────────────────────────────────────────

export function UserBubble({ content }: { content: string }) {
  return (
    <div
      className="px-3 py-2.5 text-xs leading-[1.4] text-[#93C5FD] bg-[#1E3A5F] w-full"
      style={{ borderRadius: '12px 4px 12px 12px' }}
    >
      {content}
    </div>
  );
}

// ─── Markdown Components ─────────────────────────────────────────────

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs leading-[1.5] text-[#A1A1AA] mb-1.5 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[#E4E4E7]">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-[#A1A1AA]">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-0.5 text-xs text-[#A1A1AA] mb-1.5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-0.5 text-xs text-[#A1A1AA] mb-1.5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-xs leading-[1.5] text-[#A1A1AA]">{children}</li>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre className="bg-[#14161A] rounded-md px-2.5 py-2 my-1.5 overflow-x-auto">
          <code className="text-[10px] leading-[1.4] text-[#93C5FD] font-mono">{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-[#27272a] text-[#93C5FD] text-[11px] px-1 py-0.5 rounded font-mono">{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-sm font-semibold text-[#E4E4E7] mb-1">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-[13px] font-semibold text-[#E4E4E7] mb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-[#E4E4E7] mb-0.5">{children}</h3>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-[#3f3f46] pl-2.5 my-1.5 text-[#71717A]">{children}</blockquote>
  ),
  hr: () => <hr className="border-[#27272a] my-2" />,
} as Record<string, React.ComponentType<Record<string, unknown>>>;

// ─── Assistant Text ──────────────────────────────────────────────────

export function AssistantText({ content }: { content: string }) {
  return (
    <div className="animation-md">
      <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
    </div>
  );
}

// ─── Thinking Block ─────────────────────────────────────────────────
// Streaming: borderless card with fixed height, auto-scrolling reasoning.
// Done: collapsed "Thought for Xs" — click to expand full content.

interface ThinkingBlockProps {
  /** The agent's current thinking label (set_thinking output) */
  thinking: string;
  /** Live reasoning stream from extended thinking */
  reasoning?: string;
  /** Whether the agent is currently streaming */
  isStreaming: boolean;
  /** ISO timestamp when this thinking block started */
  startedAt?: string;
  /** ISO timestamp when this thinking block finished */
  endedAt?: string;
}

export function ThinkingBlock({ thinking, reasoning, isStreaming, startedAt, endedAt }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  const displayText = reasoning || thinking;

  // Compute elapsed time: live timer when streaming, static from timestamps when done
  useEffect(() => {
    if (isStreaming && startedAt) {
      const start = new Date(startedAt).getTime();
      setElapsed(Math.round((Date.now() - start) / 1000));
      const timer = setInterval(() => {
        setElapsed(Math.round((Date.now() - start) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    } else if (startedAt && endedAt) {
      const start = new Date(startedAt).getTime();
      const end = new Date(endedAt).getTime();
      setElapsed(Math.round((end - start) / 1000));
    }
  }, [isStreaming, startedAt, endedAt]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoning, isStreaming]);

  // ── Streaming state ──
  if (isStreaming) {
    return (
      <div className="w-full rounded-md bg-[#1A1A1E] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Loader2 className="w-3 h-3 text-[#A1A1AA] animate-spin shrink-0" />
          <span
            className="text-[11px] font-medium bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #A1A1AA 0%, #FAFAFA 40%, #A1A1AA 60%, #71717A 100%)',
              backgroundSize: '200% 100%',
              animation: 'think-shimmer 2s linear infinite',
            }}
          >
            {thinking || 'Thinking'}
          </span>
          <span className="ml-auto text-[9px] text-[#3f3f46] tabular-nums">{elapsed}s</span>
        </div>
        {/* Scrollable reasoning area */}
        {reasoning && (
          <div
            ref={scrollRef}
            className="px-2.5 pb-2 overflow-y-auto scrollbar-hidden"
            style={{ maxHeight: '80px' }}
          >
            <p className="text-[10px] text-[#52525B] leading-[1.4] whitespace-pre-wrap break-words">
              {reasoning}
              <span className="inline-block w-[3px] h-[11px] bg-[#3B82F6] ml-0.5 animate-pulse rounded-sm align-middle" />
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Done state ──
  if (!displayText) return null;

  const durationLabel = elapsed > 0 ? `${elapsed}s` : '<1s';

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 rounded-md bg-[#1A1A1E] px-2.5 py-1.5 hover:bg-[#222226] transition-colors group"
      >
        <Sparkles className="w-3 h-3 text-[#52525B] shrink-0" />
        <span className="text-[11px] text-[#52525B] group-hover:text-[#71717A] transition-colors">
          Thought for {durationLabel}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[#3f3f46] shrink-0 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div
          className="px-2.5 py-2 bg-[#16161A] rounded-b-md overflow-y-auto scrollbar-hidden"
          style={{ maxHeight: '120px' }}
        >
          <p className="text-[10px] text-[#52525B] leading-[1.4] whitespace-pre-wrap break-words">{displayText}</p>
        </div>
      )}
    </div>
  );
}

// ─── Status Pill ─────────────────────────────────────────────────────

function StatusPill({ status }: { status: 'running' | 'done' | 'failed' }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1E3A5F]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
        <span className="text-[9px] font-medium text-[#93C5FD]">Running</span>
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#14532D]">
        <Check className="w-2 h-2 text-[#4ADE80]" />
        <span className="text-[9px] font-medium text-[#4ADE80]">Done</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#3B1111]">
      <X className="w-2 h-2 text-[#EF4444]" />
      <span className="text-[9px] font-medium text-[#EF4444]">Failed</span>
    </span>
  );
}

// ─── Tool Call Card ──────────────────────────────────────────────────

export function ToolCallCard({ item }: { item: ToolCallItem }) {
  const iconColor = item.status === 'failed' ? '#EF4444' : '#3B82F6';
  const hasOutput = item.output && item.status !== 'failed';
  const hasError = item.error && item.status === 'failed';
  const hasBody = hasOutput || hasError;

  return (
    <div className="w-full">
      {/* Header row */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 bg-[#14161A]"
        style={{
          borderRadius: hasBody ? '6px 6px 0 0' : '6px',
        }}
      >
        <Terminal className="w-3 h-3 flex-shrink-0" style={{ color: iconColor }} />
        <span className="text-[11px] font-medium text-[#A1A1AA]">{item.displayName}</span>
        <div className="ml-auto">
          <StatusPill status={item.status} />
        </div>
      </div>

      {/* Output section (success) */}
      {hasOutput && (
        <div
          className="px-2 py-1.5 bg-[#111318] border-t border-[#1E2028] overflow-hidden"
          style={{ borderRadius: '0 0 6px 6px' }}
        >
          <p className="text-[10px] text-[#52525B] break-all line-clamp-3 overflow-hidden">{item.output}</p>
        </div>
      )}

      {/* Error output section */}
      {hasError && (
        <div
          className="px-2.5 py-2 bg-[#1C1011] border border-[#7F1D1D] border-t-0 space-y-1 overflow-hidden"
          style={{ borderRadius: '0 0 6px 6px' }}
        >
          <div className="flex items-center gap-1.5">
            <TriangleAlert className="w-3 h-3 text-[#EF4444] flex-shrink-0" />
            <span className="text-[11px] font-semibold text-[#FCA5A5] break-all line-clamp-2">
              {item.error!.split('\n')[0] || 'Execution failed'}
            </span>
          </div>
          {item.error!.includes('\n') && (
            <p className="text-[10px] text-[#71717A] leading-[1.4] break-all line-clamp-3 overflow-hidden">
              {item.error!.split('\n').slice(1).join('\n')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Plan Card ───────────────────────────────────────────────────────
// Unified plan UI that shows plan summary, accept/reject actions,
// and the "Plan accepted" badge all in one contained section.

interface PlanCardProps {
  plan: AnimationPlan;
  accepted: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function PlanCard({ plan, accepted, onAccept, onReject }: PlanCardProps) {
  return (
    <div className="w-full rounded-lg bg-[#14161A] border border-[#1E2028] overflow-hidden">
      {/* Plan summary */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-[10px] font-semibold text-[#A1A1AA]">
          {plan.scenes.length} scenes &middot; {plan.totalDuration}s &middot; {plan.fps}fps &middot; {plan.style}
        </p>
        {plan.scenes.map((scene) => (
          <p key={scene.number} className="text-[10px] text-[#52525B]">
            {scene.number}. {scene.title} ({scene.duration}s)
          </p>
        ))}
      </div>

      {/* Actions or accepted badge */}
      <div className="px-3 pb-2.5">
        {accepted ? (
          <div className="flex items-center gap-1.5 py-1.5">
            <CircleCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span className="text-[11px] font-medium text-[#4ADE80]">Plan accepted</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onAccept}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14532D] text-[#4ADE80] text-[11px] font-medium hover:bg-[#166534] transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Accept Plan
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#27272a] text-[#A1A1AA] text-[11px] font-medium hover:bg-[#3f3f46] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Keep these as standalone exports for backward compat
export function PlanActions({
  onAccept,
  onReject,
}: {
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onAccept}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14532D] text-[#4ADE80] text-[11px] font-medium hover:bg-[#166534] transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
        Accept Plan
      </button>
      <button
        onClick={onReject}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#27272a] text-[#A1A1AA] text-[11px] font-medium hover:bg-[#3f3f46] transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Reject
      </button>
    </div>
  );
}

export function PlanAcceptedBadge() {
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <CircleCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
      <span className="text-[11px] font-medium text-[#4ADE80]">Plan accepted</span>
    </div>
  );
}

// ─── Question Options ────────────────────────────────────────────────

interface QuestionOptionsProps {
  question: AnimationQuestion;
  onSelect: (styleId: string, customStyle?: string) => void;
}

export function QuestionOptions({ question, onSelect }: QuestionOptionsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');

  const handleSubmit = useCallback(() => {
    if (!selectedId) return;
    if (selectedId === 'custom' && customInput.trim()) {
      onSelect(selectedId, customInput.trim());
    } else if (selectedId !== 'custom') {
      onSelect(selectedId);
    }
  }, [selectedId, customInput, onSelect]);

  return (
    <div className="space-y-1.5">
      {question.options.map((opt) => {
        const isSelected = selectedId === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => setSelectedId(opt.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
              isSelected
                ? 'bg-[#1E3A5F] border border-[#3B82F6]'
                : 'bg-[#14161A] border border-[#3f3f46] hover:border-[#52525B]'
            }`}
          >
            <div className="text-left space-y-0.5">
              <div className="text-[11px] font-semibold text-[#E2E8F0]">{opt.label}</div>
              {opt.description && (
                <div className="text-[10px] text-[#71717A]">{opt.description}</div>
              )}
            </div>
          </button>
        );
      })}

      {/* Open answer option */}
      {question.customInput && (
        <button
          onClick={() => setSelectedId('custom')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
            selectedId === 'custom'
              ? 'bg-[#1E3A5F] border border-[#3B82F6]'
              : 'bg-[#14161A] border border-[#3f3f46] hover:border-[#52525B]'
          }`}
        >
          <Pencil
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: selectedId === 'custom' ? '#3B82F6' : '#71717A' }}
          />
          {selectedId === 'custom' ? (
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Type your own answer..."
              className="flex-1 bg-transparent text-[11px] text-[#E2E8F0] placeholder:text-[#52525B] outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-[11px] text-[#52525B]">Type your own answer...</span>
          )}
        </button>
      )}

      {/* Submit button */}
      {selectedId && (
        <div className="flex justify-end pt-0.5">
          <button
            onClick={handleSubmit}
            disabled={selectedId === 'custom' && !customInput.trim()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3B82F6] text-white text-[11px] font-medium hover:bg-[#2563EB] transition-colors disabled:opacity-50"
          >
            <ArrowUp className="w-3 h-3" />
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Streaming Text ──────────────────────────────────────────────────

export function StreamingText({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-[#71717A] leading-[1.4] whitespace-pre-wrap">
      {text}
      <span className="inline-block w-[3px] h-[13px] bg-[#3B82F6] ml-0.5 animate-pulse rounded-sm align-middle" />
    </p>
  );
}

// ─── Retry Button ────────────────────────────────────────────────────

export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      onClick={onRetry}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#27272a] border border-[#3f3f46] text-[#A1A1AA] text-[11px] font-medium hover:bg-[#3f3f46] transition-colors"
    >
      <RotateCcw className="w-3 h-3" />
      Retry
    </button>
  );
}

// ─── Todo Section (Sticky) ───────────────────────────────────────────

interface TodoSectionProps {
  todos: AnimationTodo[];
}

export function TodoSection({ todos }: TodoSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const doneCount = todos.filter((t) => t.status === 'done').length;

  return (
    <div className="border-t border-b border-[#27272a] px-3.5 py-2 space-y-1">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5"
      >
        <ListChecks
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: doneCount === todos.length ? '#22C55E' : '#A1A1AA' }}
        />
        <span className="text-[11px] font-semibold text-[#A1A1AA]">
          To-do ({doneCount}/{todos.length})
        </span>
        {collapsed ? (
          <ChevronDown className="w-3 h-3 text-[#52525B] ml-auto" />
        ) : (
          <ChevronUp className="w-3 h-3 text-[#52525B] ml-auto" />
        )}
      </button>

      {/* Items */}
      {!collapsed && (
        <div>
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-1.5 py-[3px]">
              {todo.status === 'done' && (
                <CircleCheck className="w-3 h-3 text-[#22C55E] flex-shrink-0" />
              )}
              {todo.status === 'active' && (
                <Loader2 className="w-3 h-3 text-[#3B82F6] animate-spin flex-shrink-0" />
              )}
              {todo.status === 'pending' && (
                <Circle className="w-3 h-3 text-[#3f3f46] flex-shrink-0" />
              )}
              <span
                className={`text-[10px] ${
                  todo.status === 'active'
                    ? 'text-[#E4E4E7] font-medium'
                    : todo.status === 'done'
                    ? 'text-[#52525B]'
                    : 'text-[#71717A]'
                }`}
              >
                {todo.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
