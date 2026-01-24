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
import type { StoryboardNode as StoryboardNodeType, StoryboardNodeData, StoryboardSceneData, StoryboardStyle, StoryboardMode } from '@/lib/types';
import type { CreateNodeInput } from '@/lib/plugins/types';
import { Clapperboard, Trash2, Loader2, Sparkles, Grid3X3, ChevronRight, Image as ImageIcon, User, ArrowLeftRight, LayoutGrid } from 'lucide-react';
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
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
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
        mode: data.mode || 'transition',
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
  }, [id, data.product, data.character, data.concept, data.sceneCount, data.style, data.mode, isValid, updateNodeData]);

  // Helper function to generate fallback transition prompt
  const generateFallbackTransition = (fromScene: StoryboardSceneData, toScene: StoryboardSceneData): string => {
    return `Cinematic transition from "${fromScene.title}" to "${toScene.title}". ${fromScene.camera} transitioning smoothly, maintaining ${fromScene.mood} atmosphere.`;
  };

  // Helper function to generate fallback motion prompt for single-shot mode
  const generateFallbackMotion = (scene: StoryboardSceneData): string => {
    return `${scene.description} ${scene.camera}, ${scene.mood} atmosphere.`;
  };

  // Create nodes on canvas
  const handleCreateOnCanvas = useCallback(async () => {
    if (!data.result) return;

    const mode = data.mode || 'transition';

    try {
      // Get connected product/character images
      const connectedInputs = useCanvasStore.getState().getConnectedInputs(id);
      const productImageUrl = connectedInputs.productImageUrl;
      const characterImageUrl = connectedInputs.characterImageUrl;

      const viewportCenter = canvas.getViewportCenter();
      const nodeInputs: CreateNodeInput[] = [];

      // Layout constants
      const IMAGE_NODE_WIDTH = 280;
      const VIDEO_NODE_WIDTH = 420;

      // Build reference URLs for the first scene
      const firstSceneReferenceUrls = [productImageUrl, characterImageUrl].filter((url): url is string => !!url);

      if (mode === 'single-shot') {
        // ==================== SINGLE-SHOT MODE ====================
        // Grid layout: N images in grid, N videos below each image

        // Calculate grid dimensions
        const sceneCount = data.result.scenes.length;
        let columns: number;
        if (sceneCount <= 4) {
          columns = 2;
        } else if (sceneCount <= 6) {
          columns = 3;
        } else {
          columns = 4;
        }
        const rows = Math.ceil(sceneCount / columns);

        // Grid spacing
        const HORIZONTAL_SPACING = 350;
        const VERTICAL_SPACING = 500; // Image + video + gap

        // Calculate starting position to center the grid
        const totalGridWidth = (columns - 1) * HORIZONTAL_SPACING + IMAGE_NODE_WIDTH;
        const gridStartX = viewportCenter.x - totalGridWidth / 2;
        const gridStartY = viewportCenter.y - (rows * VERTICAL_SPACING) / 2;

        // Store image positions for video node placement
        const imagePositions: { x: number; y: number }[] = [];

        // Track starting indices
        const imageNodeStartIndex = nodeInputs.length;

        // Create image generator nodes in a grid
        data.result.scenes.forEach((scene, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);

          const position = {
            x: gridStartX + col * HORIZONTAL_SPACING,
            y: gridStartY + row * VERTICAL_SPACING,
          };
          imagePositions.push(position);

          // Only the first scene gets the product/character image references
          const isFirstScene = index === 0;

          nodeInputs.push({
            type: 'imageGenerator',
            position,
            name: `Scene ${scene.number}: ${scene.title}`,
            data: {
              prompt: scene.prompt,
              model: 'nanobanana-pro',
              ...(isFirstScene && firstSceneReferenceUrls.length > 0 && {
                referenceUrl: firstSceneReferenceUrls[0],
                referenceUrls: firstSceneReferenceUrls.length > 1 ? firstSceneReferenceUrls : undefined,
              }),
            },
          });
        });

        // Track video node start index
        const videoNodeStartIndex = nodeInputs.length;

        // Create video generator node for EACH image (N videos)
        data.result.scenes.forEach((scene, index) => {
          const imagePos = imagePositions[index];

          // Position video node below its image with 50px gap
          const videoPosition = {
            x: imagePos.x + (IMAGE_NODE_WIDTH - VIDEO_NODE_WIDTH) / 2,
            y: imagePos.y + 300, // Below the image node
          };

          // Use AI-generated motion or fallback
          const motionPrompt = scene.motion || generateFallbackMotion(scene);

          nodeInputs.push({
            type: 'videoGenerator',
            position: videoPosition,
            name: `Video ${scene.number}: ${scene.title}`,
            data: {
              prompt: motionPrompt,
              model: 'veo-3.1-i2v', // Single image input model
              aspectRatio: '16:9',
              duration: 8,
              resolution: '720p',
              generateAudio: true,
            },
          });
        });

        // Create all nodes
        const nodeIds = await canvas.createNodes(nodeInputs);

        // NO image-to-image chaining in single-shot mode

        // Create edges connecting each image to its video via 'reference' handle
        for (let i = 0; i < data.result.scenes.length; i++) {
          const imageNodeId = nodeIds[imageNodeStartIndex + i];
          const videoNodeId = nodeIds[videoNodeStartIndex + i];
          await canvas.createEdge(imageNodeId, 'output', videoNodeId, 'reference');
        }

        // Fit view to show all nodes
        canvas.fitView();

        // Notify success
        toast.success(
          `Created ${data.result.scenes.length} scene nodes and ${data.result.scenes.length} video nodes in grid layout. Click "Run All" to generate.`
        );
      } else {
        // ==================== TRANSITION MODE (existing logic) ====================
        // Horizontal row: N images, N-1 videos between pairs

        const IMAGE_SPACING = 380;
        const VIDEO_Y_OFFSET = 450;

        // Track the starting index for image nodes
        const imageNodeStartIndex = nodeInputs.length;

        // Calculate starting X to center the layout
        const totalImageWidth = (data.result.scenes.length - 1) * IMAGE_SPACING + IMAGE_NODE_WIDTH;
        const imageStartX = viewportCenter.x - totalImageWidth / 2;
        const imageStartY = viewportCenter.y - 200;

        // Store image positions for video node placement
        const imagePositions: { x: number; y: number }[] = [];

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
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create nodes');
    }
  }, [data.result, data.mode, canvas, id, generateFallbackTransition, generateFallbackMotion]);

  // Render form view
  const renderForm = () => (
    <div className="p-4 space-y-3">
      {/* Product/Subject */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Product / Subject {!isReadOnly && <span className="text-red-400">*</span>}
        </label>
        <textarea
          value={data.product || ''}
          onChange={(e) => updateField('product', e.target.value)}
          placeholder={isReadOnly ? '' : 'e.g., Premium coffee mug, Fitness app...'}
          disabled={isReadOnly}
          className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          rows={2}
        />
      </div>

      {/* Character (optional) */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Character {!isReadOnly && <span className="text-muted-foreground/70">(optional)</span>}
        </label>
        <textarea
          value={data.character || ''}
          onChange={(e) => updateField('character', e.target.value)}
          placeholder={isReadOnly ? '' : 'e.g., Young professional woman in her 30s...'}
          disabled={isReadOnly}
          className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          rows={2}
        />
      </div>

      {/* Concept/Story */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Concept / Story {!isReadOnly && <span className="text-red-400">*</span>}
        </label>
        <textarea
          value={data.concept || ''}
          onChange={(e) => updateField('concept', e.target.value)}
          placeholder={isReadOnly ? '' : 'e.g., Morning routine ad showing how our coffee mug makes the perfect start...'}
          disabled={isReadOnly}
          className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          rows={3}
        />
      </div>

      {/* Scene Count & Style */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Scenes</label>
          <select
            value={data.sceneCount}
            onChange={(e) => updateField('sceneCount', Number(e.target.value))}
            disabled={isReadOnly}
            className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          >
            {SCENE_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} scenes
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Style</label>
          <select
            value={data.style}
            onChange={(e) => updateField('style', e.target.value as StoryboardStyle)}
            disabled={isReadOnly}
            className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode Toggle */}
      {!isReadOnly && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Video Mode</label>
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            <button
              onClick={() => updateField('mode', 'transition')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors nodrag ${
                (data.mode || 'transition') === 'transition'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Transition
            </button>
            <button
              onClick={() => updateField('mode', 'single-shot')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors nodrag ${
                data.mode === 'single-shot'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Single Shot
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/80">
            {(data.mode || 'transition') === 'transition'
              ? 'Video transitions between consecutive scenes'
              : 'Each scene generates its own video clip'
            }
          </p>
        </div>
      )}

      {/* Error message */}
      {data.error && (
        <div className="p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-xs">
          {data.error}
        </div>
      )}

      {/* Generate button - hidden in read-only mode */}
      {!isReadOnly && (
        <button
          onClick={handleGenerate}
          disabled={!isValid}
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted disabled:text-muted-foreground text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 nodrag"
        >
          <Sparkles className="w-4 h-4" />
          Generate Storyboard
        </button>
      )}
    </div>
  );

  // Render loading view
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      <p className="text-muted-foreground text-sm">Generating your storyboard...</p>
    </div>
  );

  // Render preview view
  const renderPreview = () => {
    if (!data.result) return null;

    const mode = data.mode || 'transition';
    const sceneCount = data.result.scenes.length;
    const videoCount = mode === 'single-shot' ? sceneCount : sceneCount - 1;

    return (
      <div className="p-4 space-y-3">
        {/* Mode indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {mode === 'single-shot' ? (
            <>
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid layout ({sceneCount} images → {videoCount} videos)</span>
            </>
          ) : (
            <>
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Horizontal layout ({sceneCount} images → {videoCount} transitions)</span>
            </>
          )}
        </div>

        {/* Summary */}
        <div className="p-2 bg-muted rounded-lg">
          <h3 className="text-xs font-medium text-muted-foreground mb-1">Summary</h3>
          <p className="text-xs text-foreground">{data.result.summary}</p>
        </div>

        {/* Scenes preview */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Scenes</h3>
          <div className="space-y-1 max-h-[200px] overflow-y-auto nowheel" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
            {data.result.scenes.map((scene) => (
              <ScenePreview key={scene.number} scene={scene} />
            ))}
          </div>
        </div>

        {/* Actions - hidden in read-only mode */}
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
              className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 nodrag"
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
      {/* Floating Toolbar - hidden in read-only mode */}
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
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-storyboard)' }}>
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
            ? 'ring-[2.5px] ring-indigo-500 shadow-lg shadow-indigo-500/10'
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
          <span className="text-sm font-medium text-foreground">Create</span>
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
                className={`!relative !transform-none !w-6 !h-6 !rounded-md !border-2 node-handle hover:!border-indigo-500 ${hasProductImage ? '!border-green-500' : ''
                  }`}
              />
              <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: hasProductImage ? '#4ade80' : 'var(--text-muted)' }} />
            </div>
            <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
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
                className={`!relative !transform-none !w-6 !h-6 !rounded-md !border-2 node-handle hover:!border-indigo-500 ${hasCharacterImage ? '!border-green-500' : ''
                  }`}
              />
              <User className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none" style={{ color: hasCharacterImage ? '#4ade80' : 'var(--text-muted)' }} />
            </div>
            <span className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
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
    <div className="bg-muted rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 text-left hover:bg-muted/80 nodrag"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded">
            {scene.number}
          </span>
          <span className="text-xs font-medium text-foreground">{scene.title}</span>
        </div>
        <ChevronRight
          className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 text-xs">
          <p className="text-muted-foreground">{scene.description}</p>
          <div className="flex gap-1.5 text-[10px]">
            <span className="bg-background px-1.5 py-0.5 rounded text-foreground">
              {scene.camera}
            </span>
            <span className="bg-background px-1.5 py-0.5 rounded text-foreground">
              {scene.mood}
            </span>
          </div>
          <div className="p-1.5 bg-background rounded text-[10px] text-muted-foreground font-mono">
            {scene.prompt}
          </div>
        </div>
      )}
    </div>
  );
}

export const StoryboardNode = memo(StoryboardNodeComponent);
