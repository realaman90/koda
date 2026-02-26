'use client';

/**
 * PromptStudioNode Component
 *
 * Creative director chat — generates production-quality prompts
 * for image/video models. Text output handle connects to generators.
 * Matches AnimationNode / MotionAnalyzerNode UI patterns.
 */

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { PluginNodeData } from '@/lib/types';
import { useCanvasStore } from '@/stores/canvas-store';
import {
  Sparkles,
  ArrowUp,
  Copy,
  Check,
  Loader2,
  RotateCcw,
  Terminal,
  Square,
  ChevronDown,
  Camera,
  Palette,
  Zap,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  PromptStudioNodeState,
  PromptStudioMessage,
  ToolCallItem,
  ThinkingBlockItem,
  GeneratedPrompt,
} from './types';
import { TOOL_DISPLAY_NAMES } from './events';
import { usePromptStudioStream } from './hooks';

// ─── Constants ──────────────────────────────────────────────────────────
function createDefaultState(nodeId: string): PromptStudioNodeState {
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

const UI_TOOLS = new Set(['set_thinking']);

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
    <h1 className="text-sm font-bold text-[var(--an-text-primary)] mb-1.5">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xs font-bold text-[var(--an-text-primary)] mb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-[var(--an-text-secondary)] mb-1">{children}</h3>
  ),
};

// ─── Sequence counter ────────────────────────────────────────────────────
let globalSeq = 0;
function nextSeq(): number { return ++globalSeq; }

