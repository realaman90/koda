'use client';

import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { PluginNodeData } from '@/lib/types';
import { useCanvasStore } from '@/stores/canvas-store';
import { PenTool, Play, RefreshCw, Type, ImageIcon, Code, Download, Copy, Check, Eye, CodeIcon } from 'lucide-react';
import { createDefaultSvgStudioState, type SvgStudioNodeData, type SvgStudioState } from './types';

function SvgStudioNodeComponent({ id, data, selected }: NodeProps<Node<PluginNodeData, 'pluginNode'>>) {
  const nodeData = data as unknown as SvgStudioNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateNodeInternals = useUpdateNodeInternals();
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [nodeName, setNodeName] = useState(nodeData.name || 'SVG Studio');
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // Re-sync handle positions when node content changes size
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, state.phase, showCode, updateNodeInternals]);

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

  const submit = async () => {
    if (!state.prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    updateState({ phase: 'working', error: undefined });

    try {
      const res = await fetch('/api/plugins/svg-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: state.mode,
          prompt: state.prompt.trim(),
          svg: state.mode === 'edit' ? state.sourceSvg : undefined,
          persistAsset: true,
          nodeId: id,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'SVG generation failed');
      }

      updateNodeData(id, {
        outputUrl: payload.asset?.url,
        outputMimeType: payload.asset?.mimeType ?? 'image/svg+xml',
        outputType: 'image',
        outputSvgCode: payload.svg,
      });

      updateState({
        phase: 'ready',
        svg: payload.svg,
        metadata: payload.metadata,
        asset: payload.asset,
        error: undefined,
      });
    } catch (err) {
      updateState({
        phase: 'error',
        error: err instanceof Error ? err.message : 'SVG generation failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-svg)' }}>
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
        relative w-[420px] rounded-2xl overflow-visible
        transition-all duration-150
        ${isSubmitting ? 'animate-subtle-pulse generating-border-subtle' : ''}
        ${!isSubmitting ? (selected ? 'node-card node-card-selected' : 'node-card') : ''}
      `}>
        {/* Loading State */}
        {isSubmitting ? (
          <div className="p-4 min-h-[200px] flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--node-card-bg)' }}>
            {state.prompt && (
              <p className="text-muted-foreground text-xs text-center line-clamp-2 max-w-[90%]">
                {state.prompt}
              </p>
            )}
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
                Generating SVG...
              </p>
              <p className="text-muted-foreground text-xs mt-1">This may take a moment</p>
            </div>
          </div>
        ) : (
        <div>
        <div className="p-3">
          <div className="node-content-area p-3 min-h-[120px]">
            <textarea
              value={state.prompt}
              onChange={(e) => updateState({ prompt: e.target.value })}
              placeholder="Describe the SVG you want to create..."
              className="w-full h-[90px] bg-transparent border-none text-sm resize-none focus:outline-none"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="SVG prompt"
            />
          </div>
        </div>

        {state.mode === 'edit' && (
          <div className="px-3 pb-2">
            <div className="node-content-area p-2">
              <textarea
                value={state.sourceSvg || ''}
                onChange={(e) => updateState({ sourceSvg: e.target.value })}
                placeholder="Paste existing SVG to edit"
                className="w-full min-h-[90px] text-[10px] bg-transparent border-none text-muted-foreground resize-none font-mono focus:outline-none"
                aria-label="Source SVG"
              />
            </div>
          </div>
        )}

        {state.error && <div className="text-xs text-red-400 px-4 pb-2">{state.error}</div>}

        {/* Bottom Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 node-bottom-toolbar">
          <button
            onClick={() => updateState({ mode: 'generate' })}
            className={`h-7 px-2 text-xs rounded-md transition-colors ${state.mode === 'generate' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
          >
            Generate
          </button>
          <button
            onClick={() => updateState({ mode: 'edit' })}
            className={`h-7 px-2 text-xs rounded-md transition-colors ${state.mode === 'edit' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
          >
            Edit
          </button>
          {state.phase === 'ready' && (
            <button
              onClick={() => updateState({ svg: undefined, metadata: undefined, asset: undefined, phase: 'idle' })}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Reset"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={submit}
            disabled={isSubmitting || !state.prompt.trim()}
            className="h-8 w-8 min-w-8 flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-40 shrink-0 transition-all duration-200 hover:scale-105"
            aria-label="Generate SVG"
          >
            <Play className="h-4 w-4" />
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
              <div className="bg-white rounded p-1 max-h-[420px] overflow-auto">
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(state.svg)}`} alt="SVG output" className="max-w-full h-auto" />
              </div>
            )}
          </div>
        )}
      </div>
        )}

      {/* Input Handle - Text (left top) */}
      <div className="absolute -left-3 group" style={{ top: '30%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle type="target" position={Position.Left} id="text" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-yellow-500 !border-zinc-900 hover:!border-zinc-700" />
          <Type className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">Text input</span>
      </div>

      {/* Input Handle - Image ref (left bottom) */}
      <div className="absolute -left-3 group" style={{ top: '70%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle type="target" position={Position.Left} id="reference" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-red-400 !border-zinc-900 hover:!border-zinc-700" />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">Image reference</span>
      </div>

      {/* Output Handle - Image (right top) */}
      <div className="absolute -right-3 group" style={{ top: '30%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle type="source" position={Position.Right} id="image-output" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-teal-500 !border-zinc-900 hover:!border-zinc-700" />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">SVG image</span>
      </div>

      {/* Output Handle - Code (right bottom) */}
      <div className="absolute -right-3 group" style={{ top: '70%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle type="source" position={Position.Right} id="code-output" className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-emerald-500 !border-zinc-900 hover:!border-zinc-700" />
          <Code className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
        </div>
        <span className="absolute right-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">SVG code</span>
      </div>
      </div>
    </div>
  );
}

export const SvgStudioNode = memo(SvgStudioNodeComponent);
