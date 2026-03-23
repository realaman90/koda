'use client';

/**
 * MotionAnalyzerNode Component
 *
 * Video analysis + animation prompt generation through chat.
 * Matches the AnimationNode UI patterns (CSS variables, text sizes, bubbles).
 */

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { PluginNodeData } from '@/lib/types';
import { useCanvasStore } from '@/stores/canvas-store';
import {
  Eye,
  Upload,
  ArrowUp,
  Copy,
  Check,
  X,
  Loader2,
  Video,
  Sparkles,
  ChevronDown,
  RotateCcw,
  Scissors,
  Terminal,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  MotionAnalyzerNodeData,
  MotionAnalyzerNodeState,
  MotionAnalyzerMessage,
  ToolCallItem,
  ThinkingBlockItem,
  GeneratedPrompt,
  VideoInput,
} from './types';
import { TOOL_DISPLAY_NAMES } from './events';
import { useMotionAnalyzerStream } from './hooks';

// ─── Constants ──────────────────────────────────────────────────────────
const MAX_VIDEO_SIZE_MB = 50;
const MAX_ANALYSIS_DURATION = 20;

function createDefaultState(nodeId: string): MotionAnalyzerNodeState {
  return {
    nodeId,
    phase: 'idle',
    messages: [],
    toolCalls: [],
    thinkingBlocks: [],
    generatedPrompts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── UI tools hidden from timeline ──────────────────────────────────────
const UI_TOOLS = new Set(['set_thinking', 'add_message']);

// ─── Markdown components (matches AnimationNode) ────────────────────────
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
} as Record<string, React.ComponentType<Record<string, unknown>>>;

// ─── Sub-components ─────────────────────────────────────────────────────

/** User message — full-width, matches AnimationNode UserBubble */
function UserBubble({ content, videoName }: { content: string; videoName?: string }) {
  return (
    <div
      className="px-3 py-2.5 text-xs leading-[1.4] text-[var(--an-accent-text)] bg-[var(--an-bg-user-bubble)] w-full"
      style={{ borderRadius: '12px 4px 12px 12px' }}
    >
      {videoName && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Video className="w-3 h-3" />
          <span className="text-[10px] opacity-70">{videoName}</span>
        </div>
      )}
      {content}
    </div>
  );
}

/** Assistant text — no bubble, rendered as markdown (matches AnimationNode) */
function AssistantText({ content }: { content: string }) {
  return (
    <div className="animation-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{content}</ReactMarkdown>
    </div>
  );
}

/** Streaming text with cursor (matches AnimationNode) */
function StreamingText({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-[var(--an-text-dim)] leading-[1.4] whitespace-pre-wrap">
      {text}
      <span className="inline-block w-[3px] h-[13px] bg-[var(--an-accent)] ml-0.5 animate-pulse rounded-sm align-middle" />
    </p>
  );
}

