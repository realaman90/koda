'use client';

/**
 * Storyboard Node
 *
 * Canvas node for generating storyboards. Renders the same UI as the
 * deprecated StoryboardSandbox modal, but directly on the canvas.
 */

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasAPI } from '@/lib/plugins/canvas-api';
import type { StoryboardNode as StoryboardNodeType, StoryboardNodeData, StoryboardSceneData, StoryboardStyle } from '@/lib/types';
import type { CreateNodeInput } from '@/lib/plugins/types';
import { Clapperboard, Trash2, Loader2, Sparkles, Grid3X3, ChevronRight, Image as ImageIcon, User } from 'lucide-react';
import { toast } from 'sonner';

// Style options
const STYLE_OPTIONS: { value: StoryboardStyle; label: string }[] = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'illustrated', label: 'Illustrated' },
  { value: 'commercial', label: 'Commercial' },
];

// Scene count options
const SCENE_COUNTS = [4, 5, 6, 8] as const;

function StoryboardNodeComponent({ id, data, selected }: NodeProps<StoryboardNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const canvas = useCanvasAPI();

  // Check for connected images
  const connectedInputs = getConnectedInputs(id);
  const hasProductImage = !!connectedInputs.productImageUrl;
  const hasCharacterImage = !!connectedInputs.characterImageUrl;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Storyboard');
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
    <K extends keyof StoryboardNodeData>(field: K, value: StoryboardNodeData[K]) => {
      updateNodeData(id, { [field]: value });
    },
    [id, updateNodeData]
  );

  // Validation
  const isValid = (data.product?.trim().length ?? 0) > 0 && (data.concept?.trim().length ?? 0) > 0;

  // Generate storyboard
  const handleGenerate = useCallback(async () => {
    if (!isValid) return;

    updateNodeData(id, { viewState: 'loading', error: undefined });

    try {
      const input = {
        product: data.product.trim(),
        character: data.character?.trim() || undefined,
        concept: data.concept.trim(),
        sceneCount: data.sceneCount,
        style: data.style,
      };

      const response = await fetch('/api/plugins/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Generation failed');
      }

      updateNodeData(id, {
        viewState: 'preview',
        result: { scenes: result.scenes, summary: result.summary },
      });
    } catch (err) {
      updateNodeData(id, {
        viewState: 'form',
        error: err instanceof Error ? err.message : 'Generation failed',
      });
    }
  }, [id, data.product, data.character, data.concept, data.sceneCount, data.style, isValid, updateNodeData]);

  // Helper function to generate fallback transition prompt
  const generateFallbackTransition = (fromScene: StoryboardSceneData, toScene: StoryboardSceneData): string => {
    return `Cinematic transition from "${fromScene.title}" to "${toScene.title}". ${fromScene.camera} transitioning smoothly, maintaining ${fromScene.mood} atmosphere.`;
  };

  // Create nodes on canvas
  const handleCreateOnCanvas = useCallback(async () => {
    if (!data.result) return;

    try {
      // Get connected product/character images
      const connectedInputs = useCanvasStore.getState().getConnectedInputs(id);
      const productImageUrl = connectedInputs.productImageUrl;
      const characterImageUrl = connectedInputs.characterImageUrl;

      const viewportCenter = canvas.getViewportCenter();
      const nodeInputs: CreateNodeInput[] = [];

      // Track the starting index for image nodes
      const imageNodeStartIndex = nodeInputs.length;

      // Layout constants
      const IMAGE_NODE_WIDTH = 280;
      const VIDEO_NODE_WIDTH = 420;
      const IMAGE_SPACING = 380;
      const VIDEO_Y_OFFSET = 450;

      // Calculate starting X to center the layout
      const totalImageWidth = (data.result.scenes.length - 1) * IMAGE_SPACING + IMAGE_NODE_WIDTH;
      const imageStartX = viewportCenter.x - totalImageWidth / 2;
      const imageStartY = viewportCenter.y - 200;

      // Store image positions for video node placement
      const imagePositions: { x: number; y: number }[] = [];

      // Build reference URLs for the first scene
      const firstSceneReferenceUrls = [productImageUrl, characterImageUrl].filter((url): url is string => !!url);

      // Create image generator nodes in a horizontal row
      data.result.scenes.forEach((scene, index) => {
        const position = {
          x: imageStartX + index * IMAGE_SPACING,
          y: imageStartY,
        };
        imagePositions.push(position);

        // Only the first scene gets the product/character image references
        // Subsequent scenes will get their reference from the previous scene via chain connections
        const isFirstScene = index === 0;

        nodeInputs.push({
          type: 'imageGenerator',
          position,
          name: `Scene ${scene.number}: ${scene.title}`,
          data: {
            prompt: scene.prompt,
            model: 'nanobanana-pro',
            // Pass reference images to first scene only
            ...(isFirstScene && firstSceneReferenceUrls.length > 0 && {
              referenceUrl: firstSceneReferenceUrls[0],
              referenceUrls: firstSceneReferenceUrls.length > 1 ? firstSceneReferenceUrls : undefined,
            }),
          },
        });
      });

      // Track the starting index for video nodes
      const videoNodeStartIndex = nodeInputs.length;

      // Create video generator nodes between consecutive image pairs
      for (let i = 0; i < data.result.scenes.length - 1; i++) {
        const sourcePos = imagePositions[i];
        const targetPos = imagePositions[i + 1];
        const currentScene = data.result.scenes[i];
        const nextScene = data.result.scenes[i + 1];

        // Position video node below and centered between source and target image nodes
        const videoPosition = {
          x: (sourcePos.x + targetPos.x) / 2 + (IMAGE_NODE_WIDTH - VIDEO_NODE_WIDTH) / 2,
          y: imageStartY + VIDEO_Y_OFFSET,
        };

        // Use AI-generated transition or fallback
        const transitionPrompt = currentScene.transition || generateFallbackTransition(currentScene, nextScene);

        nodeInputs.push({
          type: 'videoGenerator',
          position: videoPosition,
          name: `Transition ${i + 1}`,
          data: {
            prompt: transitionPrompt,
            model: 'veo-3.1-flf',
            aspectRatio: '16:9',
            duration: 4,
            resolution: '720p',
            generateAudio: true,
          },
        });
      }

      // Create all nodes
      const nodeIds = await canvas.createNodes(nodeInputs);

      // Create edges connecting image nodes in a chain (for style reference)
      for (let i = 0; i < data.result.scenes.length - 1; i++) {
        const sourceImageId = nodeIds[imageNodeStartIndex + i];
        const targetImageId = nodeIds[imageNodeStartIndex + i + 1];
        await canvas.createEdge(sourceImageId, 'output', targetImageId, 'reference');
      }

      // Create edges connecting image nodes to video nodes
      const videoNodeCount = data.result.scenes.length - 1;
      for (let i = 0; i < videoNodeCount; i++) {
        const sourceImageId = nodeIds[imageNodeStartIndex + i];
        const targetImageId = nodeIds[imageNodeStartIndex + i + 1];
        const videoNodeId = nodeIds[videoNodeStartIndex + i];

        // Source image -> firstFrame
        await canvas.createEdge(sourceImageId, 'output', videoNodeId, 'firstFrame');
        // Target image -> lastFrame
        await canvas.createEdge(targetImageId, 'output', videoNodeId, 'lastFrame');
      }

      // Fit view to show all nodes
      canvas.fitView();

      // Notify success
      const videoCount = data.result.scenes.length - 1;
      toast.success(
        `Created ${data.result.scenes.length} scene nodes and ${videoCount} video nodes. Click "Run All" to generate images, then videos.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create nodes');
    }
  }, [data.result, canvas]);

  // Render form view
  const renderForm = () => (
    <div className="p-4 space-y-3">
      {/* Product/Subject */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-400">
          Product / Subject <span className="text-red-400">*</span>
        </label>
        <textarea
          value={data.product || ''}
          onChange={(e) => updateField('product', e.target.value)}
          placeholder="e.g., Premium coffee mug, Fitness app..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag"
          rows={2}
        />
      </div>

      {/* Character (optional) */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-400">
          Character <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          value={data.character || ''}
          onChange={(e) => updateField('character', e.target.value)}
          placeholder="e.g., Young professional woman in her 30s..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag"
          rows={2}
        />
      </div>

      {/* Concept/Story */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-400">
          Concept / Story <span className="text-red-400">*</span>
        </label>
        <textarea
          value={data.concept || ''}
          onChange={(e) => updateField('concept', e.target.value)}
          placeholder="e.g., Morning routine ad showing how our coffee mug makes the perfect start..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag"
          rows={3}
        />
      </div>

      {/* Scene Count & Style */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">Scenes</label>
          <select
            value={data.sceneCount}
            onChange={(e) => updateField('sceneCount', Number(e.target.value))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag"
          >
            {SCENE_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} scenes
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">Style</label>
          <select
            value={data.style}
            onChange={(e) => updateField('style', e.target.value as StoryboardStyle)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error message */}
      {data.error && (
        <div className="p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-xs">
          {data.error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!isValid}
        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 nodrag"
      >
        <Sparkles className="w-4 h-4" />
        Generate Storyboard
      </button>
    </div>
  );

  // Render loading view
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      <p className="text-zinc-400 text-sm">Generating your storyboard...</p>
    </div>
  );

  // Render preview view
  const renderPreview = () => {
    if (!data.result) return null;

    return (
      <div className="p-4 space-y-3">
        {/* Summary */}
        <div className="p-2 bg-zinc-800 rounded-lg">
          <h3 className="text-xs font-medium text-zinc-400 mb-1">Summary</h3>
          <p className="text-xs text-zinc-300">{data.result.summary}</p>
        </div>

        {/* Scenes preview */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-400">Scenes</h3>
          <div className="space-y-1 max-h-[200px] overflow-y-auto nowheel" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
            {data.result.scenes.map((scene) => (
              <ScenePreview key={scene.number} scene={scene} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => updateNodeData(id, { viewState: 'form' })}
            className="flex-1 py-2 px-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium rounded-lg transition-colors nodrag"
          >
            Back to Edit
          </button>
          <button
            onClick={handleCreateOnCanvas}
            className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 nodrag"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            Create Nodes
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {selected && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-800/90 backdrop-blur rounded-lg px-2 py-1.5 border border-zinc-700/50 shadow-xl z-10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-zinc-400 text-sm font-medium">
        <Clapperboard className="h-4 w-4" />
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
                setNodeName(data.name || 'Storyboard');
                setIsEditingName(false);
              }
            }}
            className="bg-transparent border-b border-zinc-600 outline-none text-zinc-300 px-0.5 min-w-[60px] nodrag"
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditingName(true)}
            className="cursor-text hover:text-zinc-300 transition-colors"
          >
            {nodeName}
          </span>
        )}
      </div>

      {/* Main Node Card */}
      <div
        className={`
          w-[400px] rounded-2xl overflow-hidden
          transition-all duration-150
          ${selected
            ? 'ring-[2.5px] ring-indigo-500 shadow-lg shadow-indigo-500/10'
            : 'ring-1 ring-zinc-800 hover:ring-zinc-700'
          }
        `}
        style={{ backgroundColor: '#1a1a1c' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-zinc-200">Create Storyboard</span>
        </div>

        {/* Content */}
        {data.viewState === 'form' && renderForm()}
        {data.viewState === 'loading' && renderLoading()}
        {data.viewState === 'preview' && renderPreview()}
      </div>

      {/* Input Handles - Left side (only shown in form view) */}
      {data.viewState === 'form' && (
        <>
          {/* Product Image Handle */}
          <div className="absolute -left-3 group" style={{ top: '95px' }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="productImage"
                className={`!relative !transform-none !w-6 !h-6 !rounded-md ${
                  hasProductImage
                    ? '!bg-green-900/50 !border-2 !border-green-500'
                    : '!bg-zinc-800 !border-2 !border-zinc-600 hover:!border-indigo-500 hover:!bg-zinc-700'
                }`}
              />
              <ImageIcon className={`absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none ${
                hasProductImage ? 'text-green-400' : 'text-zinc-500'
              }`} />
            </div>
            <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
              {hasProductImage ? 'Product Image (connected)' : 'Product Image'}
            </span>
          </div>

          {/* Character Image Handle */}
          <div className="absolute -left-3 group" style={{ top: '175px' }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="characterImage"
                className={`!relative !transform-none !w-6 !h-6 !rounded-md ${
                  hasCharacterImage
                    ? '!bg-green-900/50 !border-2 !border-green-500'
                    : '!bg-zinc-800 !border-2 !border-zinc-600 hover:!border-indigo-500 hover:!bg-zinc-700'
                }`}
              />
              <User className={`absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none ${
                hasCharacterImage ? 'text-green-400' : 'text-zinc-500'
              }`} />
            </div>
            <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-zinc-700">
              {hasCharacterImage ? 'Character Image (connected)' : 'Character Image'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// Scene preview card
function ScenePreview({ scene }: { scene: StoryboardSceneData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 text-left hover:bg-zinc-750 nodrag"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-indigo-400 bg-indigo-900/30 px-1.5 py-0.5 rounded">
            {scene.number}
          </span>
          <span className="text-xs font-medium text-zinc-200">{scene.title}</span>
        </div>
        <ChevronRight
          className={`w-3 h-3 text-zinc-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 text-xs">
          <p className="text-zinc-400">{scene.description}</p>
          <div className="flex gap-1.5 text-[10px]">
            <span className="bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">
              {scene.camera}
            </span>
            <span className="bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">
              {scene.mood}
            </span>
          </div>
          <div className="p-1.5 bg-zinc-900 rounded text-[10px] text-zinc-400 font-mono">
            {scene.prompt}
          </div>
        </div>
      )}
    </div>
  );
}

export const StoryboardNode = memo(StoryboardNodeComponent);
