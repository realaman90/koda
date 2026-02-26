'use client';

/**
 * PromptStudioNode Component
 *
 * Creative director chat — generates production-quality prompts
 * for image/video models. Text output handle connects to generators.
 * UI matches AnimationNode / SvgStudioNode patterns exactly.
 */

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
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

// ─── Markdown components (matches AnimationNode ChatMessages.tsx) ────────
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
};

// ─── Sequence counter ────────────────────────────────────────────────────
let globalSeq = 0;
function nextSeq(): number { return ++globalSeq; }

// ─── Prompt Card Component ──────────────────────────────────────────────
function PromptCard({ prompt, isLatest }: { prompt: GeneratedPrompt; isLatest: boolean }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(isLatest);

  const handleCopy = useCallback(async () => {
    try {
      let fullText = prompt.prompt;
      if (prompt.negativePrompt) fullText += `\n\nNegative: ${prompt.negativePrompt}`;
      if (prompt.parameters) {
        fullText += `\n\n${Object.entries(prompt.parameters).map(([k, v]) => `${k} ${v}`).join(' ')}`;
      }
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard fail */ }
  }, [prompt]);

  const modelColor = getModelColor(prompt.targetModel);

  return (
    <div className={`rounded-lg border overflow-hidden transition-all duration-200 ${
      isLatest
        ? 'border-[var(--an-accent)]/40 bg-[var(--an-accent-bg)]/30'
        : 'border-[var(--an-border)] bg-[var(--an-bg-card)]'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${modelColor.bg}`}>
          <Camera className={`w-3 h-3 ${modelColor.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-[var(--an-text-secondary)] truncate block">
            {prompt.label || 'Generated Prompt'}
          </span>
          <span className={`text-[10px] ${modelColor.text}`}>{prompt.targetModel}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          className="p-1 rounded hover:bg-[var(--an-bg-hover)] transition-colors shrink-0"
          title="Copy prompt"
        >
          {copied
            ? <Check className="w-3 h-3 text-green-400" />
            : <Copy className="w-3 h-3 text-[var(--an-text-dim)]" />
          }
        </button>
        <ChevronDown className={`w-3 h-3 text-[var(--an-text-dim)] transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="bg-[var(--an-bg-elevated)] rounded-md p-2.5">
            <p className="text-[11px] leading-[1.6] text-[var(--an-text-secondary)] whitespace-pre-wrap select-text">
              {prompt.prompt}
            </p>
          </div>
          {prompt.negativePrompt && (
            <div className="bg-[var(--an-bg-error)] border border-[var(--an-border-error)] rounded-md p-2">
              <p className="text-[10px] font-medium text-red-400 mb-0.5">Negative</p>
              <p className="text-[10px] leading-[1.5] text-[var(--an-text-muted)] select-text">{prompt.negativePrompt}</p>
            </div>
          )}
          {prompt.parameters && Object.keys(prompt.parameters).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(prompt.parameters).map(([key, value]) => (
                <span key={key} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--an-bg-elevated)] text-[10px] text-[var(--an-text-muted)] font-mono">
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
  return { bg: 'bg-[var(--an-accent-bg)]', text: 'text-[var(--an-accent-text)]' };
}

// ─── Main Component ─────────────────────────────────────────────────────

type PromptStudioNodeType = Node<PluginNodeData, 'pluginNode'>;

function PromptStudioNodeComponent({ id, data, selected }: NodeProps<PromptStudioNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const updateNodeInternals = useUpdateNodeInternals();

  // Rename state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Prompt Studio');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    if (nodeName.trim() && nodeName !== (data.name || 'Prompt Studio')) {
      updateNodeData(id, { name: nodeName.trim() });
    }
  }, [id, nodeName, data.name, updateNodeData]);

  // ── Local state ──
  const [ls, setLs] = useState<PromptStudioNodeState>(() => {
    const persisted = data.state as unknown as PromptStudioNodeState | undefined;
    if (persisted?.nodeId) return persisted;
    return createDefaultState(id);
  });

  const [inputValue, setInputValue] = useState('');
  const [thinkingMsg, setThinkingMsg] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestStateRef = useRef(ls);
  latestStateRef.current = ls;

  const { isStreaming, stream, abort } = usePromptStudioStream();

  // Re-sync handles when content changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, ls.phase, ls.generatedPrompts.length, updateNodeInternals]);

  const persistState = useCallback((state: PromptStudioNodeState) => {
    updateNodeData(id, { state });
  }, [id, updateNodeData]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ls.messages, ls.toolCalls, ls.generatedPrompts]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [inputValue]);

  // ── Node styling (matches AnimationNode) ──
  const nodeClasses = useMemo(() => {
    const base = 'animation-node w-[400px] min-h-[200px] max-h-[720px] rounded-xl overflow-hidden flex flex-col';
    if (selected) return `${base} ring-1 ring-[var(--an-accent)]/70`;
    return base;
  }, [selected]);

  // ── Header config ──
  const headerConfig = useMemo(() => {
    switch (ls.phase) {
      case 'idle':
        return { statusColor: 'var(--an-text-placeholder)', statusText: 'Ready' };
      case 'generating':
        return { statusColor: 'var(--an-accent)', statusText: thinkingMsg || 'Generating...' };
      case 'chatting':
        return { statusColor: '#22c55e', statusText: 'Active' };
      case 'complete':
        return { statusColor: '#22c55e', statusText: 'Complete' };
      case 'error':
        return { statusColor: '#ef4444', statusText: 'Error' };
      default:
        return { statusColor: 'var(--an-text-placeholder)', statusText: 'Ready' };
    }
  }, [ls.phase, thinkingMsg]);

  // ── Build timeline ──
  type TimelineItem =
    | { kind: 'user'; data: PromptStudioMessage; seq: number }
    | { kind: 'assistant'; data: PromptStudioMessage; seq: number }
    | { kind: 'prompt'; data: GeneratedPrompt; seq: number }
    | { kind: 'thinking'; data: ThinkingBlockItem; seq: number };

  const timeline: TimelineItem[] = [];
  ls.messages.forEach((m) => {
    timeline.push({ kind: m.role === 'user' ? 'user' : 'assistant', data: m, seq: m.seq ?? 0 });
  });
  ls.generatedPrompts.forEach((p, i) => {
    const seq = ls.toolCalls.find(tc => tc.toolName === 'generate_prompt' && tc.output?.includes(p.id))?.seq ?? (i + 1000);
    timeline.push({ kind: 'prompt', data: p, seq: typeof seq === 'number' ? seq : 0 });
  });
  timeline.sort((a, b) => a.seq - b.seq);

  const hasTimelineContent = timeline.length > 0 || !!ls.streamingText;
  const latestPrompt = ls.generatedPrompts[ls.generatedPrompts.length - 1];

  // ── Handle send ──
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
        setLs(prev => ({ ...prev, toolCalls: [...prev.toolCalls, tcItem] }));
      },
      onToolResult: (event) => {
        if (event.toolName === 'set_thinking') return;
        setLs(prev => ({
          ...prev,
          toolCalls: prev.toolCalls.map(tc =>
            tc.toolCallId === event.toolCallId
              ? { ...tc, status: (event.isError ? 'failed' : 'done') as 'done' | 'failed' }
              : tc
          ),
        }));
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
          setLs(prev => ({ ...prev, generatedPrompts: [...prev.generatedPrompts, newPrompt] }));
        }
      },
      onComplete: (fullText) => {
        setThinkingMsg('');
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

  const handleReset = useCallback(() => {
    abort();
    const newState = createDefaultState(id);
    setLs(newState);
    persistState(newState);
    setThinkingMsg('');
    setReasoning('');
    setInputValue('');
  }, [id, abort, persistState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const canSend = !isStreaming && inputValue.trim().length > 0;

  return (
    <div>
      {/* Node Title — matches AnimationNode / SvgStudio */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-animation)' }}>
        <Sparkles className="h-4 w-4" />
        {isEditingName && !isReadOnly ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') { setNodeName(data.name || 'Prompt Studio'); setIsEditingName(false); }
            }}
            className="bg-transparent border-b outline-none px-0.5 min-w-[100px]"
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)' }}
          />
        ) : (
          <span
            onDoubleClick={() => !isReadOnly && setIsEditingName(true)}
            className={`transition-colors hover:opacity-80 ${isReadOnly ? 'cursor-default' : 'cursor-text'}`}
          >
            {data.name || 'Prompt Studio'}
          </span>
        )}
      </div>

      {/* Main card — uses animation-node class for CSS vars + node-card styling */}
      <div className={nodeClasses}>
        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-[var(--an-border)]">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] leading-tight" style={{ color: headerConfig.statusColor }}>
              {isStreaming ? (thinkingMsg || 'Generating...') : headerConfig.statusText}
            </p>
          </div>
          {(ls.messages.length > 0 || ls.generatedPrompts.length > 0) && (
            <button
              onClick={handleReset}
              className="p-1 rounded-md hover:bg-[var(--an-bg-hover)] transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[var(--an-text-dim)]" />
            </button>
          )}
        </div>

        {/* ── Empty state ── */}
        {!hasTimelineContent && ls.phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-3.5 py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--an-accent-bg)] flex items-center justify-center">
              <Palette className="w-5 h-5 text-[var(--an-accent)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--an-text-secondary)] font-medium">Creative Director</p>
              <p className="text-[10px] text-[var(--an-text-dim)] mt-0.5 max-w-[260px]">
                Describe what you want to create and I'll craft the perfect prompt for any model.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {['Cinematic product shot', 'Editorial portrait', 'Architectural render', 'Abstract art'].map(s => (
                <button
                  key={s}
                  onClick={() => { setInputValue(s); textareaRef.current?.focus(); }}
                  className="px-2 py-1 rounded-full bg-[var(--an-bg-elevated)] text-[10px] text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] hover:bg-[var(--an-bg-hover)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Chat area (scrollable) ── */}
        {hasTimelineContent && (
          <div
            ref={chatScrollRef}
            className="nowheel nopan nodrag cursor-text select-text flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            onWheel={(e) => { if (!e.ctrlKey) e.stopPropagation(); }}
          >
            <div className="px-3.5 py-2.5 space-y-2.5">
              {timeline.map((item) => {
                if (item.kind === 'user') {
                  return (
                    <div
                      key={item.data.id}
                      className="px-3 py-2.5 text-xs leading-[1.4] text-[var(--an-accent-text)] bg-[var(--an-bg-user-bubble)] w-full"
                      style={{ borderRadius: '12px 4px 12px 12px' }}
                    >
                      {item.data.content}
                    </div>
                  );
                }
                if (item.kind === 'assistant') {
                  return (
                    <div key={item.data.id} className="animation-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {item.data.content}
                      </ReactMarkdown>
                    </div>
                  );
                }
                if (item.kind === 'prompt') {
                  return <PromptCard key={item.data.id} prompt={item.data} isLatest={item.data.id === latestPrompt?.id} />;
                }
                if (item.kind === 'thinking') {
                  return (
                    <div key={item.data.id} className="bg-[var(--an-bg-elevated)] rounded-lg border border-[var(--an-border)] px-3 py-2">
                      <p className="text-[10px] text-[var(--an-text-dim)] italic">{item.data.label}</p>
                    </div>
                  );
                }
                return null;
              })}

              {/* Streaming text */}
              {ls.streamingText && (
                <div className="animation-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {ls.streamingText}
                  </ReactMarkdown>
                </div>
              )}

              {/* Reasoning toggle */}
              {reasoning && (
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-1.5 text-[10px] text-[var(--an-text-dim)] hover:text-[var(--an-text-muted)] transition-colors"
                >
                  <Terminal className="w-3 h-3" />
                  {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
                </button>
              )}
              {showReasoning && reasoning && (
                <div className="bg-[var(--an-bg-elevated)] border border-[var(--an-border)] rounded-lg px-3 py-2">
                  <p className="text-[10px] leading-[1.5] text-[var(--an-text-dim)] italic whitespace-pre-wrap">{reasoning}</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* ── Chat Input (matches AnimationNode ChatInput) ── */}
        <div className="flex-shrink-0 px-3 pt-2 pb-2.5 border-t border-[var(--an-border)]">
          <div className="rounded-[10px] border border-[var(--an-border-input)] overflow-hidden" style={{ backgroundColor: 'var(--an-bg-card)' }}>
            <div className="px-3 pt-2.5 pb-1.5">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={ls.phase === 'idle' ? 'Describe your vision...' : 'Refine the prompt...'}
                disabled={isReadOnly}
                rows={1}
                className="w-full resize-none text-[13px] text-[var(--an-text)] outline-none leading-[1.4] nowheel nodrag"
                style={{ minHeight: '20px', maxHeight: '100px', backgroundColor: 'transparent' }}
              />
            </div>
            <div className="flex items-center justify-between px-2 py-1 pb-2">
              <div />
              <div className="flex items-center gap-1.5">
                {isStreaming && (
                  <button
                    onClick={abort}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--an-bg-hover)] hover:bg-[var(--an-border-hover)] transition-colors"
                    title="Stop generation"
                  >
                    <Square className="w-3 h-3 text-white" />
                  </button>
                )}
                <button
                  onClick={handleSendMessage}
                  disabled={!canSend}
                  className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                    canSend
                      ? 'bg-[var(--an-accent)] hover:bg-[var(--an-accent-hover)]'
                      : 'bg-[var(--an-accent)] opacity-40 cursor-not-allowed'
                  }`}
                  title="Send message"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Input Handle (left) ── */}
        <Handle
          type="target"
          position={Position.Left}
          id="text"
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-[var(--an-bg)]"
          style={{ top: 24 }}
        />

        {/* ── Output Handle (right) ── */}
        <Handle
          type="source"
          position={Position.Right}
          id="prompt-output"
          className="!w-3 !h-3 !bg-[var(--an-accent)] !border-2 !border-[var(--an-bg)]"
          style={{ top: '50%' }}
        />
      </div>
    </div>
  );
}

export const PromptStudioNode = memo(PromptStudioNodeComponent);
