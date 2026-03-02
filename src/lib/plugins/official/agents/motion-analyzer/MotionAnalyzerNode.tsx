'use client';

/**
 * MotionAnalyzerNode Component
 *
 * Video analysis + animation prompt generation through chat.
 * Matches the AnimationNode UI patterns (CSS variables, text sizes, bubbles).
 */

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
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
  RotateCcw,
  Scissors,
  Square,
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
  MotionAnalysis,
  VideoInput,
} from './types';
import { TOOL_DISPLAY_NAMES } from './events';
import { useMotionAnalyzerStream } from './hooks';
import { uploadVideoViaPresigned, uploadAsset } from '@/lib/assets/upload';
import { cacheMediaData, getCached, loadFromDB } from '../animation-generator/media-cache';

// ─── Constants ──────────────────────────────────────────────────────────
const MAX_VIDEO_SIZE_MB = 50;
const MAX_ANALYSIS_DURATION = 20;
const NEXT_SEGMENT_RE = /\bnext(?:\s+(\d{1,3}))?(?:\s*(?:s|sec|secs|second|seconds))?\b/i;
const ANALYZE_INTENT_RE = /\b(next|continue|reanaly[sz]e|analy[sz]e|segment|part|timestamp|window)\b/i;

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

function resolveSegmentRequest(video: VideoInput | undefined, text: string): {
  video: VideoInput | undefined;
  advanced: boolean;
  atEnd: boolean;
} {
  if (!video?.duration || video.duration <= MAX_ANALYSIS_DURATION) {
    return { video, advanced: false, atEnd: false };
  }

  const match = text.match(NEXT_SEGMENT_RE);
  if (!match) {
    return { video, advanced: false, atEnd: false };
  }

  const duration = video.duration;
  const currentStart = video.trimStart ?? 0;
  const currentEnd = video.trimEnd ?? Math.min(duration, MAX_ANALYSIS_DURATION);
  const currentSpan = Math.max(1, currentEnd - currentStart);
  const requestedSpan = match[1] ? Number(match[1]) : currentSpan;
  const span = Math.max(1, Math.min(MAX_ANALYSIS_DURATION, Number.isFinite(requestedSpan) ? requestedSpan : MAX_ANALYSIS_DURATION));

  const nextStart = Number(currentEnd.toFixed(3));
  if (nextStart >= duration - 0.05) {
    return { video, advanced: false, atEnd: true };
  }

  const nextEnd = Math.min(duration, nextStart + span);
  if (nextEnd - nextStart < 1) {
    return { video, advanced: false, atEnd: true };
  }

  return {
    video: {
      ...video,
      trimStart: nextStart,
      trimEnd: nextEnd,
    },
    advanced: true,
    atEnd: false,
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

/** Analysis card — surfaces selected segment breakdown directly in timeline */
function AnalysisCard({ analysis }: { analysis: MotionAnalysis }) {
  const scenes = Array.isArray(analysis.scenes) ? analysis.scenes : [];
  const effects = Array.isArray(analysis.effects) ? analysis.effects : [];
  const topScenes = scenes.slice(0, 3);
  const topEffects = effects.slice(0, 4);

  return (
    <div className="w-full rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--an-border-input)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-[var(--an-text-muted)]">Analysis Result</p>
          <span className="text-[10px] text-[var(--an-text-placeholder)]">
            {analysis.duration > 0 ? `${analysis.duration.toFixed(1)}s video` : 'Video analyzed'}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[var(--an-text-muted)] leading-[1.45]">{analysis.summary}</p>
      </div>

      <div className="px-3 py-2.5 space-y-2">
        {topScenes.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-[var(--an-text-dim)]">Scenes</p>
            {topScenes.map((scene) => (
              <p key={`${scene.number}-${scene.startTime}-${scene.endTime}`} className="text-[10px] text-[var(--an-text-muted)] leading-[1.45]">
                {scene.startTime.toFixed(1)}s-{scene.endTime.toFixed(1)}s: {scene.description}
              </p>
            ))}
          </div>
        )}

        {topEffects.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-[var(--an-text-dim)]">Key Effects</p>
            {topEffects.map((effect, index) => (
              <p key={`${effect.name}-${effect.timestamp ?? -1}-${index}`} className="text-[10px] text-[var(--an-text-muted)] leading-[1.45]">
                {effect.timestamp !== undefined ? `${effect.timestamp.toFixed(1)}s` : 'Timing n/a'}: {effect.name}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeAnalysisResult(result: Record<string, unknown>): MotionAnalysis {
  return {
    summary: typeof result.summary === 'string' ? result.summary : '',
    duration: typeof result.duration === 'number' ? result.duration : 0,
    scenes: Array.isArray(result.scenes) ? result.scenes as MotionAnalysis['scenes'] : [],
    effects: Array.isArray(result.effects) ? result.effects as MotionAnalysis['effects'] : [],
    cameraMovements: Array.isArray(result.cameraMovements) ? result.cameraMovements as string[] : [],
    transitions: Array.isArray(result.transitions) ? result.transitions as string[] : [],
    pacing: typeof result.pacing === 'string' ? result.pacing : '',
    overallStyle: typeof result.overallStyle === 'string' ? result.overallStyle : '',
  };
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
  const isValid = selectedDuration >= 1 && selectedDuration <= MAX_ANALYSIS_DURATION;

  const clampRange = (start: number, end: number) => {
    const clampedStart = Math.max(0, Math.min(start, Math.max(0, duration - 1)));
    const clampedEnd = Math.min(duration, Math.max(end, clampedStart + 1));
    const span = clampedEnd - clampedStart;

    if (span > MAX_ANALYSIS_DURATION) {
      return [clampedStart, Math.min(duration, clampedStart + MAX_ANALYSIS_DURATION)] as const;
    }

    return [clampedStart, clampedEnd] as const;
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const percentStart = (trimStart / duration) * 100;
  const percentEnd = (trimEnd / duration) * 100;

  return (
    <div className="mx-3.5 mb-2 rounded-md bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Scissors className="w-3 h-3 text-[#FBBF24]" />
        <span className="text-[10px] font-medium text-[var(--an-text-muted)]">
          Video is {formatTime(duration)} — select a 1s to {MAX_ANALYSIS_DURATION}s segment
        </span>
      </div>

      <div className="relative h-6 mb-2">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--an-bg-card)]" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-1 rounded-full ${isValid ? 'bg-[var(--an-accent)]/60' : 'bg-[#EF4444]/60'}`}
          style={{ left: `${percentStart}%`, width: `${Math.max(0, percentEnd - percentStart)}%` }}
        />

        <input
          type="range"
          min={0}
          max={duration}
          step={0.5}
          value={trimStart}
          onChange={(e) => {
            const [start, end] = clampRange(parseFloat(e.target.value), trimEnd);
            onChange(start, end);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 3 }}
          aria-label="Trim start"
        />

        <input
          type="range"
          min={0}
          max={duration}
          step={0.5}
          value={trimEnd}
          onChange={(e) => {
            const [start, end] = clampRange(trimStart, parseFloat(e.target.value));
            onChange(start, end);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
          aria-label="Trim end"
        />
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <div className="flex items-center gap-1">
          <label className="text-[var(--an-text-placeholder)]" htmlFor="trim-start">Start:</label>
          <input
            id="trim-start"
            type="number"
            min={0}
            max={Math.max(0, duration - 1)}
            step={0.5}
            value={trimStart}
            onChange={(e) => {
              const [start, end] = clampRange(parseFloat(e.target.value) || 0, trimEnd);
              onChange(start, end);
            }}
            className="w-14 px-1 py-0.5 rounded bg-[var(--an-bg-input)] border border-[var(--an-border-input)] text-[var(--an-text)] text-center"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[var(--an-text-placeholder)]" htmlFor="trim-end">End:</label>
          <input
            id="trim-end"
            type="number"
            min={trimStart + 1}
            max={Math.min(duration, trimStart + MAX_ANALYSIS_DURATION)}
            step={0.5}
            value={trimEnd}
            onChange={(e) => {
              const [start, end] = clampRange(trimStart, parseFloat(e.target.value) || trimEnd);
              onChange(start, end);
            }}
            className="w-14 px-1 py-0.5 rounded bg-[var(--an-bg-input)] border border-[var(--an-border-input)] text-[var(--an-text)] text-center"
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
  const isReadOnly = useCanvasStore(s => s.isReadOnly);

  // Rename state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(nodeData.name || 'Motion Analyzer');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    if (nodeName.trim() && nodeName !== (nodeData.name || 'Motion Analyzer')) {
      updateNodeData(id, { name: nodeName.trim() });
    }
  }, [id, nodeName, nodeData.name, updateNodeData]);

  // Initialize state — merge with defaults so persisted partial state doesn't crash
  const defaults = useMemo(() => createDefaultState(id), [id]);
  const state: MotionAnalyzerNodeState = nodeData.state
    ? { ...defaults, ...nodeData.state, messages: nodeData.state.messages ?? defaults.messages, toolCalls: nodeData.state.toolCalls ?? defaults.toolCalls, thinkingBlocks: nodeData.state.thinkingBlocks ?? defaults.thinkingBlocks, generatedPrompts: nodeData.state.generatedPrompts ?? defaults.generatedPrompts }
    : defaults;
  useEffect(() => {
    if (!nodeData.state) {
      updateNodeData(id, { state: defaults });
    }
  }, [defaults, id, nodeData.state, updateNodeData]);

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const seqRef = useRef(0);
  const streamingTextRef = useRef('');
  const reasoningTextRef = useRef('');
  const textFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobPreviewUrlRef = useRef<string | null>(null);

  // Local state
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const [streamElapsed, setStreamElapsed] = useState(0);
  const [cachedVideoSrc, setCachedVideoSrc] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isStreaming || !streamStartedAt) return;
    setStreamElapsed(Math.max(0, Math.round((Date.now() - streamStartedAt) / 1000)));
    const timer = setInterval(() => {
      setStreamElapsed(Math.max(0, Math.round((Date.now() - streamStartedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [isStreaming, streamStartedAt]);

  useEffect(() => () => {
    if (blobPreviewUrlRef.current) {
      URL.revokeObjectURL(blobPreviewUrlRef.current);
      blobPreviewUrlRef.current = null;
    }
  }, []);

  // Hydrate cached video payloads after refresh (dataUrl = "cached:<id>").
  useEffect(() => {
    const v = nodeData.video;
    if (!v?.dataUrl?.startsWith('cached:')) {
      setCachedVideoSrc(null);
      return;
    }

    const cached = getCached(v.id);
    if (cached) {
      setCachedVideoSrc(cached);
      return;
    }

    let cancelled = false;
    loadFromDB(v.id).then((loaded) => {
      if (!cancelled) setCachedVideoSrc(loaded || null);
    }).catch(() => {
      if (!cancelled) setCachedVideoSrc(null);
    });
    return () => {
      cancelled = true;
    };
  }, [nodeData.video]);

  // Repair persisted videos after refresh:
  // If dataUrl is transient/missing but remoteUrl exists, use remoteUrl for playback.
  useEffect(() => {
    const v = nodeData.video;
    if (!v?.remoteUrl) return;
    const dataUrl = typeof v.dataUrl === 'string' ? v.dataUrl : '';
    const needsRepair = !dataUrl || dataUrl.startsWith('blob:') || dataUrl.startsWith('data:');
    if (!needsRepair) return;
    updateNodeData(id, { video: { ...v, dataUrl: v.remoteUrl } });
  }, [id, nodeData.video, updateNodeData]);

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

  // Track presigned upload state
  const [isUploading, setIsUploading] = useState(false);

  const handleVideoUpload = useCallback(async (file: File) => {
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      updateState({
        error: { message: `Video too large. Max size is ${MAX_VIDEO_SIZE_MB}MB.`, canRetry: false },
        phase: 'error',
      });
      return;
    }

    // Create a blob URL for instant local preview (doesn't bloat memory like data URL)
    if (blobPreviewUrlRef.current) {
      URL.revokeObjectURL(blobPreviewUrlRef.current);
      blobPreviewUrlRef.current = null;
    }
    const blobUrl = URL.createObjectURL(file);
    blobPreviewUrlRef.current = blobUrl;

    // Get video metadata (don't revoke the blob URL here — it's shared with the preview element.
    // Cleanup happens in handleRemoveVideo or when a new video is uploaded.)
    const duration = await new Promise<number | undefined>((resolve) => {
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.onloadedmetadata = () => resolve(videoEl.duration);
      videoEl.onerror = () => resolve(undefined);
      videoEl.src = blobUrl;
    });

    const needsTrim = duration !== undefined && duration > MAX_ANALYSIS_DURATION;

    // Set video immediately with blob URL for preview
    const video: VideoInput = {
      id: `vid_${Date.now()}`,
      source: 'upload',
      name: file.name,
      dataUrl: blobUrl,
      mimeType: file.type || 'video/mp4',
      duration,
      ...(needsTrim ? { trimStart: 0, trimEnd: MAX_ANALYSIS_DURATION } : {}),
    };
    updateNodeData(id, { video });
    setCachedVideoSrc(null);
    setTimeout(() => textareaRef.current?.focus(), 0);

    // Cache file data in IndexedDB for refresh resilience when durable upload is unavailable.
    try {
      const localDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const cachedRef = cacheMediaData(video.id, localDataUrl);
      const freshNode = useCanvasStore.getState().nodes.find(n => n.id === id);
      const freshVideo = (freshNode?.data as unknown as MotionAnalyzerNodeData)?.video;
      if (freshVideo && !freshVideo.remoteUrl && typeof freshVideo.dataUrl === 'string' && freshVideo.dataUrl.startsWith('blob:')) {
        updateNodeData(id, { video: { ...freshVideo, dataUrl: cachedRef } });
      }
    } catch (cacheErr) {
      console.warn('[MotionAnalyzerNode] Could not cache video in IndexedDB:', cacheErr);
    }

    // Attempt durable upload in background so the node survives refresh:
    // 1) presigned R2/S3 (preferred), 2) /api/assets/upload fallback.
    setIsUploading(true);
    try {
      let durableUrl: string | undefined;

      const presignedResult = await uploadVideoViaPresigned(file);
      if (presignedResult?.url) {
        durableUrl = presignedResult.url;
        console.log('[MotionAnalyzerNode] Video uploaded via presigned URL:', durableUrl);
      } else {
        try {
          const uploaded = await uploadAsset(file, { nodeId: id });
          durableUrl = uploaded.url;
          console.log('[MotionAnalyzerNode] Video uploaded via /api/assets/upload:', durableUrl);
        } catch (fallbackErr) {
          console.warn('[MotionAnalyzerNode] Fallback asset upload failed:', fallbackErr);
        }
      }

      if (durableUrl) {
        const freshNode = useCanvasStore.getState().nodes.find(n => n.id === id);
        const freshVideo = (freshNode?.data as unknown as MotionAnalyzerNodeData)?.video;
        if (freshVideo) {
          updateNodeData(id, {
            video: {
              ...freshVideo,
              dataUrl: durableUrl,
              remoteUrl: durableUrl,
            },
          });
        }
      } else {
        // Keep blob preview only — analysis still works in-session but won't survive refresh.
        console.log('[MotionAnalyzerNode] No durable upload available; video is session-only.');
      }
    } catch (err) {
      console.warn('[MotionAnalyzerNode] Durable upload failed, video remains session-only:', err);
    } finally {
      setIsUploading(false);
    }
  }, [id, updateNodeData, updateState]);

  const handleRemoveVideo = useCallback(() => {
    if (blobPreviewUrlRef.current) {
      URL.revokeObjectURL(blobPreviewUrlRef.current);
      blobPreviewUrlRef.current = null;
    }
    updateNodeData(id, { video: undefined });
    setCachedVideoSrc(null);
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

    const ls = getLatestState();
    const currentMessages = Array.isArray(ls.messages) ? ls.messages : [];
    const segmentRequest = resolveSegmentRequest(nodeData.video, text);
    const effectiveVideo = segmentRequest.video;
    const isSegmentAdvanceRequest = NEXT_SEGMENT_RE.test(text);

    const baseUserMsg: MotionAnalyzerMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      seq: nextSeq(),
      videoName: nodeData.video?.name,
    };

    if (segmentRequest.atEnd && isSegmentAdvanceRequest) {
      const assistantMsg: MotionAnalyzerMessage = {
        id: `msg_${Date.now()}_end`,
        role: 'assistant',
        content: 'Reached the end of the video. Move the trim range above, then run analysis again.',
        timestamp: new Date().toISOString(),
        seq: nextSeq(),
      };

      updateNodeData(id, {
        state: {
          ...ls,
          messages: [...currentMessages, baseUserMsg, assistantMsg],
          phase: 'chatting',
          updatedAt: new Date().toISOString(),
        },
      });
      setInputValue('');
      return;
    }

    setInputValue('');
    setIsStreaming(true);
    setStreamStartedAt(Date.now());
    setStreamElapsed(0);
    abortRef.current = false;
    streamingTextRef.current = '';
    reasoningTextRef.current = '';

    const newMessages = [...currentMessages, baseUserMsg];
    const shouldAnalyze = ls.phase === 'idle' || segmentRequest.advanced || ANALYZE_INTENT_RE.test(text);
    const newPhase = shouldAnalyze ? 'analyzing' : ls.phase;

    updateNodeData(id, {
      ...(segmentRequest.advanced && effectiveVideo ? { video: effectiveVideo } : {}),
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
        video: effectiveVideo,
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
            const analysisResult = normalizeAnalysisResult(event.result);
            stateUpdate.analysis = analysisResult;
            // Only add analysis card when we actually have analysis payload.
            if (analysisResult.summary || analysisResult.scenes.length > 0 || analysisResult.effects.length > 0) {
              stateUpdate.analysisSeq = nextSeq();
            }
            stateUpdate.phase = 'chatting';
          }

          if (event.toolName === 'generate_animation_prompt' && !event.isError) {
            const promptResult = event.result as { prompt?: string; focusArea?: string };
            const newPrompt: GeneratedPrompt = {
              id: `prompt_${Date.now()}`,
              prompt: promptResult.prompt || '',
              focusArea: promptResult.focusArea,
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
          setStreamStartedAt(null);
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
          setStreamStartedAt(null);
        },
      });
    } catch (err) {
      console.error('[MotionAnalyzerNode] handleSend error:', err);
      setIsStreaming(false);
      setStreamStartedAt(null);
    }
  }, [id, inputValue, isStreaming, nodeData.video, getLatestState, updateNodeData, streamToAgent, nextSeq, scheduleFlush, flushStreamingText]);

  const handleStopStream = useCallback(() => {
    flushStreamingText();
    abortRef.current = true;
    abortStream();
    setIsStreaming(false);
    setStreamStartedAt(null);

    const ls = getLatestState();
    updateNodeData(id, {
      state: {
        ...ls,
        phase: ls.phase === 'analyzing' ? 'chatting' : ls.phase,
        updatedAt: new Date().toISOString(),
      },
    });
  }, [abortStream, flushStreamingText, getLatestState, id, updateNodeData]);

  // ── Reset ─────────────────────────────────

  const handleReset = useCallback(() => {
    abortStream();
    setIsStreaming(false);
    setStreamStartedAt(null);
    streamingTextRef.current = '';
    reasoningTextRef.current = '';
    if (blobPreviewUrlRef.current) {
      URL.revokeObjectURL(blobPreviewUrlRef.current);
      blobPreviewUrlRef.current = null;
    }
    updateNodeData(id, {
      state: createDefaultState(id),
      video: undefined,
    });
  }, [id, abortStream, updateNodeData]);

  // ── Build timeline ────────────────────────

  type TimelineItem =
    | { kind: 'user'; id: string; content: string; seq: number; videoName?: string }
    | { kind: 'assistant'; id: string; content: string; seq: number }
    | { kind: 'analysis'; id: string; seq: number; item: MotionAnalysis }
    | { kind: 'prompt'; id: string; seq: number; item: GeneratedPrompt };

  const timeline: TimelineItem[] = [];

  state.messages.forEach(m => {
    if (m.role === 'user') {
      timeline.push({ kind: 'user', id: m.id, content: m.content, seq: m.seq || 0, videoName: m.videoName });
    } else {
      timeline.push({ kind: 'assistant', id: m.id, content: m.content, seq: m.seq || 0 });
    }
  });
  if (state.analysis && typeof state.analysisSeq === 'number') {
    timeline.push({ kind: 'analysis', id: 'analysis_result', seq: state.analysisSeq, item: state.analysis });
  }
  state.generatedPrompts.forEach(p => {
    timeline.push({ kind: 'prompt', id: p.id, seq: Date.parse(p.createdAt), item: p });
  });

  timeline.sort((a, b) => a.seq - b.seq);

  const resolvedCachedVideoUrl = nodeData.video?.dataUrl?.startsWith('cached:')
    ? (cachedVideoSrc || getCached(nodeData.video.id))
    : undefined;
  const videoPreviewUrl = resolvedCachedVideoUrl || nodeData.video?.dataUrl || nodeData.video?.remoteUrl;
  const hasLocalCachedVideo = !!nodeData.video?.dataUrl?.startsWith('cached:');
  const hasVideo = !!nodeData.video;
  const isIdle = state.phase === 'idle';
  const hasTimelineContent = timeline.length > 0 || isStreaming;
  const canSend = inputValue.trim().length > 0 && !isStreaming && (hasVideo || state.phase !== 'idle');
  const liveStatus = isStreaming
    ? `Analyzing in progress. Elapsed ${streamElapsed} seconds.`
    : state.error
      ? `Analysis error: ${state.error.message}`
      : hasVideo
        ? 'Video ready. You can analyze or ask follow-up questions.'
        : 'Upload a video to begin analysis.';

  // ── Container class ───────────────────────
  const base = 'animation-node w-[400px] rounded-xl overflow-hidden flex flex-col';
  const containerClass = selected ? `${base} ring-1 ring-[var(--an-accent)]/70` : base;

  return (
    <div>
      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-motion)' }}>
        <Eye className="h-4 w-4" />
        {isEditingName && !isReadOnly ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNodeName(nodeData.name || 'Motion Analyzer');
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b outline-none px-0.5 min-w-[100px]"
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)' }}
          />
        ) : (
          <span
            onDoubleClick={() => !isReadOnly && setIsEditingName(true)}
            className={`transition-colors hover:opacity-80 ${isReadOnly ? 'cursor-default' : 'cursor-text'}`}
          >
            {nodeData.name || 'Motion Analyzer'}
          </span>
        )}
      </div>

    <div className={containerClass} style={{ minHeight: '200px', maxHeight: '720px' }}>
      {/* ── Header ── */}
      <div className="drag-handle cursor-grab active:cursor-grabbing flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 border-b border-[var(--an-border)]">
        <div className="flex-1 min-w-0">
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
            aria-label="Reset analysis"
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
            aria-label="Upload video for motion analysis"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideoUpload(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload video"
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
              src={videoPreviewUrl}
              className="w-full"
              style={{ maxHeight: '140px' }}
              controls
              muted
            />
            <button
              onClick={handleRemoveVideo}
              aria-label="Remove uploaded video"
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-black/80 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-zinc-300">
              {isUploading && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {nodeData.video!.name}
              {nodeData.video!.remoteUrl && !isUploading && (
                <span className="text-[#4ADE80]" title="Uploaded to cloud">&#x2713;</span>
              )}
              {!nodeData.video!.remoteUrl && hasLocalCachedVideo && !isUploading && (
                <span className="text-[#22D3EE]" title="Persisted locally">Local</span>
              )}
              {!nodeData.video!.remoteUrl && !hasLocalCachedVideo && !isUploading && (
                <span className="text-[#FBBF24]" title="Session only, re-upload needed after refresh">Session only</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Trim Range Picker ── */}
      {hasVideo && nodeData.video!.duration && nodeData.video!.duration > MAX_ANALYSIS_DURATION && (
        <>
          <TrimRangePicker
            duration={nodeData.video!.duration}
            trimStart={nodeData.video!.trimStart ?? 0}
            trimEnd={nodeData.video!.trimEnd ?? MAX_ANALYSIS_DURATION}
            onChange={handleTrimChange}
          />
          <p className="px-3.5 pb-1 text-[10px] text-[var(--an-text-placeholder)]">
            Tip: type <code>next 20</code> to continue with the next segment.
          </p>
        </>
      )}

      {hasVideo && isIdle && !hasTimelineContent && (
        <div className="px-3.5 pb-2">
          <div className="rounded-md border border-[var(--an-border-input)] bg-[var(--an-bg-elevated)] p-2.5">
            <p className="text-[11px] text-[var(--an-text-muted)]">
              Ready to analyze. Describe what to inspect (or type <strong>next 20</strong>), then click <strong>Analyze video</strong>.
            </p>
          </div>
        </div>
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
                case 'prompt':
                  return <PromptCard key={entry.id} prompt={entry.item} onCopy={handleCopyPrompt} />;
                case 'analysis':
                  return <AnalysisCard key={entry.id} analysis={entry.item} />;
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
              aria-label="Motion analyzer prompt"
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
                  ? 'Analyze video (e.g. break down camera motion and transitions)...'
                  : 'Follow-up (e.g. "next 20", "focus on transitions", "generate prompt")...'
              }
              rows={1}
              className="w-full resize-none text-[13px] text-[var(--an-text)] outline-none leading-[1.4]"
              style={{ minHeight: '20px', maxHeight: '100px', backgroundColor: 'transparent' }}
            />
          </div>
          <div className="flex items-center justify-between px-2 py-1 pb-2 gap-2">
            <div className="text-[10px] text-[var(--an-text-placeholder)]" role="status" aria-live="polite">
              {isStreaming ? `Analyzing… ${streamElapsed}s` : hasVideo ? 'Video ready' : 'No video uploaded'}
            </div>

            <div className="flex items-center gap-1.5">
              {isStreaming && (
                <button
                  onClick={handleStopStream}
                  aria-label="Stop analysis"
                  className="h-7 px-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] inline-flex items-center gap-1"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!canSend}
                aria-label={isStreaming ? 'Analyzing video' : state.phase === 'idle' ? 'Analyze video' : 'Send follow-up prompt'}
                className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                  canSend
                    ? 'bg-[var(--an-accent)] hover:bg-[var(--an-accent-hover)]'
                    : 'bg-[var(--an-accent)] opacity-40 cursor-not-allowed'
                }`}
                title={state.phase === 'idle' ? 'Analyze video' : 'Send'}
              >
                {isStreaming ? (
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
          </div>
          <div className="sr-only" aria-live="polite">{liveStatus}</div>
        </div>
      </div>

    </div>
    </div>
  );
}

export const MotionAnalyzerNode = memo(MotionAnalyzerNodeComponent);
