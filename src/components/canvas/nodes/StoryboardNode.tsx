'use client';

/**
 * Storyboard Node
 *
 * Canvas node for generating storyboards with iterative chat-based refinement.
 * Flow: Form → Generate → Chat timeline with thinking + draft cards → Refine via chat.
 */

import { memo, useCallback, useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasAPI } from '@/lib/plugins/canvas-api';
import type {
  StoryboardNode as StoryboardNodeType,
  StoryboardNodeData,
  StoryboardSceneData,
  StoryboardStyle,
  StoryboardMode,
  StoryboardVideoModel,
  StoryboardChatMessage,
  StoryboardThinkingBlock,
  StoryboardDraft,
  StoryboardReference,
  StoryboardReferenceRole,
  StoryboardReferenceIdentity,
  VideoModelType,
  VideoAspectRatio,
  VideoDuration,
} from '@/lib/types';
import { VIDEO_MODEL_CAPABILITIES } from '@/lib/types';
import type { CreateNodeInput } from '@/lib/plugins/types';
import { Clapperboard, Trash2, Sparkles, Grid3X3, ChevronRight, Image as ImageIcon, User, ArrowLeftRight, LayoutGrid, ArrowLeft, Info, Wand2, Loader2, Plus, X, Box, Mountain } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { ThinkingBlock, UserBubble } from '@/lib/plugins/official/agents/animation-generator/components/ChatMessages';
import { StoryboardDraftCard } from './storyboard/StoryboardDraftCard';
import { ChatInput } from '@/lib/plugins/official/agents/animation-generator/components/ChatInput';
import { useNodeDisplayMode } from './useNodeDisplayMode';
import { NodeFloatingToolbar } from '@/components/canvas/nodes/chrome/NodeFloatingToolbar';
import { useNodeChromeState } from '@/components/canvas/nodes/chrome/useNodeChromeState';
import { getPromptHeavyInputHandleTop } from '@/components/canvas/nodes/chrome/handleLayout';
// Video recipes available but not shown in UI — injected server-side if needed

// Style options
const STYLE_OPTIONS: { value: StoryboardStyle; label: string }[] = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'illustrated', label: 'Illustrated' },
  { value: 'commercial', label: 'Commercial' },
];

// Video model family options
const VIDEO_MODEL_OPTIONS: { value: StoryboardVideoModel; label: string; hint: string }[] = [
  { value: 'veo', label: 'Veo', hint: 'Cinematic polish, audio & lip sync' },
  { value: 'kling', label: 'Kling', hint: 'Motion physics & multi-shot' },
];

function normalizeStoryboardVideoModel(model?: StoryboardVideoModel): StoryboardVideoModel {
  if (!model) return 'veo';
  if (model === 'seedance') return 'kling';
  return model;
}

// Model family → video model IDs for canvas node creation
const VIDEO_MODEL_IDS: Record<StoryboardVideoModel, { transition: string; singleShot: string }> = {
  veo: { transition: 'veo-3.1-flf', singleShot: 'veo-3.1-i2v' },
  kling: { transition: 'kling-3.0-i2v', singleShot: 'kling-3.0-i2v' },
  seedance: { transition: 'kling-3.0-i2v', singleShot: 'kling-3.0-i2v' },
};

// Resolve per-scene video settings with validation against model capabilities
function resolveVideoSettings(
  scene: StoryboardSceneData,
  modelId: string,
): { aspectRatio?: VideoAspectRatio; duration?: VideoDuration } {
  const caps = VIDEO_MODEL_CAPABILITIES[modelId as VideoModelType];
  if (!caps) return {};

  let aspectRatio: VideoAspectRatio | undefined;
  if (scene.videoAspectRatio) {
    const ar = scene.videoAspectRatio as VideoAspectRatio;
    aspectRatio = caps.aspectRatios.includes(ar) ? ar : caps.aspectRatios[0] as VideoAspectRatio;
  }

  let duration: VideoDuration | undefined;
  if (scene.videoDuration) {
    const d = scene.videoDuration as VideoDuration;
    duration = caps.durations.includes(d) ? d : caps.defaultDuration;
  }

  return { aspectRatio, duration };
}

// Determine the correct target handle for image→video edges based on video model's input mode
function getVideoTargetHandle(modelId: string): string {
  const caps = VIDEO_MODEL_CAPABILITIES[modelId as VideoModelType];
  if (!caps) return 'reference';
  // Models with numbered image refs show ref1/ref2/ref3... handles.
  if ((caps.maxReferences ?? 0) > 0) return 'ref1';
  if (caps.inputMode === 'first-last-frame') return 'firstFrame';
  return 'reference';
}

// Scene count options
const SCENE_COUNTS = [4, 5, 6, 8] as const;

// Timeline item union for sorted rendering
type TimelineItem =
  | { type: 'user'; seq: number; message: StoryboardChatMessage }
  | { type: 'thinking'; seq: number; block: StoryboardThinkingBlock }
  | { type: 'draft'; seq: number; draft: StoryboardDraft; index: number };

/**
 * Keeps a local copy of a store-driven field so the textarea cursor doesn't jump.
 *
 * The problem: ReactFlow uses a two-hop state pipeline (Zustand → ReactFlow internal store → node re-render).
 * After the user types, `setLocal` triggers an immediate re-render, but `storeValue` (from ReactFlow's
 * data prop) still holds the OLD value because ReactFlow hasn't processed the update yet. Any ref-based
 * comparison between the stale storeValue and what we just typed incorrectly detects an "external change"
 * and resets local state, causing the cursor to jump.
 *
 * Fix: while the textarea is focused, local state is authoritative and store updates are ignored.
 * On blur we reconcile so external changes (undo, migration) are picked up.
 */
