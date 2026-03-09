'use client';

import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { PluginNodeData } from '@/lib/types';
import { useCanvasStore } from '@/stores/canvas-store';
import { PenTool, Play, RefreshCw, Type, ImageIcon, Code, Download, Copy, Check, Eye, CodeIcon, Square, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { getApiErrorMessage, normalizeApiErrorMessage } from '@/lib/client/api-error';
import { createDefaultSvgStudioState, type SvgStudioNodeData, type SvgStudioState, type SvgStudioModel, type SvgStudioPhase } from './types';
import { useNodeDisplayMode } from '@/components/canvas/nodes/useNodeDisplayMode';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';

const QUIVER_ENABLED = process.env.NEXT_PUBLIC_QUIVER_ENABLED === 'true';

const PHASE_LABELS: Record<SvgStudioPhase, string> = {
  idle: '',
  reasoning: 'Thinking...',
  drafting: 'Drafting...',
  generating: 'Generating SVG...',
  finalizing: 'Finalizing...',
  ready: '',
  error: '',
};

const MODEL_OPTIONS: Array<{ value: SvgStudioModel; label: string; credits: number }> = [
  { value: 'gemini', label: 'Simple', credits: 2 },
  ...(QUIVER_ENABLED ? [{ value: 'quiver-arrow' as SvgStudioModel, label: 'Premium', credits: 10 }] : []),
];

function SvgStudioNodeComponent({ id, data, selected }: NodeProps<Node<PluginNodeData, 'pluginNode'>>) {
  const nodeData = data as unknown as SvgStudioNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateNodeInternals = useUpdateNodeInternals();
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const addToHistory = useSettingsStore((s) => s.addToHistory);
  const getConnectedInputs = useCanvasStore((s) => s.getConnectedInputs);
  const { displayMode, focusProps } = useNodeDisplayMode(selected);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [partialSvg, setPartialSvg] = useState<string | null>(null);
  const [streamPhase, setStreamPhase] = useState<SvgStudioPhase>('idle');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [nodeName, setNodeName] = useState(nodeData.name || 'SVG Studio');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (!showDownloadMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as globalThis.Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDownloadMenu]);

  useEffect(() => {
    if (!showModelMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as globalThis.Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showModelMenu]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    if (nodeName.trim() && nodeName !== (nodeData.name || 'SVG Studio')) {
      updateNodeData(id, { name: nodeName.trim() });
    }
  }, [id, nodeName, nodeData.name, updateNodeData]);

  const state: SvgStudioState = useMemo(() => {
    const base = createDefaultSvgStudioState();
    if (!nodeData.state) return base;
    return { ...base, ...nodeData.state };
  }, [nodeData.state]);
  const [promptDraft, setPromptDraft] = useState(state.prompt);

  useEffect(() => {
    setPromptDraft(state.prompt);
  }, [id, state.prompt]);

  // Re-sync handle positions when node content changes size
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, state.phase, showCode, partialSvg, updateNodeInternals]);

  const updateState = (patch: Partial<SvgStudioState>) => {
    updateNodeData(id, {
      state: {
        ...state,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const downloadSvg = useCallback(() => {
    if (!state.svg) return;
    const blob = new Blob([state.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(nodeData.name || 'svg-studio').replace(/\s+/g, '-').toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  }, [state.svg, nodeData.name]);

  const downloadPng = useCallback(() => {
    if (!state.svg) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(nodeData.name || 'svg-studio').replace(/\s+/g, '-').toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(state.svg)}`;
    setShowDownloadMenu(false);
  }, [state.svg, nodeData.name]);

  const cancelGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const enhancePrompt = useCallback(async () => {
    if (!promptDraft.trim() || isEnhancing || isSubmitting) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/agents/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptDraft.trim(), type: 'svg' }),
      });
      if (!res.ok) throw new Error('Enhancement failed');
      const data = await res.json();
      if (data.enhancedPrompt) {
        setPromptDraft(data.enhancedPrompt);
        updateState({ prompt: data.enhancedPrompt });
      }
    } catch (err) {
      console.error('[svg-studio] Enhance prompt failed:', err);
    } finally {
      setIsEnhancing(false);
    }
  }, [isEnhancing, isSubmitting, promptDraft, updateState]);

  const submit = async () => {
    if (!promptDraft.trim() || isSubmitting) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setIsSubmitting(true);
    setPartialSvg(null);
    setStreamPhase('generating');
    if (promptDraft !== state.prompt) {
      updateState({ prompt: promptDraft });
    }
    updateState({ phase: 'generating', error: undefined, partialSvg: undefined });

    const modelName = state.model || 'gemini';

    // Resolve connected edge inputs
    const connectedInputs = getConnectedInputs(id);
    const prompt = connectedInputs.textContent
      ? `${connectedInputs.textContent}\n\n${promptDraft.trim()}`
      : promptDraft.trim();
    const references = connectedInputs.referenceUrl ? [connectedInputs.referenceUrl] : undefined;

    try {
      const res = await fetch('/api/plugins/svg-studio/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: (state.svg || state.sourceSvg) ? 'edit' : 'generate',
          prompt,
          model: modelName,
          svg: state.svg || state.sourceSvg || undefined,
          references,
          persistAsset: true,
          nodeId: id,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const message = await getApiErrorMessage(res, `HTTP ${res.status}`);
        throw new Error(message);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const eventData = JSON.parse(dataStr) as Record<string, unknown>;

              switch (currentEvent) {
                case 'phase': {
                  const phase = eventData.phase as SvgStudioPhase;
                  setStreamPhase(phase);
                  break;
                }
                case 'svg-update': {
                  const svg = eventData.svg as string;
                  if (svg) setPartialSvg(svg);
                  break;
                }
                case 'complete': {
                  const svg = eventData.svg as string;
                  const metadata = eventData.metadata as SvgStudioState['metadata'];
                  const asset = eventData.asset as SvgStudioState['asset'];

                  setPartialSvg(null);

                  updateNodeData(id, {
                    outputUrl: asset?.url,
                    outputMimeType: asset?.mimeType ?? 'image/svg+xml',
                    outputType: 'image',
                    outputSvgCode: svg,
                  });

                  updateState({
                    phase: 'ready',
                    svg,
                    metadata,
                    asset,
                    partialSvg: undefined,
                    error: undefined,
                  });

                  addToHistory({
                    type: 'svg',
                    prompt: promptDraft.trim(),
                    model: modelName === 'quiver-arrow' ? 'quiver-arrow' : 'gemini-3.1-pro-preview',
                    status: 'completed',
                    result: { urls: asset?.url ? [asset.url] : [] },
                  });
                  break;
                }
                case 'error': {
                  throw new Error(eventData.error as string || 'SVG generation failed');
                }
              }
            } catch (parseErr) {
              // If it's a thrown error from the switch, re-throw
              if (parseErr instanceof Error && parseErr.message !== 'SVG generation failed') {
                // Check if it's from our switch vs JSON.parse
                if (currentEvent === 'error' || currentEvent === 'complete') {
                  throw parseErr;
                }
              }
              // Otherwise ignore malformed SSE lines
            }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        updateState({ phase: 'idle', error: undefined, partialSvg: undefined });
      } else {
        const errorMessage = normalizeApiErrorMessage(err, 'SVG generation failed');
        updateState({ phase: 'error', error: errorMessage, partialSvg: undefined });

        addToHistory({
          type: 'svg',
          prompt: promptDraft.trim() || '(no prompt)',
          model: modelName === 'quiver-arrow' ? 'quiver-arrow' : 'gemini-3.1-pro-preview',
          status: 'failed',
          error: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
      setPartialSvg(null);
      setStreamPhase('idle');
      abortRef.current = null;
    }
  };

  // The SVG to display in the preview area — partial during streaming, final when ready
  const displaySvg = partialSvg || state.svg;
  const selectedModel = MODEL_OPTIONS.find((m) => m.value === state.model) || MODEL_OPTIONS[0];
  const connectedInputs = getConnectedInputs(id);
  const hasReference = !!connectedInputs.referenceUrl;
  const hasTextInput = !!connectedInputs.textContent;
  const svgSummary = promptDraft.replace(/\s+/g, ' ').trim() || 'Describe the SVG you want to create.';

  if (displayMode !== 'full') {
    return (
      <div {...focusProps}>
        <div className="mb-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--node-title-svg)' }}>
          <PenTool className="h-4 w-4" />
          {nodeData.name || 'SVG Studio'}
        </div>

        <div className={`node-drag-handle node-drag-surface ${selected ? 'node-card node-card-selected' : 'node-card'} relative w-[420px] rounded-2xl overflow-visible`}>
          <div className={`node-body min-h-[180px] ${displayMode === 'compact' ? 'node-compact' : 'node-summary'}`}>
            <div className="node-content-area rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {state.phase === 'ready' ? 'SVG ready' : PHASE_LABELS[state.phase] || 'Ready'}
              </p>
              <p className="mt-1 text-sm text-foreground/85 line-clamp-4">
                {svgSummary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{selectedModel.label}</span>
              {hasTextInput && <span>Text connected</span>}
              {hasReference && <span>Reference image</span>}
              {state.svg && <span>Output ready</span>}
            </div>
          </div>

          <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(0) }}>
            <div className="relative">
              <Handle type="target" position={Position.Left} id="text" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
              <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
            </div>
          </div>

          <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(1) }}>
            <div className="relative">
              <Handle type="target" position={Position.Left} id="reference" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
              <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
            </div>
          </div>

          <div className="absolute -right-3 z-10 group" style={{ top: '30%', transform: 'translateY(-50%)' }}>
            <div className="relative">
              <Handle type="source" position={Position.Right} id="image-output" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
              <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
            </div>
          </div>

          <div className="absolute -right-3 z-10 group" style={{ top: '70%', transform: 'translateY(-50%)' }}>
            <div className="relative">
              <Handle type="source" position={Position.Right} id="code-output" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
              <Code className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div {...focusProps}>
      {/* Node Title */}
      <div className="mb-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--node-title-svg)' }}>
        <PenTool className="h-4 w-4" />
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
                setNodeName(nodeData.name || 'SVG Studio');
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
            {nodeData.name || 'SVG Studio'}
          </span>
        )}
      </div>

      <div className={`
        node-drag-handle node-drag-surface relative w-[420px] rounded-2xl overflow-visible
        transition-all duration-150
        ${isSubmitting ? 'node-card animate-subtle-pulse generating-border-subtle' : ''}
        ${!isSubmitting ? (selected ? 'node-card node-card-selected' : 'node-card') : ''}
      `}>
        {/* Streaming State — show partial SVG preview */}
        {isSubmitting ? (
          <div className="rounded-2xl" style={{ backgroundColor: 'var(--node-card-bg)' }}>
            {/* Prompt area — mirrors idle layout */}
            <div className="p-3">
              <div className="node-content-area p-3 rounded-xl">
                <p className="text-sm line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                  {promptDraft}
                </p>
              </div>
            </div>

            {/* Progressive SVG preview or shimmer */}
            {partialSvg ? (
              <div className="px-3 pb-3">
                <div
                  className="rounded-xl p-1 min-h-[200px] max-h-[300px] overflow-auto [&>svg]:w-full [&>svg]:h-full [&>svg]:min-h-[190px]"
                  style={{ background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}
                  dangerouslySetInnerHTML={{ __html: partialSvg }}
                />
              </div>
            ) : (
              <div className="px-3 pb-3">
                <div className="rounded-xl min-h-[160px] flex flex-col items-center justify-center gap-3" style={{ background: 'repeating-conic-gradient(hsl(var(--muted)/0.5) 0% 25%, hsl(var(--muted)/0.2) 0% 50%) 0 0 / 16px 16px' }}>
                  <div className="text-center">
                    <p
                      className="text-base font-semibold bg-clip-text text-transparent"
                      style={{
                        backgroundImage:
                          'linear-gradient(90deg, hsl(var(--muted-foreground)/0.45) 0%, hsl(var(--foreground)/0.95) 45%, hsl(var(--muted-foreground)/0.45) 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer-text 2s ease-in-out infinite',
                      }}
                    >
                      {PHASE_LABELS[streamPhase] || 'Generating SVG...'}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {selectedModel.label} · {selectedModel.credits} credits
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom bar — phase + stop button */}
            <div className="flex items-center gap-1.5 px-3 py-2.5 node-bottom-toolbar rounded-b-2xl">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <p className="text-muted-foreground text-[11px]">
                  {PHASE_LABELS[streamPhase] || 'Generating...'}
                </p>
              </div>
              <div className="flex-1" />
              <button
                onClick={cancelGeneration}
                className="h-8 w-8 min-w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Cancel generation"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
        <div>
        <div className="p-3">
          <div className="node-content-area p-3 min-h-[120px]">
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              onBlur={() => {
                if (promptDraft !== state.prompt) {
                  updateState({ prompt: promptDraft });
                }
              }}
              placeholder="Describe the SVG you want to create..."
              className="w-full h-[90px] bg-transparent border-none text-sm resize-none focus:outline-none"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="SVG prompt"
            />
          </div>
        </div>

        {/* Connected input indicators */}
        {(hasReference || hasTextInput) && (
          <div className="flex items-center gap-1.5 px-4 pb-1.5">
            {hasTextInput && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500">Text connected</span>
            )}
            {hasReference && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400">Reference image</span>
            )}
          </div>
        )}

        {state.error && <div className="text-xs text-red-400 px-4 pb-2">{state.error}</div>}

        {/* Bottom Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 node-bottom-toolbar">
          {state.phase === 'ready' && (
            <button
              onClick={() => updateState({ svg: undefined, metadata: undefined, asset: undefined, phase: 'idle', partialSvg: undefined })}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Reset"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Model selector — only visible when Quiver is enabled */}
          {MODEL_OPTIONS.length > 1 && (
            <div className="relative" ref={modelMenuRef}>
              <button
                onClick={() => setShowModelMenu((s) => !s)}
                className="h-7 flex items-center gap-1 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Select model"
              >
                <span>{selectedModel.label}</span>
                <span className="text-[10px] opacity-60">{selectedModel.credits}cr</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showModelMenu && (
                <div className="absolute left-0 bottom-full mb-1 z-50 min-w-[140px] rounded-md border border-border bg-popover py-0.5 shadow-lg">
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        updateState({ model: opt.value });
                        setShowModelMenu(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] hover:bg-muted ${
                        state.model === opt.value ? 'text-primary font-medium' : 'text-foreground'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.credits} cr</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />
            <button
              onClick={enhancePrompt}
            disabled={isEnhancing || isSubmitting || !promptDraft.trim()}
            className="h-7 flex items-center gap-1 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            title="Enhance prompt for better SVG results"
          >
            {isEnhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            <span>Enhance</span>
          </button>
          <button
            onClick={submit}
            disabled={isSubmitting || !promptDraft.trim()}
            className="h-10 w-10 min-w-10 flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-full disabled:opacity-40 shrink-0 transition-all duration-200 hover:scale-105"
            aria-label="Generate SVG"
          >
            <Play className="h-4 w-4 ml-0.5 fill-current" />
          </button>
        </div>

        {state.svg && (
          <div className="rounded border border-border bg-muted/50 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground">
                Paths: {state.metadata?.pathCount ?? 0} · Elements: {state.metadata?.elementCount ?? 0}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setShowCode(false)}
                  className={`p-1 rounded transition-colors ${!showCode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Preview"
                >
                  <Eye className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowCode(true)}
                  className={`p-1 rounded transition-colors ${showCode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Code"
                >
                  <CodeIcon className="w-3 h-3" />
                </button>
                <div className="w-px h-3 bg-border mx-0.5" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(state.svg!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy SVG code"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <div className="relative" ref={downloadMenuRef}>
                  <button
                    onClick={() => setShowDownloadMenu((s) => !s)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Download"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[100px] rounded-md border border-border bg-popover py-0.5 shadow-lg">
                      <button onClick={downloadSvg} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted">
                        SVG
                      </button>
                      <button onClick={downloadPng} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted">
                        PNG
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {showCode ? (
              <pre className="bg-background rounded p-2 max-h-[420px] overflow-auto text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
                {state.svg}
              </pre>
            ) : (
              <div className="rounded p-1 max-h-[420px] overflow-auto" style={{ background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}>
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(state.svg)}`} alt="SVG output" className="max-w-full h-auto" />
              </div>
            )}
          </div>
        )}
      </div>
        )}

      {/* Input Handle - Text (left top) */}
      <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(0) }}>
        <div className="relative">
          <Handle type="target" position={Position.Left} id="text" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">Text input</span>
      </div>

      {/* Input Handle - Image ref (left bottom) */}
      <div className="absolute -left-3 z-10 group" style={{ top: getPromptHeavyInputHandleTop(1) }}>
        <div className="relative">
          <Handle type="target" position={Position.Left} id="reference" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">Image reference</span>
      </div>

      {/* Output Handle - Image (right top) */}
      <div className="absolute -right-3 z-10 group" style={{ top: '30%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle type="source" position={Position.Right} id="image-output" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">SVG image</span>
      </div>

      {/* Output Handle - Code (right bottom) */}
      <div className="absolute -right-3 z-10 group" style={{ top: '70%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle type="source" position={Position.Right} id="code-output" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle" />
          <Code className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-output-icon)]" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">SVG code</span>
      </div>
      </div>
    </div>
  );
}

export const SvgStudioNode = memo(SvgStudioNodeComponent);
