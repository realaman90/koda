'use client';

/**
 * Product Shot Node
 *
 * Canvas node for generating product shot plans. Takes a product image
 * and generates optimal angles/compositions as ImageGenerator nodes.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasAPI } from '@/lib/plugins/canvas-api';
import type {
  ProductShotNode as ProductShotNodeType,
  ProductShotNodeData,
  ProductShotShotData,
  ProductShotBackground,
  ProductShotLighting,
} from '@/lib/types';
import type { CreateNodeInput } from '@/lib/plugins/types';
import {
  Camera,
  Trash2,
  Sparkles,
  Grid3X3,
  ChevronRight,
  Image as ImageIcon,
  Play,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBufferedNodeField } from './useBufferedNodeField';
import { useNodeDisplayMode } from './useNodeDisplayMode';
import { CanvasNodeShell } from '@/components/canvas/nodes/chrome/CanvasNodeShell';
import { NodeFloatingToolbar } from '@/components/canvas/nodes/chrome/NodeFloatingToolbar';
import { NodeFooterRail } from '@/components/canvas/nodes/chrome/NodeFooterRail';
import { NodeStagePrompt } from '@/components/canvas/nodes/chrome/NodeStagePrompt';
import { useNodeChromeState } from '@/components/canvas/nodes/chrome/useNodeChromeState';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';

const SHOT_COUNTS = [4, 6, 8] as const;

const BACKGROUND_OPTIONS: { value: ProductShotBackground; label: string }[] = [
  { value: 'studio-white', label: 'Studio White' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'dark-moody', label: 'Dark & Moody' },
];

const LIGHTING_OPTIONS: { value: ProductShotLighting; label: string }[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'natural', label: 'Natural' },
  { value: 'rim-light', label: 'Rim Light' },
];

function ProductShotNodeComponent({ id, data, selected }: NodeProps<ProductShotNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const openSettingsPanel = useCanvasStore((state) => state.openSettingsPanel);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const canvas = useCanvasAPI();

  // Check for connected product image
  const connectedInputs = getConnectedInputs(id);
  const hasProductImage = !!connectedInputs.productImageUrl;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Product Shots');
  const [isHovered, setIsHovered] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const productNameRef = useRef<HTMLTextAreaElement>(null);
  const { displayMode, focusedWithin, focusProps } = useNodeDisplayMode(selected);
  const {
    draft: productNameDraft,
    handleChange: handleProductNameChange,
    handleBlur: handleProductNameBlur,
    commit: commitProductName,
  } = useBufferedNodeField({
    nodeId: id,
    value: data.productName || '',
    field: 'productName',
    preview: 'skip',
  });
  const {
    draft: additionalNotesDraft,
    handleChange: handleAdditionalNotesChange,
    handleBlur: handleAdditionalNotesBlur,
    commit: commitAdditionalNotes,
  } = useBufferedNodeField({
    nodeId: id,
    value: data.additionalNotes || '',
    field: 'additionalNotes',
    preview: 'skip',
  });
  const productSummary = useMemo(
    () => productNameDraft.replace(/\s+/g, ' ').trim(),
    [productNameDraft]
  );
  const notesSummary = useMemo(
    () => additionalNotesDraft.replace(/\s+/g, ' ').trim(),
    [additionalNotesDraft]
  );
  const chromeState = useNodeChromeState({
    isHovered,
    focusedWithin,
    isPromptFocused,
    selected,
    displayMode,
    hasOutput: data.viewState === 'preview',
    expanded: isPromptExpanded,
  });
  const showHandles = chromeState.showHandles;
  const showTopToolbar = chromeState.showTopToolbar && !isReadOnly;
  const showFooterRail = chromeState.showFooterRail && !isReadOnly;

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    updateNodeData(id, { name: nodeName });
  }, [id, nodeName, updateNodeData]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const openSettingsFromElement = useCallback((element: HTMLElement) => {
    const rect = element.closest('.react-flow__node')?.getBoundingClientRect();
    if (rect) {
      openSettingsPanel(id, { x: rect.right + 10, y: rect.top });
    }
  }, [id, openSettingsPanel]);

  const handleOpenSettings = useCallback((event: React.MouseEvent) => {
    openSettingsFromElement(event.currentTarget as HTMLElement);
  }, [openSettingsFromElement]);

  // Validation
  const isValid = productSummary.length > 0 && hasProductImage;

  // Generate product shots
  const handleGenerate = useCallback(async () => {
    await Promise.all([
      commitProductName(productNameDraft, true),
      commitAdditionalNotes(additionalNotesDraft, true),
    ]);
    if (!isValid) return;

    const connectedInputs = getConnectedInputs(id);
    if (!connectedInputs.productImageUrl) {
      updateNodeData(id, {
        viewState: 'form',
        error: 'Connect a product image before generating shots.',
      });
      return;
    }

    updateNodeData(id, { viewState: 'loading', error: undefined });

    try {
      const input = {
        productName: productNameDraft.trim(),
        productImageUrl: connectedInputs.productImageUrl,
        shotCount: data.shotCount,
        background: data.background,
        lighting: data.lighting,
        additionalNotes: additionalNotesDraft.trim() || undefined,
      };

      const response = await fetch('/api/plugins/product-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Generation failed');
      }

      // Add enabled: true to all shots
      const shotsWithEnabled = result.shots.map((shot: ProductShotShotData) => ({
        ...shot,
        enabled: true,
      }));

      updateNodeData(id, {
        viewState: 'preview',
        result: { shots: shotsWithEnabled, summary: result.summary },
      });
    } catch (err) {
      updateNodeData(id, {
        viewState: 'form',
        error: err instanceof Error ? err.message : 'Generation failed',
      });
    }
  }, [additionalNotesDraft, commitAdditionalNotes, commitProductName, data.background, data.lighting, data.shotCount, getConnectedInputs, id, isValid, productNameDraft, updateNodeData]);

  // Toggle a shot's enabled state
  const toggleShot = useCallback((shotNumber: number) => {
    if (!data.result) return;
    const updatedShots = data.result.shots.map((shot) =>
      shot.number === shotNumber ? { ...shot, enabled: !shot.enabled } : shot
    );
    updateNodeData(id, { result: { ...data.result, shots: updatedShots } });
  }, [id, data.result, updateNodeData]);

  // Create nodes on canvas
  const handleCreateOnCanvas = useCallback(async () => {
    if (!data.result) return;

    try {
      // Get connected product image
      const connectedInputs = useCanvasStore.getState().getConnectedInputs(id);
      const productImageUrl = connectedInputs.productImageUrl;

      // Get the source Media node ID from the edge connected to productImage handle
      const edges = useCanvasStore.getState().edges;
      const productImageEdge = edges.find(
        (e) => e.target === id && e.targetHandle === 'productImage'
      );
      const sourceMediaNodeId = productImageEdge?.source;

      const enabledShots = data.result.shots.filter((s) => s.enabled);
      if (enabledShots.length === 0) {
        toast.error('No shots enabled. Toggle at least one shot to create nodes.');
        return;
      }

      const viewportCenter = canvas.getViewportCenter();
      const nodeInputs: CreateNodeInput[] = [];

      // Grid layout based on shot count
      const columns = enabledShots.length <= 4 ? 2 : enabledShots.length <= 6 ? 3 : 4;
      const HORIZONTAL_SPACING = 350;
      const VERTICAL_SPACING = 350;
      const IMAGE_NODE_WIDTH = 280;

      const totalGridWidth = (columns - 1) * HORIZONTAL_SPACING + IMAGE_NODE_WIDTH;
      const rows = Math.ceil(enabledShots.length / columns);
      const gridStartX = viewportCenter.x - totalGridWidth / 2;
      const gridStartY = viewportCenter.y - (rows * VERTICAL_SPACING) / 2;

      enabledShots.forEach((shot, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);

        const position = {
          x: gridStartX + col * HORIZONTAL_SPACING,
          y: gridStartY + row * VERTICAL_SPACING,
        };

        nodeInputs.push({
          type: 'imageGenerator',
          position,
          name: shot.angleName,
          data: {
            prompt: shot.prompt,
            model: 'nanobanana-pro',
            ...(productImageUrl && {
              referenceUrl: productImageUrl,
            }),
          },
        });
      });

      // Create all nodes and get their IDs
      const createdNodeIds = await canvas.createNodes(nodeInputs);

      // Create edges from source Media node to each created ImageGenerator node
      if (sourceMediaNodeId) {
        for (const nodeId of createdNodeIds) {
          await canvas.createEdge(sourceMediaNodeId, 'output', nodeId, 'reference');
        }
      }

      // Wrap everything in a group: source node + product shot node + created nodes
      const groupNodeIds = [id, ...createdNodeIds];
      if (sourceMediaNodeId) groupNodeIds.unshift(sourceMediaNodeId);

      await canvas.wrapInGroup({
        nodeIds: groupNodeIds,
        name: `${data.productName || 'Product'} Shots`,
        color: '#d97706',
        stickyNote: {
          content: `${enabledShots.length} shots | ${data.background} | ${data.lighting} lighting`,
          color: 'orange',
        },
      });

      // Fit view to show all nodes
      canvas.fitView();

      // Notify success
      toast.success(
        `Created ${enabledShots.length} image nodes. Click "Run All" to generate.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create nodes');
    }
  }, [data.background, data.lighting, data.productName, data.result, canvas, id]);

  const promptPlaceholder = 'Product name (e.g., Nike Air Max 90)...';

  // --- Chrome elements ---

  const topToolbar = showTopToolbar ? (
    <NodeFloatingToolbar>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleGenerate}
        disabled={!isValid || data.viewState === 'loading'}
        title={data.viewState === 'preview' ? 'Regenerate shots' : 'Generate shots'}
      >
        {data.viewState === 'preview' ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
        onClick={handleDelete}
        title="Delete node"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleOpenSettings}
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        title="Settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
    </NodeFloatingToolbar>
  ) : null;

  const footerRail = showFooterRail ? (
    <NodeFooterRail className="node-footer-rail-plain">
      <Select value={String(data.shotCount)} onValueChange={(v) => updateNodeData(id, { shotCount: Number(v) })}>
        <SelectTrigger className="h-8 w-auto rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted">
          <SelectValue>{data.shotCount} shots</SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {SHOT_COUNTS.map((count) => (
            <SelectItem key={count} value={String(count)} className="text-xs">{count} shots</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={data.background} onValueChange={(v) => updateNodeData(id, { background: v as ProductShotBackground })}>
        <SelectTrigger className="h-8 w-auto rounded-xl border-0 bg-muted/80 px-2.5 text-xs nodrag nopan hover:bg-muted">
          <SelectValue>{BACKGROUND_OPTIONS.find((o) => o.value === data.background)?.label ?? data.background}</SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {BACKGROUND_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleOpenSettings}
        className="h-8 w-8 rounded-xl nodrag nopan text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        title="Settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>

      <div className="min-w-0 flex-1" />

      {data.viewState === 'preview' ? (
        <Button
          onClick={handleCreateOnCanvas}
          disabled={(data.result?.shots.filter((s) => s.enabled).length || 0) === 0}
          size="sm"
          className="h-10 rounded-full nodrag nopan bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 px-4"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          Create Nodes
        </Button>
      ) : (
        <Button
          onClick={handleGenerate}
          disabled={!isValid || data.viewState === 'loading'}
          size="icon-sm"
          className="h-10 w-10 min-w-10 rounded-full nodrag nopan bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {data.viewState === 'loading' ? (
            <Sparkles className="h-4 w-4 animate-pulse" />
          ) : (
            <Play className="h-4 w-4 ml-0.5 fill-current" />
          )}
        </Button>
      )}
    </NodeFooterRail>
  ) : null;

  const promptOverlay = displayMode === 'summary' ? null : (
    <NodeStagePrompt
      teaser={chromeState.showPromptTeaser ? (
        <p className={`node-prompt-teaser-clamp text-[15px] leading-6 ${productSummary ? 'text-foreground/82' : 'text-muted-foreground/82'}`}>
          {productSummary || promptPlaceholder}
        </p>
      ) : null}
      expanded={chromeState.showPromptEditor}
      onExpand={
        isReadOnly
          ? undefined
          : () => {
              setIsPromptExpanded(true);
              requestAnimationFrame(() => productNameRef.current?.focus());
            }
      }
    >
      <div
        className="flex flex-col gap-3 nodrag nopan"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <textarea
          ref={productNameRef}
          value={productNameDraft}
          onChange={handleProductNameChange}
          onFocus={() => {
            setIsPromptExpanded(true);
            setIsPromptFocused(true);
          }}
          onBlur={async () => {
            setIsPromptFocused(false);
            setIsPromptExpanded(false);
            await handleProductNameBlur();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setIsPromptFocused(false);
              setIsPromptExpanded(false);
              event.currentTarget.blur();
            }
          }}
          placeholder={isReadOnly ? '' : promptPlaceholder}
          disabled={isReadOnly}
          className={`node-stage-input nodrag nopan nowheel select-text w-full resize-none border-0 bg-transparent px-0 py-0 focus:outline-none min-h-[40px] text-[15px] leading-6 ${isReadOnly ? 'cursor-default' : ''}`}
          style={{
            colorScheme: 'dark',
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            color: 'var(--text-secondary)',
            caretColor: 'var(--text-primary)',
            boxShadow: 'none',
            borderColor: 'transparent',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        />
        {isPromptFocused && (
          <textarea
            value={additionalNotesDraft}
            onChange={handleAdditionalNotesChange}
            onBlur={() => {
              void handleAdditionalNotesBlur();
            }}
            placeholder="Additional notes (optional)..."
            disabled={isReadOnly}
            className={`node-stage-input nodrag nopan nowheel select-text w-full resize-none border-0 bg-transparent px-0 py-0 focus:outline-none min-h-[40px] text-[13px] leading-5 text-muted-foreground ${isReadOnly ? 'cursor-default' : ''}`}
            style={{
              colorScheme: 'dark',
              backgroundColor: 'transparent',
              backgroundImage: 'none',
              boxShadow: 'none',
              borderColor: 'transparent',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          />
        )}
      </div>
    </NodeStagePrompt>
  );

  const secondaryContent = data.error ? (
    <p className="px-1 text-xs text-red-400">{data.error}</p>
  ) : !hasProductImage && displayMode === 'full' ? (
    <p className="px-1 text-[11px] text-muted-foreground">
      Connect a product image to generate accurate shot prompts.
    </p>
  ) : null;

  return (
    <div className="relative">
      <CanvasNodeShell
        title={isEditingName && !isReadOnly ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNodeName(data.name || 'Product Shots');
                setIsEditingName(false);
              }
            }}
            className="node-input rounded-none border-0 border-b bg-transparent px-0.5 outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => !isReadOnly && setIsEditingName(true)}
            className={isReadOnly ? 'cursor-default' : 'cursor-text'}
          >
            {data.name || 'Product Shots'}
          </span>
        )}
        icon={<Camera className="h-4 w-4" />}
        selected={selected}
        hovered={isHovered}
        displayMode={displayMode}
        hasOutput={data.viewState === 'preview'}
        interactiveMode="prompt"
        stageMinHeight={data.viewState === 'preview' ? undefined : 280}
        topToolbar={topToolbar}
        footerRail={footerRail}
        promptOverlay={promptOverlay}
        shellMode="visual-stage"
        secondaryContent={secondaryContent}
        cardClassName={data.viewState === 'loading' ? 'animate-subtle-pulse generating-border-subtle' : undefined}
        cardStyle={{ minWidth: 420 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        focusProps={focusProps}
      >
        {data.viewState === 'loading' ? (
          <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-4 px-6 pb-[120px] text-center">
            <div>
              <p
                className="bg-clip-text text-base font-semibold text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, hsl(var(--muted-foreground)/0.45) 0%, hsl(var(--foreground)/0.95) 45%, hsl(var(--muted-foreground)/0.45) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-text 2s ease-in-out infinite',
                }}
              >
                Planning your product shots...
              </p>
              <p className="text-muted-foreground text-xs mt-1">This may take a moment</p>
            </div>
          </div>
        ) : data.viewState === 'preview' && data.result ? (
          <div className="flex flex-col gap-3 px-4 pt-3 pb-[120px]">
            {/* Summary */}
            <div className="p-2 bg-muted/50 rounded-xl">
              <p className="text-xs text-foreground">{data.result.summary}</p>
            </div>

            {/* Shots preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground">Shots</h3>
                <span className="text-[10px] text-muted-foreground">
                  {data.result.shots.filter((s) => s.enabled).length} of {data.result.shots.length} enabled
                </span>
              </div>
              <div className="space-y-1 max-h-[240px] overflow-y-auto nowheel" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
                {data.result.shots.map((shot) => (
                  <ShotPreview
                    key={shot.number}
                    shot={shot}
                    onToggle={() => toggleShot(shot.number)}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </div>
            </div>

            {!isReadOnly && (
              <button
                onClick={() => updateNodeData(id, { viewState: 'form' })}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors nodrag"
              >
                Back to edit
              </button>
            )}
          </div>
        ) : (
          <div className="min-h-[280px] flex-1" />
        )}
      </CanvasNodeShell>

      {/* Input Handle - Product Image */}
      <div className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles || hasProductImage ? 'opacity-100' : 'opacity-0'}`} style={{ top: getPromptHeavyInputHandleTop(0) }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="productImage"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: hasProductImage ? '#a1a1aa' : 'var(--text-muted)' }} />
        </div>
        <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
          {hasProductImage ? 'Product Image (connected)' : 'Product Image'}
        </span>
      </div>
    </div>
  );
}

// Shot preview card with toggle
function ShotPreview({ shot, onToggle, isReadOnly }: { shot: ProductShotShotData; onToggle: () => void; isReadOnly: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-muted rounded-lg overflow-hidden transition-opacity ${shot.enabled ? '' : 'opacity-50'}`}>
      <div className="flex items-center">
        {/* Toggle switch */}
        {!isReadOnly && (
          <button
            onClick={onToggle}
            className="pl-2 pr-1 py-2 nodrag"
          >
            <div className={`w-8 h-4.5 rounded-full transition-colors relative ${shot.enabled ? 'bg-primary' : 'bg-zinc-600'}`}>
              <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${shot.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
        )}

        {/* Shot info */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between p-2 text-left hover:bg-muted/80 nodrag"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-primary bg-primary/20 px-1.5 py-0.5 rounded">
              {shot.number}
            </span>
            <span className="text-xs font-medium text-foreground">{shot.angleName}</span>
          </div>
          <ChevronRight
            className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
      </div>
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 text-xs">
          <p className="text-muted-foreground">{shot.description}</p>
          <div className="flex gap-1.5 text-[10px] flex-wrap">
            <span className="bg-background px-1.5 py-0.5 rounded text-foreground">
              {shot.camera}
            </span>
            <span className="bg-background px-1.5 py-0.5 rounded text-foreground">
              {shot.composition}
            </span>
          </div>
          <div className="p-1.5 bg-background rounded text-[10px] text-muted-foreground font-mono">
            {shot.prompt}
          </div>
        </div>
      )}
    </div>
  );
}

export const ProductShotNode = memo(ProductShotNodeComponent);
