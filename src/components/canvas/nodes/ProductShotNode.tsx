'use client';

/**
 * Product Shot Node
 *
 * Canvas node for generating product shot plans. Takes a product image
 * and generates optimal angles/compositions as ImageGenerator nodes.
 */

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
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
  Loader2,
  Sparkles,
  Grid3X3,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// Background options
const BACKGROUND_OPTIONS: { value: ProductShotBackground; label: string }[] = [
  { value: 'studio-white', label: 'Studio White' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'dark-moody', label: 'Dark & Moody' },
];

// Lighting options
const LIGHTING_OPTIONS: { value: ProductShotLighting; label: string }[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'natural', label: 'Natural' },
  { value: 'rim-light', label: 'Rim Light' },
];

// Shot count options
const SHOT_COUNTS = [4, 6, 8] as const;

function ProductShotNodeComponent({ id, data, selected }: NodeProps<ProductShotNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const canvas = useCanvasAPI();

  // Check for connected product image
  const connectedInputs = getConnectedInputs(id);
  const hasProductImage = !!connectedInputs.productImageUrl;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Product Shots');
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // Form field handlers
  const updateField = useCallback(
    <K extends keyof ProductShotNodeData>(field: K, value: ProductShotNodeData[K]) => {
      updateNodeData(id, { [field]: value });
    },
    [id, updateNodeData]
  );

  // Validation
  const isValid = (data.productName?.trim().length ?? 0) > 0;

  // Generate product shots
  const handleGenerate = useCallback(async () => {
    if (!isValid) return;

    updateNodeData(id, { viewState: 'loading', error: undefined });

    try {
      const input = {
        productName: data.productName.trim(),
        shotCount: data.shotCount,
        background: data.background,
        lighting: data.lighting,
        additionalNotes: data.additionalNotes?.trim() || undefined,
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
  }, [id, data.productName, data.shotCount, data.background, data.lighting, data.additionalNotes, isValid, updateNodeData]);

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

      // Fit view to show all nodes
      canvas.fitView();

      // Notify success
      toast.success(
        `Created ${enabledShots.length} image nodes. Click "Run All" to generate.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create nodes');
    }
  }, [data.result, canvas, id]);

  // Render form view
  const renderForm = () => (
    <div className="p-4 space-y-3">
      {/* Product Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Product Name {!isReadOnly && <span className="text-red-400">*</span>}
        </label>
        <textarea
          value={data.productName || ''}
          onChange={(e) => updateField('productName', e.target.value)}
          placeholder={isReadOnly ? '' : 'e.g., Nike Air Max 90, Apple Watch Ultra, Coffee mug...'}
          disabled={isReadOnly}
          className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          rows={2}
        />
      </div>

      {/* Shot Count & Background */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Shots</label>
          <select
            value={data.shotCount}
            onChange={(e) => updateField('shotCount', Number(e.target.value) as 4 | 6 | 8)}
            disabled={isReadOnly}
            className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          >
            {SHOT_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} shots
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Background</label>
          <select
            value={data.background}
            onChange={(e) => updateField('background', e.target.value as ProductShotBackground)}
            disabled={isReadOnly}
            className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          >
            {BACKGROUND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lighting */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Lighting</label>
        <select
          value={data.lighting}
          onChange={(e) => updateField('lighting', e.target.value as ProductShotLighting)}
          disabled={isReadOnly}
          className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
        >
          {LIGHTING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Additional Notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Additional Notes {!isReadOnly && <span className="text-muted-foreground/70">(optional)</span>}
        </label>
        <textarea
          value={data.additionalNotes || ''}
          onChange={(e) => updateField('additionalNotes', e.target.value)}
          placeholder={isReadOnly ? '' : 'e.g., Focus on the sole pattern, include a wrist shot...'}
          disabled={isReadOnly}
          className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          rows={2}
        />
      </div>

      {/* Error message */}
      {data.error && (
        <div className="p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-xs">
          {data.error}
        </div>
      )}

      {/* Generate button */}
      {!isReadOnly && (
        <button
          onClick={handleGenerate}
          disabled={!isValid}
          className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-muted disabled:text-muted-foreground text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 nodrag"
        >
          <Sparkles className="w-4 h-4" />
          Generate Shots
        </button>
      )}
    </div>
  );

  // Render loading view
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      <p className="text-muted-foreground text-sm">Planning your product shots...</p>
    </div>
  );

  // Render preview view
  const renderPreview = () => {
    if (!data.result) return null;

    const enabledCount = data.result.shots.filter((s) => s.enabled).length;

    return (
      <div className="p-4 space-y-3">
        {/* Summary */}
        <div className="p-2 bg-muted rounded-lg">
          <h3 className="text-xs font-medium text-muted-foreground mb-1">Summary</h3>
          <p className="text-xs text-foreground">{data.result.summary}</p>
        </div>

        {/* Shots preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground">Shots</h3>
            <span className="text-[10px] text-muted-foreground">
              {enabledCount} of {data.result.shots.length} enabled
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

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => updateNodeData(id, { viewState: 'form' })}
              className="flex-1 py-2 px-3 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-lg transition-colors nodrag"
            >
              Back to Edit
            </button>
            <button
              onClick={handleCreateOnCanvas}
              disabled={enabledCount === 0}
              className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-muted disabled:text-muted-foreground text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 nodrag"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Create Nodes
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {selected && !isReadOnly && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 backdrop-blur rounded-lg px-2 py-1.5 border node-toolbar-floating shadow-xl z-10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-productShot, #d97706)' }}>
        <Camera className="h-4 w-4" />
        {isEditingName ? (
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
            className="bg-transparent border-b outline-none px-0.5 min-w-[60px] nodrag"
            style={{ borderColor: 'var(--input-border)', color: 'var(--text-secondary)' }}
          />
        ) : (
          <span
            onDoubleClick={() => !isReadOnly && setIsEditingName(true)}
            className={`transition-colors hover:opacity-80 ${isReadOnly ? 'cursor-default' : 'cursor-text'}`}
          >
            {nodeName}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[400px] rounded-2xl overflow-hidden
          transition-[box-shadow,ring-color] duration-150
          ${selected
            ? 'ring-[2.5px] ring-amber-500 shadow-lg shadow-amber-500/10'
            : 'ring-1 hover:ring-2'
          }
        `}
        style={{
          backgroundColor: 'var(--node-card-bg)',
          '--tw-ring-color': selected ? undefined : 'var(--node-ring)'
        } as React.CSSProperties}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Product Shot Plan</span>
        </div>

        {/* Content */}
        {data.viewState === 'form' && renderForm()}
        {data.viewState === 'loading' && renderLoading()}
        {data.viewState === 'preview' && renderPreview()}
      </div>

      {/* Input Handle - Product Image (left side, only in form view) */}
      {data.viewState === 'form' && (
        <div className="absolute -left-3 group" style={{ top: '95px' }}>
          <div className="relative">
            <Handle
              type="target"
              position={Position.Left}
              id="productImage"
              className={`!relative !transform-none !w-6 !h-6 !rounded-md !border-2 node-handle hover:!border-amber-500 ${hasProductImage ? '!border-green-500' : ''
                }`}
            />
            <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: hasProductImage ? '#4ade80' : 'var(--text-muted)' }} />
          </div>
          <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
            {hasProductImage ? 'Product Image (connected)' : 'Product Image'}
          </span>
        </div>
      )}
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
            <div className={`w-8 h-4.5 rounded-full transition-colors relative ${shot.enabled ? 'bg-amber-500' : 'bg-zinc-600'}`}>
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
            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
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