// ─── Prompt Card Component ──────────────────────────────────────────────
function PromptCard({
  prompt,
  isLatest,
}: {
  prompt: GeneratedPrompt;
  isLatest: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(isLatest);

  const handleCopy = useCallback(async () => {
    try {
      let fullText = prompt.prompt;
      if (prompt.negativePrompt) {
        fullText += `\n\nNegative: ${prompt.negativePrompt}`;
      }
      if (prompt.parameters) {
        const params = Object.entries(prompt.parameters).map(([k, v]) => `${k} ${v}`).join(' ');
        fullText += `\n\n${params}`;
      }
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard fail */ }
  }, [prompt]);

  // Model badge color
  const modelColor = getModelColor(prompt.targetModel);

  return (
    <div className={`
      rounded-lg border transition-all duration-200
      ${isLatest
        ? 'border-amber-500/40 bg-amber-500/5 shadow-[0_0_12px_-4px_rgba(245,158,11,0.15)]'
        : 'border-[var(--an-border)] bg-[var(--an-bg-card)]'
      }
    `}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center ${modelColor.bg}`}>
          <Camera className={`w-3 h-3 ${modelColor.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-[var(--an-text-primary)] truncate block">
            {prompt.label || 'Generated Prompt'}
          </span>
          <span className={`text-[10px] ${modelColor.text}`}>
            {prompt.targetModel}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          className="p-1 rounded hover:bg-white/5 transition-colors"
          title="Copy prompt"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3 text-[var(--an-text-muted)]" />
          )}
        </button>
        <ChevronDown className={`w-3 h-3 text-[var(--an-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="bg-[var(--an-bg-elevated)] rounded-md p-2.5">
            <p className="text-[11px] leading-[1.6] text-[var(--an-text-secondary)] whitespace-pre-wrap select-text">
              {prompt.prompt}
            </p>
          </div>
          {prompt.negativePrompt && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-md p-2">
              <p className="text-[10px] font-medium text-red-400 mb-0.5">Negative</p>
              <p className="text-[10px] leading-[1.5] text-red-300/70 select-text">
                {prompt.negativePrompt}
              </p>
            </div>
          )}
          {prompt.parameters && Object.keys(prompt.parameters).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(prompt.parameters).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--an-bg-elevated)] text-[10px] text-[var(--an-text-muted)] font-mono"
                >
                  {key} {value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getModelColor(model: string): { bg: string; text: string } {
  const m = model.toLowerCase();
  if (m.includes('midjourney')) return { bg: 'bg-blue-500/15', text: 'text-blue-400' };
  if (m.includes('dall') || m.includes('openai')) return { bg: 'bg-green-500/15', text: 'text-green-400' };
  if (m.includes('stable') || m.includes('sdxl') || m.includes('sd3')) return { bg: 'bg-purple-500/15', text: 'text-purple-400' };
  if (m.includes('flux')) return { bg: 'bg-cyan-500/15', text: 'text-cyan-400' };
  if (m.includes('imagen')) return { bg: 'bg-red-500/15', text: 'text-red-400' };
  if (m.includes('nano') || m.includes('banana')) return { bg: 'bg-yellow-500/15', text: 'text-yellow-400' };
  if (m.includes('kling') || m.includes('runway') || m.includes('sora') || m.includes('luma')) return { bg: 'bg-pink-500/15', text: 'text-pink-400' };
  if (m.includes('ideogram')) return { bg: 'bg-orange-500/15', text: 'text-orange-400' };
  if (m.includes('leonardo')) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' };
  return { bg: 'bg-amber-500/15', text: 'text-amber-400' };
}

// ─── Main Component ─────────────────────────────────────────────────────

type PromptStudioNodeType = Node<PluginNodeData, 'pluginNode'>;

function PromptStudioNodeComponent({ id, data, selected }: NodeProps<PromptStudioNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  // ── Local state (UI-only, not persisted) ──
  const [ls, setLs] = useState<PromptStudioNodeState>(() => {
    const persisted = data.state as unknown as PromptStudioNodeState | undefined;
    if (persisted?.nodeId) return persisted;
    return createDefaultState(id);
  });

  const [inputValue, setInputValue] = useState('');
  const [thinkingMsg, setThinkingMsg] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const latestStateRef = useRef(ls);
  latestStateRef.current = ls;

  // ── Streaming hook ──
  const { isStreaming, stream, abort } = usePromptStudioStream();

  // ── Persist state ──
  const persistState = useCallback((state: PromptStudioNodeState) => {
    updateNodeData(id, { state });
  }, [id, updateNodeData]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ls.messages, ls.toolCalls, ls.thinkingBlocks, ls.generatedPrompts]);

  // ── Build timeline ──
  type TimelineItem =
    | { kind: 'message'; data: PromptStudioMessage; seq: number }
    | { kind: 'toolCall'; data: ToolCallItem; seq: number }
    | { kind: 'thinking'; data: ThinkingBlockItem; seq: number }
    | { kind: 'prompt'; data: GeneratedPrompt; seq: number };

  const timeline: TimelineItem[] = [];
  ls.messages.forEach((m) => timeline.push({ kind: 'message', data: m, seq: m.seq ?? 0 }));
  ls.toolCalls.filter(tc => !UI_TOOLS.has(tc.toolName)).forEach((tc) => timeline.push({ kind: 'toolCall', data: tc, seq: tc.seq ?? 0 }));
  ls.thinkingBlocks.forEach((tb) => timeline.push({ kind: 'thinking', data: tb, seq: tb.seq ?? 0 }));
  ls.generatedPrompts.forEach((p, i) => {
    const seq = ls.toolCalls.find(tc => tc.toolName === 'generate_prompt' && tc.output?.includes(p.id))?.seq ?? (i + 1000);
    timeline.push({ kind: 'prompt', data: p, seq: typeof seq === 'number' ? seq : 0 });
  });
  timeline.sort((a, b) => a.seq - b.seq);

  // ── Handle send message ──
  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    setInputValue('');

    const userMsg: PromptStudioMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      seq: nextSeq(),
    };

    const updatedState: PromptStudioNodeState = {
      ...latestStateRef.current,
      phase: 'generating',
      messages: [...latestStateRef.current.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };
    setLs(updatedState);
    persistState(updatedState);

    setThinkingMsg('');
    setReasoning('');

    // Build message history for the agent
    const agentMessages = updatedState.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let streamingAssistantText = '';
    const toolCallArgs = new Map<string, Record<string, unknown>>();

    await stream(agentMessages, { nodeId: id, phase: 'generating' }, {
      onTextDelta: (delta) => {
        streamingAssistantText += delta;
        setLs(prev => ({ ...prev, streamingText: streamingAssistantText }));
      },
      onReasoningDelta: (delta) => {
        setReasoning(prev => prev + delta);
      },
      onToolCall: (event) => {
        toolCallArgs.set(event.toolCallId, event.args);

        if (event.toolName === 'set_thinking') {
          setThinkingMsg(event.args.message as string || '');
          return;
        }

        const tcItem: ToolCallItem = {
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          displayName: TOOL_DISPLAY_NAMES[event.toolName] || event.toolName,
          status: 'running',
          args: event.args,
          timestamp: new Date().toISOString(),
          seq: nextSeq(),
        };

        setLs(prev => ({
          ...prev,
          toolCalls: [...prev.toolCalls, tcItem],
        }));
      },
      onToolResult: (event) => {
        if (event.toolName === 'set_thinking') return;

        // Mark tool call as done
        setLs(prev => ({
          ...prev,
          toolCalls: prev.toolCalls.map(tc =>
            tc.toolCallId === event.toolCallId
              ? { ...tc, status: (event.isError ? 'failed' : 'done') as 'done' | 'failed' }
              : tc
          ),
        }));

        // Handle generate_prompt result
        if (event.toolName === 'generate_prompt' && !event.isError) {
          const args = toolCallArgs.get(event.toolCallId) || {};
          const newPrompt: GeneratedPrompt = {
            id: (event.result.promptId as string) || `prompt_${Date.now()}`,
            prompt: (args.prompt as string) || '',
            targetModel: (args.targetModel as string) || 'General',
            label: args.label as string | undefined,
            negativePrompt: args.negativePrompt as string | undefined,
            parameters: args.parameters as Record<string, string> | undefined,
            createdAt: new Date().toISOString(),
          };

          setLs(prev => ({
            ...prev,
            generatedPrompts: [...prev.generatedPrompts, newPrompt],
          }));
        }
      },
      onComplete: (fullText) => {
        setThinkingMsg('');

        // Strip HTML tags from response
        const cleanText = fullText.replace(/<[^>]*>/g, '').trim();

        setLs(prev => {
          const assistantMsg: PromptStudioMessage | null = cleanText ? {
            id: `msg_${Date.now()}_asst`,
            role: 'assistant',
            content: cleanText,
            timestamp: new Date().toISOString(),
            seq: nextSeq(),
          } : null;

          const newState: PromptStudioNodeState = {
            ...prev,
            phase: 'chatting',
            messages: assistantMsg ? [...prev.messages, assistantMsg] : prev.messages,
            streamingText: undefined,
            reasoning: undefined,
            updatedAt: new Date().toISOString(),
          };
          persistState(newState);
          return newState;
        });
      },
      onError: (error) => {
        setThinkingMsg('');
        setLs(prev => {
          const newState: PromptStudioNodeState = {
            ...prev,
            phase: 'error',
            error: { message: error, canRetry: true },
            streamingText: undefined,
            updatedAt: new Date().toISOString(),
          };
          persistState(newState);
          return newState;
        });
      },
    });
  }, [inputValue, isStreaming, id, stream, persistState]);

  // ── Handle reset ──
  const handleReset = useCallback(() => {
    abort();
    const newState = createDefaultState(id);
    setLs(newState);
    persistState(newState);
    setThinkingMsg('');
    setReasoning('');
    setInputValue('');
  }, [id, abort, persistState]);

  // ── Handle key down ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // ── Status config ──
  const headerConfig = {
    idle: { label: 'Ready', color: 'text-[var(--an-text-muted)]', dot: 'bg-zinc-500' },
    generating: { label: 'Creating', color: 'text-amber-400', dot: 'bg-amber-400 animate-pulse' },
    chatting: { label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    complete: { label: 'Complete', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    error: { label: 'Error', color: 'text-red-400', dot: 'bg-red-400' },
  };
  const status = headerConfig[ls.phase] || headerConfig.idle;

  // ── Live status for screen readers ──
  const liveStatus = isStreaming ? (thinkingMsg || 'Generating...') : '';

  // ── Latest prompt for output handle data ──
  const latestPrompt = ls.generatedPrompts[ls.generatedPrompts.length - 1];

  return (
    <div className="group/node" data-prompt-studio-node>
    <div
      className={`
        w-[420px] rounded-2xl overflow-hidden shadow-xl transition-all duration-200
        bg-[var(--an-bg)] border-2
        ${selected
          ? 'border-amber-500/60 shadow-[0_0_24px_-4px_rgba(245,158,11,0.2)]'
          : 'border-[var(--an-border)] hover:border-[var(--an-border-hover)]'
        }
      `}
      style={{
        // CSS variables (matching animation node palette, but with amber accent)
        '--an-bg': '#0c0c0f',
        '--an-bg-card': '#141418',
        '--an-bg-elevated': '#1a1a20',
        '--an-border': '#27272a',
        '--an-border-hover': '#3f3f46',
        '--an-text-primary': '#fafafa',
        '--an-text-secondary': '#d4d4d8',
        '--an-text-muted': '#a1a1aa',
        '--an-accent': '#f59e0b',
        '--an-accent-hover': '#d97706',
        '--an-accent-text': '#fbbf24',
      } as React.CSSProperties}
    >
      {/* ── Input Handle (left) ── */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-[var(--an-bg)]"
        style={{ top: 24 }}
      />

      {/* ── Header ── */}
      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-[var(--an-border)]">
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--an-text-primary)] leading-tight">
            Prompt Studio
          </h3>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className={`text-[10px] ${status.color}`}>
              {isStreaming ? (thinkingMsg || 'Generating...') : status.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(ls.messages.length > 0 || ls.generatedPrompts.length > 0) && (
            <button
              onClick={handleReset}
              className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[var(--an-text-muted)]" />
            </button>
          )}
        </div>
      </div>

      {/* ── Timeline / Messages ── */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: 400, minHeight: ls.phase === 'idle' && timeline.length === 0 ? 0 : 120 }}
      >
        <div className="p-3 space-y-2.5">
          {/* Empty state */}
          {ls.phase === 'idle' && timeline.length === 0 && (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] text-[var(--an-text-secondary)] font-medium">Creative Director</p>
                <p className="text-[10px] text-[var(--an-text-muted)] mt-0.5 max-w-[260px]">
                  Describe what you want to create and I'll craft the perfect prompt for any image or video model.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {[
                  'Cinematic product shot',
                  'Editorial portrait',
                  'Architectural render',
                  'Abstract art',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setInputValue(suggestion); inputRef.current?.focus(); }}
                    className="px-2 py-1 rounded-full bg-[var(--an-bg-elevated)] text-[10px] text-[var(--an-text-muted)] hover:text-[var(--an-text-secondary)] hover:bg-white/5 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timeline items */}
          {timeline.map((item) => {
            switch (item.kind) {
              case 'message': {
                const msg = item.data;
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] rounded-xl px-3 py-2
                        ${isUser
                          ? 'bg-amber-500/15 border border-amber-500/20'
                          : 'bg-[var(--an-bg-card)] border border-[var(--an-border)]'
                        }
                      `}
                    >
                      {isUser ? (
                        <p className="text-xs text-[var(--an-text-secondary)] whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                );
              }

              case 'toolCall': {
                const tc = item.data;
                return (
                  <div key={tc.id} className="flex items-center gap-2 px-2 py-1">
                    <div className={`w-4 h-4 rounded flex items-center justify-center ${
                      tc.status === 'running' ? 'bg-amber-500/15' :
                      tc.status === 'done' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                    }`}>
                      {tc.status === 'running' ? (
                        <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                      ) : tc.status === 'done' ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Zap className="w-2.5 h-2.5 text-red-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--an-text-muted)]">{tc.displayName}</span>
                  </div>
                );
              }

              case 'thinking': {
                const tb = item.data;
                return (
                  <div key={tb.id} className="flex items-center gap-2 px-2 py-1">
                    <Terminal className="w-3 h-3 text-[var(--an-text-muted)]" />
                    <span className="text-[10px] text-[var(--an-text-muted)] italic">{tb.label}</span>
                  </div>
                );
              }

              case 'prompt': {
                const p = item.data;
                const isLatest = p.id === latestPrompt?.id;
                return (
                  <PromptCard key={p.id} prompt={p} isLatest={isLatest} />
                );
              }
            }
          })}

          {/* Streaming text */}
          {ls.streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-3 py-2 bg-[var(--an-bg-card)] border border-[var(--an-border)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {ls.streamingText}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Reasoning toggle */}
          {reasoning && (
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--an-text-muted)] hover:text-[var(--an-text-secondary)] transition-colors"
            >
              <Terminal className="w-3 h-3" />
              {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
              <ChevronDown className={`w-3 h-3 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
            </button>
          )}
          {showReasoning && reasoning && (
            <div className="bg-[var(--an-bg-elevated)] border border-[var(--an-border)] rounded-lg px-3 py-2">
              <p className="text-[10px] leading-[1.5] text-[var(--an-text-muted)] italic whitespace-pre-wrap">{reasoning}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Chat Input ── */}
      <div className="border-t border-[var(--an-border)] p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ls.phase === 'idle' ? 'Describe your vision...' : 'Refine the prompt...'}
              className="
                w-full bg-[var(--an-bg-card)] border border-[var(--an-border)]
                rounded-xl px-3 py-2 text-xs text-[var(--an-text-secondary)]
                placeholder:text-[var(--an-text-muted)]/50
                focus:outline-none focus:border-amber-500/40
                resize-none overflow-hidden
                nowheel nodrag
              "
              rows={1}
              style={{ minHeight: 36, maxHeight: 120 }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            onClick={isStreaming ? abort : handleSendMessage}
            disabled={!isStreaming && !inputValue.trim()}
            className={`
              h-9 w-9 rounded-xl flex items-center justify-center transition-all
              ${isStreaming
                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30'
                : inputValue.trim()
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-[var(--an-bg-elevated)] border border-[var(--an-border)] opacity-40'
              }
            `}
          >
            {isStreaming ? (
              <Square className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
        <div className="sr-only" aria-live="polite">{liveStatus}</div>
      </div>
    </div>

    {/* ── Output Handle (right) ── */}
    <Handle
      type="source"
      position={Position.Right}
      id="prompt-output"
      className="!w-3 !h-3 !bg-amber-500 !border-2 !border-[var(--an-bg)]"
      style={{ top: '50%' }}
    />
    </div>
  );
}

export const PromptStudioNode = memo(PromptStudioNodeComponent);
