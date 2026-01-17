'use client';

/**
 * Storyboard Sandbox UI
 *
 * Form UI for generating storyboards and creating nodes on the canvas.
 */

import * as React from 'react';
import { Loader2, Sparkles, Grid3X3, ChevronRight } from 'lucide-react';
import type { AgentSandboxProps, CreateNodeInput } from '@/lib/plugins/types';
import type { StoryboardInput, StoryboardOutput, StoryboardScene } from './schema';

// Style options
const STYLE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'illustrated', label: 'Illustrated' },
  { value: 'commercial', label: 'Commercial' },
] as const;

// Scene count options
const SCENE_COUNTS = [4, 5, 6, 8] as const;

type ViewState = 'form' | 'loading' | 'preview';

export function StoryboardSandbox({ canvas, onClose, notify }: AgentSandboxProps) {
  // Form state
  const [product, setProduct] = React.useState('');
  const [character, setCharacter] = React.useState('');
  const [concept, setConcept] = React.useState('');
  const [sceneCount, setSceneCount] = React.useState<number>(4);
  const [style, setStyle] = React.useState<StoryboardInput['style']>('cinematic');

  // UI state
  const [viewState, setViewState] = React.useState<ViewState>('form');
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<StoryboardOutput | null>(null);

  // Validation
  const isValid = product.trim().length > 0 && concept.trim().length > 0;

  // Generate storyboard
  const handleGenerate = async () => {
    if (!isValid) return;

    setViewState('loading');
    setError(null);

    try {
      const input: StoryboardInput = {
        product: product.trim(),
        character: character.trim() || undefined,
        concept: concept.trim(),
        sceneCount,
        style,
      };

      const response = await fetch('/api/plugins/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setResult({ scenes: data.scenes, summary: data.summary });
      setViewState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setViewState('form');
    }
  };

  // Helper function to generate fallback transition prompt
  const generateFallbackTransition = (fromScene: StoryboardScene, toScene: StoryboardScene): string => {
    return `Cinematic transition from "${fromScene.title}" to "${toScene.title}". ${fromScene.camera} transitioning smoothly, maintaining ${fromScene.mood} atmosphere.`;
  };

  // Create nodes on canvas
  const handleCreateOnCanvas = async () => {
    if (!result) return;

    try {
      const viewportCenter = canvas.getViewportCenter();
      const nodeInputs: CreateNodeInput[] = [];

      // Track the starting index for image nodes
      const imageNodeStartIndex = nodeInputs.length;

      // Layout constants
      const IMAGE_NODE_WIDTH = 280;
      const VIDEO_NODE_WIDTH = 420;
      const IMAGE_SPACING = 380; // Horizontal spacing between image nodes
      const VIDEO_Y_OFFSET = 450; // Vertical offset for video nodes below images

      // Calculate starting X to center the layout
      const totalImageWidth = (result.scenes.length - 1) * IMAGE_SPACING + IMAGE_NODE_WIDTH;
      const imageStartX = viewportCenter.x - totalImageWidth / 2;
      const imageStartY = viewportCenter.y - 200;

      // Store image positions for video node placement
      const imagePositions: { x: number; y: number }[] = [];

      // Create image generator nodes in a horizontal row
      result.scenes.forEach((scene, index) => {
        const position = {
          x: imageStartX + index * IMAGE_SPACING,
          y: imageStartY,
        };
        imagePositions.push(position);

        nodeInputs.push({
          type: 'imageGenerator',
          position,
          name: `Scene ${scene.number}: ${scene.title}`,
          data: {
            prompt: scene.prompt,
            model: 'nanobanana-pro',
          },
        });
      });

      // Track the starting index for video nodes
      const videoNodeStartIndex = nodeInputs.length;

      // Create video generator nodes between consecutive image pairs
      // N images = N-1 videos
      for (let i = 0; i < result.scenes.length - 1; i++) {
        const sourcePos = imagePositions[i];
        const targetPos = imagePositions[i + 1];
        const currentScene = result.scenes[i];
        const nextScene = result.scenes[i + 1];

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
          name: `Video Generator ${i + 1}`,
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
      // Image 1 → Image 2 → Image 3 → etc.
      for (let i = 0; i < result.scenes.length - 1; i++) {
        const sourceImageId = nodeIds[imageNodeStartIndex + i];
        const targetImageId = nodeIds[imageNodeStartIndex + i + 1];

        // Connect output of current image to reference input of next image
        await canvas.createEdge(sourceImageId, 'output', targetImageId, 'reference');
      }

      // Create edges connecting image nodes to video nodes
      // For each video node, connect:
      // - Source image output → video firstFrame
      // - Target image output → video lastFrame
      const videoNodeCount = result.scenes.length - 1;
      for (let i = 0; i < videoNodeCount; i++) {
        const sourceImageId = nodeIds[imageNodeStartIndex + i];
        const targetImageId = nodeIds[imageNodeStartIndex + i + 1];
        const videoNodeId = nodeIds[videoNodeStartIndex + i];

        // Source image → firstFrame
        await canvas.createEdge(sourceImageId, 'output', videoNodeId, 'firstFrame');
        // Target image → lastFrame
        await canvas.createEdge(targetImageId, 'output', videoNodeId, 'lastFrame');
      }

      // Fit view to show all nodes
      canvas.fitView();

      // Close sandbox and notify
      const videoCount = result.scenes.length - 1;
      notify(
        `Created ${result.scenes.length} scene nodes and ${videoCount} video nodes. Click "Run All" to generate images, then videos.`,
        'success'
      );
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create nodes', 'error');
    }
  };

  // Render form view
  const renderForm = () => (
    <div className="p-4 space-y-4">
      {/* Product/Subject */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-300">
          Product / Subject <span className="text-red-400">*</span>
        </label>
        <textarea
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="e.g., Premium coffee mug, Fitness app, Electric car..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={2}
        />
      </div>

      {/* Character (optional) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-300">
          Character <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
          placeholder="e.g., Young professional woman in her 30s, Athletic male model..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={2}
        />
      </div>

      {/* Concept/Story */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-300">
          Concept / Story <span className="text-red-400">*</span>
        </label>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="e.g., Morning routine ad showing how our coffee mug makes the perfect start to the day..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={3}
        />
      </div>

      {/* Scene Count & Style */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300">Scenes</label>
          <select
            value={sceneCount}
            onChange={(e) => setSceneCount(Number(e.target.value))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SCENE_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} scenes
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300">Style</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as StoryboardInput['style'])}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!isValid}
        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Generate Storyboard
      </button>
    </div>
  );

  // Render loading view
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      <p className="text-zinc-400">Generating your storyboard...</p>
    </div>
  );

  // Render preview view
  const renderPreview = () => {
    if (!result) return null;

    return (
      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="p-3 bg-zinc-800 rounded-lg">
          <h3 className="text-sm font-medium text-zinc-300 mb-1">Summary</h3>
          <p className="text-sm text-zinc-400">{result.summary}</p>
        </div>

        {/* Scenes preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">Scenes</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {result.scenes.map((scene) => (
              <ScenePreview key={scene.number} scene={scene} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setViewState('form')}
            className="flex-1 py-2.5 px-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium rounded-lg transition-colors"
          >
            Back to Edit
          </button>
          <button
            onClick={handleCreateOnCanvas}
            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Grid3X3 className="w-4 h-4" />
            Create on Canvas
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {viewState === 'form' && renderForm()}
      {viewState === 'loading' && renderLoading()}
      {viewState === 'preview' && renderPreview()}
    </>
  );
}

// Scene preview card
function ScenePreview({ scene }: { scene: StoryboardScene }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="bg-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-750"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded">
            {scene.number}
          </span>
          <span className="text-sm font-medium text-zinc-200">{scene.title}</span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-zinc-500 transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 text-sm">
          <p className="text-zinc-400">{scene.description}</p>
          <div className="flex gap-2 text-xs">
            <span className="bg-zinc-700 px-2 py-0.5 rounded text-zinc-300">
              {scene.camera}
            </span>
            <span className="bg-zinc-700 px-2 py-0.5 rounded text-zinc-300">
              {scene.mood}
            </span>
          </div>
          <div className="p-2 bg-zinc-900 rounded text-xs text-zinc-400 font-mono">
            {scene.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
