'use client';

/**
 * Storyboard Node
 *
 * Canvas node for generating storyboards with iterative chat-based refinement.
 * Flow: Form → Generate → Chat timeline with thinking + draft cards → Refine via chat.
 */

import { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasAPI } from '@/lib/plugins/canvas-api';
import type {
  StoryboardNode as StoryboardNodeType,
  StoryboardNodeData,
  StoryboardSceneData,
  StoryboardStyle,
  StoryboardMode,
  StoryboardChatMessage,
  StoryboardThinkingBlock,
  StoryboardDraft,
} from '@/lib/types';
import type { CreateNodeInput } from '@/lib/plugins/types';
import { Clapperboard, Trash2, Sparkles, Grid3X3, ChevronRight, Image as ImageIcon, User, ArrowLeftRight, LayoutGrid, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ThinkingBlock, UserBubble } from '@/lib/plugins/official/agents/animation-generator/components/ChatMessages';
import { StoryboardDraftCard } from './storyboard/StoryboardDraftCard';
import { StoryboardChatInput } from './storyboard/StoryboardChatInput';

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

// Timeline item union for sorted rendering
type TimelineItem =
  | { type: 'user'; seq: number; message: StoryboardChatMessage }
  | { type: 'thinking'; seq: number; block: StoryboardThinkingBlock }
  | { type: 'draft'; seq: number; draft: StoryboardDraft; index: number };

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
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Sequence counter for ordering timeline items
  const seqRef = useRef(0);
  const nextSeq = () => ++seqRef.current;

  // Abort controller for cancelling streams
  const abortRef = useRef<AbortController | null>(null);

  // Batched reasoning accumulator (avoid updating store on every delta)
  const reasoningBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThinkingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Sync seqRef to persisted data on mount
  useEffect(() => {
    const allSeqs = [
      ...(data.chatMessages || []).map((m) => m.seq),
      ...(data.thinkingBlocks || []).map((t) => t.seq),
      ...(data.drafts || []).map((d) => d.seq),
    ];
    if (allSeqs.length > 0) {
      seqRef.current = Math.max(...allSeqs);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Backward compatibility: migrate old data.result into drafts
  useEffect(() => {
    if (data.result && (!data.drafts || data.drafts.length === 0)) {
      const syntheticDraft: StoryboardDraft = {
        id: `draft_migrated_${Date.now()}`,
        scenes: data.result.scenes,
        summary: data.result.summary,
        createdAt: new Date().toISOString(),
        seq: nextSeq(),
      };
      updateNodeData(id, {
        drafts: [syntheticDraft],
        chatPhase: 'draft-ready',
        viewState: data.viewState === 'preview' ? 'chat' : data.viewState,
        // Clear old fields
        result: undefined,
        thinkingText: undefined,
        reasoningText: undefined,
        thinkingStartedAt: undefined,
        isStreaming: undefined,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat to bottom when new items appear
  useEffect(() => {
    if (data.viewState === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [data.viewState, data.chatMessages?.length, data.thinkingBlocks?.length, data.drafts?.length, data.chatPhase]);

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

  // Helper to flush batched reasoning to store
  const flushReasoning = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const thinkingId = activeThinkingIdRef.current;
    const buffered = reasoningBufferRef.current;
    if (!thinkingId || !buffered) return;

    const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!currentNode) return;
    const nodeData = currentNode.data as StoryboardNodeData;
    const blocks = [...(nodeData.thinkingBlocks || [])];
    const idx = blocks.findIndex((b) => b.id === thinkingId);
    if (idx >= 0) {
      blocks[idx] = { ...blocks[idx], reasoning: buffered };
      updateNodeData(id, { thinkingBlocks: blocks });
    }
  }, [id, updateNodeData]);

  // Stream SSE from the storyboard API
  const streamGeneration = useCallback(async (
    body: Record<string, unknown>,
    thinkingLabel: string,
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const thinkingId = `thinking_${Date.now()}`;
    const startedAt = new Date().toISOString();
    activeThinkingIdRef.current = thinkingId;
    reasoningBufferRef.current = '';

    // Add thinking block
    const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
    const nodeData = currentNode?.data as StoryboardNodeData | undefined;
    const existingBlocks = nodeData?.thinkingBlocks || [];
    const newThinking: StoryboardThinkingBlock = {
      id: thinkingId,
      label: thinkingLabel,
      startedAt,
      seq: nextSeq(),
    };

    updateNodeData(id, {
      thinkingBlocks: [...existingBlocks, newThinking],
      chatPhase: 'streaming',
    });

    try {
      const response = await fetch('/api/plugins/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: { type: string; text?: string; error?: string; success?: boolean; scenes?: unknown[]; summary?: string };
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          switch (event.type) {
            case 'reasoning-delta': {
              reasoningBufferRef.current += event.text || '';
              // Batch flush every 100ms
              if (!flushTimerRef.current) {
                flushTimerRef.current = setTimeout(flushReasoning, 100);
              }
              break;
            }
            case 'result': {
              // Final flush of reasoning
              flushReasoning();

              if (event.success && event.scenes) {
                const scenes = event.scenes as StoryboardSceneData[];
                const summary = event.summary || '';
                const draftId = `draft_${Date.now()}`;
                const endedAt = new Date().toISOString();

                // Get latest state
                const latestNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
                const latestData = latestNode?.data as StoryboardNodeData | undefined;
                const currentBlocks = [...(latestData?.thinkingBlocks || [])];
                const currentDrafts = [...(latestData?.drafts || [])];

                // Finalize thinking block
                const tIdx = currentBlocks.findIndex((b) => b.id === thinkingId);
                if (tIdx >= 0) {
                  currentBlocks[tIdx] = { ...currentBlocks[tIdx], endedAt };
                }

                // Add draft
                const newDraft: StoryboardDraft = {
                  id: draftId,
                  scenes,
                  summary,
                  createdAt: endedAt,
                  seq: nextSeq(),
                };
                currentDrafts.push(newDraft);

                updateNodeData(id, {
                  thinkingBlocks: currentBlocks,
                  drafts: currentDrafts,
                  chatPhase: 'draft-ready',
                  error: undefined,
                });
              } else {
                throw new Error('Invalid result from AI service');
              }
              return;
            }
            case 'error': {
              throw new Error(event.error || 'Generation failed');
            }
          }
        }
      }

      // Stream ended without a result event
      const checkNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
      const checkData = checkNode?.data as StoryboardNodeData | undefined;
      if (checkData?.chatPhase === 'streaming') {
        throw new Error('Stream ended without result');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User aborted — finalize thinking block and go to draft-ready
        flushReasoning();
        const latestNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
        const latestData = latestNode?.data as StoryboardNodeData | undefined;
        const currentBlocks = [...(latestData?.thinkingBlocks || [])];
        const tIdx = currentBlocks.findIndex((b) => b.id === thinkingId);
        if (tIdx >= 0) {
          currentBlocks[tIdx] = { ...currentBlocks[tIdx], endedAt: new Date().toISOString() };
        }
        updateNodeData(id, {
          thinkingBlocks: currentBlocks,
          chatPhase: (latestData?.drafts?.length ?? 0) > 0 ? 'draft-ready' : 'idle',
        });
        return;
      }

      flushReasoning();
      // Finalize thinking block
      const latestNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
      const latestData = latestNode?.data as StoryboardNodeData | undefined;
      const currentBlocks = [...(latestData?.thinkingBlocks || [])];
      const tIdx = currentBlocks.findIndex((b) => b.id === thinkingId);
      if (tIdx >= 0) {
        currentBlocks[tIdx] = { ...currentBlocks[tIdx], endedAt: new Date().toISOString() };
      }
      updateNodeData(id, {
        thinkingBlocks: currentBlocks,
        chatPhase: 'error',
        error: err instanceof Error ? err.message : 'Generation failed',
      });
    } finally {
      activeThinkingIdRef.current = null;
      abortRef.current = null;
    }
  }, [id, updateNodeData, flushReasoning]);

  // Initial generation from form
  const handleGenerate = useCallback(async () => {
    if (!isValid) return;

    const mode = data.mode || 'transition';

    // Synthesize user message from form fields
    const characterLine = data.character?.trim() ? ` with character: ${data.character.trim()}` : '';
    const userContent = `Generate a ${data.sceneCount}-scene ${data.style} storyboard for: ${data.product.trim()}${characterLine}. Concept: ${data.concept.trim()}`;
    const userMsg: StoryboardChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
      seq: nextSeq(),
    };

    // Transition to chat view
    updateNodeData(id, {
      viewState: 'chat',
      chatMessages: [...(data.chatMessages || []), userMsg],
      error: undefined,
    });

    const input = {
      product: data.product.trim(),
      character: data.character?.trim() || undefined,
      concept: data.concept.trim(),
      sceneCount: data.sceneCount,
      style: data.style,
      mode,
    };

    await streamGeneration(input, 'Generating storyboard');
  }, [id, data, isValid, updateNodeData, streamGeneration]);

  // Refinement from chat input
  const handleRefinement = useCallback(async (feedback: string) => {
    const latestNode = useCanvasStore.getState().nodes.find((n) => n.id === id);
    const latestData = latestNode?.data as StoryboardNodeData | undefined;
    const drafts = latestData?.drafts || [];
    if (drafts.length === 0) return;

    const latestDraft = drafts[drafts.length - 1];
    const mode = data.mode || 'transition';

    // Add user message
    const userMsg: StoryboardChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: feedback,
      timestamp: new Date().toISOString(),
      seq: nextSeq(),
    };

    const currentMessages = latestData?.chatMessages || [];
    updateNodeData(id, {
      chatMessages: [...currentMessages, userMsg],
    });

    // Build refinement request
    const body = {
      previousDraft: {
        scenes: latestDraft.scenes,
        summary: latestDraft.summary,
      },
      feedback,
      mode,
      product: data.product.trim(),
      character: data.character?.trim() || undefined,
      concept: data.concept.trim(),
      sceneCount: data.sceneCount,
      style: data.style,
    };

    await streamGeneration(body, 'Refining storyboard');
  }, [id, data, updateNodeData, streamGeneration]);

  // Stop streaming
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Helper function to generate fallback transition prompt
  const generateFallbackTransition = useCallback((fromScene: StoryboardSceneData, toScene: StoryboardSceneData): string => {
    return `Cinematic transition from "${fromScene.title}" to "${toScene.title}". ${fromScene.camera} transitioning smoothly, maintaining ${fromScene.mood} atmosphere.`;
  }, []);

  // Helper function to generate fallback motion prompt for single-shot mode
  const generateFallbackMotion = useCallback((scene: StoryboardSceneData): string => {
    return `${scene.description} ${scene.camera}, ${scene.mood} atmosphere.`;
  }, []);

  // Get the active draft (latest or explicitly selected)
  const activeDraft = useMemo(() => {
    const drafts = data.drafts || [];
    if (drafts.length === 0) return null;
    const idx = data.activeDraftIndex ?? drafts.length - 1;
    return drafts[idx] || drafts[drafts.length - 1];
  }, [data.drafts, data.activeDraftIndex]);

  // Create nodes on canvas from the active draft
  const handleCreateOnCanvas = useCallback(async () => {
    if (!activeDraft) return;

    const mode = data.mode || 'transition';

    try {
      // --- Step 1: Find connected source node IDs via edges ---
      const storeState = useCanvasStore.getState();
      const allEdges = storeState.edges;
      const productEdge = allEdges.find(e => e.target === id && e.targetHandle === 'productImage');
      const characterEdge = allEdges.find(e => e.target === id && e.targetHandle === 'characterImage');
      let productRefNodeId: string | null = productEdge?.source ?? null;
      let characterRefNodeId: string | null = characterEdge?.source ?? null;

      const viewportCenter = canvas.getViewportCenter();
      const nodeInputs: CreateNodeInput[] = [];

      const IMAGE_NODE_WIDTH = 280;
      const VIDEO_NODE_WIDTH = 420;
      const STORYBOARD_NODE_WIDTH = 320;
      const RIGHT_MARGIN = 200;
      const PRE_STEP_Y_OFFSET = 400; // How far above scene row pre-step nodes sit
      const PRE_STEP_H_SPACING = 350; // Horizontal gap between side-by-side pre-step nodes

      const storyboardNode = storeState.nodes.find((n) => n.id === id);
      const storyboardRight = storyboardNode
        ? storyboardNode.position.x + STORYBOARD_NODE_WIDTH + RIGHT_MARGIN
        : viewportCenter.x;
      const storyboardY = storyboardNode?.position.y ?? viewportCenter.y;

      // Scene startX is always the same — pre-step nodes go above, not to the left
      const sceneStartX = storyboardRight;

      // --- Step 2: Create pre-step nodes when no images are connected ---
      // We need to know the scene layout to center them, so compute center of scene row first
      const sceneSpacing = mode === 'single-shot' ? 450 : 380;
      const sceneCount = activeDraft.scenes.length;
      const sceneCenterX = sceneStartX + ((sceneCount - 1) * sceneSpacing) / 2;

      const preStepNodeInputs: CreateNodeInput[] = [];
      let preStepProductIndex = -1;
      let preStepCharacterIndex = -1;
      const styleLabel = data.style || 'cinematic';
      const needsProduct = !productRefNodeId && !!data.product?.trim();
      const needsCharacter = !characterRefNodeId && !!data.character?.trim();

      // Total ref count includes both already-connected and to-be-created refs
      // so positioning is consistent regardless of source
      const totalRefCount = (productRefNodeId || needsProduct ? 1 : 0)
                          + (characterRefNodeId || needsCharacter ? 1 : 0);

      // Position ref nodes centered above the scene row
      const preStepY = storyboardY - PRE_STEP_Y_OFFSET;
      const preStepGroupWidth = totalRefCount > 1 ? PRE_STEP_H_SPACING : 0;
      const preStepStartX = sceneCenterX - preStepGroupWidth / 2;

      if (needsProduct) {
        preStepProductIndex = preStepNodeInputs.length;
        preStepNodeInputs.push({
          type: 'imageGenerator',
          position: { x: preStepStartX, y: preStepY },
          name: 'Product Reference',
          data: {
            prompt: `Product photo of ${data.product!.trim()}, ${styleLabel} style, clean background, centered composition, studio lighting, high detail`,
            model: 'nanobanana-pro',
          },
        });
      }

      if (needsCharacter) {
        preStepCharacterIndex = preStepNodeInputs.length;
        preStepNodeInputs.push({
          type: 'imageGenerator',
          position: {
            x: needsProduct ? preStepStartX + PRE_STEP_H_SPACING : preStepStartX,
            y: preStepY,
          },
          name: 'Character Reference',
          data: {
            prompt: `Portrait of ${data.character!.trim()}, ${styleLabel} style, neutral background, detailed features, professional photography`,
            model: 'nanobanana-pro',
          },
        });
      }

      // Create pre-step nodes if any
      let preStepNodeIds: string[] = [];
      if (preStepNodeInputs.length > 0) {
        preStepNodeIds = await canvas.createNodes(preStepNodeInputs);
        if (preStepProductIndex >= 0) {
          productRefNodeId = preStepNodeIds[preStepProductIndex];
        }
        if (preStepCharacterIndex >= 0) {
          characterRefNodeId = preStepNodeIds[preStepCharacterIndex];
        }
      }

      // Reposition already-connected ref nodes above scene row
      {
        const positionChanges: { type: 'position'; id: string; position: { x: number; y: number } }[] = [];
        let slotIndex = 0;

        if (productEdge && productEdge.source) {
          positionChanges.push({
            type: 'position' as const,
            id: productEdge.source,
            position: { x: preStepStartX + slotIndex * PRE_STEP_H_SPACING, y: preStepY },
          });
          slotIndex++;
        }

        if (characterEdge && characterEdge.source) {
          // If product was auto-created (not via edge), character still takes slot after product
          const charSlot = productRefNodeId && !productEdge ? 1 : slotIndex;
          positionChanges.push({
            type: 'position' as const,
            id: characterEdge.source,
            position: { x: preStepStartX + charSlot * PRE_STEP_H_SPACING, y: preStepY },
          });
        }

        if (positionChanges.length > 0) {
          useCanvasStore.getState().onNodesChange(positionChanges);
        }
      }

      // --- Step 3: Determine refHandleCount for scene nodes ---
      const hasProduct = !!productRefNodeId;
      const hasCharacter = !!characterRefNodeId;
      const refCount = (hasProduct ? 1 : 0) + (hasCharacter ? 1 : 0);

      // Helper: get handle assignments for a scene
      // Returns { productHandle, characterHandle, refHandleCount } for a given scene index
      const getHandleAssignments = (sceneIndex: number) => {
        // In transition mode, scene 1+ gets continuity chain on 'reference' (idx 0)
        const hasContinuity = mode === 'transition' && sceneIndex > 0;

        let productHandle: string | null = null;
        let characterHandle: string | null = null;
        let handleCount: number;

        if (hasContinuity) {
          // continuity chain takes 'reference' (idx 0)
          // product gets 'ref2' (idx 1), character gets 'ref3' (idx 2)
          if (hasProduct) productHandle = 'ref2';
          if (hasCharacter) characterHandle = hasProduct ? 'ref3' : 'ref2';
          handleCount = 1 + refCount; // 1 for continuity + product/character
        } else {
          // scene 0 or single-shot: product gets 'reference' (idx 0), character gets 'ref2' (idx 1)
          if (hasProduct) productHandle = 'reference';
          if (hasCharacter) characterHandle = hasProduct ? 'ref2' : 'reference';
          handleCount = refCount;
        }

        return { productHandle, characterHandle, refHandleCount: Math.max(handleCount, 1) };
      };

      if (mode === 'single-shot') {
        const HORIZONTAL_SPACING = 450;
        const VIDEO_Y_OFFSET = 350;

        const startX = sceneStartX;
        const startY = storyboardY;

        const imagePositions: { x: number; y: number }[] = [];
        const imageNodeStartIndex = nodeInputs.length;

        activeDraft.scenes.forEach((scene, index) => {
          const position = {
            x: startX + index * HORIZONTAL_SPACING,
            y: startY,
          };
          imagePositions.push(position);

          const { refHandleCount: sceneRefCount } = getHandleAssignments(index);
          nodeInputs.push({
            type: 'imageGenerator',
            position,
            name: `Scene ${scene.number}: ${scene.title}`,
            data: {
              prompt: scene.prompt,
              model: 'nanobanana-pro',
              refHandleCount: sceneRefCount,
            },
          });
        });

        const videoNodeStartIndex = nodeInputs.length;

        activeDraft.scenes.forEach((scene, index) => {
          const imagePos = imagePositions[index];
          const videoPosition = {
            x: imagePos.x + (IMAGE_NODE_WIDTH - VIDEO_NODE_WIDTH) / 2,
            y: startY + VIDEO_Y_OFFSET,
          };
          const motionPrompt = scene.motion || generateFallbackMotion(scene);

          nodeInputs.push({
            type: 'videoGenerator',
            position: videoPosition,
            name: `Video ${scene.number}: ${scene.title}`,
            data: {
              prompt: motionPrompt,
              model: 'veo-3.1-i2v',
              aspectRatio: '16:9',
              duration: 8,
              resolution: '720p',
              generateAudio: true,
            },
          });
        });

        const nodeIds = await canvas.createNodes(nodeInputs);

        // Image → Video edges
        for (let i = 0; i < activeDraft.scenes.length; i++) {
          const imageNodeId = nodeIds[imageNodeStartIndex + i];
          const videoNodeId = nodeIds[videoNodeStartIndex + i];
          await canvas.createEdge(imageNodeId, 'output', videoNodeId, 'reference');
        }

        // --- Step 5: Product/Character → ALL scene image generators ---
        for (let i = 0; i < activeDraft.scenes.length; i++) {
          const imageNodeId = nodeIds[imageNodeStartIndex + i];
          const { productHandle, characterHandle } = getHandleAssignments(i);
          if (productRefNodeId && productHandle) {
            await canvas.createEdge(productRefNodeId, 'output', imageNodeId, productHandle);
          }
          if (characterRefNodeId && characterHandle) {
            await canvas.createEdge(characterRefNodeId, 'output', imageNodeId, characterHandle);
          }
        }

        canvas.fitView();
        const preStepMsg = preStepNodeIds.length > 0
          ? ` (+ ${preStepNodeIds.length} reference node${preStepNodeIds.length > 1 ? 's' : ''})`
          : '';
        toast.success(
          `Created ${activeDraft.scenes.length} scene nodes and ${activeDraft.scenes.length} video nodes${preStepMsg}. Click "Run All" to generate.`
        );
      } else {
        const IMAGE_SPACING = 380;
        const VIDEO_Y_OFFSET = 450;
        const imageNodeStartIndex = nodeInputs.length;

        const imageStartX = sceneStartX;
        const imageStartY = storyboardY;

        const imagePositions: { x: number; y: number }[] = [];

        activeDraft.scenes.forEach((scene, index) => {
          const position = {
            x: imageStartX + index * IMAGE_SPACING,
            y: imageStartY,
          };
          imagePositions.push(position);

          const { refHandleCount: sceneRefCount } = getHandleAssignments(index);
          nodeInputs.push({
            type: 'imageGenerator',
            position,
            name: `Scene ${scene.number}: ${scene.title}`,
            data: {
              prompt: scene.prompt,
              model: 'nanobanana-pro',
              refHandleCount: sceneRefCount,
            },
          });
        });

        const videoNodeStartIndex = nodeInputs.length;

        for (let i = 0; i < activeDraft.scenes.length - 1; i++) {
          const sourcePos = imagePositions[i];
          const targetPos = imagePositions[i + 1];
          const currentScene = activeDraft.scenes[i];
          const nextScene = activeDraft.scenes[i + 1];

          const videoPosition = {
            x: (sourcePos.x + targetPos.x) / 2 + (IMAGE_NODE_WIDTH - VIDEO_NODE_WIDTH) / 2,
            y: imageStartY + VIDEO_Y_OFFSET,
          };

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

        const nodeIds = await canvas.createNodes(nodeInputs);

        // Continuity chain edges (scene[i] → scene[i+1] on 'reference' handle)
        for (let i = 0; i < activeDraft.scenes.length - 1; i++) {
          const sourceImageId = nodeIds[imageNodeStartIndex + i];
          const targetImageId = nodeIds[imageNodeStartIndex + i + 1];
          await canvas.createEdge(sourceImageId, 'output', targetImageId, 'reference');
        }

        // Video transition edges
        const videoNodeCount = activeDraft.scenes.length - 1;
        for (let i = 0; i < videoNodeCount; i++) {
          const sourceImageId = nodeIds[imageNodeStartIndex + i];
          const targetImageId = nodeIds[imageNodeStartIndex + i + 1];
          const videoNodeId = nodeIds[videoNodeStartIndex + i];
          await canvas.createEdge(sourceImageId, 'output', videoNodeId, 'firstFrame');
          await canvas.createEdge(targetImageId, 'output', videoNodeId, 'lastFrame');
        }

        // --- Step 5: Product/Character → ALL scene image generators ---
        for (let i = 0; i < activeDraft.scenes.length; i++) {
          const imageNodeId = nodeIds[imageNodeStartIndex + i];
          const { productHandle, characterHandle } = getHandleAssignments(i);
          if (productRefNodeId && productHandle) {
            await canvas.createEdge(productRefNodeId, 'output', imageNodeId, productHandle);
          }
          if (characterRefNodeId && characterHandle) {
            await canvas.createEdge(characterRefNodeId, 'output', imageNodeId, characterHandle);
          }
        }

        canvas.fitView();
        const preStepMsg = preStepNodeIds.length > 0
          ? ` (+ ${preStepNodeIds.length} reference node${preStepNodeIds.length > 1 ? 's' : ''})`
          : '';
        toast.success(
          `Created ${activeDraft.scenes.length} scene nodes and ${videoNodeCount} video nodes${preStepMsg}. Click "Run All" to generate images, then videos.`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create nodes');
    }
  }, [activeDraft, data.mode, data.product, data.character, data.style, canvas, id, generateFallbackTransition, generateFallbackMotion]);

  // Build sorted timeline from chat messages, completed thinking blocks, and drafts
  const timelineItems = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];

    // User messages
    for (const msg of data.chatMessages || []) {
      items.push({ type: 'user', seq: msg.seq, message: msg });
    }

    // Completed thinking blocks (not the currently-streaming one)
    for (const block of data.thinkingBlocks || []) {
      if (block.endedAt) {
        items.push({ type: 'thinking', seq: block.seq, block });
      }
    }

    // Drafts
    (data.drafts || []).forEach((draft, index) => {
      items.push({ type: 'draft', seq: draft.seq, draft, index });
    });

    items.sort((a, b) => a.seq - b.seq);
    return items;
  }, [data.chatMessages, data.thinkingBlocks, data.drafts]);

  // Currently streaming thinking block
  const streamingThinking = useMemo(() => {
    if (data.chatPhase !== 'streaming') return null;
    const blocks = data.thinkingBlocks || [];
    return blocks.find((b) => !b.endedAt) || null;
  }, [data.chatPhase, data.thinkingBlocks]);

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

  // Render chat timeline view
  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Scrollable timeline */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto nowheel p-3 space-y-3"
        onWheel={(e) => !e.ctrlKey && e.stopPropagation()}
      >
        {timelineItems.map((item) => {
          switch (item.type) {
            case 'user':
              return (
                <div key={item.message.id} className="flex justify-end">
                  <div className="max-w-[85%]">
                    <UserBubble content={item.message.content} />
                  </div>
                </div>
              );
            case 'thinking':
              return (
                <div key={item.block.id}>
                  <ThinkingBlock
                    thinking={item.block.label}
                    reasoning={item.block.reasoning}
                    isStreaming={false}
                    startedAt={item.block.startedAt}
                    endedAt={item.block.endedAt}
                    maxReasoningHeight={120}
                  />
                </div>
              );
            case 'draft':
              return (
                <div key={item.draft.id}>
                  <StoryboardDraftCard
                    draft={item.draft}
                    draftIndex={item.index}
                    mode={data.mode || 'transition'}
                    isLatest={item.index === (data.drafts?.length ?? 0) - 1}
                    onCreateNodes={handleCreateOnCanvas}
                    isReadOnly={isReadOnly}
                  />
                </div>
              );
            default:
              return null;
          }
        })}

        {/* Currently streaming thinking block (not yet in timeline) */}
        {streamingThinking && (
          <div>
            <ThinkingBlock
              thinking={streamingThinking.label}
              reasoning={streamingThinking.reasoning}
              isStreaming={true}
              startedAt={streamingThinking.startedAt}
              maxReasoningHeight={120}
            />
          </div>
        )}

        {/* Error in chat */}
        {data.chatPhase === 'error' && data.error && (
          <div className="p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-xs">
            {data.error}
          </div>
        )}
      </div>

      {/* Chat input — pinned at bottom */}
      {!isReadOnly && (
        <StoryboardChatInput
          onSubmit={handleRefinement}
          onStop={handleStop}
          isGenerating={data.chatPhase === 'streaming'}
          disabled={data.chatPhase === 'streaming'}
          placeholder={
            (data.drafts?.length ?? 0) > 0
              ? 'Refine the storyboard...'
              : 'Waiting for generation...'
          }
        />
      )}
    </div>
  );

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
          animation-node w-[400px] rounded-2xl overflow-hidden flex flex-col
          transition-[box-shadow,ring-color] duration-150
          ${selected
            ? 'ring-[2.5px] ring-indigo-500 shadow-lg shadow-indigo-500/10'
            : 'ring-1 hover:ring-2'
          }
        `}
        style={{
          backgroundColor: 'var(--node-card-bg)',
          border: 'none',
          '--tw-ring-color': selected ? undefined : 'var(--node-ring)',
          minHeight: data.viewState === 'chat' ? '450px' : undefined,
          maxHeight: data.viewState === 'chat' ? '620px' : undefined,
          height: data.viewState === 'chat' ? '580px' : undefined,
        } as React.CSSProperties}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center shrink-0">
          {data.viewState === 'chat' && !isReadOnly ? (
            <button
              onClick={() => updateNodeData(id, { viewState: 'form' })}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors nodrag"
            >
              <ArrowLeft className="w-4 h-4" />
              Edit Form
            </button>
          ) : (
            <span className="text-sm font-medium text-foreground">Create</span>
          )}
        </div>

        {/* Content */}
        {data.viewState === 'form' ? (
          <div className="h-[580px] overflow-y-auto nowheel" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
            {renderForm()}
          </div>
        ) : data.viewState === 'chat' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {renderChat()}
          </div>
        ) : data.viewState === 'loading' ? (
          /* Legacy loading state — show thinking block */
          <div className="h-[580px] overflow-y-auto nowheel p-4 flex flex-col justify-center" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
            <ThinkingBlock
              thinking={data.thinkingText || 'Generating storyboard'}
              reasoning={data.reasoningText}
              isStreaming={data.isStreaming ?? true}
              startedAt={data.thinkingStartedAt}
              maxReasoningHeight={400}
            />
          </div>
        ) : data.viewState === 'preview' ? (
          /* Legacy preview state — show old result */
          <div className="h-[580px] overflow-y-auto nowheel" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
            {data.result && (
              <div className="p-4 space-y-3">
                <div className="p-2 bg-muted rounded-lg">
                  <h3 className="text-xs font-medium text-muted-foreground mb-1">Summary</h3>
                  <p className="text-xs text-foreground">{data.result.summary}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">Scenes</h3>
                  <div className="space-y-1">
                    {data.result.scenes.map((scene) => (
                      <ScenePreview key={scene.number} scene={scene} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Input Handles - Left side (shown in form and chat views) */}
      {(data.viewState === 'form' || data.viewState === 'chat') && (
        <>
          {/* Product Image Handle */}
          <div className="absolute -left-3 group" style={{ top: '95px' }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id="productImage"
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-red-400 !border-zinc-900 hover:!border-zinc-700"
              />
              <ImageIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
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
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-indigo-400 !border-zinc-900 hover:!border-zinc-700"
              />
              <User className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-zinc-900" />
            </div>
            <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
              {hasCharacterImage ? 'Character Image (connected)' : 'Character Image'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// Scene preview card (kept for legacy preview state)
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
