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
import remarkGfm from 'remark-gfm';
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
  Video,
  ExternalLink,
  Download,
} from 'lucide-react';
import type {
  AnimationTodo,
  AnimationQuestion,
  AnimationPlan,
  AnimationVersion,
  ToolCallItem,
  MediaEntry,
} from '../types';

// ─── User Message Bubble ─────────────────────────────────────────────

export function UserBubble({ content, media }: { content: string; media?: MediaEntry[] }) {
  return (
    <div
      className="px-3 py-2.5 text-xs leading-[1.4] text-[var(--an-accent-text)] bg-[var(--an-bg-user-bubble)] w-full"
      style={{ borderRadius: '12px 4px 12px 12px' }}
    >
      {/* Inline media thumbnails */}
      {media && media.length > 0 && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {media.map((m) => (
            <div key={m.id} className="w-12 h-12 rounded overflow-hidden bg-[var(--an-accent-bg)] border border-[#2563EB]/30 shrink-0">
              {m.type === 'image' ? (
                <img src={m.dataUrl} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                  <Video className="w-4 h-4 text-purple-400" />
                  {m.duration != null && (
                    <span className="text-[7px] text-purple-300">{m.duration.toFixed(1)}s</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {content}
    </div>
  );
}

// ─── Markdown Components ─────────────────────────────────────────────

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs leading-[1.5] text-[var(--an-text-muted)] mb-1.5 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[var(--an-text-secondary)]">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-[var(--an-text-muted)]">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-0.5 text-xs text-[var(--an-text-muted)] mb-1.5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-0.5 text-xs text-[var(--an-text-muted)] mb-1.5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-xs leading-[1.5] text-[var(--an-text-muted)]">{children}</li>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre className="bg-[var(--an-bg-elevated)] rounded-md px-2.5 py-2 my-1.5 overflow-x-auto">
          <code className="text-[10px] leading-[1.4] text-[var(--an-accent-text)] font-mono">{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-[var(--an-bg-card)] text-[var(--an-accent-text)] text-[11px] px-1 py-0.5 rounded font-mono">{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-sm font-semibold text-[var(--an-text-secondary)] mb-1">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-[13px] font-semibold text-[var(--an-text-secondary)] mb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-[var(--an-text-secondary)] mb-0.5">{children}</h3>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-[var(--an-border-input)] pl-2.5 my-1.5 text-[var(--an-text-dim)]">{children}</blockquote>
  ),
  hr: () => <hr className="border-[var(--an-border)] my-2" />,
  // Table components
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2 rounded-md border border-[var(--an-border)]">
      <table className="min-w-full text-[10px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-[var(--an-bg-elevated)] border-b border-[var(--an-border)]">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-[var(--an-border)]">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-[var(--an-bg-elevated)]/50 transition-colors">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-[var(--an-text-muted)]">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-2 py-1.5 text-[10px] text-[var(--an-text-dim)]">{children}</td>
  ),
} as Record<string, React.ComponentType<Record<string, unknown>>>;

// ─── Assistant Text ──────────────────────────────────────────────────

export function AssistantText({ content }: { content: string }) {
  return (
    <div className="animation-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{content}</ReactMarkdown>
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
      <div className="w-full rounded-md bg-[var(--an-bg-elevated)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Loader2 className="w-3 h-3 text-[var(--an-text-muted)] animate-spin shrink-0" />
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
          <span className="ml-auto text-[9px] text-[var(--an-border-input)] tabular-nums">{elapsed}s</span>
        </div>
        {/* Scrollable reasoning area */}
        {reasoning && (
          <div
            ref={scrollRef}
            className="px-2.5 pb-2 overflow-y-auto scrollbar-hidden"
            style={{ maxHeight: '80px' }}
          >
            <p className="text-[10px] text-[var(--an-text-placeholder)] leading-[1.4] whitespace-pre-wrap break-words">
              {reasoning}
              <span className="inline-block w-[3px] h-[11px] bg-[var(--an-accent)] ml-0.5 animate-pulse rounded-sm align-middle" />
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
        className="w-full flex items-center gap-2 rounded-md bg-[var(--an-bg-elevated)] px-2.5 py-1.5 hover:bg-[var(--an-bg-hover)] transition-colors group"
      >
        <Sparkles className="w-3 h-3 text-[var(--an-text-placeholder)] shrink-0" />
        <span className="text-[11px] text-[var(--an-text-placeholder)] group-hover:text-[var(--an-text-dim)] transition-colors">
          Thought for {durationLabel}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[var(--an-border-input)] shrink-0 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div
          className="px-2.5 py-2 bg-[var(--an-bg-elevated)] rounded-b-md overflow-y-auto scrollbar-hidden"
          style={{ maxHeight: '120px' }}
        >
          <p className="text-[10px] text-[var(--an-text-placeholder)] leading-[1.4] whitespace-pre-wrap break-words">{displayText}</p>
        </div>
      )}
    </div>
  );
}

// ─── Status Pill ─────────────────────────────────────────────────────

function StatusPill({ status }: { status: 'running' | 'done' | 'failed' }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--an-bg-user-bubble)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--an-accent)] animate-pulse" />
        <span className="text-[9px] font-medium text-[var(--an-accent-text)]">Running</span>
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

// ─── Tool Output Summarizer ───────────────────────────────────────────
// Converts raw JSON tool outputs to user-friendly summaries

function summarizeToolOutput(toolName: string, output: string | undefined): string | null {
  if (!output) return null;

  try {
    const parsed = JSON.parse(output);

    switch (toolName) {
      case 'sandbox_create':
        return parsed.sandboxId ? 'Workspace ready' : null;

      case 'sandbox_write_file':
        // Don't show anything for file writes - they're noise
        return null;

      case 'generate_code': {
        const files = parsed.files;
        if (Array.isArray(files) && files.length > 0) {
          if (files.length === 1) {
            return `Created ${files[0].path?.split('/').pop() || '1 file'}`;
          }
          return `Created ${files.length} files`;
        }
        return parsed.summary || null;
      }

      case 'sandbox_run_command':
        // Hide command output unless it's an error
        return null;

      case 'sandbox_start_preview':
        return parsed.previewUrl ? 'Preview server started' : null;

      case 'sandbox_screenshot':
        return parsed.imageUrl ? 'Captured screenshot' : null;

      case 'render_preview':
        return parsed.videoUrl ? 'Preview video ready' : null;

      case 'render_final':
        return parsed.videoUrl ? 'Final video rendered' : null;

      case 'generate_plan':
        return parsed.plan ? 'Plan created' : null;

      default:
        // For unknown tools, don't show raw JSON
        return null;
    }
  } catch {
    // If output isn't valid JSON, don't show it
    return null;
  }
}

// ─── Friendly Error Messages ──────────────────────────────────────────
// Converts raw technical errors to user-friendly messages

function getFriendlyErrorMessage(toolName: string, rawError: string): string {
  // Map tool names to user-friendly error messages
  const toolErrorMessages: Record<string, string> = {
    sandbox_create: 'Setup taking longer than expected',
    sandbox_start_preview: 'Preview server starting...',
    sandbox_run_command: 'Processing step encountered an issue',
    sandbox_write_file: 'File save issue, retrying...',
    render_preview: 'Video render in progress...',
    render_final: 'Final render in progress...',
    generate_code: 'Code generation retry needed',
  };

  // Return tool-specific message, or generic one
  return toolErrorMessages[toolName] || 'Retrying...';
}

// ─── Tool Running Context ─────────────────────────────────────────────
// Shows meaningful context while a tool is running (especially for slow ones like generate_code)

function getRunningContext(toolName: string, args?: Record<string, unknown>): string | null {
  if (!args) return null;

  switch (toolName) {
    case 'generate_code': {
      const task = args.task as string;
      const plan = args.plan as { scenes?: Array<{ title: string }> } | undefined;
      const name = args.name as string | undefined;

      if (task === 'initial_setup') {
        return 'Setting up project structure...';
      }
      if (task === 'create_component' && name) {
        return `Creating ${name}...`;
      }
      if (task === 'create_scene' && plan?.scenes) {
        const sceneNames = plan.scenes.map(s => s.title).join(', ');
        return `Building scenes: ${sceneNames}`;
      }
      if (task === 'modify_existing') {
        return 'Updating code...';
      }
      return 'Generating animation code...';
    }

    case 'render_preview':
      return 'Capturing frames and encoding video...';

    case 'render_final':
      return 'Rendering high-quality video...';

    case 'sandbox_start_preview':
      return 'Starting development server...';

    default:
      return null;
  }
}

// ─── Tool Call Card ──────────────────────────────────────────────────

export function ToolCallCard({ item }: { item: ToolCallItem }) {
  const iconColor = item.status === 'failed' ? '#EF4444' : '#3B82F6';
  const hasError = item.error && item.status === 'failed';

  // Live elapsed time counter for running tools
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (item.status !== 'running') return;
    const startTime = new Date(item.timestamp).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [item.status, item.timestamp]);

  // Get context while running, or summary when done
  const runningContext = item.status === 'running' ? getRunningContext(item.toolName, item.args) : null;
  const summary = item.status !== 'failed' && item.status !== 'running' ? summarizeToolOutput(item.toolName, item.output) : null;

  // Always show body for running tools (to display elapsed time + context)
  const hasBody = summary || hasError || item.status === 'running';

  return (
    <div className="w-full">
      {/* Header row */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--an-bg-elevated)]"
        style={{
          borderRadius: hasBody ? '6px 6px 0 0' : '6px',
        }}
      >
        <Terminal className="w-3 h-3 shrink-0" style={{ color: iconColor }} />
        <span className="text-[11px] font-medium text-[var(--an-text-muted)]">{item.displayName}</span>
        <div className="ml-auto">
          <StatusPill status={item.status} />
        </div>
      </div>

      {/* Running state - shows elapsed time and context */}
      {item.status === 'running' && (
        <div
          className="px-2 py-1.5 bg-[var(--an-bg-elevated)] border-t border-[var(--an-border-input)] overflow-hidden"
          style={{ borderRadius: '0 0 6px 6px' }}
        >
          <div className="flex items-center gap-2">
            <div className="relative w-2.5 h-2.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-[var(--an-accent)] animate-ping opacity-30" />
              <span className="absolute inset-0 rounded-full bg-[var(--an-accent)]" />
            </div>
            <p className="text-[10px] text-[var(--an-accent-text)] flex-1">
              {runningContext || 'Working...'}
            </p>
            <span className="text-[9px] text-[var(--an-text-placeholder)] tabular-nums">{elapsed}s</span>
          </div>
        </div>
      )}

      {/* Output summary section (success) - only if we have a friendly summary */}
      {summary && (
        <div
          className="px-2 py-1.5 bg-[var(--an-bg-elevated)] border-t border-[var(--an-border-input)] overflow-hidden"
          style={{ borderRadius: '0 0 6px 6px' }}
        >
          <p className="text-[10px] text-[var(--an-text-dim)]">{summary}</p>
        </div>
      )}

      {/* Error output section - show user-friendly message, not raw JSON */}
      {hasError && (
        <div
          className="px-2.5 py-2 bg-[#1C1011] border border-[#7F1D1D] border-t-0 overflow-hidden"
          style={{ borderRadius: '0 0 6px 6px' }}
        >
          <div className="flex items-center gap-1.5">
            <TriangleAlert className="w-3 h-3 text-[#EF4444] shrink-0" />
            <span className="text-[11px] font-medium text-[#FCA5A5]">
              {getFriendlyErrorMessage(item.toolName, item.error!)}
            </span>
          </div>
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
    <div className="w-full rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] overflow-hidden">
      {/* Plan summary */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-[10px] font-semibold text-[var(--an-text-muted)]">
          {plan.scenes.length} scenes &middot; {plan.totalDuration}s &middot; {plan.fps}fps &middot; {plan.style}
        </p>
        {plan.scenes.map((scene) => (
          <p key={scene.number} className="text-[10px] text-[var(--an-text-placeholder)]">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--an-bg-card)] text-[var(--an-text-muted)] text-[11px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--an-bg-card)] text-[var(--an-text-muted)] text-[11px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
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
                ? 'bg-[var(--an-bg-user-bubble)] border border-[var(--an-accent)]'
                : 'bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] hover:border-[var(--an-border-hover)]'
            }`}
          >
            <div className="text-left space-y-0.5">
              <div className="text-[11px] font-semibold text-[var(--an-text-secondary)]">{opt.label}</div>
              {opt.description && (
                <div className="text-[10px] text-[var(--an-text-dim)]">{opt.description}</div>
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
              ? 'bg-[var(--an-bg-user-bubble)] border border-[var(--an-accent)]'
              : 'bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] hover:border-[var(--an-border-hover)]'
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
              className="flex-1 bg-transparent text-[11px] text-[var(--an-text-secondary)] placeholder:text-[var(--an-text-placeholder)] outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-[11px] text-[var(--an-text-placeholder)]">Type your own answer...</span>
          )}
        </button>
      )}

      {/* Submit button */}
      {selectedId && (
        <div className="flex justify-end pt-0.5">
          <button
            onClick={handleSubmit}
            disabled={selectedId === 'custom' && !customInput.trim()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--an-accent)] text-white text-[11px] font-medium hover:bg-[var(--an-accent-hover)] transition-colors disabled:opacity-50"
          >
            <ArrowUp className="w-3 h-3" />
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Live Preview Card (Collapsible Iframe) ───────────────────────────

interface LivePreviewCardProps {
  previewUrl: string;
  nodeId: string;
  /** Whether to show expanded or collapsed state */
  expanded?: boolean;
  /** Called when Export is clicked to render the final video */
  onExport?: () => void;
  /** Whether export is in progress */
  isExporting?: boolean;
  /** Preview state: 'active' (normal), 'stale' (updating), 'hidden' (show pill only) */
  previewState?: 'active' | 'stale' | 'hidden';
  /** Called when user clicks to show hidden preview */
  onShowPreview?: () => void;
}

export function LivePreviewCard({
  previewUrl,
  nodeId,
  expanded = true,
  onExport,
  isExporting = false,
  previewState = 'active',
  onShowPreview,
}: LivePreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for errors from the iframe via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if message is from our iframe and indicates an error
      if (event.data?.type === 'animation-error' || event.data?.error) {
        setHasError(true);
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Reset error state when URL changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [previewUrl]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    // Check if iframe content has an error (can't directly access cross-origin)
    // The animation will post a message if it errors
  }, []);

  const handleIframeError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    if (iframeRef.current) {
      // Force reload by setting src to itself
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc.includes('?')
            ? currentSrc.replace(/\?t=\d+/, `?t=${Date.now()}`)
            : `${currentSrc}?t=${Date.now()}`;
        }
      }, 100);
    }
  }, []);

  // Hidden state: show only a small pill button (Issue #22)
  if (previewState === 'hidden') {
    return (
      <button
        onClick={onShowPreview}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[var(--an-bg-user-bubble)]/50 border border-[var(--an-accent)]/30 hover:bg-[var(--an-bg-user-bubble)] hover:border-[var(--an-accent)]/50 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--an-accent)] animate-pulse" />
        <span className="text-[10px] font-medium text-[var(--an-accent-text)]">Show Preview</span>
      </button>
    );
  }

  // Collapsed state: compact card
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border)] hover:border-[var(--an-border-input)] transition-colors"
      >
        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${hasError ? 'bg-[#3B1111]' : 'bg-[#14532D]'}`}>
          {hasError ? (
            <TriangleAlert className="w-4 h-4 text-[#EF4444]" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[11px] font-medium text-[var(--an-text-muted)] truncate">
            {hasError ? 'Preview Issue' : 'Live Preview'}
          </p>
          <p className="text-[10px] text-[var(--an-text-placeholder)]">Click to expand</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--an-text-placeholder)] shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)]">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--an-bg-elevated)] border-b border-[var(--an-border-input)]">
        <span className="text-[10px] text-[var(--an-text-muted)] font-medium flex items-center gap-1.5">
          {hasError ? (
            <TriangleAlert className="w-3 h-3 text-[#EF4444]" />
          ) : previewState === 'stale' ? (
            <Loader2 className="w-3 h-3 text-[#FBBF24] animate-spin" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
          )}
          {hasError ? 'Preview Issue' : previewState === 'stale' ? 'Updating Preview...' : 'Live Preview'}
        </span>
        <div className="flex items-center gap-1">
          {onExport && (
            <button
              onClick={onExport}
              disabled={isExporting}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                isExporting
                  ? 'bg-[var(--an-bg-user-bubble)] text-[var(--an-accent-text)] cursor-not-allowed'
                  : 'bg-[#14532D] text-[#4ADE80] hover:bg-[#166534]'
              }`}
              title="Export video"
            >
              {isExporting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-[var(--an-bg-card)] text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] transition-colors"
            title="Refresh preview"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            onClick={() => window.open(previewUrl, '_blank')}
            className="p-1 rounded hover:bg-[var(--an-bg-card)] text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded hover:bg-[var(--an-bg-card)] text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] transition-colors"
            title="Collapse"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Error state overlay */}
      {hasError ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 bg-[var(--an-bg-elevated)]">
          <div className="w-10 h-10 rounded-full bg-[#3B1111] flex items-center justify-center mb-3">
            <TriangleAlert className="w-5 h-5 text-[#EF4444]" />
          </div>
          <p className="text-[11px] text-[var(--an-text-muted)] font-medium mb-1">Preview encountered an issue</p>
          <p className="text-[10px] text-[var(--an-text-placeholder)] text-center mb-3">
            The animation is being fixed. This happens sometimes during development.
          </p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--an-bg-card)] text-[var(--an-text-muted)] text-[10px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Try Again
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 bg-[var(--an-bg-elevated)]">
              <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
            </div>
          )}
          {/* Iframe */}
          <iframe
            ref={iframeRef}
            data-sandbox={nodeId}
            src={previewUrl}
            className={`w-full bg-white ${isLoading ? 'hidden' : ''}`}
            style={{ height: '200px', border: 'none' }}
            sandbox="allow-scripts allow-same-origin"
            title="Animation preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
          {/* Stale overlay - shown when preview is being updated */}
          {previewState === 'stale' && !isLoading && (
            <div className="absolute inset-0 bg-[#18181b]/60 backdrop-blur-[1px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-[#FBBF24] animate-spin" />
                <span className="text-[10px] text-[#FBBF24] font-medium">Updating...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Video Card (Collapsible) ─────────────────────────────────────────

interface VideoCardProps {
  videoUrl: string;
  duration: number;
  /** Whether to show full video or collapsed state */
  expanded?: boolean;
  /** Called when Accept is clicked */
  onAccept?: () => void;
  /** Called when Regenerate is clicked */
  onRegenerate?: () => void;
  /** Whether this is the active preview (show buttons) or just a timeline item */
  isActivePreview?: boolean;
}

// Check if URL is a sandbox URL (ephemeral, won't work after sandbox destroyed)
const isSandboxUrl = (url: string) => url.includes('/api/plugins/animation/sandbox/');

export function VideoCard({
  videoUrl,
  duration,
  expanded = true,
  onAccept,
  onRegenerate,
  isActivePreview = false,
}: VideoCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [loadError, setLoadError] = useState(false);
  const isSandbox = isSandboxUrl(videoUrl);

  // Show collapsed state: just a clickable card to expand
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border)] hover:border-[var(--an-border-input)] transition-colors"
      >
        <div className="w-8 h-8 rounded bg-[var(--an-bg-elevated)] flex items-center justify-center shrink-0">
          <Video className="w-4 h-4 text-[var(--an-text-dim)]" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[11px] font-medium text-[var(--an-text-muted)] truncate">Preview video</p>
          <p className="text-[10px] text-[var(--an-text-placeholder)]">{duration}s • Click to expand</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--an-text-placeholder)] shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)]">
      {/* Collapse button header */}
      <button
        onClick={() => setIsExpanded(false)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[var(--an-bg-elevated)] border-b border-[var(--an-border-input)] hover:bg-[var(--an-bg-hover)] transition-colors"
      >
        <span className="text-[10px] text-[var(--an-text-muted)] font-medium flex items-center gap-1.5">
          <Video className="w-3 h-3" />
          Preview video
        </span>
        <ChevronUp className="w-3 h-3 text-[var(--an-text-placeholder)]" />
      </button>

      {/* Video player with error handling */}
      {loadError || (isSandbox && !isActivePreview) ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
          <Video className="w-8 h-8 text-[var(--an-text-placeholder)] mb-2" />
          <p className="text-[11px] text-[var(--an-text-dim)] mb-1">Video unavailable</p>
          <p className="text-[10px] text-[var(--an-text-placeholder)]">
            {isSandbox ? 'Session expired — regenerate to create a new video' : 'Failed to load video'}
          </p>
        </div>
      ) : (
        <video
          src={videoUrl}
          controls
          className="w-full"
          style={{ maxHeight: '180px' }}
          onError={() => setLoadError(true)}
        />
      )}

      {/* Action buttons (only for active preview) */}
      {isActivePreview && onAccept && onRegenerate && (
        <div className="flex items-center gap-2 p-2">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-[#14532D] text-[#4ADE80] text-[11px] font-medium hover:bg-[#166534] transition-colors"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
          <button
            onClick={onRegenerate}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-[var(--an-bg-card)] text-[var(--an-text-muted)] text-[11px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Version History Thumbnails ───────────────────────────────────────

interface VersionHistoryProps {
  versions: AnimationVersion[];
  activeVersionId?: string;
  onSelectVersion: (version: AnimationVersion) => void;
}

export function VersionHistory({ versions, activeVersionId, onSelectVersion }: VersionHistoryProps) {
  if (versions.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1.5 px-1 py-2">
      <span className="text-[10px] font-medium text-[var(--an-text-dim)] uppercase tracking-wide">
        Versions ({versions.length})
      </span>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hidden">
        {versions.map((version, idx) => {
          const isActive = version.id === activeVersionId;
          return (
            <button
              key={version.id}
              onClick={() => onSelectVersion(version)}
              className={`relative shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${
                isActive
                  ? 'border-[var(--an-accent)] ring-1 ring-[var(--an-accent)]/30'
                  : 'border-[var(--an-border)] hover:border-[var(--an-border-input)]'
              }`}
              title={`Version ${idx + 1} - ${new Date(version.createdAt).toLocaleTimeString()}`}
            >
              {version.thumbnailUrl ? (
                <img
                  src={version.thumbnailUrl}
                  alt={`Version ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--an-bg-elevated)] flex items-center justify-center">
                  <Video className="w-4 h-4 text-[var(--an-text-placeholder)]" />
                </div>
              )}
              <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white bg-black/60 px-1 rounded">
                v{idx + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Streaming Placeholder (Shimmer) ──────────────────────────────────

interface StreamingPlaceholderProps {
  /** Name of the currently running tool (if any) */
  activeToolName?: string;
}

/** Maps tool names to user-friendly activity descriptions */
const TOOL_ACTIVITY_TEXT: Record<string, string> = {
  sandbox_create: 'Setting up workspace...',
  sandbox_write_file: 'Writing code...',
  sandbox_read_file: 'Reading file...',
  sandbox_run_command: 'Running command...',
  sandbox_list_files: 'Checking files...',
  sandbox_start_preview: 'Starting preview server...',
  sandbox_screenshot: 'Capturing screenshot...',
  generate_code: 'Generating code...',
  generate_plan: 'Creating animation plan...',
  analyze_prompt: 'Analyzing your request...',
  render_preview: 'Rendering preview...',
  render_final: 'Rendering final video...',
  update_todo: 'Updating progress...',
  set_thinking: 'Processing...',
};

export function StreamingPlaceholder({ activeToolName }: StreamingPlaceholderProps) {
  // Show tool activity or generic message (thinking label is already shown in ThinkingBlock)
  const text = activeToolName
    ? (TOOL_ACTIVITY_TEXT[activeToolName] || 'Processing...')
    : 'Working on it...';

  return (
    <div className="flex items-center gap-2">
      {/* Animated flower/bloom loader */}
      <div className="relative w-3 h-3 flex items-center justify-center">
        <span
          className="absolute w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"
          style={{ animation: 'bloom-center 1.5s ease-in-out infinite' }}
        />
        <span
          className="absolute w-1 h-1 rounded-full bg-[#A78BFA]"
          style={{ animation: 'bloom-petal 1.5s ease-in-out infinite', animationDelay: '0s' }}
        />
        <span
          className="absolute w-1 h-1 rounded-full bg-[#C4B5FD]"
          style={{ animation: 'bloom-petal 1.5s ease-in-out infinite', animationDelay: '0.3s' }}
        />
        <span
          className="absolute w-1 h-1 rounded-full bg-[#DDD6FE]"
          style={{ animation: 'bloom-petal 1.5s ease-in-out infinite', animationDelay: '0.6s' }}
        />
      </div>
      <p
        className="text-[11px] font-medium bg-clip-text text-transparent"
        style={{
          backgroundImage: 'linear-gradient(90deg, #52525B 0%, #A1A1AA 30%, #52525B 50%, #71717A 80%, #52525B 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer-text 2s ease-in-out infinite',
        }}
      >
        {text}
      </p>
    </div>
  );
}

// ─── Streaming Text ──────────────────────────────────────────────────

export function StreamingText({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-[var(--an-text-dim)] leading-[1.4] whitespace-pre-wrap">
      {text}
      <span className="inline-block w-[3px] h-[13px] bg-[var(--an-accent)] ml-0.5 animate-pulse rounded-sm align-middle" />
    </p>
  );
}

// ─── Retry Button ────────────────────────────────────────────────────

export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      onClick={onRetry}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--an-bg-card)] border border-[var(--an-border-input)] text-[var(--an-text-muted)] text-[11px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
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
    <div className="border-t border-b border-[var(--an-border)] px-3.5 py-2 space-y-1">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5"
      >
        <ListChecks
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: doneCount === todos.length ? '#22C55E' : '#A1A1AA' }}
        />
        <span className="text-[11px] font-semibold text-[var(--an-text-muted)]">
          Tasks ({doneCount}/{todos.length})
        </span>
        {collapsed ? (
          <ChevronDown className="w-3 h-3 text-[var(--an-text-placeholder)] ml-auto" />
        ) : (
          <ChevronUp className="w-3 h-3 text-[var(--an-text-placeholder)] ml-auto" />
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
                <Circle className="w-3 h-3 text-[var(--an-border-input)] flex-shrink-0" />
              )}
              <span
                className={`text-[10px] ${
                  todo.status === 'active'
                    ? 'text-[var(--an-text-secondary)] font-medium'
                    : todo.status === 'done'
                    ? 'text-[var(--an-text-placeholder)]'
                    : 'text-[var(--an-text-dim)]'
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
