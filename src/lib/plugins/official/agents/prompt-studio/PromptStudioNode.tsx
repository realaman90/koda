'use client';

/**
 * PromptStudioNode Component
 *
 * Creative director chat — generates production-quality prompts
 * for image/video models. Text output handle connects to generators.
 * UI matches AnimationNode / SvgStudioNode patterns exactly.
 *
 * Features:
 * - Selectable prompt cards (active prompt flows through output edge)
 * - Interactive QnA cards with clickable chips
 * - Search result cards from web search
 * - Conversational flow (text segments between tool calls)
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
  RotateCcw,
  Terminal,
  Square,
  ChevronDown,
  Camera,
  Palette,
  Image as ImageIcon,
  Type,
  Globe,
  ExternalLink,
  CircleCheck,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  PromptStudioNodeState,
  PromptStudioMessage,
  ToolCallItem,
  ThinkingBlockItem,
  GeneratedPrompt,
  QnASet,
  QnAQuestion,
  SearchResult,
} from './types';
import { TOOL_DISPLAY_NAMES } from './events';
import { usePromptStudioStream, type ConnectedNodeInfo } from './hooks';
import { useNodeDisplayMode } from '@/components/canvas/nodes/useNodeDisplayMode';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';

// ─── Constants ──────────────────────────────────────────────────────────
function createDefaultState(nodeId: string): PromptStudioNodeState {
  return {
    nodeId,
    phase: 'idle',
    messages: [],
    toolCalls: [],
    thinkingBlocks: [],
    generatedPrompts: [],
    qnaSets: [],
    searchResults: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

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

// ─── Sequence helpers ───────────────────────────────────────────────────
function toMs(value: string | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function getMaxSeqFromState(state: PromptStudioNodeState): number {
  let maxSeq = 0;

  for (const message of state.messages) {
    if (typeof message.seq === 'number' && Number.isFinite(message.seq)) {
      maxSeq = Math.max(maxSeq, message.seq);
    }
  }
  for (const toolCall of state.toolCalls) {
    if (typeof toolCall.seq === 'number' && Number.isFinite(toolCall.seq)) {
      maxSeq = Math.max(maxSeq, toolCall.seq);
    }
  }
  for (const block of state.thinkingBlocks) {
    if (typeof block.seq === 'number' && Number.isFinite(block.seq)) {
      maxSeq = Math.max(maxSeq, block.seq);
    }
  }
  for (const prompt of state.generatedPrompts) {
    if (typeof prompt.seq === 'number' && Number.isFinite(prompt.seq)) {
      maxSeq = Math.max(maxSeq, prompt.seq);
    }
  }
  for (const qna of state.qnaSets) {
    if (typeof qna.seq === 'number' && Number.isFinite(qna.seq)) {
      maxSeq = Math.max(maxSeq, qna.seq);
    }
  }
  for (const search of state.searchResults) {
    if (typeof search.seq === 'number' && Number.isFinite(search.seq)) {
      maxSeq = Math.max(maxSeq, search.seq);
    }
  }

  return maxSeq;
}

// ─── Model color helper ─────────────────────────────────────────────────
function getModelColor(model: string): { bg: string; text: string } {
  const m = model.toLowerCase();
  if (m.includes('midjourney')) return { bg: 'bg-blue-500/15', text: 'text-blue-400' };
  if (m.includes('dall') || m.includes('openai')) return { bg: 'bg-green-500/15', text: 'text-green-400' };
  if (m.includes('stable') || m.includes('sdxl') || m.includes('sd3')) return { bg: 'bg-purple-500/15', text: 'text-purple-400' };
  if (m.includes('flux')) return { bg: 'bg-cyan-500/15', text: 'text-cyan-400' };
  if (m.includes('imagen')) return { bg: 'bg-red-500/15', text: 'text-red-400' };
  if (m.includes('nano') || m.includes('banana')) return { bg: 'bg-yellow-500/15', text: 'text-yellow-400' };
  if (m.includes('veo')) return { bg: 'bg-blue-500/15', text: 'text-blue-400' };
  if (m.includes('kling')) return { bg: 'bg-pink-500/15', text: 'text-pink-400' };
  if (m.includes('seedance')) return { bg: 'bg-violet-500/15', text: 'text-violet-400' };
  if (m.includes('sora')) return { bg: 'bg-green-500/15', text: 'text-green-400' };
  if (m.includes('luma') || m.includes('ray')) return { bg: 'bg-amber-500/15', text: 'text-amber-400' };
  if (m.includes('animation') || m.includes('remotion')) return { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' };
  if (m.includes('ideogram')) return { bg: 'bg-orange-500/15', text: 'text-orange-400' };
  if (m.includes('leonardo')) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' };
  return { bg: 'bg-[var(--an-accent-bg)]', text: 'text-[var(--an-accent-text)]' };
}

const SPECIFIC_MODEL_HINTS = [
  'flux', 'nanobanana', 'nano banana', 'recraft', 'ideogram', 'seedream',
  'sd 3.5', 'stable diffusion', 'veo', 'kling', 'seedance', 'sora',
  'luma', 'wan', 'hailuo', 'runway', 'minimax', 'grok',
];

function hasExplicitModelRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return false;
  return SPECIFIC_MODEL_HINTS.some((hint) => normalized.includes(hint));
}

function isAutoDetail(detail?: string): boolean {
  if (!detail) return true;
  const normalized = detail.toLowerCase().trim();
  return normalized === 'auto';
}

function resolvePromptTargetModel({
  requestedTargetModel,
  userConversationText,
  connectedNodes,
}: {
  requestedTargetModel?: string;
  userConversationText: string;
  connectedNodes?: ConnectedNodeInfo[];
}): string {
  const downstream = (connectedNodes || []).filter((n) => n.direction === 'downstream');
  const hasDownstreamVideo = downstream.some((n) => n.nodeType === 'videoGenerator');
  const hasDownstreamImage = downstream.some((n) => n.nodeType === 'imageGenerator');
  const hasSpecificDownstreamModel = downstream.some((n) => {
    if (n.nodeType !== 'imageGenerator' && n.nodeType !== 'videoGenerator') return false;
    return !isAutoDetail(n.detail);
  });
  const explicitModelRequested = hasExplicitModelRequest(userConversationText);

  if (!explicitModelRequested && !hasSpecificDownstreamModel) {
    if (hasDownstreamVideo && !hasDownstreamImage) return 'Auto (Video)';
    if (hasDownstreamImage && !hasDownstreamVideo) return 'Auto (Image)';
    if (hasDownstreamVideo) return 'Auto (Video)';
    return 'Auto (Image)';
  }

  const trimmedRequested = requestedTargetModel?.trim();
  if (trimmedRequested) return trimmedRequested;
  return hasDownstreamVideo ? 'Auto (Video)' : 'Auto (Image)';
}

// ─── Prompt Card Component ──────────────────────────────────────────────
function PromptCard({
  prompt,
  isActive,
  onSelect,
}: {
  prompt: GeneratedPrompt;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
    <div
      className={`rounded-lg border overflow-hidden transition-all duration-200 cursor-pointer ${
        isActive
          ? 'border-teal-500/60 bg-teal-500/5 ring-1 ring-teal-500/20'
          : 'border-[var(--an-border)] bg-[var(--an-bg-card)] hover:border-[var(--an-border-hover)]'
      }`}
      onClick={onSelect}
    >
      <div className="w-full flex items-center gap-2 px-3 py-2">
        {/* Active indicator */}
        <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
          isActive ? 'bg-teal-500' : 'bg-[var(--an-text-dim)]/30'
        }`} />
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-[var(--an-accent-bg)]">
          <Sparkles className="w-3 h-3 text-[var(--an-accent-text)]" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-[var(--an-text-secondary)] truncate block">
            {prompt.label || 'Generated Prompt'}
          </span>
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
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="p-0.5 shrink-0"
        >
          <ChevronDown className={`w-3 h-3 text-[var(--an-text-dim)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

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

// ─── QnA Card Component (Carousel) ──────────────────────────────────────
function QnACard({
  qna,
  onAnswer,
  disabled,
}: {
  qna: QnASet;
  onAnswer: (answers: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const total = qna.questions.length;

  const handleChipClick = (questionId: string, value: string) => {
    if (qna.answered || disabled) return;
    setCustomInputs(prev => ({ ...prev, [questionId]: '' }));
    setSelections(prev => ({
      ...prev,
      [questionId]: prev[questionId] === value ? '' : value,
    }));
  };

  const handleCustomInput = (questionId: string, value: string) => {
    if (qna.answered || disabled) return;
    setCustomInputs(prev => ({ ...prev, [questionId]: value }));
    setSelections(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    const filled = Object.entries(selections).filter(([, v]) => v);
    if (filled.length === 0) return;
    onAnswer(selections);
  };

  const hasSelection = Object.values(selections).some(v => v);
  const answeredCount = Object.values(selections).filter(v => v).length;

  if (qna.answered) {
    return (
      <div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-bg-card)] px-3 py-2 opacity-60">
        <div className="flex items-center gap-1.5 mb-1">
          <CircleCheck className="w-3 h-3 text-green-400" />
          <span className="text-[10px] text-[var(--an-text-dim)]">Answered</span>
        </div>
      </div>
    );
  }

  const currentQ = qna.questions[activeIdx];
  if (!currentQ) return null;

  const isChipSelected = (s: string) => selections[currentQ.id] === s && !customInputs[currentQ.id];
  const hasCustom = !!customInputs[currentQ.id];

  return (
    <div className="rounded-lg border border-[var(--an-accent)]/30 bg-[var(--an-accent-bg)]/20 overflow-hidden">
      {/* Carousel dots + counter */}
      {total > 1 && (
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex gap-1">
            {qna.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === activeIdx
                    ? 'bg-[var(--an-accent)] w-3'
                    : selections[qna.questions[i].id]
                      ? 'bg-[var(--an-accent)]/50'
                      : 'bg-[var(--an-text-dim)]/30'
                }`}
              />
            ))}
          </div>
          <span className="text-[9px] text-[var(--an-text-dim)]">
            {answeredCount}/{total}
          </span>
        </div>
      )}

      {/* Current question */}
      <div className="px-3 py-2.5">
        <p className="text-[11px] font-medium text-[var(--an-text-secondary)] mb-2">{currentQ.question}</p>
        <div className="flex flex-wrap gap-1.5">
          {currentQ.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleChipClick(currentQ.id, s)}
              disabled={disabled}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                isChipSelected(s)
                  ? 'bg-[var(--an-accent)] text-white'
                  : 'bg-[var(--an-bg-elevated)] text-[var(--an-text-muted)] hover:bg-[var(--an-bg-hover)] hover:text-[var(--an-text-secondary)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {/* Free text input */}
        <input
          type="text"
          placeholder="Or type your own..."
          value={customInputs[currentQ.id] || ''}
          onChange={(e) => handleCustomInput(currentQ.id, e.target.value)}
          disabled={disabled}
          className="mt-2 w-full px-2.5 py-1.5 rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border)] text-[10px] text-[var(--an-text-primary)] placeholder-[var(--an-text-dim)] outline-none focus:border-[var(--an-accent)]/50 transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customInputs[currentQ.id]) {
              if (activeIdx < total - 1) setActiveIdx(activeIdx + 1);
              else handleSubmit();
            }
          }}
        />
      </div>

      {/* Navigation + Submit */}
      <div className="px-3 pb-2.5 flex gap-2">
        {total > 1 && activeIdx > 0 && (
          <button
            onClick={() => setActiveIdx(activeIdx - 1)}
            className="px-3 py-1.5 rounded-lg bg-[var(--an-bg-elevated)] text-[var(--an-text-muted)] text-[10px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
          >
            Back
          </button>
        )}
        {activeIdx < total - 1 ? (
          <button
            onClick={() => setActiveIdx(activeIdx + 1)}
            className="flex-1 py-1.5 rounded-lg bg-[var(--an-accent)]/20 text-[var(--an-accent)] text-[10px] font-medium hover:bg-[var(--an-accent)]/30 transition-colors"
          >
            Next
          </button>
        ) : hasSelection && !disabled ? (
          <button
            onClick={handleSubmit}
            className="flex-1 py-1.5 rounded-lg bg-[var(--an-accent)] hover:bg-[var(--an-accent-hover)] text-white text-[11px] font-medium transition-colors"
          >
            Send answers
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Search Result Card Component ───────────────────────────────────────
function SearchResultCard({ search }: { search: SearchResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--an-border)] bg-[var(--an-bg-card)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-[11px] text-[var(--an-text-muted)] truncate flex-1">
          Searched: {search.query}
        </span>
        <span className="text-[10px] text-[var(--an-text-dim)] shrink-0">{search.results.length} results</span>
        <ChevronDown className={`w-3 h-3 text-[var(--an-text-dim)] transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && search.results.length > 0 && (
        <div className="px-3 pb-2.5 space-y-1.5">
          {search.results.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md bg-[var(--an-bg-elevated)] px-2.5 py-2 hover:bg-[var(--an-bg-hover)] transition-colors group"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-medium text-[var(--an-text-secondary)] leading-tight flex-1">{r.title}</span>
                <ExternalLink className="w-3 h-3 text-[var(--an-text-dim)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
              {r.summary && (
                <p className="text-[10px] text-[var(--an-text-dim)] mt-1 leading-tight line-clamp-2">{r.summary}</p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

type PromptStudioNodeType = Node<PluginNodeData, 'pluginNode'>;

function PromptStudioNodeComponent({ id, data, selected }: NodeProps<PromptStudioNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const updateNodeInternals = useUpdateNodeInternals();
  const { displayMode, focusProps } = useNodeDisplayMode(selected);

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
    if (persisted?.nodeId) return { ...createDefaultState(id), ...persisted };
    return createDefaultState(id);
  });
  const seqRef = useRef(getMaxSeqFromState(ls));
  const nextLocalSeq = useCallback((): number => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

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

  // Keep per-node sequence monotonic across persisted/rehydrated state.
  useEffect(() => {
    seqRef.current = Math.max(seqRef.current, getMaxSeqFromState(ls));
  }, [ls]);

  const persistedState = useMemo(() => ({
    ...ls,
    streamingText: undefined,
  }), [ls]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateNodeData(id, { state: persistedState }, {
        history: 'skip',
        save: 'schedule',
        preview: 'skip',
        kind: 'content',
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [id, persistedState, updateNodeData]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ls.messages, ls.toolCalls, ls.generatedPrompts, ls.qnaSets, ls.searchResults]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [inputValue]);

  // ── Gather connected canvas nodes for context ──
  const getCanvasContext = useCallback((): { connectedNodes: ConnectedNodeInfo[]; referenceImages: string[] } | undefined => {
    const store = useCanvasStore.getState();
    const edges = store.edges;
    const nodes = store.nodes;
    const connected: ConnectedNodeInfo[] = [];

    // Downstream: edges where this node is the source
    for (const edge of edges) {
      if (edge.source !== id) continue;
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!targetNode) continue;
      const info: ConnectedNodeInfo = {
        direction: 'downstream',
        handleId: edge.targetHandle || '',
        nodeType: targetNode.type || 'unknown',
      };
      const d = targetNode.data as Record<string, unknown>;
      if (targetNode.type === 'pluginNode') {
        info.pluginId = d.pluginId as string;
        info.name = (d.name as string) || (d.pluginId as string);
      } else if (targetNode.type === 'imageGenerator') {
        info.name = 'Image Generator';
        info.detail = d.model as string;
      } else if (targetNode.type === 'videoGenerator') {
        info.name = 'Video Generator';
        info.detail = d.model as string;
      } else if (targetNode.type === 'text') {
        info.name = 'Text Node';
      }
      connected.push(info);
    }

    // Upstream: edges where this node is the target
    const referenceImages: string[] = [];
    for (const edge of edges) {
      if (edge.target !== id) continue;
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;
      const info: ConnectedNodeInfo = {
        direction: 'upstream',
        handleId: edge.sourceHandle || '',
        nodeType: sourceNode.type || 'unknown',
      };
      const d = sourceNode.data as Record<string, unknown>;
      if (sourceNode.type === 'pluginNode') {
        info.pluginId = d.pluginId as string;
        info.name = (d.name as string) || (d.pluginId as string);
      } else if (sourceNode.type === 'media') {
        info.name = 'Media';
        info.detail = (d.mediaType as string) || 'image';
        const url = d.url as string;
        if (url) referenceImages.push(url);
      } else if (sourceNode.type === 'imageGenerator') {
        info.name = 'Image Generator';
        info.detail = d.model as string;
        const url = (d.outputUrl as string) || ((d.outputUrls as string[])?.[0]);
        if (url) referenceImages.push(url);
      } else if (sourceNode.type === 'text') {
        info.name = 'Text Node';
      }
      connected.push(info);
    }

    return connected.length > 0 || referenceImages.length > 0
      ? { connectedNodes: connected, referenceImages }
      : undefined;
  }, [id]);

  // ── Active prompt (for output edge) ──
  const activePromptId = ls.activePromptId || ls.generatedPrompts[ls.generatedPrompts.length - 1]?.id;

  const handleSelectPrompt = useCallback((promptId: string) => {
    setLs(prev => ({ ...prev, activePromptId: promptId }));
  }, []);

  // ── Node styling (matches AnimationNode) ──
  const nodeClasses = useMemo(() => {
    const base = 'node-drag-handle node-drag-surface animation-node w-[400px] min-h-[200px] max-h-[720px] rounded-xl overflow-hidden flex flex-col';
    if (selected) return `${base} ring-1 ring-[var(--an-accent)]/70`;
    return base;
  }, [selected]);

  // ── Header config ──
  const headerConfig = useMemo(() => {
    const activePrompt = ls.generatedPrompts.find(p => p.id === activePromptId);
    const activeLabel = activePrompt ? `${activePrompt.label || activePrompt.targetModel}` : '';

    switch (ls.phase) {
      case 'idle':
        return { statusColor: 'var(--an-text-placeholder)', statusText: 'Ready' };
      case 'generating':
        return { statusColor: 'var(--an-accent)', statusText: thinkingMsg || 'Generating...' };
      case 'chatting':
        return { statusColor: '#22c55e', statusText: activeLabel ? `Active — ${activeLabel}` : 'Active' };
      case 'complete':
        return { statusColor: '#22c55e', statusText: 'Complete' };
      case 'error':
        return { statusColor: '#ef4444', statusText: 'Error' };
      default:
        return { statusColor: 'var(--an-text-placeholder)', statusText: 'Ready' };
    }
  }, [ls.phase, thinkingMsg, activePromptId, ls.generatedPrompts]);

  // ── Build timeline ──
  type TimelineItem =
    | { kind: 'user'; data: PromptStudioMessage; seq: number; timeMs: number; idx: number }
    | { kind: 'assistant'; data: PromptStudioMessage; seq: number; timeMs: number; idx: number }
    | { kind: 'prompt'; data: GeneratedPrompt; seq: number; timeMs: number; idx: number }
    | { kind: 'qna'; data: QnASet; seq: number; timeMs: number; idx: number }
    | { kind: 'search'; data: SearchResult; seq: number; timeMs: number; idx: number }
    | { kind: 'thinking'; data: ThinkingBlockItem; seq: number; timeMs: number; idx: number };

  const timeline: TimelineItem[] = [];
  let timelineIdx = 0;
  ls.messages.forEach((m) => {
    timeline.push({
      kind: m.role === 'user' ? 'user' : 'assistant',
      data: m,
      seq: m.seq ?? 0,
      timeMs: toMs(m.timestamp),
      idx: timelineIdx++,
    });
  });
  ls.generatedPrompts.forEach((p) => {
    const tc = ls.toolCalls.find(tc => tc.toolName === 'generate_prompt' && tc.output?.includes(p.id));
    timeline.push({
      kind: 'prompt',
      data: p,
      seq: p.seq ?? tc?.seq ?? 0,
      timeMs: toMs(p.createdAt),
      idx: timelineIdx++,
    });
  });
  ls.qnaSets.forEach((q) => {
    timeline.push({
      kind: 'qna',
      data: q,
      seq: q.seq ?? 0,
      timeMs: toMs(q.createdAt),
      idx: timelineIdx++,
    });
  });
  ls.searchResults.forEach((s) => {
    timeline.push({
      kind: 'search',
      data: s,
      seq: s.seq ?? 0,
      timeMs: toMs(s.createdAt),
      idx: timelineIdx++,
    });
  });
  timeline.sort((a, b) => {
    if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
    if (a.seq !== b.seq) return a.seq - b.seq;
    return a.idx - b.idx;
  });

  const hasTimelineContent = timeline.length > 0 || !!ls.streamingText;

  // ── Handle QnA answer ──
  const handleQnAAnswer = useCallback((qnaId: string, answers: Record<string, string>) => {
    // Mark QnA as answered
    setLs(prev => ({
      ...prev,
      qnaSets: prev.qnaSets.map(q => q.id === qnaId ? { ...q, answered: true } : q),
    }));

    // Build a natural response from the selections
    const qna = ls.qnaSets.find(q => q.id === qnaId);
    if (!qna) return;

    const parts: string[] = [];
    for (const q of qna.questions) {
      const answer = answers[q.id];
      if (answer) parts.push(answer);
    }
    const responseText = parts.join(', ');

    // Set as input and auto-send
    setInputValue(responseText);
    // Use a microtask to let the inputValue state update, then trigger send
    setTimeout(() => {
      const sendBtn = document.querySelector(`[data-node-id="${id}"] [data-send-btn]`) as HTMLButtonElement;
      sendBtn?.click();
    }, 50);
  }, [ls.qnaSets, id]);

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
      seq: nextLocalSeq(),
    };

    const updatedState: PromptStudioNodeState = {
      ...latestStateRef.current,
      phase: 'generating',
      messages: [...latestStateRef.current.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };
    setLs(updatedState);
    setThinkingMsg('');
    setReasoning('');

    const agentMessages = updatedState.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let streamingAssistantText = '';
    const toolCallArgs = new Map<string, Record<string, unknown>>();
    const qnaToolCallIds = new Set<string>();
    const initialCounts = {
      prompts: updatedState.generatedPrompts.length,
      qnaSets: updatedState.qnaSets.length,
      searchResults: updatedState.searchResults.length,
    };
    const userConversationText = updatedState.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');

    // Helper: commit accumulated text as an assistant message
    const commitTextSegment = () => {
      const cleanText = streamingAssistantText.replace(/<[^>]*>/g, '').trim();
      if (cleanText) {
        const textMsg: PromptStudioMessage = {
          id: `msg_${Date.now()}_seg_${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: cleanText,
          timestamp: new Date().toISOString(),
          seq: nextLocalSeq(),
        };
        setLs(prev => ({ ...prev, messages: [...prev.messages, textMsg] }));
      }
      streamingAssistantText = '';
      setLs(prev => ({ ...prev, streamingText: undefined }));
    };

    const canvasCtx = getCanvasContext();
    const referenceImages = canvasCtx?.referenceImages?.length ? canvasCtx.referenceImages : undefined;
    await stream(agentMessages, {
      nodeId: id,
      phase: 'generating',
      canvasContext: canvasCtx ? { connectedNodes: canvasCtx.connectedNodes } : undefined,
      referenceImages,
    }, {
      onTextDelta: (delta) => {
        streamingAssistantText += delta;
        setLs(prev => ({ ...prev, streamingText: streamingAssistantText }));
      },
      onReasoningDelta: (delta) => {
        setReasoning(prev => prev + delta);
      },
      onToolCall: (event) => {
        toolCallArgs.set(event.toolCallId, event.args);

        // set_thinking: just update header, don't commit text
        if (event.toolName === 'set_thinking') {
          setThinkingMsg(event.args.message as string || '');
          return;
        }

        // Commit any accumulated text BEFORE this tool call
        commitTextSegment();

        // ask_questions: create QnA set immediately from tool-call args
        if (event.toolName === 'ask_questions') {
          const questions = (event.args.questions as QnAQuestion[]) || [];
          const qnaSet: QnASet = {
            id: `qna_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            questions,
            answered: false,
            createdAt: new Date().toISOString(),
            seq: nextLocalSeq(),
          };
          setLs(prev => ({ ...prev, qnaSets: [...prev.qnaSets, qnaSet] }));
          qnaToolCallIds.add(event.toolCallId);
          setThinkingMsg('');
          return;
        }

        // Other tools: create tool call item
        const tcItem: ToolCallItem = {
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          displayName: TOOL_DISPLAY_NAMES[event.toolName] || event.toolName,
          status: 'running',
          args: event.args,
          timestamp: new Date().toISOString(),
          seq: nextLocalSeq(),
        };
        setLs(prev => ({ ...prev, toolCalls: [...prev.toolCalls, tcItem] }));
      },
      onToolResult: (event) => {
        if (event.toolName === 'set_thinking') return;

        const args = event.args || toolCallArgs.get(event.toolCallId) || {};

        // Fallback: if ask_questions call event was missed, recover from tool-result args.
        if (event.toolName === 'ask_questions') {
          if (!event.isError && !qnaToolCallIds.has(event.toolCallId)) {
            const questions = Array.isArray(args.questions) ? args.questions as QnAQuestion[] : [];
            if (questions.length > 0) {
              const qnaSet: QnASet = {
                id: `qna_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                questions,
                answered: false,
                createdAt: new Date().toISOString(),
                seq: nextLocalSeq(),
              };
              setLs(prev => ({ ...prev, qnaSets: [...prev.qnaSets, qnaSet] }));
              qnaToolCallIds.add(event.toolCallId);
            }
          }
          return;
        }

        // Update tool call status
        setLs(prev => ({
          ...prev,
          toolCalls: prev.toolCalls.map(tc =>
            tc.toolCallId === event.toolCallId
              ? { ...tc, status: (event.isError ? 'failed' : 'done') as 'done' | 'failed' }
              : tc
          ),
        }));

        // generate_prompt → create prompt
        if (event.toolName === 'generate_prompt' && !event.isError) {
          const targetModel = resolvePromptTargetModel({
            requestedTargetModel: args.targetModel as string | undefined,
            userConversationText,
            connectedNodes: canvasCtx?.connectedNodes,
          });
          const newPrompt: GeneratedPrompt = {
            id: (event.result.promptId as string) || `prompt_${Date.now()}`,
            prompt: (args.prompt as string) || '',
            targetModel,
            label: args.label as string | undefined,
            negativePrompt: args.negativePrompt as string | undefined,
            parameters: args.parameters as Record<string, string> | undefined,
            createdAt: new Date().toISOString(),
            seq: nextLocalSeq(),
          };
          setLs(prev => ({
            ...prev,
            generatedPrompts: [...prev.generatedPrompts, newPrompt],
            // Auto-select the latest prompt
            activePromptId: newPrompt.id,
          }));
        }

        // search_web → create search result
        if (event.toolName === 'search_web' && !event.isError) {
          const result = event.result;
          const searchResult: SearchResult = {
            id: (result.searchId as string) || `search_${Date.now()}`,
            query: (result.query as string) || '',
            results: (result.results as SearchResult['results']) || [],
            createdAt: new Date().toISOString(),
            seq: nextLocalSeq(),
          };
          setLs(prev => ({ ...prev, searchResults: [...prev.searchResults, searchResult] }));
        }
      },
      onComplete: () => {
        setThinkingMsg('');
        // Commit any remaining text after the last tool call
        const cleanText = streamingAssistantText.replace(/<[^>]*>/g, '').trim();
        setLs(prev => {
          const noStructuredOutput =
            prev.generatedPrompts.length === initialCounts.prompts
            && prev.qnaSets.length === initialCounts.qnaSets
            && prev.searchResults.length === initialCounts.searchResults;
          if (!cleanText && noStructuredOutput) {
            const newState: PromptStudioNodeState = {
              ...prev,
              phase: 'error',
              error: { message: 'No response received from Prompt Studio. Please retry.', canRetry: true },
              streamingText: undefined,
              reasoning: undefined,
              updatedAt: new Date().toISOString(),
            };
            return newState;
          }

          const assistantMsg: PromptStudioMessage | null = cleanText ? {
            id: `msg_${Date.now()}_asst`,
            role: 'assistant',
            content: cleanText,
            timestamp: new Date().toISOString(),
            seq: nextLocalSeq(),
          } : null;
          const newState: PromptStudioNodeState = {
            ...prev,
            phase: 'chatting',
            messages: assistantMsg ? [...prev.messages, assistantMsg] : prev.messages,
            streamingText: undefined,
            reasoning: undefined,
            updatedAt: new Date().toISOString(),
          };
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
          return newState;
        });
      },
    });
  }, [inputValue, isStreaming, id, stream, getCanvasContext, nextLocalSeq]);

  const handleReset = useCallback(() => {
    abort();
    const newState = createDefaultState(id);
    setLs(newState);
    setThinkingMsg('');
    setReasoning('');
    setInputValue('');
  }, [id, abort]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const canSend = !isStreaming && inputValue.trim().length > 0;
  const latestPrompt = ls.generatedPrompts[ls.generatedPrompts.length - 1];
  const latestAssistantMessage = [...ls.messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content.trim());
  const promptStudioSummary = latestPrompt?.prompt
    || latestAssistantMessage?.content
    || 'Describe a visual direction and Prompt Studio will shape it into a production-ready prompt.';

  if (displayMode !== 'full') {
    return (
      <div data-node-id={id} {...focusProps}>
        <div className="mb-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--node-title-animation)' }}>
          <Sparkles className="h-4 w-4" />
          {data.name || 'Prompt Studio'}
        </div>

        <div className={nodeClasses}>
          <div className={`node-body flex-1 ${displayMode === 'compact' ? 'node-compact' : 'node-summary'}`}>
            <div className="node-content-area rounded-xl p-3">
              <p className="text-xs font-medium text-[var(--an-text-muted)]">
                {isStreaming ? (thinkingMsg || 'Generating...') : headerConfig.statusText}
              </p>
              <p className="mt-1 text-sm text-[var(--an-text)]/85 line-clamp-4">
                {promptStudioSummary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--an-text-dim)]">
              <span>{ls.generatedPrompts.length} prompt{ls.generatedPrompts.length === 1 ? '' : 's'}</span>
              <span>{ls.qnaSets.length} Q&A</span>
              <span>{ls.searchResults.length} result{ls.searchResults.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(0) }}>
            <div className="relative">
              <Handle type="target" position={Position.Left} id="text"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
              <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
            </div>
          </div>

          <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(1) }}>
            <div className="relative">
              <Handle type="target" position={Position.Left} id="reference"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
              <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
            </div>
          </div>

          <div className="absolute -right-3 z-10 group" style={{ top: '40%', transform: 'translateY(-50%)' }}>
            <div className="relative">
              <Handle type="source" position={Position.Right} id="prompt-output"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
              <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-node-id={id} {...focusProps}>
      {/* Node Title — matches AnimationNode / SvgStudio */}
      <div className="mb-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--node-title-animation)' }}>
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
            <p className="text-[10px] leading-tight truncate" style={{ color: headerConfig.statusColor }}>
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

        {ls.error?.message && (
          <div className="px-3.5 py-2 border-b border-[var(--an-border-error)] bg-[var(--an-bg-error)]">
            <p className="text-[10px] leading-snug text-red-400 line-clamp-3" title={ls.error.message}>
              {ls.error.message}
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasTimelineContent && ls.phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-3.5 py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--an-accent-bg)] flex items-center justify-center">
              <Palette className="w-5 h-5 text-[var(--an-accent)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--an-text-secondary)] font-medium">Creative Director</p>
              <p className="text-[10px] text-[var(--an-text-dim)] mt-0.5 max-w-[260px]">
                Describe what you want to create and I&apos;ll craft the perfect prompt for any model.
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
                  return (
                    <PromptCard
                      key={item.data.id}
                      prompt={item.data}
                      isActive={item.data.id === activePromptId}
                      onSelect={() => handleSelectPrompt(item.data.id)}
                    />
                  );
                }
                if (item.kind === 'qna') {
                  return (
                    <QnACard
                      key={item.data.id}
                      qna={item.data}
                      onAnswer={(answers) => handleQnAAnswer(item.data.id, answers)}
                      disabled={isStreaming}
                    />
                  );
                }
                if (item.kind === 'search') {
                  return <SearchResultCard key={item.data.id} search={item.data} />;
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
                  data-send-btn
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

        {/* ── Input Handle: Text (left top) ── */}
        <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(0) }}>
          <div className="relative">
            <Handle type="target" position={Position.Left} id="text"
              className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
            <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
          </div>
          <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">Text input</span>
        </div>

        {/* ── Input Handle: Image reference (left bottom) ── */}
        <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(1) }}>
          <div className="relative">
            <Handle type="target" position={Position.Left} id="reference"
              className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
            <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
          </div>
          <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">Image reference</span>
        </div>

        {/* ── Output Handle: Prompt text (right) ── */}
        <div className="absolute -right-3 z-10 group" style={{ top: '40%', transform: 'translateY(-50%)' }}>
          <div className="relative">
            <Handle type="source" position={Position.Right} id="prompt-output"
              className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
            <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
          </div>
          <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">Prompt output</span>
        </div>
      </div>
    </div>
  );
}

export const PromptStudioNode = memo(PromptStudioNodeComponent);