function useLocalField(
  storeValue: string,
  onUpdate: (value: string, options?: { final?: boolean }) => void,
) {
  const [local, setLocal] = useState(storeValue);
  const focused = useRef(false);
  const storeRef = useRef(storeValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    storeRef.current = storeValue;
    if (!focused.current) {
      setLocal(storeValue);
    }
  }, [storeValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const nextValue = e.target.value;
      setLocal(nextValue);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onUpdate(nextValue, { final: false });
      }, 750);
    },
    [onUpdate],
  );

  const handleFocus = useCallback(() => { focused.current = true; }, []);
  const handleBlur = useCallback(() => {
    focused.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onUpdate(local, { final: true });
  }, [local, onUpdate]);

  return { value: local, onChange: handleChange, onFocus: handleFocus, onBlur: handleBlur };
}

function ReferenceCard({
  ref: refData,
  index,
  isReadOnly,
  referenceImageUrls,
  updateReference,
  removeReference,
  setCardRef,
  refsLength,
}: {
  ref: StoryboardReference;
  index: number;
  isReadOnly: boolean;
  referenceImageUrls: Record<string, string>;
  updateReference: (refId: string, field: keyof StoryboardReference, value: string, options?: { final?: boolean }) => void;
  removeReference: (refId: string) => void;
  setCardRef: (index: number, el: HTMLDivElement | null) => void;
  refsLength: number;
}) {
  const labelField = useLocalField(refData.label, (v, options) => updateReference(refData.id, 'label', v, options));
  const descField = useLocalField(refData.description, (v, options) => updateReference(refData.id, 'description', v, options));
  const handleCardRef = useCallback((el: HTMLDivElement | null) => {
    setCardRef(index, el);
  }, [index, setCardRef]);

  return (
    <div ref={handleCardRef} className="p-2 bg-muted/50 border border-border rounded-lg space-y-1.5">
      <div className="flex items-center gap-1.5">
        {/* Role dropdown */}
        <select
          value={refData.role}
          onChange={(e) => updateReference(refData.id, 'role', e.target.value)}
          disabled={isReadOnly}
          className="px-1.5 py-1 bg-muted border border-border rounded text-[10px] text-foreground focus:outline-none nodrag"
        >
          <option value="subject">Subject</option>
          <option value="character">Character</option>
          <option value="prop">Prop</option>
          <option value="environment">Environment</option>
        </select>
        {/* Label input */}
        <input
          {...labelField}
          placeholder={isReadOnly ? '' : 'Name...'}
          disabled={isReadOnly}
          className="flex-1 px-2 py-1 bg-muted border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 nodrag"
        />
        {/* Connected image indicator */}
        {referenceImageUrls[refData.handleId] && (
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Image connected" />
        )}
        {/* Remove button */}
        {!isReadOnly && refsLength > 1 && (
          <button
            onClick={() => removeReference(refData.id)}
            className="p-0.5 text-muted-foreground hover:text-red-400 transition-colors nodrag"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {/* Description textarea */}
      <textarea
        {...descField}
        placeholder={isReadOnly ? '' : refData.role === 'character' ? 'Physical appearance...' : 'Description...'}
        disabled={isReadOnly}
        className={`w-full px-2 py-1 bg-muted border border-border rounded text-xs text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
        rows={2}
      />
    </div>
  );
}

function StoryboardNodeComponent({ id, data, selected }: NodeProps<StoryboardNodeType>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const getConnectedInputs = useCanvasStore((state) => state.getConnectedInputs);
  const isReadOnly = useCanvasStore((state) => state.isReadOnly);
  const canvas = useCanvasAPI();

  // Check for connected images (N-ref + legacy)
  const connectedInputs = getConnectedInputs(id);
  const hasProductImage = !!connectedInputs.productImageUrl;
  const hasCharacterImage = !!connectedInputs.characterImageUrl;
  const referenceImageUrls: Record<string, string> = connectedInputs.referenceImageUrls || {};

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Storyboard');
  const [isHovered, setIsHovered] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const rootNodeRef = useRef<HTMLDivElement>(null);
  const refCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const setRefCardRef = useCallback((index: number, el: HTMLDivElement | null) => {
    refCardRefs.current[index] = el;
  }, []);
  const [handleTops, setHandleTops] = useState<(number | null)[]>([]);
  const { displayMode, focusedWithin, focusProps } = useNodeDisplayMode(selected);

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

  // Backward compatibility: migrate legacy product/character → references array
  useEffect(() => {
    if (!data.references && (data.product !== undefined || data.character !== undefined)) {
      const refs: StoryboardReference[] = [];
      if (data.product) {
        refs.push({ id: 'ref_legacy_product', role: 'subject', label: data.product, description: data.product, handleId: 'refImage_0' });
      }
      if (data.character) {
        refs.push({ id: 'ref_legacy_character', role: 'character', label: data.character, description: data.character, handleId: refs.length === 0 ? 'refImage_0' : 'refImage_1' });
      }
      if (refs.length === 0) {
        refs.push({ id: `ref_${Date.now()}`, role: 'subject', label: '', description: '', handleId: 'refImage_0' });
      }
      updateNodeData(id, { references: refs });

      // Migrate connected edges from legacy handles to new refImage handles
      const storeState = useCanvasStore.getState();
      const edgeUpdates: Array<{ oldEdgeId: string; source: string; sourceHandle: string; newTargetHandle: string }> = [];
      for (const edge of storeState.edges) {
        if (edge.target !== id) continue;
        if (edge.targetHandle === 'productImage') {
          edgeUpdates.push({ oldEdgeId: edge.id, source: edge.source, sourceHandle: edge.sourceHandle || 'output', newTargetHandle: 'refImage_0' });
        } else if (edge.targetHandle === 'characterImage') {
          edgeUpdates.push({ oldEdgeId: edge.id, source: edge.source, sourceHandle: edge.sourceHandle || 'output', newTargetHandle: refs.length > 1 ? 'refImage_1' : 'refImage_0' });
        }
      }
      if (edgeUpdates.length > 0) {
        const removals = edgeUpdates.map(u => ({ type: 'remove' as const, id: u.oldEdgeId }));
        storeState.onEdgesChange(removals);
        for (const u of edgeUpdates) {
          storeState.onConnect({
            source: u.source,
            sourceHandle: u.sourceHandle,
            target: id,
            targetHandle: u.newTargetHandle,
          });
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Backward compatibility: migrate drafts with legacy identities to referenceIdentities
  useEffect(() => {
    if (!data.drafts?.length) return;
    const updatedDrafts = data.drafts.map(draft => {
      if (draft.referenceIdentities?.length || (!draft.productIdentity && !draft.characterIdentity)) return draft;
      const refIdentities: StoryboardReferenceIdentity[] = [];
      if (draft.productIdentity) {
        refIdentities.push({ refId: 'ref_legacy_product', label: data.references?.[0]?.label || 'Product', role: 'subject', identity: draft.productIdentity });
      }
      if (draft.characterIdentity) {
        const charRef = data.references?.find(r => r.role === 'character');
        refIdentities.push({ refId: charRef?.id || 'ref_legacy_character', label: charRef?.label || 'Character', role: 'character', identity: draft.characterIdentity });
      }
      return { ...draft, referenceIdentities: refIdentities };
    });
    if (updatedDrafts.some((d, i) => d !== data.drafts![i])) {
      updateNodeData(id, { drafts: updatedDrafts });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat to bottom only when NEW content appears (not on every re-render)
  const prevItemCountRef = useRef(0);
  useEffect(() => {
    if (data.viewState !== 'chat' || !chatScrollRef.current) return;
    const currentCount = (data.chatMessages?.length ?? 0) + (data.thinkingBlocks?.length ?? 0) + (data.drafts?.length ?? 0);
    // Scroll when items are added or phase changes to streaming
    if (currentCount > prevItemCountRef.current || data.chatPhase === 'streaming') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
    prevItemCountRef.current = currentCount;
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
    <K extends keyof StoryboardNodeData>(field: K, value: StoryboardNodeData[K], options?: { final?: boolean }) => {
      updateNodeData(
        id,
        { [field]: value },
        options
          ? (options.final
            ? { history: 'push', save: 'schedule', preview: 'skip', kind: 'content' }
            : { history: 'skip', save: 'skip', preview: 'skip', kind: 'typing' })
          : undefined
      );
    },
    [id, updateNodeData]
  );

  // Local field state to prevent cursor-jump in textareas
  const conceptField = useLocalField(data.concept || '', (v, options) => updateField('concept', v, options));

  // References helpers
  const refs = data.references || [];
  const targetVideoModel = normalizeStoryboardVideoModel(data.targetVideoModel);
  const MAX_REFS = 8;

  useEffect(() => {
    if (data.targetVideoModel === 'seedance') {
      updateField('targetVideoModel', 'kling');
    }
  }, [data.targetVideoModel, updateField]);

  // Force React Flow to recalculate handle positions when references change
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, refs.length, updateNodeInternals]);

  useLayoutEffect(() => {
    const rootEl = rootNodeRef.current;
    if (!rootEl) return;
    refCardRefs.current.length = refs.length;

    const measure = () => {
      const tops = refs.map((_, i) => {
        const card = refCardRefs.current[i];
        if (!card) return null;
        let offset = 0;
        let el: HTMLElement | null = card;
        while (el && el !== rootEl) {
          offset += el.offsetTop;
          el = el.offsetParent as HTMLElement | null;
        }
        return offset + card.offsetHeight / 2;
      });
      setHandleTops(tops);
    };

    measure();

    const observer = new ResizeObserver(() => measure());
    refCardRefs.current.forEach((card) => { if (card) observer.observe(card); });
    return () => observer.disconnect();
  }, [refs.length]);

  const addReference = useCallback(() => {
    if (refs.length >= MAX_REFS) return;
    const newRef: StoryboardReference = {
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'subject',
      label: '',
      description: '',
      handleId: `refImage_${refs.length}`,
    };
    updateNodeData(id, { references: [...refs, newRef] });
  }, [id, refs, updateNodeData]);

  const removeReference = useCallback((refId: string) => {
    const filtered = refs.filter(r => r.id !== refId);
    // Re-assign handleIds to keep them sequential
    const reindexed = filtered.map((r, i) => ({ ...r, handleId: `refImage_${i}` }));
    updateNodeData(id, { references: reindexed.length > 0 ? reindexed : [{ id: `ref_${Date.now()}`, role: 'subject' as const, label: '', description: '', handleId: 'refImage_0' }] });
  }, [id, refs, updateNodeData]);

  const updateReference = useCallback((refId: string, field: keyof StoryboardReference, value: string, options?: { final?: boolean }) => {
    const updated = refs.map(r => r.id === refId ? { ...r, [field]: value } : r);
    updateNodeData(
      id,
      { references: updated },
      options
        ? (options.final
          ? { history: 'push', save: 'schedule', preview: 'skip', kind: 'content' }
          : { history: 'skip', save: 'skip', preview: 'skip', kind: 'typing' })
        : undefined
    );
  }, [id, refs, updateNodeData]);

  // Validation: at least one reference with a label + concept filled
  const isValid = refs.some(r => r.label.trim().length > 0) && (data.concept?.trim().length ?? 0) > 0;
  const latestDraft = data.drafts?.[data.drafts.length - 1];
  const storyboardSummary = useMemo(() => {
    const concept = (data.concept || '').replace(/\s+/g, ' ').trim();
    const latestUserMessage = [...(data.chatMessages || [])]
      .reverse()
      .find((message) => message.role === 'user' && message.content.trim())?.content;
    return latestDraft?.summary || data.result?.summary || concept || latestUserMessage || 'Add references and a concept to generate a storyboard.';
  }, [data.chatMessages, data.concept, data.result?.summary, latestDraft?.summary]);
  const chromeState = useNodeChromeState({
    isHovered,
    focusedWithin,
    selected,
    displayMode,
    hasOutput: data.viewState === 'chat' || data.viewState === 'preview',
  });
  const showTopToolbar = chromeState.showTopToolbar && !isReadOnly;
  const showHandles = chromeState.showHandles;

  // Concept auto-generation
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const handleGenerateConcept = useCallback(async () => {
    const hasAnyLabel = refs.some(r => r.label.trim());
    if (!hasAnyLabel) {
      toast.error('Enter at least one reference label first');
      return;
    }
    setIsGeneratingConcept(true);
    try {
      const connectedInputs = getConnectedInputs(id);
      const connectedParts: string[] = [];
      // Note legacy fields for concept API compatibility
      for (const ref of refs) {
        if (referenceImageUrls[ref.handleId]) {
          connectedParts.push(`${ref.role} reference image connected for "${ref.label}"`);
        }
      }

      // Build product/character from refs for concept API backward compat
      const subjectRef = refs.find(r => r.role === 'subject' || r.role === 'prop');
      const characterRef = refs.find(r => r.role === 'character');
      const res = await fetch('/api/plugins/storyboard/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: subjectRef?.label?.trim() || refs[0]?.label?.trim(),
          character: characterRef?.label?.trim() || undefined,
          style: data.style,
          targetVideoModel,
          connectedNodes: connectedParts.join(', ') || undefined,
        }),
      });
      const result = await res.json();
      if (result.success && result.concept) {
        updateField('concept', result.concept);
      } else {
        toast.error(result.error || 'Failed to generate concept');
      }
    } catch {
      toast.error('Failed to generate concept');
    } finally {
      setIsGeneratingConcept(false);
    }
  }, [id, refs, data.style, targetVideoModel, getConnectedInputs, updateField, referenceImageUrls]);

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

          let event: { type: string; text?: string; error?: string; success?: boolean; scenes?: unknown[]; summary?: string; productIdentity?: string; characterIdentity?: string; referenceIdentities?: unknown[] };
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
                const productIdentity = event.productIdentity as string | undefined;
                const characterIdentity = event.characterIdentity as string | undefined;
                const referenceIdentities = event.referenceIdentities as StoryboardReferenceIdentity[] | undefined;
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

                // Add draft with identity fields
                const newDraft: StoryboardDraft = {
                  id: draftId,
                  scenes,
                  summary,
                  productIdentity,
                  characterIdentity,
                  referenceIdentities,
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
    const refSummary = refs.filter(r => r.label.trim()).map(r => `${r.role}: ${r.label.trim()}`).join(', ');
    const userContent = `Generate a ${data.sceneCount}-scene ${data.style} storyboard with references: ${refSummary}. Concept: ${data.concept.trim()}`;
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

    // Include connected image URLs so the LLM can SEE the actual references
    const connectedImages = getConnectedInputs(id);
    const refImageUrls = connectedImages.referenceImageUrls || {};

    // Build references array with resolved image URLs
    const refsInput = refs.filter(r => r.label.trim()).map(r => ({
      id: r.id,
      role: r.role,
      label: r.label.trim(),
      description: r.description.trim(),
      imageUrl: refImageUrls[r.handleId] || undefined,
    }));

    // Legacy fields for backward compat
    const firstSubject = refs.find(r => r.role === 'subject' || r.role === 'prop');
    const firstCharacter = refs.find(r => r.role === 'character');

    const input = {
      references: refsInput,
      product: firstSubject?.label?.trim() || refs[0]?.label?.trim() || '',
      character: firstCharacter?.label?.trim() || undefined,
      concept: data.concept.trim(),
      sceneCount: data.sceneCount,
      style: data.style,
      mode,
      targetVideoModel,
      videoRecipes: data.videoRecipes?.length ? data.videoRecipes : undefined,
      productImageUrl: connectedImages.productImageUrl || refImageUrls['refImage_0'] || undefined,
      characterImageUrl: connectedImages.characterImageUrl || refImageUrls['refImage_1'] || undefined,
    };

    await streamGeneration(input, 'Generating storyboard');
  }, [id, data, refs, isValid, targetVideoModel, updateNodeData, streamGeneration, getConnectedInputs, referenceImageUrls]);

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

    // Build refinement request — include full scene data for faithful preservation (#70)
    // Include connected image URLs so the LLM can SEE the actual references during refinement
    const connectedImages = getConnectedInputs(id);
    const refImageUrls = connectedImages.referenceImageUrls || {};

    // Build references array with resolved image URLs
    const currentRefs = latestData?.references || refs;
    const refsInput = currentRefs.filter(r => r.label.trim()).map(r => ({
      id: r.id,
      role: r.role,
      label: r.label.trim(),
      description: r.description.trim(),
      imageUrl: refImageUrls[r.handleId] || undefined,
    }));

    const firstSubject = currentRefs.find(r => r.role === 'subject' || r.role === 'prop');
    const firstCharacter = currentRefs.find(r => r.role === 'character');

    const body = {
      previousDraft: {
        scenes: latestDraft.scenes,
        summary: latestDraft.summary,
        productIdentity: latestDraft.productIdentity,
        characterIdentity: latestDraft.characterIdentity,
        referenceIdentities: latestDraft.referenceIdentities,
      },
      feedback,
      mode,
      targetVideoModel,
      references: refsInput,
      product: firstSubject?.label?.trim() || currentRefs[0]?.label?.trim() || '',
      character: firstCharacter?.label?.trim() || undefined,
      concept: data.concept.trim(),
      sceneCount: data.sceneCount,
      style: data.style,
      productImageUrl: connectedImages.productImageUrl || refImageUrls['refImage_0'] || undefined,
      characterImageUrl: connectedImages.characterImageUrl || refImageUrls['refImage_1'] || undefined,
    };

    await streamGeneration(body, 'Refining storyboard');
  }, [id, data, refs, targetVideoModel, updateNodeData, streamGeneration, getConnectedInputs, referenceImageUrls]);

  // Stop streaming
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Helper function to generate fallback transition prompt — enriched with full scene context
  const generateFallbackTransition = useCallback((fromScene: StoryboardSceneData, toScene: StoryboardSceneData): string => {
    const style = data.style || 'cinematic';
    return `Camera transitions from ${fromScene.camera} to ${toScene.camera}. ${fromScene.description} The scene shifts smoothly toward ${toScene.title}, maintaining ${fromScene.mood} atmosphere. ${style} style, consistent lighting throughout.${fromScene.audioDirection ? ` ${fromScene.audioDirection}` : ''}`;
  }, [data.style]);

  // Helper function to generate fallback motion prompt for single-shot mode — enriched
  const generateFallbackMotion = useCallback((scene: StoryboardSceneData): string => {
    const style = data.style || 'cinematic';
    return `${scene.description} Camera: ${scene.camera}, steady. ${scene.mood} atmosphere, ${style} style.${scene.audioDirection ? ` ${scene.audioDirection}` : ''}`;
  }, [data.style]);

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
      // --- Step 1: Find connected source node IDs via edges (N-ref) ---
      const storeState = useCanvasStore.getState();
      const allEdges = storeState.edges;

      // Build map of refId → source node ID from edges connected to ref handles
      const refSourceMap = new Map<string, string>(); // refId → sourceNodeId
      const connectedRefEdges: Array<{ refId: string; handleId: string; source: string }> = [];
      for (const ref of refs) {
        // Check new-style refImage_N handles
        let edge = allEdges.find(e => e.target === id && e.targetHandle === ref.handleId);
        // Legacy fallback: productImage → refImage_0, characterImage → refImage_1
        if (!edge && ref.handleId === 'refImage_0') {
          edge = allEdges.find(e => e.target === id && e.targetHandle === 'productImage');
        }
        if (!edge && ref.handleId === 'refImage_1') {
          edge = allEdges.find(e => e.target === id && e.targetHandle === 'characterImage');
        }
        if (edge) {
          refSourceMap.set(ref.id, edge.source);
          connectedRefEdges.push({ refId: ref.id, handleId: ref.handleId, source: edge.source });
        }
      }

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

      // --- Step 2: Create pre-step nodes for refs without connected images ---
      const sceneSpacing = mode === 'single-shot' ? 450 : 380;
      const sceneCount = activeDraft.scenes.length;
      const sceneCenterX = sceneStartX + ((sceneCount - 1) * sceneSpacing) / 2;

      const preStepNodeInputs: CreateNodeInput[] = [];
      const preStepRefIndexMap = new Map<string, number>(); // refId → index in preStepNodeInputs
      const styleLabel = data.style || 'cinematic';

      // Determine which refs need pre-step nodes (have text identity but no connected image)
      const refsNeedingPreStep: StoryboardReference[] = [];
      for (const ref of refs) {
        if (refSourceMap.has(ref.id)) continue; // already connected
        // Check if ref has content (label/description) OR AI generated an identity for it
        const hasContent = ref.label.trim().length > 0;
        const aiIdentity = activeDraft.referenceIdentities?.find(ri => ri.refId === ref.id);
        // Also check legacy identities
        const isLegacyProduct = ref.id === 'ref_legacy_product' && !!activeDraft.productIdentity;
        const isLegacyChar = ref.id === 'ref_legacy_character' && !!activeDraft.characterIdentity;
        if (hasContent || aiIdentity || isLegacyProduct || isLegacyChar) {
          refsNeedingPreStep.push(ref);
        }
      }

      // Total ref nodes = connected + needing pre-step
      const totalRefCount = connectedRefEdges.length + refsNeedingPreStep.length;
      const preStepY = storyboardY - PRE_STEP_Y_OFFSET;
      const preStepGroupWidth = totalRefCount > 1 ? PRE_STEP_H_SPACING * (totalRefCount - 1) : 0;
      // Tighter spacing if many refs
      const effectiveSpacing = totalRefCount > 3 ? Math.min(PRE_STEP_H_SPACING, 280) : PRE_STEP_H_SPACING;
      const effectiveGroupWidth = totalRefCount > 1 ? effectiveSpacing * (totalRefCount - 1) : 0;
      const preStepStartX = sceneCenterX - effectiveGroupWidth / 2;

      for (const ref of refsNeedingPreStep) {
        const slotIndex = connectedRefEdges.length + preStepNodeInputs.length;
        // Get AI-generated identity if available
        const aiIdentity = activeDraft.referenceIdentities?.find(ri => ri.refId === ref.id);
        let description = aiIdentity?.identity || ref.description.trim() || ref.label.trim();
        // Legacy fallback
        if (ref.id === 'ref_legacy_product' && !aiIdentity) description = activeDraft.productIdentity || description;
        if (ref.id === 'ref_legacy_character' && !aiIdentity) description = activeDraft.characterIdentity || description;

        const isCharacter = ref.role === 'character';
        const promptPrefix = isCharacter ? 'Portrait of' : ref.role === 'environment' ? 'Scene of' : 'Product photo of';
        const promptSuffix = isCharacter
          ? `${styleLabel} style, neutral background, detailed features, professional photography`
          : `${styleLabel} style, clean background, centered composition, studio lighting, high detail`;

        preStepRefIndexMap.set(ref.id, preStepNodeInputs.length);
        preStepNodeInputs.push({
          type: 'imageGenerator',
          position: { x: preStepStartX + slotIndex * effectiveSpacing, y: preStepY },
          name: `${ref.label.trim() || ref.role} Reference`,
          data: {
            prompt: `${promptPrefix} ${description}, ${promptSuffix}`,
            model: 'nanobanana-pro',
          },
        });
      }

      // Create pre-step nodes if any
      let preStepNodeIds: string[] = [];
      if (preStepNodeInputs.length > 0) {
        preStepNodeIds = await canvas.createNodes(preStepNodeInputs);
        for (const [refId, idx] of preStepRefIndexMap.entries()) {
          refSourceMap.set(refId, preStepNodeIds[idx]);
        }
      }

      // Reposition already-connected ref nodes above scene row
      {
        const positionChanges: { type: 'position'; id: string; position: { x: number; y: number } }[] = [];
        connectedRefEdges.forEach((entry, slotIndex) => {
          positionChanges.push({
            type: 'position' as const,
            id: entry.source,
            position: { x: preStepStartX + slotIndex * effectiveSpacing, y: preStepY },
          });
        });
        if (positionChanges.length > 0) {
          useCanvasStore.getState().onNodesChange(positionChanges);
        }
      }

      // --- Step 3: Determine refHandleCount for scene nodes ---
      const activeRefIds = [...refSourceMap.keys()]; // all refs that have a source node

      // Helper: get handle assignments for a scene (N-ref version)
      // Returns { handleMap, refHandleCount } for a given scene index
      const getHandleAssignments = (sceneIndex: number) => {
        const scene = activeDraft.scenes[sceneIndex];
        // Which refs appear in this scene? Use AI-assigned referenceIds, or all refs as fallback
        const sceneRefIds = scene.referenceIds?.length
          ? scene.referenceIds.filter(rid => refSourceMap.has(rid))
          : activeRefIds;

        const hasContinuity = mode === 'transition' && sceneIndex > 0;
        const handleMap = new Map<string, string>(); // refId → handle name

        if (hasContinuity) {
          // continuity chain takes 'reference' (idx 0), refs go to ref2, ref3, ...
          let handleIdx = 2; // start at ref2
          for (const refId of sceneRefIds) {
            handleMap.set(refId, `ref${handleIdx}`);
            handleIdx++;
          }
          return { handleMap, refHandleCount: Math.max(1 + sceneRefIds.length, 1) };
        } else {
          // scene 0 or single-shot: first ref gets 'reference', rest get ref2, ref3, ...
          let first = true;
          let handleIdx = 2;
          for (const refId of sceneRefIds) {
            if (first) {
              handleMap.set(refId, 'reference');
              first = false;
            } else {
              handleMap.set(refId, `ref${handleIdx}`);
              handleIdx++;
            }
          }
          return { handleMap, refHandleCount: Math.max(sceneRefIds.length, 1) };
        }
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
              model: 'auto',
              refHandleCount: sceneRefCount,
            },
          });
        });

        const videoNodeStartIndex = nodeInputs.length;

        const videoModelFamily = targetVideoModel;
        const videoModelId = VIDEO_MODEL_IDS[videoModelFamily].singleShot;
        const videoTargetHandle = getVideoTargetHandle(videoModelId);

        activeDraft.scenes.forEach((scene, index) => {
          const imagePos = imagePositions[index];
          const videoPosition = {
            x: imagePos.x + (IMAGE_NODE_WIDTH - VIDEO_NODE_WIDTH) / 2,
            y: startY + VIDEO_Y_OFFSET,
          };
          const motionPrompt = scene.motion || generateFallbackMotion(scene);

          // Validate per-scene video settings against model capabilities
          const videoSettings = resolveVideoSettings(scene, videoModelId);

          nodeInputs.push({
            type: 'videoGenerator',
            position: videoPosition,
            name: `Video ${scene.number}: ${scene.title}`,
            data: {
              prompt: motionPrompt,
              model: videoModelId,
              generateAudio: true,
              ...(videoSettings.aspectRatio && { aspectRatio: videoSettings.aspectRatio }),
              ...(videoSettings.duration && { duration: videoSettings.duration }),
            },
          });
        });

        const nodeIds = await canvas.createNodes(nodeInputs);

        // Image → Video edges (handle varies by model input mode)
        for (let i = 0; i < activeDraft.scenes.length; i++) {
          const imageNodeId = nodeIds[imageNodeStartIndex + i];
          const videoNodeId = nodeIds[videoNodeStartIndex + i];
          await canvas.createEdge(imageNodeId, 'output', videoNodeId, videoTargetHandle);
        }

        // --- Step 5: Reference → ALL scene image generators (N-ref) ---
        for (let i = 0; i < activeDraft.scenes.length; i++) {
          const imageNodeId = nodeIds[imageNodeStartIndex + i];
          const { handleMap } = getHandleAssignments(i);
          for (const [refId, handleName] of handleMap.entries()) {
            const sourceNodeId = refSourceMap.get(refId);
            if (sourceNodeId) {
              await canvas.createEdge(sourceNodeId, 'output', imageNodeId, handleName);
            }
          }
        }

        // Wrap everything in a group: storyboard + refs + scenes + videos
        const allSingleShotNodeIds = [id, ...preStepNodeIds, ...nodeIds];
        for (const entry of connectedRefEdges) {
          if (!allSingleShotNodeIds.includes(entry.source)) allSingleShotNodeIds.push(entry.source);
        }

        await canvas.wrapInGroup({
          nodeIds: allSingleShotNodeIds,
          name: data.concept || 'Storyboard',
          color: '#8b5cf6',
          stickyNote: {
            content: `${activeDraft.scenes.length} scenes | ${data.style} | single-shot mode`,
            color: 'purple',
          },
        });

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
              model: 'auto',
              refHandleCount: sceneRefCount,
            },
          });
        });

        const videoNodeStartIndex = nodeInputs.length;

        const videoModelFamily = targetVideoModel;
        const transitionModelId = VIDEO_MODEL_IDS[videoModelFamily].transition;

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

          // Validate per-scene video settings against model capabilities
          const videoSettings = resolveVideoSettings(currentScene, transitionModelId);

          nodeInputs.push({
            type: 'videoGenerator',
            position: videoPosition,
            name: `Transition ${i + 1}`,
            data: {
              prompt: transitionPrompt,
              model: transitionModelId,
              generateAudio: true,
              ...(videoSettings.aspectRatio && { aspectRatio: videoSettings.aspectRatio }),
              ...(videoSettings.duration && { duration: videoSettings.duration }),
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
          const transitionCaps = VIDEO_MODEL_CAPABILITIES[transitionModelId as VideoModelType];
          if (transitionCaps?.supportsVideoRef) {
            // Omni-reference models (Seedance 2.0): use ref1 for first image, ref2 for second
            await canvas.createEdge(sourceImageId, 'output', videoNodeId, 'ref1');
            await canvas.createEdge(targetImageId, 'output', videoNodeId, 'ref2');
          } else {
            await canvas.createEdge(sourceImageId, 'output', videoNodeId, 'firstFrame');
            await canvas.createEdge(targetImageId, 'output', videoNodeId, 'lastFrame');
          }
        }

        // --- Step 5: Reference → ALL scene image generators (N-ref) ---
        for (let i = 0; i < activeDraft.scenes.length; i++) {
          const imageNodeId = nodeIds[imageNodeStartIndex + i];
          const { handleMap } = getHandleAssignments(i);
          for (const [refId, handleName] of handleMap.entries()) {
            const sourceNodeId = refSourceMap.get(refId);
            if (sourceNodeId) {
              await canvas.createEdge(sourceNodeId, 'output', imageNodeId, handleName);
            }
          }
        }

        // Wrap everything in a group: storyboard + refs + scenes + videos
        const allTransitionNodeIds = [id, ...preStepNodeIds, ...nodeIds];
        for (const entry of connectedRefEdges) {
          if (!allTransitionNodeIds.includes(entry.source)) allTransitionNodeIds.push(entry.source);
        }

        await canvas.wrapInGroup({
          nodeIds: allTransitionNodeIds,
          name: data.concept || 'Storyboard',
          color: '#8b5cf6',
          stickyNote: {
            content: `${activeDraft.scenes.length} scenes | ${data.style} | transition mode`,
            color: 'purple',
          },
        });

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
  }, [activeDraft, data.mode, refs, data.style, targetVideoModel, canvas, id, generateFallbackTransition, generateFallbackMotion]);

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
      {/* References (N-ref dynamic list) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            References {!isReadOnly && <span className="text-red-400">*</span>}
          </label>
          {!isReadOnly && refs.length < MAX_REFS && (
            <button
              onClick={addReference}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded transition-colors nodrag"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          )}
        </div>
        <div className="space-y-2">
          {refs.map((ref, index) => (
            <ReferenceCard
              key={ref.id}
              ref={ref}
              index={index}
              isReadOnly={isReadOnly}
              referenceImageUrls={referenceImageUrls}
              updateReference={updateReference}
              removeReference={removeReference}
              setCardRef={setRefCardRef}
              refsLength={refs.length}
            />
          ))}
        </div>
      </div>

      {/* Concept/Story */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Concept / Story {!isReadOnly && <span className="text-red-400">*</span>}
          </label>
          {!isReadOnly && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleGenerateConcept}
                    disabled={isGeneratingConcept || !refs.some(r => r.label.trim())}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded transition-colors disabled:opacity-40 nodrag"
                  >
                    {isGeneratingConcept ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    Auto
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-popover border-border text-popover-foreground max-w-[200px]">
                  <p className="text-xs">Generate a creative concept from your product and character inputs</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <textarea
          {...conceptField}
          placeholder={isReadOnly ? '' : 'e.g., Morning routine ad showing how our coffee mug makes the perfect start...'}
          disabled={isReadOnly}
          className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
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
            className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
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
            className={`w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag ${isReadOnly ? 'cursor-default' : ''}`}
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
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-popover border-border text-popover-foreground max-w-[200px]">
                    <p className="text-xs">Creates smooth video transitions between consecutive scenes, blending the end of one scene into the start of the next.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-popover border-border text-popover-foreground max-w-[200px]">
                    <p className="text-xs">Each scene generates an independent video clip. Best for distinct, self-contained scenes.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

      {/* Video Model Family */}
      {!isReadOnly && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Video Model</label>
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            {VIDEO_MODEL_OPTIONS.map((opt) => (
              <TooltipProvider key={opt.value} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => updateField('targetVideoModel', opt.value)}
                      className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors nodrag ${
                        targetVideoModel === opt.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-popover border-border text-popover-foreground max-w-[200px]">
                    <p className="text-xs">{opt.hint}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/80">
            {VIDEO_MODEL_OPTIONS.find((o) => o.value === targetVideoModel)?.hint}
          </p>
        </div>
      )}

      {/* Error message */}
      {data.error && (
        <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs">
          {data.error}
        </div>
      )}

      {/* Generate button - hidden in read-only mode */}
      {!isReadOnly && (
        <button
          onClick={handleGenerate}
          disabled={!isValid}
          className="w-full py-2 px-4 bg-primary hover:bg-[var(--accent-primary-hover)] disabled:bg-muted disabled:text-muted-foreground text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 nodrag"
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
        className="flex-1 overflow-y-auto nowheel scrollbar-thin p-3 space-y-3"
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
          <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs">
            {data.error}
          </div>
        )}
      </div>

      {/* Chat input — pinned at bottom */}
      {!isReadOnly && (
        <ChatInput
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
    <div
      ref={rootNodeRef}
      className="relative"
      {...focusProps}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Floating Toolbar - hidden in read-only mode */}
      {showTopToolbar && (
        <NodeFloatingToolbar className="absolute -top-12 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted/50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </NodeFloatingToolbar>
      )}

      {/* Node Title */}
      <div className="mb-2 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--node-title-storyboard)' }}>
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
          node-drag-handle node-drag-surface animation-node min-w-[400px] w-fit max-w-[760px] rounded-2xl overflow-hidden flex flex-col
          transition-[box-shadow,ring-color] duration-150
          ${selected
            ? 'ring-[2.5px] ring-blue-500 shadow-lg shadow-blue-500/10'
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
        {displayMode !== 'full' ? (
          <div className={`node-body flex-1 ${displayMode === 'compact' ? 'node-compact' : 'node-summary'}`}>
            <div className="node-content-area rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {data.viewState === 'chat' ? 'Latest storyboard' : 'Storyboard brief'}
              </p>
              <p className="mt-1 text-sm text-foreground/85 line-clamp-4">
                {storyboardSummary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{refs.length} reference{refs.length === 1 ? '' : 's'}</span>
              <span>{data.sceneCount} scenes</span>
              <span>{data.style}</span>
              <span>{targetVideoModel}</span>
              <span>{data.mode || 'transition'}</span>
            </div>
          </div>
        ) : data.viewState === 'form' ? (
          <div className="h-[580px] overflow-y-auto nowheel scrollbar-thin" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
            {renderForm()}
          </div>
        ) : data.viewState === 'chat' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {renderChat()}
          </div>
        ) : data.viewState === 'loading' ? (
          /* Legacy loading state — show thinking block */
          <div className="h-[580px] overflow-y-auto nowheel scrollbar-thin p-4 flex flex-col justify-center" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
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
          <div className="h-[580px] overflow-y-auto nowheel scrollbar-thin" onWheel={(e) => !e.ctrlKey && e.stopPropagation()}>
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
          {/* Dynamic reference image handles */}
          {refs.map((ref, index) => {
            const RoleIcon = ref.role === 'character' ? User
              : ref.role === 'prop' ? Box
              : ref.role === 'environment' ? Mountain
              : ImageIcon;
            const isConnected = !!referenceImageUrls[ref.handleId];
            const label = ref.label?.trim() || `${ref.role} ${index + 1}`;
            return (
              <div key={ref.handleId} className={`absolute -left-3 z-10 group transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`} style={{ top: `${handleTops[index] ?? getPromptHeavyInputHandleTop(index, { start: 110, gap: 50 })}px` }}>
                <div className="relative">
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={ref.handleId}
                    className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full !bg-zinc-400 !border-zinc-900 hover:!border-zinc-700"
                  />
                  <RoleIcon className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-[var(--handle-input-icon)]" />
                </div>
                <span className="absolute left-9 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border node-tooltip">
                  {isConnected ? `${label} (connected)` : label}
                </span>
              </div>
            );
          })}
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
          <span className="text-[10px] font-medium text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
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