/** Thinking block — matches AnimationNode ThinkingBlock */
function ThinkingBlockUI({
  label,
  reasoning,
  isActive,
  startedAt,
  endedAt,
}: {
  label: string;
  reasoning?: string;
  isActive: boolean;
  startedAt?: string;
  endedAt?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isActive && startedAt) {
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
  }, [isActive, startedAt, endedAt]);

  useEffect(() => {
    if (isActive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoning, isActive]);

  if (isActive) {
    return (
      <div className="w-full rounded-md bg-[var(--an-bg-elevated)] overflow-hidden">
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
            {label || 'Thinking'}
          </span>
          <span className="ml-auto text-[9px] text-[var(--an-border-input)] tabular-nums">{elapsed}s</span>
        </div>
        {reasoning && (
          <div ref={scrollRef} className="px-2.5 pb-2 overflow-y-auto scrollbar-hidden" style={{ maxHeight: '80px' }}>
            <p className="text-[10px] text-[#52525B] leading-[1.4] break-words">
              {reasoning}
              <span className="inline-block w-[3px] h-[11px] bg-[var(--an-accent)] ml-0.5 animate-pulse rounded-sm align-middle" />
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!reasoning && !label) return null;
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
      {expanded && (reasoning || label) && (
        <div className="px-2.5 py-2 bg-[var(--an-bg-elevated)] rounded-b-md overflow-y-auto scrollbar-hidden" style={{ maxHeight: '120px' }}>
          <p className="text-[10px] text-[#52525B] leading-[1.4] break-words">{reasoning || label}</p>
        </div>
      )}
    </div>
  );
}

/** Tool call card — matches AnimationNode ToolCallCard */
function ToolCallCard({ item }: { item: ToolCallItem }) {
  const displayName = TOOL_DISPLAY_NAMES[item.toolName] || item.toolName;
  const iconColor = item.status === 'failed' ? '#EF4444' : 'var(--an-accent)';

  return (
    <div className="w-full">
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--an-bg-elevated)]"
        style={{ borderRadius: '6px' }}
      >
        <Terminal className="w-3 h-3 shrink-0" style={{ color: iconColor }} />
        <span className="text-[11px] font-medium text-[var(--an-text-muted)]">{displayName}</span>
        <div className="ml-auto">
          {item.status === 'running' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--an-bg-user-bubble)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--an-accent)] animate-pulse" />
              <span className="text-[9px] font-medium text-[var(--an-accent-text)]">Running</span>
            </span>
          ) : item.status === 'done' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#14532D]">
              <Check className="w-2 h-2 text-[#4ADE80]" />
              <span className="text-[9px] font-medium text-[#4ADE80]">Done</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#3B1111]">
              <X className="w-2 h-2 text-[#EF4444]" />
              <span className="text-[9px] font-medium text-[#EF4444]">Failed</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Generated prompt card with copy button */
function PromptCard({ prompt, onCopy }: { prompt: GeneratedPrompt; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--an-text-muted)]">
          <Sparkles className="w-3 h-3 text-[var(--an-accent)]" />
          Generated Prompt
          {prompt.focusArea && <span className="text-[var(--an-text-placeholder)] font-normal">({prompt.focusArea})</span>}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[var(--an-bg-card)] text-[var(--an-text-muted)] hover:bg-[var(--an-bg-hover)] transition-colors"
        >
          {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="px-3 pb-2.5">
        <p className="text-xs text-[var(--an-text-muted)] leading-[1.5] whitespace-pre-wrap">{prompt.prompt}</p>
      </div>
    </div>
  );
}

