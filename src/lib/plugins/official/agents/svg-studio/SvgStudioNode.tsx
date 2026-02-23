'use client';

import { memo, useMemo, useState } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { PluginNodeData } from '@/lib/types';
import { useCanvasStore } from '@/stores/canvas-store';
import { PenTool, Loader2, RefreshCw } from 'lucide-react';
import { createDefaultSvgStudioState, type SvgStudioNodeData, type SvgStudioState } from './types';

function SvgStudioNodeComponent({ id, data, selected }: NodeProps<Node<PluginNodeData, 'pluginNode'>>) {
  const nodeData = data as unknown as SvgStudioNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state: SvgStudioState = useMemo(() => {
    const base = createDefaultSvgStudioState();
    if (!nodeData.state) return base;
    return { ...base, ...nodeData.state };
  }, [nodeData.state]);

  const updateState = (patch: Partial<SvgStudioState>) => {
    updateNodeData(id, {
      state: {
        ...state,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  };

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
    <div className={`w-[420px] rounded-xl border bg-zinc-950 border-zinc-800 overflow-hidden ${selected ? 'ring-1 ring-emerald-500/70' : ''}`}>
      <div className="drag-handle flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <div className="h-7 w-7 rounded-md bg-emerald-500/15 flex items-center justify-center">
          <PenTool className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-sm font-semibold text-zinc-100">{nodeData.name || 'SVG Studio'}</div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex gap-1">
          <button
            onClick={() => updateState({ mode: 'generate' })}
            className={`px-2 py-1 text-xs rounded ${state.mode === 'generate' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-zinc-400'}`}
          >
            Generate
          </button>
          <button
            onClick={() => updateState({ mode: 'edit' })}
            className={`px-2 py-1 text-xs rounded ${state.mode === 'edit' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-zinc-400'}`}
          >
            Edit
          </button>
        </div>

        <textarea
          value={state.prompt}
          onChange={(e) => updateState({ prompt: e.target.value })}
          placeholder="Describe the SVG you want to create..."
          className="w-full min-h-[74px] text-xs rounded bg-zinc-900 border border-zinc-800 text-zinc-200 p-2 outline-none"
          aria-label="SVG prompt"
        />

        {state.mode === 'edit' && (
          <textarea
            value={state.sourceSvg || ''}
            onChange={(e) => updateState({ sourceSvg: e.target.value })}
            placeholder="Paste existing SVG to edit"
            className="w-full min-h-[90px] text-[10px] rounded bg-zinc-900 border border-zinc-800 text-zinc-300 p-2 font-mono outline-none"
            aria-label="Source SVG"
          />
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={submit}
            disabled={isSubmitting || !state.prompt.trim()}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs text-white"
            aria-label="Generate SVG"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Run'}
          </button>

          {state.phase === 'ready' && (
            <button
              onClick={() => updateState({ svg: undefined, metadata: undefined, asset: undefined, phase: 'idle' })}
              className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>

        {state.error && <div className="text-xs text-red-400">{state.error}</div>}

        {state.svg && (
          <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
            <div className="text-[10px] text-zinc-400 mb-1">
              Paths: {state.metadata?.pathCount ?? 0} · Elements: {state.metadata?.elementCount ?? 0}
            </div>
            <div className="bg-white rounded p-1 max-h-[220px] overflow-auto">
              <img src={`data:image/svg+xml;utf8,${encodeURIComponent(state.svg)}`} alt="SVG output" className="max-w-full h-auto" />
            </div>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="svg-input" className="!w-3 !h-3 !bg-zinc-500" style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} id="svg-output" className="!w-3 !h-3 !bg-emerald-500" style={{ top: '50%' }} />
    </div>
  );
}

export const SvgStudioNode = memo(SvgStudioNodeComponent);