/** Trim range picker for videos > 20s */
function TrimRangePicker({
  duration,
  trimStart,
  trimEnd,
  onChange,
}: {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onChange: (start: number, end: number) => void;
}) {
  const selectedDuration = trimEnd - trimStart;
  const isValid = selectedDuration > 0 && selectedDuration <= MAX_ANALYSIS_DURATION;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mx-3.5 mb-2 rounded-md bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Scissors className="w-3 h-3 text-[#FBBF24]" />
        <span className="text-[10px] font-medium text-[var(--an-text-muted)]">
          Video is {formatTime(duration)} — select a {MAX_ANALYSIS_DURATION}s segment
        </span>
      </div>

      {/* Range slider track */}
      <div className="relative h-5 mb-2">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--an-bg-card)]" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-1 rounded-full ${isValid ? 'bg-[var(--an-accent)]/60' : 'bg-[#EF4444]/60'}`}
          style={{
            left: `${(trimStart / duration) * 100}%`,
            width: `${((trimEnd - trimStart) / duration) * 100}%`,
          }}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={0.5}
          value={trimStart}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            const newEnd = Math.min(v + MAX_ANALYSIS_DURATION, duration);
            onChange(v, Math.max(newEnd, v + 1));
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
        />
      </div>

      {/* Time inputs */}
      <div className="flex items-center gap-2 text-[10px]">
        <div className="flex items-center gap-1">
          <label className="text-[var(--an-text-placeholder)]">Start:</label>
          <input
            type="number"
            min={0}
            max={Math.max(0, duration - 1)}
            step={0.5}
            value={trimStart}
            onChange={(e) => {
              const v = Math.max(0, parseFloat(e.target.value) || 0);
              const newEnd = Math.min(v + MAX_ANALYSIS_DURATION, duration);
              onChange(v, Math.max(newEnd, v + 1));
            }}
            className="w-12 px-1 py-0.5 rounded bg-[var(--an-bg-input)] border border-[var(--an-border-input)] text-[var(--an-text)] text-center"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[var(--an-text-placeholder)]">End:</label>
          <input
            type="number"
            min={trimStart + 1}
            max={Math.min(trimStart + MAX_ANALYSIS_DURATION, duration)}
            step={0.5}
            value={trimEnd}
            onChange={(e) => {
              const v = Math.min(duration, parseFloat(e.target.value) || trimEnd);
              onChange(trimStart, Math.max(v, trimStart + 1));
            }}
            className="w-12 px-1 py-0.5 rounded bg-[var(--an-bg-input)] border border-[var(--an-border-input)] text-[var(--an-text)] text-center"
          />
        </div>
        <span className={`ml-auto ${isValid ? 'text-[var(--an-accent)]' : 'text-[#EF4444]'}`}>
          {selectedDuration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

function MotionAnalyzerNodeComponent({ id, data, selected }: NodeProps<Node<PluginNodeData, 'pluginNode'>>) {
  const nodeData = data as unknown as MotionAnalyzerNodeData;
  const updateNodeData = useCanvasStore(s => s.updateNodeData);

  // Initialize state — merge with defaults so persisted partial state doesn't crash
  const defaults = createDefaultState(id);
  const state: MotionAnalyzerNodeState = nodeData.state
    ? { ...defaults, ...nodeData.state, messages: nodeData.state.messages ?? defaults.messages, toolCalls: nodeData.state.toolCalls ?? defaults.toolCalls, thinkingBlocks: nodeData.state.thinkingBlocks ?? defaults.thinkingBlocks, generatedPrompts: nodeData.state.generatedPrompts ?? defaults.generatedPrompts }
    : defaults;
  if (!nodeData.state) {
    updateNodeData(id, { state: defaults });
  }

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const seqRef = useRef(0);
  const streamingTextRef = useRef('');
  const reasoningTextRef = useRef('');
  const textFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local state
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Stream hook
  const { stream: streamToAgent, abort: abortStream } = useMotionAnalyzerStream();

  // ── Helpers ──────────────────────────────

  const updateState = useCallback((partial: Partial<MotionAnalyzerNodeState>) => {
    updateNodeData(id, {
      state: { ...state, ...partial, updatedAt: new Date().toISOString() },
    });
  }, [id, state, updateNodeData]);

  const getLatestState = useCallback((): MotionAnalyzerNodeState => {
    const freshNode = useCanvasStore.getState().nodes.find(n => n.id === id);
    const raw = (freshNode?.data as unknown as MotionAnalyzerNodeData)?.state;
    if (!raw) return state;
    return {
      ...raw,
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      toolCalls: Array.isArray(raw.toolCalls) ? raw.toolCalls : [],
      thinkingBlocks: Array.isArray(raw.thinkingBlocks) ? raw.thinkingBlocks : [],
      generatedPrompts: Array.isArray(raw.generatedPrompts) ? raw.generatedPrompts : [],
    };
  }, [id, state]);

  const nextSeq = useCallback(() => ++seqRef.current, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [state.messages, state.toolCalls, state.thinkingBlocks, state.generatedPrompts]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [inputValue]);

  // ── Flush streaming text ──────────────────

  const flushStreamingText = useCallback(() => {
    const text = streamingTextRef.current;
    const reasoning = reasoningTextRef.current;
    if (text || reasoning) {
      const ls = getLatestState();
      updateNodeData(id, {
        state: {
          ...ls,
          streamingText: text || undefined,
          reasoning: reasoning || undefined,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }, [id, getLatestState, updateNodeData]);

  const scheduleFlush = useCallback(() => {
    if (textFlushTimerRef.current) return;
    textFlushTimerRef.current = setTimeout(() => {
      textFlushTimerRef.current = null;
      flushStreamingText();
    }, 100);
  }, [flushStreamingText]);

  // ── Video upload ──────────────────────────

  const handleVideoUpload = useCallback(async (file: File) => {
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      updateState({
        error: { message: `Video too large. Max size is ${MAX_VIDEO_SIZE_MB}MB.`, canRetry: false },
        phase: 'error',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.onloadedmetadata = () => {
        const duration = videoEl.duration;
        const needsTrim = duration > MAX_ANALYSIS_DURATION;

        const video: VideoInput = {
          id: `vid_${Date.now()}`,
          source: 'upload',
          name: file.name,
          dataUrl,
          mimeType: file.type || 'video/mp4',
          duration,
          ...(needsTrim ? { trimStart: 0, trimEnd: MAX_ANALYSIS_DURATION } : {}),
        };
        updateNodeData(id, { video });
        URL.revokeObjectURL(videoEl.src);
      };
      videoEl.onerror = () => {
        const video: VideoInput = {
          id: `vid_${Date.now()}`,
          source: 'upload',
          name: file.name,
          dataUrl,
          mimeType: file.type || 'video/mp4',
        };
        updateNodeData(id, { video });
      };
      videoEl.src = URL.createObjectURL(file);
    };
    reader.readAsDataURL(file);
  }, [id, updateNodeData, updateState]);

  const handleRemoveVideo = useCallback(() => {
    updateNodeData(id, { video: undefined });
  }, [id, updateNodeData]);

  const handleTrimChange = useCallback((start: number, end: number) => {
    if (!nodeData.video) return;
    updateNodeData(id, {
      video: { ...nodeData.video, trimStart: start, trimEnd: end },
    });
  }, [id, nodeData.video, updateNodeData]);

  // ── Copy prompt ───────────────────────────

  const handleCopyPrompt = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // ── Send message ──────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    setInputValue('');
    setIsStreaming(true);
    abortRef.current = false;
    streamingTextRef.current = '';
    reasoningTextRef.current = '';

    const ls = getLatestState();
    // Defensive: ensure arrays exist even if store state is corrupted
    const currentMessages = Array.isArray(ls.messages) ? ls.messages : [];

    const userMsg: MotionAnalyzerMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      seq: nextSeq(),
      videoName: nodeData.video?.name,
    };

    const newMessages = [...currentMessages, userMsg];
    const newPhase = ls.phase === 'idle' ? 'analyzing' : ls.phase;

    updateNodeData(id, {
      state: {
        ...ls,
        messages: newMessages,
        phase: newPhase,
        error: undefined,
        streamingText: undefined,
        reasoning: undefined,
        updatedAt: new Date().toISOString(),
      },
    });

    const conversationMessages = newMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      await streamToAgent(conversationMessages, {
        nodeId: id,
        phase: newPhase,
        video: nodeData.video,
      }, {
        onTextDelta: (delta) => {
          streamingTextRef.current += delta;
          scheduleFlush();
        },

        onReasoningDelta: (delta) => {
          reasoningTextRef.current += delta;
          scheduleFlush();
        },

        onToolCall: (event) => {
          const ls2 = getLatestState();
          const toolCall: ToolCallItem = {
            id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            displayName: TOOL_DISPLAY_NAMES[event.toolName] || event.toolName,
            status: 'running',
            args: event.args,
            timestamp: new Date().toISOString(),
            seq: nextSeq(),
          };
          updateNodeData(id, {
            state: {
              ...ls2,
              toolCalls: [...ls2.toolCalls, toolCall],
              updatedAt: new Date().toISOString(),
            },
          });

          // Start a thinking block for non-UI tools
          if (!UI_TOOLS.has(event.toolName)) {
            const thinking: ThinkingBlockItem = {
              id: `tb_${Date.now()}`,
              label: TOOL_DISPLAY_NAMES[event.toolName] || event.toolName,
              startedAt: new Date().toISOString(),
              seq: nextSeq(),
            };
            const ls3 = getLatestState();
            updateNodeData(id, {
              state: {
                ...ls3,
                thinkingBlocks: [...ls3.thinkingBlocks, thinking],
                updatedAt: new Date().toISOString(),
              },
            });
          }
        },

        onToolResult: (event) => {
          const ls2 = getLatestState();

          const updatedToolCalls = ls2.toolCalls.map(tc =>
            tc.toolCallId === event.toolCallId
              ? { ...tc, status: (event.isError ? 'failed' : 'done') as 'done' | 'failed', output: JSON.stringify(event.result).slice(0, 500) }
              : tc
          );

          const updatedThinking = [...ls2.thinkingBlocks];
          const lastThinking = updatedThinking[updatedThinking.length - 1];
          if (lastThinking && !lastThinking.endedAt) {
            updatedThinking[updatedThinking.length - 1] = {
              ...lastThinking,
              endedAt: new Date().toISOString(),
              reasoning: reasoningTextRef.current || lastThinking.reasoning,
            };
          }

          const stateUpdate: Partial<MotionAnalyzerNodeState> = {
            toolCalls: updatedToolCalls,
            thinkingBlocks: updatedThinking,
            updatedAt: new Date().toISOString(),
          };

          if (event.toolName === 'analyze_video_motion' && !event.isError) {
            stateUpdate.analysis = event.result as any;
            stateUpdate.phase = 'chatting';
          }

          if (event.toolName === 'generate_animation_prompt' && !event.isError) {
            const newPrompt: GeneratedPrompt = {
              id: `prompt_${Date.now()}`,
              prompt: (event.result as any).prompt || '',
              focusArea: (event.result as any).focusArea,
              createdAt: new Date().toISOString(),
            };
            stateUpdate.generatedPrompts = [...ls2.generatedPrompts, newPrompt];
          }

          updateNodeData(id, { state: { ...ls2, ...stateUpdate } });
          reasoningTextRef.current = '';
        },

        onComplete: () => {
          flushStreamingText();
          const ls2 = getLatestState();
          const streamedText = streamingTextRef.current.trim();

          const finalState: Partial<MotionAnalyzerNodeState> = {
            streamingText: undefined,
            reasoning: undefined,
            phase: ls2.phase === 'analyzing' ? 'chatting' : ls2.phase,
            updatedAt: new Date().toISOString(),
          };

          if (streamedText) {
            const assistantMsg: MotionAnalyzerMessage = {
              id: `msg_${Date.now()}`,
              role: 'assistant',
              content: streamedText,
              timestamp: new Date().toISOString(),
              seq: nextSeq(),
            };
            finalState.messages = [...ls2.messages, assistantMsg];
          }

          updateNodeData(id, { state: { ...ls2, ...finalState } });
          streamingTextRef.current = '';
          reasoningTextRef.current = '';
          setIsStreaming(false);
        },

        onError: (error) => {
          const ls2 = getLatestState();
          updateNodeData(id, {
            state: {
              ...ls2,
              error: { message: error, canRetry: true },
              phase: 'error',
              streamingText: undefined,
              updatedAt: new Date().toISOString(),
            },
          });
          setIsStreaming(false);
        },
      });
    } catch (err) {
      console.error('[MotionAnalyzerNode] handleSend error:', err);
      setIsStreaming(false);
    }
  }, [id, inputValue, isStreaming, nodeData.video, getLatestState, updateNodeData, streamToAgent, nextSeq, scheduleFlush, flushStreamingText]);

  // ── Reset ─────────────────────────────────

  const handleReset = useCallback(() => {
    abortStream();
    setIsStreaming(false);
    streamingTextRef.current = '';
    reasoningTextRef.current = '';
    updateNodeData(id, {
      state: createDefaultState(id),
      video: undefined,
    });
  }, [id, abortStream, updateNodeData]);

  // ── Build timeline ────────────────────────

  type TimelineItem =
    | { kind: 'user'; id: string; content: string; seq: number; videoName?: string }
    | { kind: 'assistant'; id: string; content: string; seq: number }
    | { kind: 'tool'; id: string; seq: number; item: ToolCallItem }
    | { kind: 'thinking'; id: string; seq: number; item: ThinkingBlockItem }
    | { kind: 'prompt'; id: string; seq: number; item: GeneratedPrompt };

  const timeline: TimelineItem[] = [];

  state.messages.forEach(m => {
    if (m.role === 'user') {
      timeline.push({ kind: 'user', id: m.id, content: m.content, seq: m.seq || 0, videoName: m.videoName });
    } else {
      timeline.push({ kind: 'assistant', id: m.id, content: m.content, seq: m.seq || 0 });
    }
  });
  // Only show non-UI tool calls
  state.toolCalls.filter(tc => !UI_TOOLS.has(tc.toolName)).forEach(tc => {
    timeline.push({ kind: 'tool', id: tc.id, seq: tc.seq || 0, item: tc });
  });
  state.thinkingBlocks.forEach(tb => {
    timeline.push({ kind: 'thinking', id: tb.id, seq: tb.seq || 0, item: tb });
  });
  state.generatedPrompts.forEach(p => {
    timeline.push({ kind: 'prompt', id: p.id, seq: Date.parse(p.createdAt), item: p });
  });

  timeline.sort((a, b) => a.seq - b.seq);

  const hasVideo = !!nodeData.video?.dataUrl;
  const isIdle = state.phase === 'idle';
  const hasTimelineContent = timeline.length > 0 || isStreaming;
  const canSend = inputValue.trim().length > 0 && !isStreaming;

  // ── Container class ───────────────────────
  const base = 'animation-node w-[400px] rounded-xl overflow-hidden flex flex-col';
  const containerClass = selected ? `${base} ring-1 ring-[var(--an-accent)]/70` : base;

  return (
    <div className={containerClass} style={{ minHeight: '200px', maxHeight: '720px' }}>
      {/* ── Header ── */}
      <div className="drag-handle cursor-grab active:cursor-grabbing flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 border-b border-[var(--an-border)]">
        <div className="h-7 w-7 rounded-[7px] bg-[var(--an-accent-bg)] flex items-center justify-center">
          <Eye className="w-3.5 h-3.5" style={{ color: 'var(--an-accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--an-text-heading)] leading-tight truncate">
            {nodeData.name || 'Motion Analyzer'}
          </h3>
          <p className="text-[10px] leading-tight" style={{ color: 'var(--an-text-placeholder)' }}>
            {state.phase === 'idle' && 'Upload a video to analyze'}
            {state.phase === 'analyzing' && 'Analyzing motion...'}
            {state.phase === 'chatting' && 'Chat to refine prompts'}
            {state.phase === 'complete' && 'Analysis complete'}
            {state.phase === 'error' && 'Error occurred'}
          </p>
        </div>
        {(state.phase !== 'idle' || hasVideo) && (
          <button
            onClick={handleReset}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] hover:bg-[var(--an-bg-hover)] transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Video Upload Area ── */}
      {!hasVideo && isIdle && (
        <div className="p-3.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/mov"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideoUpload(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-28 rounded-lg border-2 border-dashed border-[var(--an-border-input)] hover:border-[var(--an-accent)]/50 bg-[var(--an-bg-elevated)] hover:bg-[var(--an-accent-bg)]/30 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith('video/')) handleVideoUpload(file);
            }}
          >
            <Upload className="w-5 h-5 text-[var(--an-text-placeholder)] group-hover:text-[var(--an-accent)] transition-colors" />
            <span className="text-[11px] text-[var(--an-text-placeholder)] group-hover:text-[var(--an-text-dim)]">
              Drop video or click to upload
            </span>
            <span className="text-[10px] text-[var(--an-text-placeholder)]">
              MP4, WebM, MOV — max {MAX_VIDEO_SIZE_MB}MB
            </span>
          </button>
        </div>
      )}

      {/* ── Video Preview ── */}
      {hasVideo && (
        <div className="px-3.5 pt-2.5 pb-1">
          <div className="relative rounded-lg overflow-hidden bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)]">
            <video
              src={nodeData.video!.dataUrl}
              className="w-full"
              style={{ maxHeight: '140px' }}
              controls
              muted
            />
            <button
              onClick={handleRemoveVideo}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-black/80 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-zinc-300">
              {nodeData.video!.name}
            </div>
          </div>
        </div>
      )}

      {/* ── Trim Range Picker ── */}
      {hasVideo && nodeData.video!.duration && nodeData.video!.duration > MAX_ANALYSIS_DURATION && (
        <TrimRangePicker
          duration={nodeData.video!.duration}
          trimStart={nodeData.video!.trimStart ?? 0}
          trimEnd={nodeData.video!.trimEnd ?? MAX_ANALYSIS_DURATION}
          onChange={handleTrimChange}
        />
      )}

      {/* ── Chat Timeline ── */}
      {hasTimelineContent && (
        <div
          ref={chatScrollRef}
          className="nowheel nopan nodrag cursor-text select-text flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="px-3.5 py-2.5 space-y-2.5">
            {timeline.map((entry) => {
              switch (entry.kind) {
                case 'user':
                  return <UserBubble key={entry.id} content={entry.content} videoName={entry.videoName} />;
                case 'assistant':
                  return <AssistantText key={entry.id} content={entry.content} />;
                case 'tool':
                  return <ToolCallCard key={entry.id} item={entry.item} />;
                case 'thinking':
                  return (
                    <ThinkingBlockUI
                      key={entry.id}
                      label={entry.item.label}
                      reasoning={entry.item.reasoning}
                      isActive={!entry.item.endedAt && isStreaming}
                      startedAt={entry.item.startedAt}
                      endedAt={entry.item.endedAt}
                    />
                  );
                case 'prompt':
                  return <PromptCard key={entry.id} prompt={entry.item} onCopy={handleCopyPrompt} />;
                default:
                  return null;
              }
            })}

            {/* Streaming text */}
            {isStreaming && state.streamingText && (
              <StreamingText text={state.streamingText} />
            )}

            {/* Error */}
            {state.error && (
              <div className="rounded-md bg-[var(--an-bg-error)] border border-[var(--an-border-error)] px-2.5 py-2">
                <p className="text-[11px] text-[#EF4444]">{state.error.message}</p>
                {state.error.canRetry && (
                  <button
                    onClick={handleReset}
                    className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--an-bg-card)] border border-[var(--an-border-input)] text-[var(--an-text-muted)] text-[10px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="shrink-0 nopan nodrag nowheel px-3 pt-2 pb-2.5 border-t border-[var(--an-border)]">
        <div className="rounded-[10px] border border-[var(--an-border-input)] overflow-hidden" style={{ backgroundColor: 'var(--an-bg-card)' }}>
          <div className="px-3 pt-2.5 pb-1.5">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                !hasVideo
                  ? 'Upload a video first...'
                  : state.phase === 'idle'
                  ? 'Describe what you want to analyze...'
                  : 'Ask about effects, or request a prompt...'
              }
              rows={1}
              className="w-full resize-none text-[13px] text-[var(--an-text)] outline-none leading-[1.4]"
              style={{ minHeight: '20px', maxHeight: '100px', backgroundColor: 'transparent' }}
            />
          </div>
          <div className="flex items-center justify-end px-2 py-1 pb-2">
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                canSend
                  ? 'bg-[var(--an-accent)] hover:bg-[var(--an-accent-hover)]'
                  : 'bg-[var(--an-accent)] opacity-40 cursor-not-allowed'
              }`}
            >
              {isStreaming ? (
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Output Handle ── */}
      <Handle
        type="source"
        position={Position.Right}
        id="prompt-output"
        className="!w-3 !h-3 !bg-[var(--an-accent)] !border-2 !border-[var(--an-bg)]"
        style={{ top: '50%' }}
      />
    </div>
  );
}

export const MotionAnalyzerNode = memo(MotionAnalyzerNodeComponent);
