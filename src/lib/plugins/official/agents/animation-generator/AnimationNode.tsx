'use client';

/**
 * AnimationNode Component
 *
 * Unified chat UI for the Animation Generator plugin.
 * All phases render in a single scrollable timeline of messages,
 * tool calls, and phase-specific elements — matching the Pencil
 * design spec "Animation Generator — Chat UI Anatomy".
 */

import { memo, useCallback, useMemo, useEffect, useState, useRef } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Clapperboard, Image, Video, X, Code } from 'lucide-react';
import { toast } from 'sonner';
import { useCanvasStore } from '@/stores/canvas-store';
import { useSettingsStore } from '@/stores/settings-store';

// Chat components
import { ChatInput } from './components';
import { AnimationSettingsPanel } from './components/AnimationSettingsPanel';
import {
  UserBubble,
  AssistantText,
  PlanCard,
  QuestionOptions,
  RetryButton,
  TodoSection,
  VideoCard,
  ThinkingBlock,
} from './components/ChatMessages';
import { QuestionForm } from './components/QuestionForm';

// Hooks
import { useAnimationStream } from './hooks/useAnimationStream';
import type { AnimationStreamCallbacks } from './hooks/useAnimationStream';

// Types
import type {
  AnimationNodeData,
  AnimationNodeState,
  AnimationPlan,
  AnimationMessage,
  AnimationVersion,
  AnimationEngine,
  AspectRatio,
  ToolCallItem,
  ThinkingBlockItem,
  MediaEntry,
  FormField,
  MotionPreset,
  MotionSpec,
  MotionIntentChips,
  MotionVariantId,
} from './types';

// ─── Constants ──────────────────────────────────────────────────────────
const HANDLE_SPACING = 32;
const IMAGE_HANDLE_START = 70;
// Visual gap between image and video handle groups for readability
const VIDEO_HANDLE_START_OFFSET = 48;

/** Tool names that should appear as cards in the chat timeline */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  generate_code: 'Building animation',
  sandbox_write_file: 'Saving changes',
  sandbox_read_file: 'Checking file',
  sandbox_run_command: 'Processing',
  sandbox_list_files: 'Checking files',
  sandbox_screenshot: 'Capturing frame',
  sandbox_create: 'Setting up workspace',
  sandbox_destroy: 'Cleaning up',
  render_final: 'Rendering final video',
  generate_plan: 'Planning animation',
  verify_animation: 'Checking quality',
};

/** UI tools that update state silently — not shown in the timeline */
const UI_TOOLS = new Set(['update_todo', 'batch_update_todos', 'set_thinking', 'add_message', 'request_approval', 'analyze_prompt']);

const DEFAULT_SEMANTIC_MOTION_CHIPS = [
  'Make intro 20% slower',
  'Reduce bounce',
  'Hold final frame 1s',
  'Make transitions smoother',
] as const;

const GUIDED_MOTION_GROUPS: Array<{
  key: keyof MotionIntentChips;
  label: string;
  options: Array<{ id: MotionIntentChips[keyof MotionIntentChips]; label: string }>;
}> = [
  {
    key: 'energy',
    label: 'Energy',
    options: [
      { id: 'calm', label: 'Calm' },
      { id: 'medium', label: 'Medium' },
      { id: 'energetic', label: 'Energetic' },
    ],
  },
  {
    key: 'feel',
    label: 'Feel',
    options: [
      { id: 'smooth', label: 'Smooth' },
      { id: 'snappy', label: 'Snappy' },
      { id: 'bouncy', label: 'Bouncy' },
    ],
  },
  {
    key: 'camera',
    label: 'Camera',
    options: [
      { id: 'static', label: 'Static' },
      { id: 'subtle', label: 'Subtle' },
      { id: 'dynamic', label: 'Dynamic' },
    ],
  },
  {
    key: 'transitions',
    label: 'Transitions',
    options: [
      { id: 'minimal', label: 'Minimal' },
      { id: 'cinematic', label: 'Cinematic' },
    ],
  },
];

// ─── Timeline item union ────────────────────────────────────────────────
// Simplified: only user messages, assistant messages, plan cards, and videos
// Tool calls and thinking blocks are hidden for cleaner UX
type TimelineItem =
  | { kind: 'user'; id: string; content: string; ts: string; seq: number; media?: MediaEntry[] }
  | { kind: 'assistant'; id: string; content: string; ts: string; seq: number }
  | { kind: 'plan'; id: string; ts: string; seq: number }
  | { kind: 'video'; id: string; ts: string; seq: number; videoUrl: string; duration: number }
  | { kind: 'thinking'; id: string; ts: string; seq: number; label: string; reasoning?: string; duration?: number; isActive?: boolean };

// ─── Media data cache (IndexedDB-backed) ─────────────────────────────────
import {
  cacheMediaData,
  cacheIfLarge,
  getCached,
  removeCached,
  resolveMediaCache,
  hydrateMediaCache,
} from './media-cache';
import { animationDebugLog } from './debug';
import {
  applySemanticMotionEdit,
  buildMotionVariants,
  createGuidedMotionSpec,
  createMotionSpec,
  deriveGuidedChipsFromPrompt,
  extractReferenceMotionProfile,
  isLowConfidenceMotionPrompt,
  makeMotionPresetName,
  seedMotionSpecFromReference,
} from './motion-spec';

// ─── Global sequence counter for stable chronological ordering ──────────
// This ensures events are ordered correctly even when timestamps are identical
let globalSeqCounter = 0;
const getNextSeq = () => ++globalSeqCounter;

// ─── Affirmative detection ──────────────────────────────────────────────
const AFFIRMATIVE_RE = /^(y|ye|yes|yeah|yep|yea|ok|okay|sure|go|go ahead|proceed|do it|let'?s go|approve|accept|sounds good|looks good|lgtm|ship it|👍|✅)$/i;
const isAffirmative = (text: string): boolean => AFFIRMATIVE_RE.test(text.trim());

// ─── Default state factory ──────────────────────────────────────────────
const createDefaultState = (nodeId: string): AnimationNodeState => ({
  nodeId,
  phase: 'idle',
  messages: [],
  toolCalls: [],
  thinkingBlocks: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ─── Types ──────────────────────────────────────────────────────────────
export type AnimationNodeType = Node<AnimationNodeData, 'pluginNode'>;

interface AnimationNodeProps extends NodeProps<AnimationNodeType> {}

// ─── Component ──────────────────────────────────────────────────────────
function AnimationNodeComponent({ id, data, selected }: AnimationNodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodes = useCanvasStore((s) => s.nodes);
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const addToHistory = useSettingsStore((s) => s.addToHistory);
  const updateNodeInternals = useUpdateNodeInternals();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPosition, setSettingsPosition] = useState({ x: 0, y: 0 });
  const [settingsAnchorRect, setSettingsAnchorRect] = useState<{ left: number; right: number; top: number; bottom: number; width: number; height: number } | null>(null);
  const [guidedPrompt, setGuidedPrompt] = useState<string | null>(null);
  const [guidedFollowUp, setGuidedFollowUp] = useState('');
  const [guidedChips, setGuidedChips] = useState<MotionIntentChips>(() => createMotionSpec().chips);
  const [guidedVariant, setGuidedVariant] = useState<MotionVariantId>('balanced');

  // Rename state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.name || 'Animation Generator');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    if (nodeName.trim() && nodeName !== (data.name || 'Animation Generator')) {
      updateNodeData(id, { name: nodeName.trim() });
    }
  }, [id, nodeName, data.name, updateNodeData]);

  // Streaming hook
  const { isStreaming, stream: streamToAgent, abort: abortStream } = useAnimationStream();

  // Refs for cleanup
  const abortRef = useRef(abortStream);
  abortRef.current = abortStream;
  const sandboxIdRef = useRef<string | undefined>(undefined);

  // Refs for batching text-delta updates
  const streamingTextRef = useRef('');
  const reasoningTextRef = useRef('');
  const textFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll ref
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // File input ref for media uploads
  const [isDragOver, setIsDragOver] = useState(false);

  // ─── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current();
      if (textFlushTimerRef.current) clearTimeout(textFlushTimerRef.current);
      const sid = sandboxIdRef.current;
      if (sid) {
        fetch('/api/plugins/animation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: id, action: 'cleanup', sandboxId: sid }),
        }).catch(() => {});
      }
    };
  }, [id]);

  // ─── Hydrate media cache from IndexedDB on mount ────────────────────
  const [mediaCacheReady, setMediaCacheReady] = useState(false);
  useEffect(() => {
    const entries = data.media || [];
    if (entries.some((m) => m.dataUrl.startsWith('cached:'))) {
      hydrateMediaCache(entries).then(() => setMediaCacheReady(true));
    } else {
      setMediaCacheReady(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once on mount

  // ─── Data accessors ─────────────────────────────────────────────────
  const imageRefCount = data.imageRefCount || 1;
  const videoRefCount = data.videoRefCount || 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const media: MediaEntry[] = useMemo(() => resolveMediaCache(data.media || []), [data.media, mediaCacheReady]);
  const engine: AnimationEngine = data.engine || 'remotion';
  const aspectRatio: AspectRatio = data.aspectRatio || '16:9';
  const duration: number = data.duration || 5;
  const techniques: string[] = data.techniques || [];
  const motionSpec: MotionSpec = data.motionSpec || createMotionSpec();
  const motionPresets: MotionPreset[] = data.motionPresets || [];

  // Design spec fields for stream context (passed to agent on every call)
  const designSpec = data.designSpec;
  const logo = data.logo;
  const fps = data.fps;
  const resolution = data.resolution;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, imageRefCount, videoRefCount, updateNodeInternals]);

  // Re-sync handle positions whenever the node resizes (content streaming, plan, video, etc.)
  const nodeContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = nodeContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateNodeInternals(id));
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, updateNodeInternals]);

  // Ensure state initialized
  const state = useMemo((): AnimationNodeState => {
    if (data.state) {
      // Back-compat: ensure arrays exist
      return {
        ...data.state,
        messages: data.state.messages || [],
        toolCalls: data.state.toolCalls || [],
        thinkingBlocks: data.state.thinkingBlocks || [],
      };
    }
    return createDefaultState(id);
  }, [data.state, id]);

  sandboxIdRef.current = state.sandboxId;

  useEffect(() => {
    if (!data.state) {
      updateNodeData(id, { state: createDefaultState(id) });
    }
  }, [id, data.state, updateNodeData]);

  // Available node outputs for reference picker
  const availableNodeOutputs = useMemo(() => {
    const outputs: Array<{ nodeId: string; name: string; type: 'image' | 'video'; url: string }> = [];
    nodes.forEach((node) => {
      if (node.id === id) return;
      if (node.type === 'imageGenerator') {
        const d = node.data as Record<string, unknown>;
        const url = (d.outputUrl as string) || (d.imageUrl as string);
        if (url) outputs.push({ nodeId: node.id, name: (d.name as string) || 'Image', type: 'image', url });
      }
      if (node.type === 'media') {
        const d = node.data as Record<string, unknown>;
        // Media node uploads are stored in `url`; prefer it over any legacy keys.
        const url = (d.url as string) || (d.outputUrl as string) || (d.imageUrl as string);
        const mediaType = (d.type as string) === 'video' ? 'video' : 'image';
        if (url && mediaType !== 'image' && mediaType !== 'video') return;
        if (url) outputs.push({ nodeId: node.id, name: (d.name as string) || 'Media', type: mediaType, url });
      }
      if (node.type === 'videoGenerator') {
        const d = node.data as Record<string, unknown>;
        const url = d.outputUrl as string;
        if (url) outputs.push({ nodeId: node.id, name: (d.name as string) || 'Video', type: 'video', url });
      }
    });
    return outputs;
  }, [nodes, id]);

  // ─── Edge connection watcher ────────────────────────────────────────
  // Watches incoming edges and syncs connected node outputs to media[]
  const edges = useCanvasStore((s) => s.edges);
  const incomingEdges = useMemo(
    () => edges.filter((e) => e.target === id),
    [edges, id]
  );

  useEffect(() => {
    const currentMedia = data.media || [];
    const edgeMedia = currentMedia.filter((m) => m.source === 'edge');
    const uploadMedia = currentMedia.filter((m) => m.source === 'upload');
    const currentEdgeIds = new Set(edgeMedia.map((m) => m.edgeId).filter(Boolean) as string[]);
    const activeEdgeIds = new Set(incomingEdges.map((e) => e.id));

    let changed = false;
    let updatedEdgeMedia = [...edgeMedia];

    // Remove media for disconnected edges
    const removedIds = [...currentEdgeIds].filter((eid) => !activeEdgeIds.has(eid));
    if (removedIds.length > 0) {
      updatedEdgeMedia = updatedEdgeMedia.filter((m) => !removedIds.includes(m.edgeId!));
      // Clean up cached data for removed edges
      edgeMedia.filter((m) => removedIds.includes(m.edgeId!)).forEach((m) => {
        removeCached(m.id);
      });
      changed = true;
    }

    // Track blob: URLs that need async conversion to data: URLs
    const blobConversions: Array<{ entryId: string; blobUrl: string; edgeId: string }> = [];

    // Add media for new edges
    for (const edge of incomingEdges) {
      if (currentEdgeIds.has(edge.id)) continue; // Already tracked

      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;

      const d = sourceNode.data as Record<string, unknown>;
      let mediaUrl: string | undefined;
      let mediaType: 'image' | 'video' = 'image';
      let mediaDescription: string | undefined;
      let svgCode: string | undefined;

      if (sourceNode.type === 'imageGenerator') {
        mediaUrl = (d.outputUrl as string) || (d.imageUrl as string) || (d.url as string);
        mediaType = 'image';
        mediaDescription = (d.prompt as string) || (d.name as string) || undefined;
      } else if (sourceNode.type === 'media') {
        // Prefer explicit media node url (uploaded asset) over stale generation keys.
        mediaUrl = (d.url as string) || (d.outputUrl as string) || (d.imageUrl as string);
        const explicitType = d.type as string | undefined;
        mediaType = explicitType === 'video' ? 'video' : 'image';
        mediaDescription = (d.prompt as string) || (d.name as string) || undefined;
      } else if (sourceNode.type === 'videoGenerator') {
        mediaUrl = d.outputUrl as string;
        mediaType = 'video';
        mediaDescription = (d.prompt as string) || (d.name as string) || undefined;
      } else if (sourceNode.type === 'pluginNode' && d.pluginId === 'svg-studio') {
        mediaUrl = (d.outputUrl as string) || ((d.state as Record<string, unknown> | undefined)?.asset as { url?: string } | undefined)?.url;
        mediaType = 'image';
        if (edge.sourceHandle === 'code-output') {
          svgCode = (d.outputSvgCode as string) || (d.state as Record<string, unknown> | undefined)?.svg as string | undefined;
          mediaDescription = (d.name as string) || 'SVG code';
        } else {
          mediaDescription = (d.name as string) || 'SVG asset';
        }
      }

      // Skip video media for Theatre.js (no video ref support in Puppeteer rendering)
      if (engine === 'theatre' && mediaType === 'video') continue;

      if (mediaUrl || svgCode) {
        // Build a safe filename with proper extension and source node suffix to prevent collisions.
        // NOTE: edge.id starts with "xy-edge__" so slice(0,6) was always "xy-edg" — use source node ID instead.
        const baseName = ((d.name as string) || sourceNode.type || 'media')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase();
        const urlExt = mediaUrl?.split('?')[0].match(/\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov)$/i)?.[1]?.toLowerCase();
        const ext = svgCode ? 'svg' : (urlExt || (mediaType === 'video' ? 'mp4' : 'png'));
        const mediaName = `${baseName}_${edge.source.slice(-8)}.${ext}`;

        const entryId = `edge_${edge.id}`;

        // blob: URLs are browser-only — queue for async conversion to data: URL
        if (mediaUrl?.startsWith('blob:')) {
          blobConversions.push({ entryId, blobUrl: mediaUrl, edgeId: edge.id });
        }

        // For SVG code entries without a URL, use empty string — the code itself is the payload
        const effectiveUrl = mediaUrl || '';

        updatedEdgeMedia.push({
          id: entryId,
          source: 'edge',
          edgeId: edge.id,
          sourceNodeId: edge.source,
          name: mediaName,
          type: mediaType,
          dataUrl: effectiveUrl.startsWith('blob:') ? effectiveUrl : (effectiveUrl ? cacheIfLarge(entryId, effectiveUrl) : ''),
          description: mediaDescription,
          ...(svgCode ? { svgCode } : {}),
        });
        changed = true;
      }
    }

    // Check for updated source node outputs (re-generated images/videos)
    for (const entry of updatedEdgeMedia) {
      const sourceNode = nodes.find((n) => n.id === entry.sourceNodeId);
      if (!sourceNode) continue;
      const d = sourceNode.data as Record<string, unknown>;
      const currentUrl = sourceNode.type === 'media'
        ? ((d.url as string) || (d.outputUrl as string) || (d.imageUrl as string) || '')
        : ((d.outputUrl as string) || (d.imageUrl as string) || (d.url as string) || '');
      // Compare against resolved (real) URL, not the cached placeholder
      const resolvedUrl = entry.dataUrl.startsWith('cached:') ? (getCached(entry.id) || '') : entry.dataUrl;
      if (currentUrl && currentUrl !== resolvedUrl) {
        // New URL could be blob: — queue for conversion
        if (currentUrl.startsWith('blob:')) {
          blobConversions.push({ entryId: entry.id, blobUrl: currentUrl, edgeId: entry.edgeId! });
          entry.dataUrl = currentUrl; // Store temporarily, will be converted async
        } else {
          entry.dataUrl = cacheIfLarge(entry.id, currentUrl);
        }
        changed = true;
      }
      // Update description if source node's prompt changed
      const currentDesc = (d.prompt as string) || (d.name as string) || undefined;
      if (currentDesc !== entry.description) {
        entry.description = currentDesc;
        changed = true;
      }
      // Update SVG code if source node re-generated (code-output edge)
      if (entry.svgCode !== undefined && sourceNode.type === 'pluginNode' && d.pluginId === 'svg-studio') {
        const currentSvgCode = (d.outputSvgCode as string) || (d.state as Record<string, unknown> | undefined)?.svg as string | undefined;
        if (currentSvgCode && currentSvgCode !== entry.svgCode) {
          entry.svgCode = currentSvgCode;
          changed = true;
        }
      }
    }

    if (changed) {
      updateNodeData(id, { media: [...uploadMedia, ...updatedEdgeMedia] });
    }

    // Async: convert any blob: URLs to data: URLs and update media entries
    if (blobConversions.length > 0) {
      (async () => {
        for (const { entryId, blobUrl } of blobConversions) {
          try {
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            // Cache the converted data: URL and update the media entry
            const cachedUrl = cacheIfLarge(entryId, dataUrl);
            // Re-read current media and update the specific entry
            const current = (useCanvasStore.getState().nodes.find(n => n.id === id)?.data as Record<string, unknown>)?.media as MediaEntry[] | undefined;
            if (current) {
              const updated = current.map(m => m.id === entryId ? { ...m, dataUrl: cachedUrl } : m);
              updateNodeData(id, { media: updated });
            }
            animationDebugLog(`[EdgeWatcher] Converted blob: → data: for ${entryId} (${Math.round(dataUrl.length / 1024)}KB)`);
          } catch (err) {
            console.warn(`[EdgeWatcher] Failed to convert blob: URL for ${entryId}:`, err);
          }
        }
      })();
    }
  }, [id, incomingEdges, nodes, data.media, updateNodeData]);

  // Auto-remove video media when switching to Theatre.js (no video ref support)
  useEffect(() => {
    if (engine === 'theatre' && media.some((m) => m.type === 'video')) {
      const filtered = media.filter((m) => m.type !== 'video');
      updateNodeData(id, { media: filtered });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]); // Only react to engine changes

  // ─── Media upload handler ─────────────────────────────────────────
  // Converts files to base64 data URLs (not blob URLs) so they can be
  // passed to the Docker sandbox via sandbox_write_binary.
  const handleMediaUpload = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (!isVideo && !isImage) return;

        if (isVideo) {
          // Videos: validate duration first, then convert to base64
          const tempUrl = URL.createObjectURL(file);
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            URL.revokeObjectURL(tempUrl);
            if (video.duration > 10) {
              toast.error(`Video too long (${video.duration.toFixed(1)}s) — max 10 seconds`);
              return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              const entryId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              // Store large base64 in memory cache, not in persisted state
              cacheMediaData(entryId, dataUrl);
              const entry: MediaEntry = {
                id: entryId,
                source: 'upload',
                name: file.name,
                type: 'video',
                dataUrl: `cached:${entryId}`,
                duration: video.duration,
                mimeType: file.type,
              };
              updateNodeData(id, { media: [...(data.media || []), entry] });
            };
            reader.readAsDataURL(file);
          };
          video.src = tempUrl;
        } else {
          // Images: convert to base64 directly
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const entryId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            // Store large base64 in memory cache, not in persisted state
            cacheMediaData(entryId, dataUrl);
            const entry: MediaEntry = {
              id: entryId,
              source: 'upload',
              name: file.name,
              type: 'image',
              dataUrl: `cached:${entryId}`,
              mimeType: file.type,
            };
            updateNodeData(id, { media: [...(data.media || []), entry] });
          };
          reader.readAsDataURL(file);
        }
      });
    },
    [id, data.media, updateNodeData]
  );

  const handleNodeReference = useCallback(
    (node: { nodeId: string; name: string; type: 'image' | 'video'; url: string }) => {
      const currentMedia = data.media || [];
      // Don't add duplicates from same source node
      if (currentMedia.some((m) => m.source === 'upload' && m.sourceNodeId === node.nodeId)) return;
      const entryId = `noderef_${node.nodeId}_${Date.now()}`;
      const entry: MediaEntry = {
        id: entryId,
        source: 'upload', // manual reference, not auto-edge
        sourceNodeId: node.nodeId,
        name: node.name,
        type: node.type,
        dataUrl: cacheIfLarge(entryId, node.url),
      };
      updateNodeData(id, { media: [...currentMedia, entry] });
    },
    [id, data.media, updateNodeData]
  );

  const handleRemoveMedia = useCallback(
    (mediaId: string) => {
      const currentMedia = data.media || [];
      // Clean up cached data
      removeCached(mediaId);
      updateNodeData(id, { media: currentMedia.filter((m) => m.id !== mediaId) });
    },
    [id, data.media, updateNodeData]
  );

  // ─── State update helpers ───────────────────────────────────────────
  const updateState = useCallback(
    (updates: Partial<AnimationNodeState>) => {
      updateNodeData(id, {
        state: { ...state, ...updates, updatedAt: new Date().toISOString() },
      });
    },
    [id, state, updateNodeData]
  );

  const getLatestState = useCallback((): AnimationNodeState => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return state;
    const s = (node.data as AnimationNodeData).state;
    return s ? { ...s, messages: s.messages || [], toolCalls: s.toolCalls || [], thinkingBlocks: s.thinkingBlocks || [] } : state;
  }, [id, state]);

  // ─── Streaming text flush ───────────────────────────────────────────
  const flushStreamingText = useCallback(() => {
    const ls = getLatestState();
    if (!ls.execution) return;
    const updates: Partial<typeof ls.execution> = {};
    if (streamingTextRef.current) updates.streamingText = streamingTextRef.current;
    if (reasoningTextRef.current) updates.reasoning = reasoningTextRef.current;
    if (Object.keys(updates).length > 0) {
      updateNodeData(id, {
        state: { ...ls, execution: { ...ls.execution, ...updates }, updatedAt: new Date().toISOString() },
      });
    }
  }, [id, getLatestState, updateNodeData]);

  const scheduleFlush = useCallback(() => {
    if (!textFlushTimerRef.current) {
      textFlushTimerRef.current = setTimeout(() => {
        flushStreamingText();
        textFlushTimerRef.current = null;
      }, 100);
    }
  }, [flushStreamingText]);

  // ─── Performance timing ────────────────────────────────────────────
  const pipelineStartRef = useRef<number>(0);
  const toolTimersRef = useRef<Map<string, { name: string; start: number }>>(new Map());

  // ─── Stream callbacks ───────────────────────────────────────────────
  const createStreamCallbacks = useCallback(
    (): AnimationStreamCallbacks => ({
      onTextDelta: (text) => {
        streamingTextRef.current += text;
        scheduleFlush();
      },

      onReasoningDelta: (text) => {
        reasoningTextRef.current += text;
        scheduleFlush();
      },

      onComplete: (fullText) => {
        const totalTime = pipelineStartRef.current ? ((Date.now() - pipelineStartRef.current) / 1000).toFixed(1) : '?';
        animationDebugLog(`%c⏱ [Animation] Stream complete — total: ${totalTime}s`, 'color: #22C55E; font-weight: bold');
        if (textFlushTimerRef.current) {
          clearTimeout(textFlushTimerRef.current);
          textFlushTimerRef.current = null;
        }
        const ls = getLatestState();
        animationDebugLog(`[AnimationNode] onComplete: phase=${ls.phase}, versionsCount=${ls.versions?.length ?? 0}, hasPreview=${!!ls.preview?.videoUrl}`);
        // Strip any HTML tags from agent output — the LLM sometimes outputs <div> markup
        // (e.g. video-card divs) that should be handled by tool results, not displayed as text
        const trimmed = fullText.replace(/<[^>]*>/g, '').trim();
        const updatedMessages = [...ls.messages];

        // Check if stream completed without generating text (tool-only response)
        // In this case, add a system message to inform the user
        const hasRecentToolCalls = ls.toolCalls.some(tc => {
          const tcTime = new Date(tc.timestamp).getTime();
          const now = Date.now();
          // Tool call within last 30 seconds is "recent"
          return (now - tcTime) < 30000;
        });
        const isToolOnlyResponse = trimmed.length === 0 && hasRecentToolCalls;

        if (trimmed.length > 0) {
          updatedMessages.push({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: trimmed,
            timestamp: new Date().toISOString(),
            seq: getNextSeq(),
          });
        } else if (isToolOnlyResponse && ls.phase === 'executing') {
          // Agent did tool calls but didn't respond — add a subtle indicator
          // that the user can send a message to continue
          updatedMessages.push({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: '_(Waiting for your input to continue...)_',
            timestamp: new Date().toISOString(),
            seq: getNextSeq(),
          });
        }

        // Finalize the active thinking block
        const thinkingBlocks = [...ls.thinkingBlocks];
        const activeIdx = thinkingBlocks.findIndex((tb) => !tb.endedAt);
        if (activeIdx >= 0) {
          thinkingBlocks[activeIdx] = {
            ...thinkingBlocks[activeIdx],
            reasoning: reasoningTextRef.current || thinkingBlocks[activeIdx].reasoning,
            endedAt: new Date().toISOString(),
          };
        }

        // Defensive: if versions exist but phase is still 'executing', force 'preview'
        // This catches edge cases where render_final result handler's state update was lost
        const resolvedPhase = (ls.phase === 'executing' && ls.versions && ls.versions.length > 0)
          ? 'preview' as const
          : ls.phase;

        updateNodeData(id, {
          state: {
            ...ls,
            phase: resolvedPhase,
            messages: updatedMessages,
            thinkingBlocks,
            execution: ls.execution
              ? { ...ls.execution, streamingText: undefined, reasoning: undefined }
              : undefined,
            updatedAt: new Date().toISOString(),
          },
        });
        streamingTextRef.current = '';
        reasoningTextRef.current = '';
      },

      onToolCall: (event) => {
        let ls = getLatestState();

        // When a tool call starts, the agent has finished thinking — close the active thinking block
        // This ensures the timer stops when thinking ends, not when the entire stream completes
        const thinkingBlocks = [...ls.thinkingBlocks];
        const activeThinkingIdx = thinkingBlocks.findIndex((tb) => !tb.endedAt);
        if (activeThinkingIdx >= 0) {
          thinkingBlocks[activeThinkingIdx] = {
            ...thinkingBlocks[activeThinkingIdx],
            reasoning: reasoningTextRef.current || thinkingBlocks[activeThinkingIdx].reasoning,
            endedAt: new Date().toISOString(),
          };
          ls = { ...ls, thinkingBlocks };
          // Clear the reasoning ref since this thinking block is now closed
          reasoningTextRef.current = '';
        }

        // ⏱ Tool call timing
        const elapsed = pipelineStartRef.current ? ((Date.now() - pipelineStartRef.current) / 1000).toFixed(1) : '?';
        animationDebugLog(`%c⏱ [Animation] Tool call: ${event.toolName} — started at +${elapsed}s`, 'color: #3B82F6', event.args);
        toolTimersRef.current.set(event.toolCallId, { name: event.toolName, start: Date.now() });

        // ── Auto-label thinking based on tool call ──────────────────
        // Updates the thinking message to reflect what's actually happening,
        // so users don't see a stale "Analysing your prompt" for 45+ seconds.
        const TOOL_THINKING_LABELS: Record<string, string> = {
          enhance_animation_prompt: 'Crafting your design...',
          analyze_prompt: 'Understanding your request...',
          generate_plan: 'Planning your animation...',
          sandbox_create: 'Setting up workspace...',
          generate_remotion_code: 'Writing animation code...',
          generate_code: 'Writing animation code...',
          sandbox_screenshot: 'Checking the animation...',
          render_final: 'Rendering final video...',
          verify_animation: 'Reviewing your animation...',
          analyze_media: 'Analyzing your media...',
        };
        const autoLabel = TOOL_THINKING_LABELS[event.toolName];
        if (autoLabel && ls.execution) {
          // Update thinking + active thinking block label
          const updatedBlocks = [...ls.thinkingBlocks];
          const activeBlkIdx = updatedBlocks.findIndex((tb) => !tb.endedAt);
          if (activeBlkIdx >= 0) {
            updatedBlocks[activeBlkIdx] = { ...updatedBlocks[activeBlkIdx], label: autoLabel };
          }
          ls = { ...ls, thinkingBlocks: updatedBlocks, execution: { ...ls.execution, thinking: autoLabel } };
          updateNodeData(id, { state: { ...ls, updatedAt: new Date().toISOString() } });
        }

        // Track visible tools in state.toolCalls
        if (!UI_TOOLS.has(event.toolName)) {
          const tc: ToolCallItem = {
            id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            displayName: TOOL_DISPLAY_NAMES[event.toolName] || event.toolName,
            status: 'running',
            args: event.args,  // Capture args for showing context
            timestamp: new Date().toISOString(),
            seq: getNextSeq(),
          };
          updateNodeData(id, {
            state: { ...ls, toolCalls: [...ls.toolCalls, tc], updatedAt: new Date().toISOString() },
          });
          ls = { ...ls, toolCalls: [...ls.toolCalls, tc] };
        } else {
          // Still need to save the closed thinking block even for UI tools
          if (activeThinkingIdx >= 0) {
            updateNodeData(id, {
              state: { ...ls, updatedAt: new Date().toISOString() },
            });
          }
        }

        // UI tool: update_todo (supports update / add / remove)
        if (event.toolName === 'update_todo' && ls.execution) {
          const { action = 'update', todoId, status, label } = event.args as {
            action?: 'update' | 'add' | 'remove';
            todoId: string;
            status?: string;
            label?: string;
          };
          let updatedTodos = [...ls.execution.todos];

          if (action === 'add' && label) {
            // Only add if the id doesn't already exist
            if (!updatedTodos.some((t) => t.id === todoId)) {
              updatedTodos.push({ id: todoId, label, status: (status as 'pending' | 'active' | 'done') || 'pending' });
            }
          } else if (action === 'remove') {
            // Safety: never remove a completed todo — they should stay visible
            const target = updatedTodos.find((t) => t.id === todoId);
            if (target?.status === 'done') {
              console.warn(`[AnimationNode] Blocked removal of completed todo "${todoId}"`);
            } else {
              updatedTodos = updatedTodos.filter((t) => t.id !== todoId);
            }
          } else {
            // Default: update status
            updatedTodos = updatedTodos.map((t) =>
              t.id === todoId ? { ...t, status: (status as 'pending' | 'active' | 'done') || t.status } : t
            );
          }

          updateNodeData(id, {
            state: { ...ls, execution: { ...ls.execution, todos: updatedTodos }, updatedAt: new Date().toISOString() },
          });
        }

        // UI tool: batch_update_todos — process multiple updates at once
        if (event.toolName === 'batch_update_todos' && ls.execution) {
          const { updates } = event.args as {
            updates: Array<{ action?: string; todoId: string; status?: string; label?: string }>;
          };
          if (updates?.length) {
            let updatedTodos = [...ls.execution.todos];
            for (const u of updates) {
              const action = u.action || 'update';
              if (action === 'add' && u.label) {
                if (!updatedTodos.some((t) => t.id === u.todoId)) {
                  updatedTodos.push({ id: u.todoId, label: u.label, status: (u.status as 'pending' | 'active' | 'done') || 'pending' });
                }
              } else if (action === 'remove') {
                const target = updatedTodos.find((t) => t.id === u.todoId);
                if (target?.status !== 'done') {
                  updatedTodos = updatedTodos.filter((t) => t.id !== u.todoId);
                }
              } else {
                updatedTodos = updatedTodos.map((t) =>
                  t.id === u.todoId ? { ...t, status: (u.status as 'pending' | 'active' | 'done') || t.status } : t
                );
              }
            }
            updateNodeData(id, {
              state: { ...ls, execution: { ...ls.execution, todos: updatedTodos }, updatedAt: new Date().toISOString() },
            });
          }
        }

        // UI tool: set_thinking — update execution + active thinking block label
        if (event.toolName === 'set_thinking' && ls.execution) {
          const { message } = event.args as { message: string };
          const thinkingBlocks = [...ls.thinkingBlocks];
          const activeIdx = thinkingBlocks.findIndex((tb) => !tb.endedAt);
          if (activeIdx >= 0) {
            thinkingBlocks[activeIdx] = { ...thinkingBlocks[activeIdx], label: message };
          }
          updateNodeData(id, {
            state: { ...ls, thinkingBlocks, execution: { ...ls.execution, thinking: message }, updatedAt: new Date().toISOString() },
          });
        }

        // UI tool: add_message → state.messages
        if (event.toolName === 'add_message') {
          const { content } = event.args as { content: string };
          const msg = { id: `msg_${Date.now()}`, role: 'assistant' as const, content, timestamp: new Date().toISOString(), seq: getNextSeq() };
          updateNodeData(id, {
            state: { ...ls, messages: [...ls.messages, msg], updatedAt: new Date().toISOString() },
          });
        }

        // UI tool: request_approval with multi_question → show form
        if (event.toolName === 'request_approval') {
          const args = event.args as { type: string; content: string; options?: Array<{ id: string; label: string; description?: string }>; fields?: FormField[] };
          if (args.type === 'multi_question' && args.fields) {
            updateNodeData(id, {
              state: {
                ...ls,
                phase: 'question',
                formQuestion: { content: args.content, fields: args.fields },
                question: undefined,
                updatedAt: new Date().toISOString(),
              },
            });
          } else if (args.type === 'question' && args.options) {
            updateNodeData(id, {
              state: {
                ...ls,
                phase: 'question',
                question: { text: args.content, options: args.options, customInput: true },
                formQuestion: undefined,
                updatedAt: new Date().toISOString(),
              },
            });
          }
        }

        // Track sandbox file writes
        if (event.toolName === 'sandbox_write_file' && ls.execution) {
          const { path } = event.args as { path: string };
          const files = ls.execution.files || [];
          if (!files.includes(path)) {
            updateNodeData(id, {
              state: { ...ls, execution: { ...ls.execution, files: [...files, path] }, updatedAt: new Date().toISOString() },
            });
          }
        }
      },

      onToolResult: (event) => {
        let ls = getLatestState();

        // ⏱ Tool result timing
        const timer = toolTimersRef.current.get(event.toolCallId);
        if (timer) {
          const toolDuration = ((Date.now() - timer.start) / 1000).toFixed(1);
          const pipelineElapsed = pipelineStartRef.current ? ((Date.now() - pipelineStartRef.current) / 1000).toFixed(1) : '?';
          const isFail = event.isError || (typeof event.result === 'object' && event.result !== null && (event.result as Record<string, unknown>).success === false);
          animationDebugLog(
            `%c⏱ [Animation] Tool result: ${timer.name} — took ${toolDuration}s (pipeline +${pipelineElapsed}s) ${isFail ? '❌ FAILED' : '✅'}`,
            isFail ? 'color: #EF4444; font-weight: bold' : 'color: #22C55E',
          );
          toolTimersRef.current.delete(event.toolCallId);
        }

        // Update tool call status for visible tools
        if (!UI_TOOLS.has(event.toolName)) {
          // Detect failure: either SSE-level isError OR result.success === false
          const resultObj = typeof event.result === 'object' && event.result !== null
            ? (event.result as Record<string, unknown>)
            : null;
          const isFailed = event.isError || (resultObj && resultObj.success === false);
          const updatedTCs = ls.toolCalls.map((tc) => {
            if (tc.toolCallId === event.toolCallId) {
              const resultStr = event.result
                ? typeof event.result === 'string' ? event.result : JSON.stringify(event.result)
                : undefined;
              const errorStr = isFailed
                ? (resultObj && typeof resultObj.message === 'string' ? resultObj.message : resultStr)
                : undefined;
              return {
                ...tc,
                status: (isFailed ? 'failed' : 'done') as 'running' | 'done' | 'failed',
                output: isFailed ? undefined : resultStr,
                error: errorStr,
              };
            }
            return tc;
          });
          updateNodeData(id, {
            state: { ...ls, toolCalls: updatedTCs, updatedAt: new Date().toISOString() },
          });
          ls = { ...ls, toolCalls: updatedTCs };
        }

        // ── Auto-infer todo progress from tool completions ─────────
        // Helper: mark a todo status if it exists and hasn't already reached that state
        const autoMarkTodo = (todoId: string, status: 'active' | 'done') => {
          if (!ls.execution) return;
          const idx = ls.execution.todos.findIndex((t) => t.id === todoId);
          if (idx < 0) return;
          const cur = ls.execution.todos[idx].status;
          // Don't regress (done → active) or no-op
          if (cur === 'done' || cur === status) return;
          const updatedTodos = [...ls.execution.todos];
          updatedTodos[idx] = { ...updatedTodos[idx], status };
          ls = { ...ls, execution: { ...ls.execution, todos: updatedTodos } };
          updateNodeData(id, { state: { ...ls, updatedAt: new Date().toISOString() } });
        };

        // Helper to add a USER-FRIENDLY message (technical details logged to console only)
        const addUserMessage = (message: string) => {
          const newMessage: AnimationMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: message,
            timestamp: new Date().toISOString(),
            seq: getNextSeq(),
          };
          const updatedMessages = [...(ls.messages || []), newMessage];
          updateNodeData(id, {
            state: { ...ls, messages: updatedMessages, updatedAt: new Date().toISOString() },
          });
          ls = { ...ls, messages: updatedMessages };
        };

        // Phase transitions from tool results
        if (event.toolName === 'sandbox_create') {
          const result = event.result as { success?: boolean; sandboxId?: string; message?: string };
          if (result.success === false || event.isError) {
            // Log technical details, show friendly message
            console.error(`[AnimationNode] Sandbox creation failed:`, result.message);
            addUserMessage('Having trouble setting up. Retrying...');
          } else if (result.sandboxId) {
            updateNodeData(id, {
              state: { ...ls, sandboxId: result.sandboxId, updatedAt: new Date().toISOString() },
            });
            ls = { ...ls, sandboxId: result.sandboxId };
            autoMarkTodo('setup', 'active');
          }
        }

        // sandbox_write_file completing after setup → mark setup done
        if (event.toolName === 'sandbox_write_file' && !event.isError) {
          // If setup is still "active", and we've written at least one file, mark it done
          // (the agent has moved past setup into writing scene code)
          const setupTodo = ls.execution?.todos.find((t) => t.id === 'setup');
          if (setupTodo?.status === 'active') {
            autoMarkTodo('setup', 'done');
          }
        }

        // Code generation tools (generate_code / generate_remotion_code)
        if ((event.toolName === 'generate_code' || event.toolName === 'generate_remotion_code') && !event.isError) {
          const result = event.result as { files?: Array<{ path: string; size: number }>; writtenToSandbox?: boolean; summary?: string };
          // Check if this was an error (summary starts with "ERROR:")
          if (result.summary?.startsWith('ERROR:')) {
            console.error(`[AnimationNode] Code generation failed:`, result.summary);
            // Don't show message to user - agent will handle retry
          } else if (result.files && result.files.length > 0 && result.writtenToSandbox) {
            // Success - files were written to sandbox
            animationDebugLog(`[AnimationNode] Code generated: ${result.files.length} files written to sandbox`);
            autoMarkTodo('setup', 'done');
          }
        }

        if (event.toolName === 'render_final') {
          animationDebugLog(`[AnimationNode] Render tool result:`, JSON.stringify(event.result, null, 2));
          animationDebugLog(`[AnimationNode] Current state: phase=${ls.phase}, versionsCount=${ls.versions?.length ?? 0}, existingUrls=${(ls.versions || []).map(v => v.videoUrl.split('?')[0].slice(-20)).join(', ')}`);
          const result = event.result as { success?: boolean; videoUrl?: string; duration?: number; versionId?: string; message?: string };
          if (result.success === false || event.isError) {
            // Log technical details, show friendly message
            console.error(`[AnimationNode] Render failed:`, result.message, `isError=${event.isError}`);
            addUserMessage('Video rendering encountered an issue. Retrying...');
          } else if (result.videoUrl && result.videoUrl.length > 0) {
            // Skip duplicate: if this URL (without query params) already exists in a version, don't add again.
            // This prevents the video-ready recovery SSE from creating a duplicate when the tool-result was also received.
            const baseUrl = result.videoUrl.split('?')[0];
            const alreadyExists = ls.versions?.some(v => v.videoUrl.split('?')[0] === baseUrl);
            if (alreadyExists) {
              animationDebugLog(`[AnimationNode] Skipping duplicate video version (URL already exists): ${baseUrl.slice(0, 60)}...`);
            } else {
            animationDebugLog(`[AnimationNode] Creating video version with URL:`, result.videoUrl);
            // Add cache-busting timestamp to prevent browser from serving stale video
            const separator = result.videoUrl.includes('?') ? '&' : '?';
            const videoUrlWithCacheBust = `${result.videoUrl}${separator}t=${Date.now()}`;
            const isPermanentUrl = result.videoUrl.startsWith('/api/assets/') || result.videoUrl.startsWith('https://') || result.videoUrl.startsWith('http://');
            const duration = result.duration || ls.plan?.totalDuration || 7;

            // Immediately show the video URL
            // Use server-provided versionId if available (from render_final or video-ready recovery)
            const tempVersion: AnimationVersion = {
              id: result.versionId || `v${Date.now()}`,
              videoUrl: videoUrlWithCacheBust,
              duration,
              prompt: data.prompt || '',
              createdAt: new Date().toISOString(),
            };
            const existingVersions = ls.versions || [];
            const newState = {
              ...ls,
              phase: 'preview' as const,
              versions: [...existingVersions, tempVersion],
              activeVersionId: tempVersion.id,
              preview: { videoUrl: videoUrlWithCacheBust, duration },
              previewTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            animationDebugLog(`[AnimationNode] Updating state with video version:`, {
              versionCount: newState.versions.length,
              activeVersionId: newState.activeVersionId,
              phase: newState.phase,
              videoUrl: videoUrlWithCacheBust.slice(0, 50) + '...',
              isPermanent: isPermanentUrl,
            });
            updateNodeData(id, { state: newState });
            // Force update ls reference for subsequent handlers
            ls = newState;
            autoMarkTodo('render', 'done');

            addToHistory({
              type: 'video',
              prompt: data.prompt || '',
              model: data.engine || 'remotion',
              status: 'completed',
              result: { urls: [videoUrlWithCacheBust], duration },
            });

            // Persist video to storage in background (async)
            // Skip if URL is already a permanent storage URL (from video-ready recovery)
            if (isPermanentUrl) {
              animationDebugLog(`[AnimationNode] Video URL is already permanent — skipping save-video`);
            } else
            if (ls.sandboxId) {
              // Extract the file path from the sandbox URL
              // Format: /api/plugins/animation/sandbox/{id}/file?path=output/final.mp4
              const pathMatch = videoUrlWithCacheBust.match(/[?&]path=([^&]+)/);
              const filePath = pathMatch ? decodeURIComponent(pathMatch[1]) : 'output/final.mp4';
              const versionId = tempVersion.id; // Capture for async callback

              animationDebugLog(`[AnimationNode] Saving video to permanent storage...`, { sandboxId: ls.sandboxId, filePath, versionId });

              fetch('/api/plugins/animation/save-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sandboxId: ls.sandboxId,
                  filePath,
                  nodeId: id,
                  prompt: data.prompt,
                  duration,
                  versionId,
                }),
              })
                .then((res) => {
                  if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                  }
                  return res.json();
                })
                .then((saved) => {
                  animationDebugLog(`[AnimationNode] save-video response:`, saved);
                  if (saved.success && saved.videoUrl) {
                    // Update the version with the permanent URL
                    const latestState = getLatestState();
                    const updatedVersions = (latestState.versions || []).map((v) =>
                      v.id === versionId ? { ...v, videoUrl: saved.videoUrl, thumbnailUrl: saved.thumbnailUrl } : v
                    );
                    updateNodeData(id, {
                      state: {
                        ...latestState,
                        versions: updatedVersions,
                        preview: latestState.preview ? { ...latestState.preview, videoUrl: saved.videoUrl } : undefined,
                        updatedAt: new Date().toISOString(),
                      },
                    });
                    animationDebugLog(`[AnimationNode] Video URL updated to permanent storage: ${saved.videoUrl}`);
                  } else {
                    console.error(`[AnimationNode] save-video failed:`, saved.error || 'Unknown error');
                  }
                })
                .catch((err) => {
                  console.error('[AnimationNode] Failed to save video to storage:', err);
                  // Keep using sandbox URL as fallback - will show "unavailable" after refresh
                });
            } else {
              console.warn('[AnimationNode] No sandboxId available to save video - URL will be ephemeral');
            }
            } // close alreadyExists else
          } else {
            // success is not false, but videoUrl is missing or empty
            console.warn(`[AnimationNode] render_final returned success but no videoUrl:`, { success: result.success, videoUrl: result.videoUrl, message: result.message });
          }
        }

        if (event.toolName === 'generate_plan' && !event.isError) {
          const result = event.result as { plan?: AnimationPlan & { motionSpec?: MotionSpec } };
          if (result.plan) {
            const planMotionSpec = result.plan.motionSpec;
            updateNodeData(id, {
              ...(planMotionSpec ? { motionSpec: createMotionSpec(planMotionSpec) } : {}),
              state: {
                ...ls,
                phase: 'plan',
                plan: result.plan,
                planAccepted: false, // Always reset — new plan needs fresh approval
                execution: undefined, // Clear execution state from previous run
                planTimestamp: new Date().toISOString(),
                planSeq: getNextSeq(),
                updatedAt: new Date().toISOString(),
              },
            });
          }
        }

        if (event.toolName === 'analyze_prompt' && !event.isError) {
          const result = event.result as {
            needsClarification?: boolean;
            question?: { text: string; options: Array<{ id: string; label: string; description?: string }>; customInput?: boolean };
          };
          if (result.needsClarification && result.question) {
            updateNodeData(id, {
              state: { ...ls, phase: 'question', question: result.question, updatedAt: new Date().toISOString() },
            });
          } else {
            // needsClarification=false — agent should call generate_plan next.
            // Just log it; the generate_plan handler will do the phase transition.
            animationDebugLog('[AnimationNode] analyze_prompt: no clarification needed, expecting generate_plan next');
          }
        }
      },

      onError: (errorMsg) => {
        const ls = getLatestState();
        // Finalize the active thinking block on error
        const thinkingBlocks = [...ls.thinkingBlocks];
        const activeIdx = thinkingBlocks.findIndex((tb) => !tb.endedAt);
        if (activeIdx >= 0) {
          thinkingBlocks[activeIdx] = {
            ...thinkingBlocks[activeIdx],
            reasoning: reasoningTextRef.current || thinkingBlocks[activeIdx].reasoning,
            endedAt: new Date().toISOString(),
          };
        }
        updateNodeData(id, {
          state: {
            ...ls,
            phase: 'error',
            thinkingBlocks,
            error: { message: errorMsg, code: 'STREAM_ERROR', canRetry: true },
            updatedAt: new Date().toISOString(),
          },
        });
      },
    }),
    [id, getLatestState, updateNodeData, scheduleFlush]
  );

  const handleAspectRatioChange = useCallback(
    (newAspectRatio: AspectRatio) => updateNodeData(id, { aspectRatio: newAspectRatio }),
    [id, updateNodeData]
  );

  const handleDurationChange = useCallback(
    (newDuration: number) => updateNodeData(id, { duration: newDuration }),
    [id, updateNodeData]
  );

  const handleEngineChange = useCallback(
    (newEngine: AnimationEngine) => updateNodeData(id, { engine: newEngine }),
    [id, updateNodeData]
  );

  const handleTechniquesChange = useCallback(
    (newTechniques: string[]) => updateNodeData(id, { techniques: newTechniques }),
    [id, updateNodeData]
  );

  const handleDesignSpecChange = useCallback(
    (spec: AnimationNodeData['designSpec']) => updateNodeData(id, { designSpec: spec }),
    [id, updateNodeData]
  );

  const handleLogoChange = useCallback(
    (logo: AnimationNodeData['logo']) => updateNodeData(id, { logo }),
    [id, updateNodeData]
  );

  const handleFpsChange = useCallback(
    (newFps: number) => updateNodeData(id, { fps: newFps }),
    [id, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (res: string) => updateNodeData(id, { resolution: res as '720p' | '1080p' | '4k' }),
    [id, updateNodeData]
  );

  const handleMotionSpecChange = useCallback(
    (spec: MotionSpec) => {
      updateNodeData(id, { motionSpec: createMotionSpec({ ...spec, updatedAt: new Date().toISOString() }) });
    },
    [id, updateNodeData]
  );

  const handleSaveMotionPreset = useCallback(
    (name: string) => {
      const current = useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as AnimationNodeData | undefined;
      const currentSpec = current?.motionSpec || motionSpec;
      const currentPresets = current?.motionPresets || motionPresets;
      const presetName = name.trim() || makeMotionPresetName(currentPresets, 'My Motion Preset');
      const preset: MotionPreset = {
        id: `motion_preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: presetName,
        createdAt: new Date().toISOString(),
        source: currentSpec.referenceProfile ? 'reference' : 'manual',
        spec: createMotionSpec({
          ...currentSpec,
          source: 'preset',
          presetId: undefined,
          updatedAt: new Date().toISOString(),
        }),
      };
      updateNodeData(id, {
        motionPresets: [...currentPresets, preset],
        selectedMotionPresetId: preset.id,
        motionSpec: createMotionSpec({
          ...preset.spec,
          presetId: preset.id,
          source: 'preset',
          updatedAt: new Date().toISOString(),
        }),
      });
      toast.success(`Saved motion preset "${presetName}"`);
    },
    [id, motionSpec, motionPresets, updateNodeData]
  );

  const handleApplyMotionPreset = useCallback(
    (presetId: string) => {
      const preset = motionPresets.find((item) => item.id === presetId);
      if (!preset) return;
      updateNodeData(id, {
        selectedMotionPresetId: presetId,
        motionSpec: createMotionSpec({
          ...preset.spec,
          source: 'preset',
          presetId,
          updatedAt: new Date().toISOString(),
        }),
      });
      toast.success(`Applied "${preset.name}"`);
    },
    [id, motionPresets, updateNodeData]
  );

  const handleDeleteMotionPreset = useCallback(
    (presetId: string) => {
      const remaining = motionPresets.filter((preset) => preset.id !== presetId);
      const isSelected = data.selectedMotionPresetId === presetId;
      updateNodeData(id, {
        motionPresets: remaining,
        selectedMotionPresetId: isSelected ? undefined : data.selectedMotionPresetId,
      });
    },
    [id, motionPresets, data.selectedMotionPresetId, updateNodeData]
  );

  const lastReferenceMotionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const profile = extractReferenceMotionProfile(media);
    if (!profile) return;
    if (lastReferenceMotionIdRef.current === profile.sourceMediaId) return;
    if (motionSpec.referenceProfile?.sourceMediaId === profile.sourceMediaId) return;

    lastReferenceMotionIdRef.current = profile.sourceMediaId;
    updateNodeData(id, {
      motionSpec: seedMotionSpecFromReference(profile, motionSpec),
    });
    toast.success(`Motion profile inferred from ${profile.sourceName}`);
  }, [id, media, motionSpec, updateNodeData]);

  const handleOpenSettings = useCallback(() => {
    const nodeEl = document.querySelector(`[data-id="${id}"]`);
    if (nodeEl) {
      const rect = nodeEl.getBoundingClientRect();
      setSettingsPosition({ x: rect.right + 10, y: rect.top });
      setSettingsAnchorRect({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
      setShowSettings(true);
    }
  }, [id]);

  // ─── Pipeline timer helper ─────────────────────────────────────────
  const startPipelineTimer = useCallback((label: string) => {
    pipelineStartRef.current = Date.now();
    toolTimersRef.current.clear();
    animationDebugLog(`%c⏱ [Animation] Pipeline started: ${label}`, 'color: #FBBF24; font-weight: bold');
  }, []);

  // ─── Stream lifecycle ───────────────────────────────────────────────
  const resetStreamingRefs = useCallback(() => {
    streamingTextRef.current = '';
    reasoningTextRef.current = '';
    if (textFlushTimerRef.current) {
      clearTimeout(textFlushTimerRef.current);
      textFlushTimerRef.current = null;
    }
  }, []);

  // ─── Conversation history builder ──────────────────────────────────
  // Builds a messages array from accumulated state for multi-turn continuity.
  // The agent needs to see prior user/assistant exchanges to understand edits.
  // Limits to last 20 messages to avoid context window blowup.
  const buildConversationHistory = useCallback((
    currentMessages: AnimationMessage[],
    newUserContent: string,
  ): Array<{ role: 'user' | 'assistant'; content: string }> => {
    // Filter to user/assistant messages only (skip internal system messages)
    const history = currentMessages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content.trim().length > 0)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Keep last 20 messages to stay within context limits
    const trimmed = history.length > 20 ? history.slice(-20) : history;

    // Add the new user message as the final message
    trimmed.push({ role: 'user', content: newUserContent });

    return trimmed;
  }, []);

  // ─── Phase handlers ─────────────────────────────────────────────────

  const runAnalyzePrompt = useCallback(
    async (prompt: string, options?: { skipGuided?: boolean; appendUserMessage?: boolean; promptForAgent?: string }) => {
      const ls = getLatestState();
      const appendUserMessage = options?.appendUserMessage !== false;
      const promptForAgent = options?.promptForAgent || prompt;
      const shouldOpenGuidedMotion =
        !options?.skipGuided &&
        isLowConfidenceMotionPrompt(prompt) &&
        !data.motionSpec &&
        ls.phase !== 'question';

      // #93/#94: low-confidence prompts open guided chips + variants first.
      if (shouldOpenGuidedMotion) {
        const inferred = deriveGuidedChipsFromPrompt(prompt);
        setGuidedPrompt(prompt);
        setGuidedFollowUp('');
        setGuidedChips(inferred);
        setGuidedVariant('balanced');

        const userMsg: AnimationMessage = {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: prompt,
          timestamp: new Date().toISOString(),
          seq: getNextSeq(),
        };
        updateNodeData(id, {
          prompt,
          state: {
            ...ls,
            phase: 'question',
            question: undefined,
            formQuestion: undefined,
            messages: appendUserMessage ? [...ls.messages, userMsg] : ls.messages,
            updatedAt: new Date().toISOString(),
          },
        });
        return;
      }

      // Collect edge media IDs already shown in prior messages so we don't repeat them
      const seenEdgeIds = new Set(
        ls.messages.flatMap((m) => m.media?.filter((e) => e.source === 'edge').map((e) => e.id) ?? [])
      );
      const uploads = media.filter((m) => m.source === 'upload');
      const newEdge = media.filter((m) => m.source === 'edge' && !seenEdgeIds.has(m.id));
      const msgMedia = [...uploads, ...newEdge];
      const userMsg: AnimationMessage = {
        id: `msg_${Date.now()}`,
        role: 'user' as const,
        content: prompt,
        timestamp: new Date().toISOString(),
        seq: getNextSeq(),
        media: msgMedia.length > 0 ? msgMedia : undefined,
      };
      const thinkingBlock: ThinkingBlockItem = {
        id: `tb_${Date.now()}`,
        label: 'Analyzing your prompt...',
        startedAt: new Date().toISOString(),
        seq: getNextSeq(),
      };

      updateNodeData(id, {
        prompt,
        motionSpec: motionSpec,
        state: {
          ...ls,
          phase: 'executing',
          messages: appendUserMessage ? [...ls.messages, userMsg] : ls.messages,
          thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
          execution: { todos: [], thinking: 'Analyzing your prompt...', files: [] },
          updatedAt: new Date().toISOString(),
        },
      });

      startPipelineTimer('analyzePrompt');
      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      animationDebugLog(
        `[AnimationNode] handleAnalyzePrompt — sending ${media.length} media entries`,
        media.map((m) => ({ name: m.name, type: m.type, source: m.source, urlPrefix: m.dataUrl?.slice(0, 40) }))
      );

      try {
        await streamToAgent(
          `Analyze this animation request and either ask a clarifying question (if style is unclear) or generate a plan directly:\n\n${promptForAgent}`,
          {
            nodeId: id,
            phase: 'idle',
            planAccepted: false,
            media,
            engine,
            aspectRatio,
            duration,
            techniques,
            designSpec,
            motionSpec,
            logo,
            fps,
            resolution,
          },
          callbacks
        );
        // Fallback if agent didn't call generate_plan (stayed in 'executing')
        const latest = getLatestState();
        if (latest.phase === 'executing') {
          console.warn('[AnimationNode] handleAnalyzePrompt fallback — agent did not generate a plan, creating default');
          const targetDur = duration || 5;
          const introDur = Math.round(targetDur * 0.2 * 10) / 10;
          const outroDur = Math.round(targetDur * 0.2 * 10) / 10;
          const mainDur = Math.round((targetDur - introDur - outroDur) * 10) / 10;
          updateNodeData(id, {
            state: {
              ...latest,
              phase: 'plan',
              plan: {
                scenes: [
                  { number: 1, title: 'Intro', duration: introDur, description: 'Opening animation' },
                  { number: 2, title: 'Main', duration: mainDur, description: prompt.slice(0, 100) },
                  { number: 3, title: 'Outro', duration: outroDur, description: 'Closing animation' },
                ],
                totalDuration: targetDur,
                style: 'smooth',
                fps: fps || 30,
                motionSpec,
              },
              planTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error('[AnimationNode] handleAnalyzePrompt error:', err);
      }
    },
    [id, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs, data.motionSpec]
  );

  const handleAnalyzePrompt = useCallback(
    async (prompt: string) => {
      await runAnalyzePrompt(prompt);
    },
    [runAnalyzePrompt]
  );

  const guidedVariantOptions = useMemo(
    () => buildMotionVariants(createGuidedMotionSpec(guidedChips, guidedVariant, guidedFollowUp || undefined, motionSpec.referenceProfile)),
    [guidedChips, guidedVariant, guidedFollowUp, motionSpec.referenceProfile]
  );

  const handleApplyGuidedMotion = useCallback(
    async (variantId?: MotionVariantId) => {
      if (!guidedPrompt) return;
      const selectedVariant = variantId || guidedVariant;
      const nextSpec = createGuidedMotionSpec(
        guidedChips,
        selectedVariant,
        guidedFollowUp || undefined,
        motionSpec.referenceProfile
      );
      const normalized = createMotionSpec({
        ...nextSpec,
        source: selectedVariant === 'balanced' ? 'guided' : 'variant',
        updatedAt: new Date().toISOString(),
      });

      updateNodeData(id, {
        motionSpec: normalized,
        selectedMotionPresetId: undefined,
      });

      const promptForAgent = [
        guidedPrompt,
        '',
        'Structured guided motion profile (authoritative):',
        JSON.stringify(normalized, null, 2),
        'Use this profile over ambiguous phrasing when generating the plan.',
      ].join('\n');

      setGuidedPrompt(null);
      setGuidedFollowUp('');
      await runAnalyzePrompt(guidedPrompt, {
        skipGuided: true,
        appendUserMessage: false,
        promptForAgent,
      });
    },
    [guidedPrompt, guidedVariant, guidedChips, guidedFollowUp, motionSpec.referenceProfile, id, updateNodeData, runAnalyzePrompt]
  );

  const handleSkipGuidedMotion = useCallback(async () => {
    if (!guidedPrompt) return;
    const promptToUse = guidedPrompt;
    setGuidedPrompt(null);
    setGuidedFollowUp('');
    await runAnalyzePrompt(promptToUse, {
      skipGuided: true,
      appendUserMessage: false,
    });
  }, [guidedPrompt, runAnalyzePrompt]);

  const handleSelectStyle = useCallback(
    async (styleId: string, customStyle?: string) => {
      const ls = getLatestState();
      const selectedStyle = customStyle || styleId;
      const userMsg = {
        id: `msg_${Date.now()}`,
        role: 'user' as const,
        content: `Selected style: ${selectedStyle}`,
        timestamp: new Date().toISOString(),
        seq: getNextSeq(),
      };
      const thinkingBlock: ThinkingBlockItem = {
        id: `tb_${Date.now()}`,
        label: 'Generating animation plan...',
        startedAt: new Date().toISOString(),
        seq: getNextSeq(),
      };

      updateNodeData(id, {
        state: {
          ...ls,
          phase: 'executing',
          selectedStyle,
          messages: [...ls.messages, userMsg],
          thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
          execution: { todos: [], thinking: 'Generating animation plan...', files: [] },
          updatedAt: new Date().toISOString(),
        },
      });

      startPipelineTimer('selectStyle');
      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          `Generate an animation plan for this request with style "${selectedStyle}":\n\n${data.prompt || 'Animation request'}`,
          { nodeId: id, phase: 'question', planAccepted: false, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution },
          callbacks
        );
        const latest = getLatestState();
        if (latest.phase === 'executing') {
          updateNodeData(id, {
            state: {
              ...latest,
              phase: 'plan',
              plan: {
                scenes: [
                  { number: 1, title: 'Intro', duration: 2, description: `${selectedStyle} entrance` },
                  { number: 2, title: 'Main Action', duration: 3, description: data.prompt || 'Main animation' },
                  { number: 3, title: 'Outro', duration: 2, description: `${selectedStyle} exit` },
                ],
                totalDuration: 7,
                style: selectedStyle,
                fps: fps || 30,
                motionSpec,
              },
              planTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
        }
      } catch {
        // Error handled by callback
      }
    },
    [id, data.prompt, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]
  );

  const handleFormSubmit = useCallback(
    async (answers: Record<string, string | string[]>) => {
      const ls = getLatestState();
      const formQuestion = ls.formQuestion;

      // Build human-readable summary for the chat bubble
      const lines: string[] = [];
      if (formQuestion) {
        for (const field of formQuestion.fields) {
          const val = answers[field.id];
          if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) continue;
          const displayVal = Array.isArray(val) ? val.join(', ') : val;
          lines.push(`${field.label}: ${displayVal}`);
        }
      }
      const userContent = lines.length > 0 ? lines.join('\n') : JSON.stringify(answers);

      const userMsg: AnimationMessage = {
        id: `msg_${Date.now()}`,
        role: 'user' as const,
        content: userContent,
        timestamp: new Date().toISOString(),
        seq: getNextSeq(),
      };
      const thinkingBlock: ThinkingBlockItem = {
        id: `tb_${Date.now()}`,
        label: 'Processing your answers...',
        startedAt: new Date().toISOString(),
        seq: getNextSeq(),
      };

      updateNodeData(id, {
        state: {
          ...ls,
          phase: 'executing',
          formQuestion: undefined,
          question: undefined,
          messages: [...ls.messages, userMsg],
          thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
          execution: { todos: [], thinking: 'Processing your answers...', files: [] },
          updatedAt: new Date().toISOString(),
        },
      });

      startPipelineTimer('formSubmit');
      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        const answersJson = JSON.stringify(answers, null, 2);
        await streamToAgent(
          `User answered the form:\n${answersJson}\n\nProceed with generating a plan based on these answers.\n\nOriginal prompt: ${data.prompt || 'Animation request'}`,
          { nodeId: id, phase: 'question', planAccepted: false, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution },
          callbacks
        );
        const latest = getLatestState();
        if (latest.phase === 'executing') {
          updateNodeData(id, {
            state: {
              ...latest,
              phase: 'plan',
              plan: {
                scenes: [
                  { number: 1, title: 'Intro', duration: 2, description: 'Opening animation' },
                  { number: 2, title: 'Main', duration: 3, description: data.prompt || 'Main animation' },
                  { number: 3, title: 'Outro', duration: 2, description: 'Closing animation' },
                ],
                totalDuration: 7,
                style: 'smooth',
                fps: fps || 30,
                motionSpec,
              },
              planTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
        }
      } catch {
        // Error handled by callback
      }
    },
    [id, data.prompt, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]
  );

  const handleAcceptPlan = useCallback(async () => {
    const ls = getLatestState();
    if (!ls.plan) return;

    // Don't pre-create todos — let the agent own them entirely to avoid double bookkeeping
    const engineLabel = engine === 'remotion' ? 'Remotion' : 'Theatre.js';
    const thinkingBlock: ThinkingBlockItem = {
      id: `tb_${Date.now()}`,
      label: `Setting up ${engineLabel} animation...`,
      startedAt: new Date().toISOString(),
      seq: getNextSeq(),
    };

    updateNodeData(id, {
      state: {
        ...ls,
        phase: 'executing',
        planAccepted: true,
        thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
        execution: { todos: [], thinking: `Setting up ${engineLabel} animation...`, files: [] },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    startPipelineTimer('acceptPlan');
    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    // Debug: log media being sent with execution request
    animationDebugLog(`[AnimationNode] handleAcceptPlan — sending ${media.length} media entries, sandboxId=${ls.sandboxId || 'NONE'}`,
      media.map(m => ({ name: m.name, type: m.type, source: m.source, urlPrefix: m.dataUrl?.slice(0, 40) })));

    try {
      const sceneList = ls.plan.scenes.map((s) =>
        `  - Scene ${s.number}: ${s.title} (${s.duration}s) — ${s.description}`
      ).join('\n');
      const mediaInfo = media.length > 0 ? [
        '',
        `MEDIA FILES (${media.length} file${media.length > 1 ? 's' : ''}) — AUTO-UPLOADED during sandbox creation:`,
        ...media.map(m => `  - "${m.name}" (${m.type}) → public/media/${m.name} — use staticFile("media/${m.name}") in Remotion code`),
        'These files are AUTOMATICALLY uploaded to the sandbox when you call sandbox_create.',
        'Do NOT manually upload them. Just reference them with staticFile() in your animation code.',
      ] : [];
      const executionPrompt = [
        'The user has approved the animation plan. Execute it now.',
        '',
        'FIRST: Create your task list using batch_update_todos with action="add" for ALL tasks.',
        'Include tasks for: sandbox setup, each scene, post-processing, and rendering.',
        'Then IMMEDIATELY start executing — do NOT stop after creating todos.',
        '',
        'Plan scenes:',
        sceneList,
        ...mediaInfo,
        '',
        'RULES:',
        '- Mark each todo "active" before starting, "done" after completing.',
        '- NEVER remove completed todos.',
        '- Prefer batch_update_todos for multiple updates.',
        '- Work SILENTLY — use set_thinking for status, not text output.',
        '',
        `Prompt: ${data.prompt || 'Animation request'}`,
      ].join('\n');

      // Include conversation history so agent knows the original prompt and plan discussions
      const conversationMessages = buildConversationHistory(ls.messages, executionPrompt);

      await streamToAgent(
        conversationMessages,
        { nodeId: id, phase: 'executing', plan: ls.plan, planAccepted: true, todos: [], sandboxId: ls.sandboxId, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, data.prompt, engine, media, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs, buildConversationHistory]);

  const handleRejectPlan = useCallback(() => {
    updateState({ phase: 'idle', plan: undefined, question: undefined, planAccepted: undefined });
  }, [updateState]);

  const handleRevisePlan = useCallback(
    async (feedback: string) => {
      const ls = getLatestState();
      if (!ls.plan) return;

      const userMsg = { id: `msg_${Date.now()}`, role: 'user' as const, content: feedback, timestamp: new Date().toISOString(), seq: getNextSeq() };
      const thinkingBlock: ThinkingBlockItem = {
        id: `tb_${Date.now()}`,
        label: 'Revising animation plan...',
        startedAt: new Date().toISOString(),
        seq: getNextSeq(),
      };
      updateNodeData(id, {
        state: {
          ...ls,
          messages: [...ls.messages, userMsg],
          thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
          execution: { todos: [], thinking: 'Revising animation plan...', files: [] },
          updatedAt: new Date().toISOString(),
        },
      });

      startPipelineTimer('revisePlan');
      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      // Send conversation history so agent understands prior discussion about the plan
      const reviseContent = `The user wants to revise the animation plan. Feedback: "${feedback}"\n\nGenerate an updated plan using the generate_plan tool.`;
      const conversationMessages = buildConversationHistory(ls.messages, reviseContent);

      try {
        await streamToAgent(
          conversationMessages,
          { nodeId: id, phase: 'plan', plan: ls.plan, planAccepted: false, sandboxId: ls.sandboxId, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution },
          callbacks
        );
        const latest = getLatestState();
        if (latest.execution && latest.phase !== 'plan') {
          updateNodeData(id, {
            state: { ...latest, phase: 'plan', execution: undefined, updatedAt: new Date().toISOString() },
          });
        }
      } catch (err) {
        console.error('[AnimationNode] stream error:', err);
        // Error state is set by onError callback in createStreamCallbacks
      }
    },
    [id, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs, buildConversationHistory]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      const ls = getLatestState();
      // Collect edge media IDs already shown in prior messages so we don't repeat them
      const seenEdgeIds = new Set(
        ls.messages.flatMap((m) => m.media?.filter((e) => e.source === 'edge').map((e) => e.id) ?? [])
      );
      const uploads = media.filter((m) => m.source === 'upload');
      const newEdge = media.filter((m) => m.source === 'edge' && !seenEdgeIds.has(m.id));
      const msgMedia = [...uploads, ...newEdge];
      const userMsg: AnimationMessage = {
        id: `msg_${Date.now()}`, role: 'user' as const, content, timestamp: new Date().toISOString(), seq: getNextSeq(),
        media: msgMedia.length > 0 ? msgMedia : undefined,
      };
      const thinkingBlock: ThinkingBlockItem = {
        id: `tb_${Date.now()}`,
        label: 'Thinking...',
        startedAt: new Date().toISOString(),
        seq: getNextSeq(),
      };

      // If there was an old execution with no streaming, start a fresh execution tracker
      const stateUpdate: Partial<AnimationNodeState> = {
        messages: [...ls.messages, userMsg],
        thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
        updatedAt: new Date().toISOString(),
      };

      // #95: deterministic semantic motion edits for post-render feedback.
      const semanticMotionEdit = applySemanticMotionEdit(content, motionSpec, ls.plan);
      const shouldApplySemanticPatch =
        semanticMotionEdit.recognized &&
        (ls.phase === 'preview' || ls.phase === 'complete' || ls.planAccepted === true);
      const effectiveMotionSpec = shouldApplySemanticPatch ? semanticMotionEdit.patchedSpec : motionSpec;
      const effectivePlan = shouldApplySemanticPatch && semanticMotionEdit.patchedPlan
        ? semanticMotionEdit.patchedPlan
        : ls.plan;
      if (shouldApplySemanticPatch && semanticMotionEdit.patchedPlan) {
        stateUpdate.plan = semanticMotionEdit.patchedPlan;
      }

      // Auto-accept plan when user sends ANY message during plan phase with a plan present.
      // The placeholder says "Type 'yes' to accept, or suggest changes..." — any text input implies engagement.
      // If the user wanted to reject, they'd click the "Reject" button instead.
      if (ls.phase === 'plan' && ls.plan && !ls.planAccepted) {
        stateUpdate.planAccepted = true;
      }

      // Transition to executing when plan is accepted (either previously via button, or auto-accepted above)
      // This covers: plan phase (text acceptance), plan phase (failed execution retry),
      // preview phase (edit request), complete phase (follow-up)
      if (ls.planAccepted || stateUpdate.planAccepted) {
        stateUpdate.phase = 'executing';
        stateUpdate.execution = {
          todos: ls.execution?.todos || [],
          thinking: 'Processing your feedback...',
          files: ls.execution?.files || [],
        };
      }

      // Mark live preview as stale when user sends feedback (Issue #22)
      // This shows a visual indicator that the preview is being updated
      if (ls.previewUrl) {
        stateUpdate.previewState = 'stale';
      }

      const nodeUpdatePayload: Record<string, unknown> = {
        state: { ...ls, ...stateUpdate },
      };
      if (shouldApplySemanticPatch) {
        nodeUpdatePayload.motionSpec = effectiveMotionSpec;
      }
      updateNodeData(id, nodeUpdatePayload);

      startPipelineTimer('sendMessage');
      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      // Build a contextual prompt with instructions
      let userContent = content;
      const semanticInstruction = shouldApplySemanticPatch ? semanticMotionEdit.instruction : '';
      if (ls.planAccepted && (ls.phase === 'plan' || ls.phase === 'executing')) {
        // User is giving feedback after failed execution — emphasize retry, not replan
        userContent = [
          content,
          ...(semanticInstruction ? ['', semanticInstruction] : []),
          '',
          'IMPORTANT: The plan has already been approved. Do NOT re-generate the plan.',
          'Instead, investigate what went wrong with the previous execution,',
          'fix the issue (check vite logs, file contents, etc.), and retry.',
          ls.sandboxId ? `Active sandbox: ${ls.sandboxId}` : 'No sandbox — create one first with sandbox_create.',
        ].join('\n');
      } else if (ls.planAccepted && (ls.phase === 'preview' || ls.phase === 'complete')) {
        // User is requesting edits to a working animation — emphasize modify, not replan
        userContent = [
          content,
          ...(semanticInstruction ? ['', semanticInstruction] : []),
          '',
          'IMPORTANT: The plan has already been approved and the animation was rendered successfully.',
          'Do NOT re-generate the plan. Modify the existing code to implement the requested changes,',
          'then call render_final to produce the updated video.',
          ls.sandboxId ? `Active sandbox: ${ls.sandboxId}` : 'No sandbox — create one first with sandbox_create.',
        ].join('\n');
      } else if (semanticInstruction) {
        userContent = [
          content,
          '',
          semanticInstruction,
          '',
          'Apply a targeted patch to existing timing/easing values whenever possible.',
        ].join('\n');
      }

      // Send full conversation history so the agent has context of prior exchanges.
      // This is critical for edit requests — the agent needs to know what was built before.
      const conversationMessages = buildConversationHistory(ls.messages, userContent);

      // Use the UPDATED phase (after stateUpdate), not the stale ls.phase
      const effectivePhase = stateUpdate.phase || ls.phase;

      try {
        await streamToAgent(conversationMessages, {
          nodeId: id,
          phase: effectivePhase,
          plan: effectivePlan,
          planAccepted: !!(ls.planAccepted || stateUpdate.planAccepted),
          todos: ls.execution?.todos,
          sandboxId: ls.sandboxId,
          media,
          engine,
          aspectRatio,
          duration,
          techniques,
          designSpec,
          motionSpec: effectiveMotionSpec,
          logo,
          fps,
          resolution,
        }, callbacks);
      } catch (err) {
        console.error('[AnimationNode] stream error:', err);
        // Error state is set by onError callback in createStreamCallbacks
      }
    },
    [id, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs, buildConversationHistory]
  );

  const handleAcceptPreview = useCallback(async () => {
    if (!state.preview) return;
    try {
      const response = await fetch('/api/plugins/animation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: id,
          action: 'finalize',
          previewUrl: state.preview.videoUrl,
          sandboxId: state.sandboxId,
          duration: state.preview.duration,
        }),
      });
      const result = response.ok ? await response.json() : null;
      updateState({
        phase: 'complete',
        output: {
          videoUrl: result?.outputUrl || state.preview.videoUrl,
          thumbnailUrl: result?.thumbnailUrl || state.preview.videoUrl.replace('.mp4', '-thumb.jpg'),
          duration: state.preview.duration,
        },
        completedAt: new Date().toISOString(),
      });
    } catch {
      updateState({
        phase: 'complete',
        output: {
          videoUrl: state.preview.videoUrl,
          thumbnailUrl: state.preview.videoUrl.replace('.mp4', '-thumb.jpg'),
          duration: state.preview.duration,
        },
        completedAt: new Date().toISOString(),
      });
    }
  }, [id, state.preview, state.sandboxId, updateState]);

  const handleRegenerate = useCallback(async () => {
    const ls = getLatestState();
    if (!ls.plan) return;

    const setupLabel = engine === 'remotion' ? 'Set up Remotion project' : 'Set up Theatre.js project';
    const todos = [
      { id: 'setup', label: setupLabel, status: 'pending' as const },
      ...ls.plan.scenes.map((s) => ({
        id: `scene-${s.number}`,
        label: `Create Scene ${s.number} (${s.title})`,
        status: 'pending' as const,
      })),
      { id: 'postprocess', label: 'Add post-processing effects', status: 'pending' as const },
      { id: 'render', label: 'Render preview', status: 'pending' as const },
    ];
    const thinkingBlock: ThinkingBlockItem = {
      id: `tb_${Date.now()}`,
      label: 'Regenerating animation...',
      startedAt: new Date().toISOString(),
      seq: getNextSeq(),
    };

    updateNodeData(id, {
      state: {
        ...ls,
        phase: 'executing',
        thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
        execution: { todos, thinking: 'Regenerating animation...', files: [] },
        preview: undefined,
        updatedAt: new Date().toISOString(),
      },
    });

    startPipelineTimer('regenerate');
    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    try {
      await streamToAgent(
        `Regenerate the animation from the plan. Execute all steps again.\n\nPrompt: ${data.prompt || 'Animation request'}`,
        { nodeId: id, phase: 'executing', plan: ls.plan, planAccepted: true, todos, sandboxId: ls.sandboxId, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, data.prompt, engine, media, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]);

  const handleExportVideo = useCallback(async () => {
    const ls = getLatestState();
    if (!ls.sandboxId) return;

    const thinkingBlock: ThinkingBlockItem = {
      id: `tb_${Date.now()}`,
      label: 'Rendering final video...',
      startedAt: new Date().toISOString(),
      seq: getNextSeq(),
    };

    // Add or update render todo
    const todos = ls.execution?.todos || [];
    const renderTodo = todos.find(t => t.id === 'render');
    const updatedTodos = renderTodo
      ? todos.map(t => t.id === 'render' ? { ...t, status: 'active' as const } : t)
      : [...todos, { id: 'render', label: 'Render video', status: 'active' as const }];

    updateNodeData(id, {
      state: {
        ...ls,
        thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
        execution: {
          todos: updatedTodos,
          thinking: 'Rendering final video...',
          files: ls.execution?.files || [],
        },
        updatedAt: new Date().toISOString(),
      },
    });

    startPipelineTimer('exportVideo');
    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    try {
      await streamToAgent(
        [
          'The user clicked Export. Render the final video now.',
          '',
          'Use render_final to create the video.',
          `Active sandbox: ${ls.sandboxId}`,
        ].join('\n'),
        { nodeId: id, phase: 'executing', plan: ls.plan, planAccepted: true, sandboxId: ls.sandboxId, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, media, engine, aspectRatio, duration, techniques, designSpec, motionSpec, logo, fps, resolution, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]);

  const handleRetry = useCallback(() => {
    if (state.plan) {
      updateState({ phase: 'plan', planAccepted: false, error: undefined, execution: undefined });
    } else {
      updateState({ phase: 'idle', error: undefined, execution: undefined });
    }
  }, [state.plan, updateState]);

  const handleReset = useCallback(() => {
    abortStream();
    reasoningTextRef.current = '';
    streamingTextRef.current = '';
    setGuidedPrompt(null);
    setGuidedFollowUp('');
    setGuidedChips(createMotionSpec().chips);
    setGuidedVariant('balanced');
    // Delete code snapshot for this node (fire-and-forget)
    fetch(`/api/plugins/animation/snapshot/${id}`, { method: 'DELETE' }).catch(() => {});
    updateNodeData(id, { prompt: '', media: [], state: createDefaultState(id) });
  }, [id, updateNodeData, abortStream]);

  // ─── Input routing ──────────────────────────────────────────────────
  const handleInputSubmit = useCallback(
    (message: string) => {
      switch (state.phase) {
        case 'idle':
        case 'error':
          handleAnalyzePrompt(message);
          break;
        case 'plan':
          if (state.planAccepted) {
            // Plan already accepted — user is giving post-execution feedback.
            // Route to handleSendMessage which passes full context (sandboxId, plan, etc.)
            // so the agent can retry / fix rather than re-plan.
            handleSendMessage(message);
          } else if (isAffirmative(message)) {
            // User typed "yes", "ok", "go", etc. → accept the plan
            handleAcceptPlan();
          } else {
            // User gave specific feedback → revise the plan
            handleRevisePlan(message);
          }
          break;
        case 'executing':
        case 'preview':
        case 'question':
          handleSendMessage(message);
          break;
        case 'complete':
          // Start a new animation from scratch
          handleReset();
          break;
        default:
          handleAnalyzePrompt(message);
      }
    },
    [state.phase, state.planAccepted, handleAnalyzePrompt, handleAcceptPlan, handleRevisePlan, handleSendMessage, handleReset]
  );

  const inputPlaceholder = useMemo(() => {
    switch (state.phase) {
      case 'idle':
        return 'Describe the animation you want...';
      case 'plan':
        return state.planAccepted
          ? 'Send feedback or ask to retry...'
          : 'Type "yes" to accept, or suggest changes...';
      case 'executing':
        return 'Send a message to the agent...';
      case 'question':
        return state.formQuestion ? 'Or type a message...' : 'Or type your own answer...';
      case 'error':
        return 'Describe what you\'d like to try...';
      case 'preview':
        return 'Request changes...';
      case 'complete':
        return 'Start a new animation...';
      default:
        return 'Describe the animation you want...';
    }
  }, [state.phase, state.planAccepted, state.formQuestion]);

  // ─── Header config ──────────────────────────────────────────────────
  const headerConfig = useMemo(() => {
    switch (state.phase) {
      case 'idle':
        return { iconColor: 'var(--an-accent)', statusColor: 'var(--an-text-placeholder)', statusText: 'Idle', iconBg: 'var(--an-accent-bg)' };
      case 'question':
        return { iconColor: '#FBBF24', statusColor: '#FBBF24', statusText: 'Question', iconBg: '#422006' };
      case 'plan':
        return { iconColor: '#FBBF24', statusColor: '#FBBF24', statusText: 'Planning', iconBg: '#422006' };
      case 'executing':
        return { iconColor: 'var(--an-accent)', statusColor: 'var(--an-accent)', statusText: 'Generating', iconBg: 'var(--an-accent-bg)' };
      case 'preview':
        return { iconColor: 'var(--an-accent)', statusColor: 'var(--an-accent)', statusText: 'Generating', iconBg: 'var(--an-accent-bg)' };
      case 'complete':
        return { iconColor: '#22C55E', statusColor: '#22C55E', statusText: 'Complete', iconBg: '#14532D' };
      case 'error':
        return { iconColor: '#EF4444', statusColor: '#EF4444', statusText: 'Error', iconBg: '#3B1111' };
      default:
        return { iconColor: 'var(--an-accent)', statusColor: 'var(--an-text-placeholder)', statusText: 'Idle', iconBg: 'var(--an-accent-bg)' };
    }
  }, [state.phase]);

  // ─── Timeline computation ───────────────────────────────────────────
  // SIMPLIFIED: Only show messages, plan, and videos, hide verbose tool calls and thinking blocks.
  // Users care about the result (video), not the building process.
  const timeline = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];

    // Only show user/assistant messages - skip internal status messages
    state.messages.forEach((msg) => {
      // Skip internal status messages (start with underscore or are just waiting indicators)
      const isInternalMessage = msg.content.startsWith('_') ||
        msg.content.includes('Waiting for your input');
      if (!isInternalMessage) {
        items.push({
          kind: msg.role === 'user' ? 'user' : 'assistant',
          id: msg.id,
          content: msg.content,
          ts: msg.timestamp || state.createdAt,
          seq: msg.seq ?? 0,
          ...(msg.role === 'user' && msg.media ? { media: msg.media } : {}),
        } as TimelineItem);
      }
    });

    // Include plan card in timeline if it has a timestamp
    if (state.plan && state.planTimestamp) {
      items.push({ kind: 'plan', id: 'plan', ts: state.planTimestamp, seq: state.planSeq ?? 0 });
    }

    // Include video versions in timeline - each version appears where it was created
    if (state.versions && state.versions.length > 0) {
      animationDebugLog(`[AnimationNode] Timeline: Adding ${state.versions.length} video(s) to timeline`);
      state.versions.forEach((version, idx) => {
        animationDebugLog(`[AnimationNode] Timeline video ${idx}:`, { id: version.id, url: version.videoUrl?.slice(0, 50) });
        items.push({
          kind: 'video',
          id: version.id,
          ts: version.createdAt,
          seq: 1000000 + idx, // High seq to ensure videos appear after same-timestamp messages
          videoUrl: version.videoUrl,
          duration: version.duration,
        });
      });
    } else {
      animationDebugLog(`[AnimationNode] Timeline: No videos in state.versions`);
    }

    // Include thinking blocks that have meaningful content
    state.thinkingBlocks.forEach((tb) => {
      const tbDuration = tb.endedAt
        ? (new Date(tb.endedAt).getTime() - new Date(tb.startedAt).getTime()) / 1000
        : undefined;
      // Only show blocks with reasoning text or a completed duration > 0
      const hasMeaningfulContent = tb.reasoning || (tbDuration !== undefined && tbDuration > 0);
      if (!hasMeaningfulContent) return;
      items.push({
        kind: 'thinking' as const,
        id: tb.id,
        ts: tb.startedAt,
        seq: tb.seq ?? 0,
        label: tb.label,
        reasoning: tb.reasoning,
        duration: tbDuration,
        isActive: !tb.endedAt,
      });
    });

    // Sort by timestamp first, then by sequence number for stable ordering
    items.sort((a, b) => {
      const tsCompare = a.ts.localeCompare(b.ts);
      if (tsCompare !== 0) return tsCompare;
      return a.seq - b.seq;
    });
    return items;
  }, [state.messages, state.plan, state.planTimestamp, state.planSeq, state.versions, state.thinkingBlocks, state.createdAt]);

  const hasTimelineContent =
    timeline.length > 0 ||
    state.execution?.streamingText ||
    state.previewUrl ||
    state.preview?.videoUrl ||
    state.phase === 'question' ||
    state.phase === 'plan' ||
    state.phase === 'preview' ||
    state.phase === 'complete' ||
    state.phase === 'error';

  // ─── Auto scroll ────────────────────────────────────────────────────
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [timeline.length, state.execution?.streamingText, state.execution?.reasoning, state.phase]);

  // ─── Node styling ──────────────────────────────────────────────────
  const nodeClasses = useMemo(() => {
    const base = 'animation-node w-[400px] min-h-[520px] max-h-[720px] rounded-xl overflow-hidden flex flex-col';
    if (selected) return `${base} ring-1 ring-[var(--an-accent)]/70`;
    return base;
  }, [selected]);

  const videoHandleStart = engine !== 'theatre'
    ? IMAGE_HANDLE_START + imageRefCount * HANDLE_SPACING + VIDEO_HANDLE_START_OFFSET
    : 0;
  // SVG code handle sits after the video handle group
  const svgCodeHandleTop = engine !== 'theatre'
    ? videoHandleStart + videoRefCount * HANDLE_SPACING + 48
    : IMAGE_HANDLE_START + imageRefCount * HANDLE_SPACING + 48;
  // minHeight must accommodate: all handles + padding
  const lastVideoHandleBottom = svgCodeHandleTop + HANDLE_SPACING;
  const minHeight = Math.max(200, lastVideoHandleBottom);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className="relative"
    >
      {/* Node Title */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: 'var(--node-title-animation)' }}>
        <Clapperboard className="h-4 w-4" />
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
                setNodeName(data.name || 'Animation Generator');
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
            {data.name || 'Animation Generator'}
          </span>
        )}
      </div>

    <div
      ref={nodeContainerRef}
      className={`${nodeClasses}${isDragOver ? ' ring-1 ring-blue-500/50' : ''}`}
      style={{ minHeight }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files.length > 0) handleMediaUpload(e.dataTransfer.files);
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-[var(--an-border)]">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] leading-tight" style={{ color: headerConfig.statusColor }}>
            {headerConfig.statusText}
          </p>
        </div>
      </div>

      {/* ── Chat area (scrollable) ───────────────────────────────────── */}
      {hasTimelineContent && (
        <div
          ref={chatScrollRef}
          className="nowheel nopan nodrag cursor-text select-text flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          onWheel={(e) => { if (!e.ctrlKey) e.stopPropagation(); }}
        >
          <div className="px-3.5 py-2.5 space-y-2.5">
            {/* Timeline items - messages, plan, and videos in chronological order */}
            {timeline.map((item, idx) => {
              if (item.kind === 'user') {
                return <UserBubble key={item.id} content={item.content} media={item.media} />;
              }
              if (item.kind === 'assistant') {
                return <AssistantText key={item.id} content={item.content} />;
              }
              if (item.kind === 'plan' && state.plan) {
                return (
                  <PlanCard
                    key={item.id}
                    plan={state.plan}
                    accepted={!!state.planAccepted}
                    onAccept={handleAcceptPlan}
                    onReject={handleRejectPlan}
                  />
                );
              }
              if (item.kind === 'video') {
                // Check if this is the latest video (last video in the timeline)
                const isLatestVideo = timeline.filter(i => i.kind === 'video').pop()?.id === item.id;
                // Check if there are user messages after this video
                const videoIdx = idx;
                const hasMessageAfter = timeline.slice(videoIdx + 1).some(i => i.kind === 'user');
                // Expand if it's the latest video and no messages after it
                const shouldExpand = isLatestVideo && !hasMessageAfter;
                // Show accept/regenerate only on latest video in preview phase
                const isActivePreview = isLatestVideo && state.phase === 'preview' && !hasMessageAfter;

                return (
                  <VideoCard
                    key={item.id}
                    videoUrl={item.videoUrl}
                    duration={item.duration}
                    expanded={shouldExpand}
                    isActivePreview={isActivePreview}
                    onAccept={isActivePreview ? handleAcceptPreview : undefined}
                    onRegenerate={isActivePreview ? handleRegenerate : undefined}
                    semanticEditOptions={isActivePreview ? [...DEFAULT_SEMANTIC_MOTION_CHIPS] : undefined}
                    onSemanticEdit={isActivePreview ? handleSendMessage : undefined}
                  />
                );
              }
              if (item.kind === 'thinking') {
                return (
                  <ThinkingBlock
                    key={item.id}
                    thinking={item.label}
                    reasoning={item.reasoning}
                    isStreaming={!!item.isActive}
                    startedAt={item.ts}
                    endedAt={item.isActive ? undefined : (item.duration !== undefined ? new Date(new Date(item.ts).getTime() + item.duration * 1000).toISOString() : undefined)}
                  />
                );
              }
              return null;
            })}

            {/* Thinking shimmer — visible whenever streaming with no visible text output */}
            {(
              (isStreaming && !state.execution?.streamingText) ||
              (state.phase === 'executing' && state.execution?.thinking && !isStreaming && !state.execution?.streamingText && state.execution?.todos.length === 0)
            ) && (
              <div className="py-2">
                <span
                  className="text-[11px] font-medium text-[var(--an-text-muted)]"
                  style={{ animation: 'think-shimmer 2.5s ease-in-out infinite' }}
                >
                  {state.execution?.thinking || 'Working on it...'}
                </span>
              </div>
            )}

            {/* Guided motion intake (#93/#94) */}
            {state.phase === 'question' && guidedPrompt && (
              <div className="rounded-lg bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] p-2.5 space-y-2">
                <p className="text-[11px] font-medium text-[var(--an-text-muted)]">
                  Pick a motion direction
                </p>
                <p className="text-[10px] text-[var(--an-text-placeholder)]">
                  Your prompt is broad, so select intent chips and one variant (A/B/C).
                </p>

                {GUIDED_MOTION_GROUPS.map((group) => (
                  <div key={group.key} className="space-y-1">
                    <p className="text-[10px] text-[var(--an-text-dim)]">{group.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.options.map((option) => {
                        const selected = guidedChips[group.key] === option.id;
                        return (
                          <button
                            key={`${group.key}-${String(option.id)}`}
                            onClick={() => setGuidedChips((prev) => ({ ...prev, [group.key]: option.id } as MotionIntentChips))}
                            className={`px-2 py-1 rounded-md border text-[10px] transition-colors ${
                              selected
                                ? 'bg-[var(--an-accent-bg)] border-[var(--an-accent)] text-[var(--an-accent-text)]'
                                : 'bg-[var(--an-bg-card)] border-[var(--an-border-input)] text-[var(--an-text-dim)] hover:border-[var(--an-border-hover)]'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--an-text-dim)]">Motion variants</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {guidedVariantOptions.map((variant) => {
                      const selected = guidedVariant === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => setGuidedVariant(variant.id)}
                          className={`rounded-md border px-2 py-1 text-left transition-colors ${
                            selected
                              ? 'bg-[var(--an-accent-bg)] border-[var(--an-accent)]'
                              : 'bg-[var(--an-bg-card)] border-[var(--an-border-input)]'
                          }`}
                        >
                          <p className="text-[10px] font-medium text-[var(--an-text-muted)]">{variant.label}</p>
                          <p className="text-[9px] text-[var(--an-text-placeholder)]">{variant.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--an-text-dim)]">Optional follow-up</p>
                  <textarea
                    value={guidedFollowUp}
                    onChange={(e) => setGuidedFollowUp(e.target.value)}
                    rows={2}
                    placeholder="Example: slower intro, cleaner transitions, stronger camera push in scene 2"
                    className="w-full rounded-md border border-[var(--an-border-input)] bg-[var(--an-bg-card)] px-2 py-1.5 text-[10px] text-[var(--an-text)] outline-none focus:border-[var(--an-border-hover)] resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApplyGuidedMotion()}
                    className="flex-1 px-2.5 py-1.5 rounded-md bg-[var(--an-accent)] hover:bg-[var(--an-accent-hover)] text-white text-[11px] font-medium transition-colors"
                  >
                    Apply & Continue
                  </button>
                  <button
                    onClick={handleSkipGuidedMotion}
                    className="px-2.5 py-1.5 rounded-md border border-[var(--an-border-input)] bg-[var(--an-bg-card)] text-[10px] text-[var(--an-text-dim)] hover:border-[var(--an-border-hover)]"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* Multi-question form */}
            {state.phase === 'question' && state.formQuestion && (
              <QuestionForm
                content={state.formQuestion.content}
                fields={state.formQuestion.fields}
                onSubmit={handleFormSubmit}
              />
            )}

            {/* Single question options (backward compat) */}
            {state.phase === 'question' && state.question && !state.formQuestion && (
              <>
                <AssistantText content={state.question.text} />
                <QuestionOptions question={state.question} onSelect={handleSelectStyle} />
              </>
            )}

            {/* Complete output */}
            {state.phase === 'complete' && state.output && (
              <div className="rounded-lg overflow-hidden bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)]">
                <video
                  src={state.output.videoUrl}
                  controls
                  className="w-full"
                  style={{ maxHeight: '180px' }}
                />
                <div className="flex items-center justify-between p-2">
                  <span className="text-[10px] text-[#22C55E] font-medium">Animation complete</span>
                  <button
                    onClick={handleReset}
                    className="px-2.5 py-1 rounded-md bg-[var(--an-bg-card)] text-[var(--an-text-muted)] text-[10px] font-medium hover:bg-[var(--an-bg-hover)] transition-colors"
                  >
                    New Animation
                  </button>
                </div>
              </div>
            )}

            {/* Error display */}
            {state.phase === 'error' && state.error && (
              <div className="space-y-2">
                <div className="px-2.5 py-2 rounded-md bg-[var(--an-bg-error)] border border-[var(--an-border-error)]">
                  <p className="text-[11px] text-[#FCA5A5] font-medium">{state.error.message}</p>
                  {state.error.details && (
                    <p className="text-[10px] text-[var(--an-text-dim)] mt-1">{state.error.details}</p>
                  )}
                </div>
                {state.error.canRetry && <RetryButton onRetry={handleRetry} />}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sticky todo section ──────────────────────────────────────── */}
      {state.execution?.todos && state.execution.todos.length > 0 && (
        <div className="flex-shrink-0">
          <TodoSection todos={state.execution.todos} />
        </div>
      )}

      {/* ── Media strip (thumbnails of attached media) */}
      {media.length > 0 && (
        <div className="flex-shrink-0 px-3 py-1 border-t border-[var(--an-border)]">
          <div className="flex gap-1 overflow-x-auto scrollbar-hidden items-center">
            {media.map((m) => (
              <div key={m.id} className="relative group flex-shrink-0">
                <div className="w-8 h-8 rounded bg-[var(--an-bg-card)] overflow-hidden border border-[var(--an-border-input)]">
                  {m.type === 'image' ? (
                    <img src={m.dataUrl} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-3 h-3 text-purple-400" />
                    </div>
                  )}
                </div>
                {m.source === 'upload' && (
                  <button
                    onClick={() => handleRemoveMedia(m.id)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500/90 flex items-center justify-center opacity-90 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 transition-opacity"
                    title={`Remove ${m.name}`}
                    aria-label={`Remove ${m.name}`}
                  >
                    <X className="w-2 h-2 text-white" />
                  </button>
                )}
                {(m.source === 'edge' || (m.type === 'video' && m.duration)) && (
                  <span className="absolute bottom-0 left-0 right-0 text-[6px] text-center text-zinc-400 bg-black/60 truncate px-0.5">
                    {m.type === 'video' && m.duration ? `${m.duration.toFixed(1)}s` : ''}
                    {m.source === 'edge' ? '⚡' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer: pushes chat input to bottom when no timeline content */}
      {!hasTimelineContent && <div className="flex-1" />}

      {/* ── Chat input (always visible) ──────────────────────────────── */}
      <div className="shrink-0 nopan nodrag nowheel">
        <ChatInput
          onSubmit={handleInputSubmit}
          isGenerating={isStreaming}
          hasActiveTool={state.toolCalls.some((tc) => tc.status === 'running')}
          onStop={() => abortStream()}
          placeholder={inputPlaceholder}
          engine={engine}
          aspectRatio={aspectRatio}
          duration={duration}
          techniques={techniques}
          onOpenSettings={handleOpenSettings}
          onMediaUpload={handleMediaUpload}
          onNodeReference={handleNodeReference}
          availableNodeOutputs={availableNodeOutputs}
        />
      </div>

      {/* ── Settings Panel (portal) ──────────────────────────────────── */}
      {showSettings && (
        <AnimationSettingsPanel
          nodeId={id}
          position={settingsPosition}
          anchorRect={settingsAnchorRect ?? undefined}
          onClose={() => setShowSettings(false)}
          engine={engine}
          aspectRatio={aspectRatio}
          duration={duration}
          techniques={techniques}
          designSpec={data.designSpec}
          motionSpec={data.motionSpec}
          motionPresets={data.motionPresets}
          selectedMotionPresetId={data.selectedMotionPresetId}
          logo={data.logo}
          fps={data.fps}
          resolution={data.resolution}
          engineLocked={state.messages.length > 0}
          onEngineChange={handleEngineChange}
          onAspectRatioChange={handleAspectRatioChange}
          onDurationChange={handleDurationChange}
          onTechniquesChange={handleTechniquesChange}
          onDesignSpecChange={handleDesignSpecChange}
          onMotionSpecChange={handleMotionSpecChange}
          onSaveMotionPreset={handleSaveMotionPreset}
          onApplyMotionPreset={handleApplyMotionPreset}
          onDeleteMotionPreset={handleDeleteMotionPreset}
          onLogoChange={handleLogoChange}
          onFpsChange={handleFpsChange}
          onResolutionChange={handleResolutionChange}
        />
      )}
    </div>

      {/* ── Handles (outside overflow-hidden card so pointer events aren't clipped) ── */}

      {/* Left: Image reference handles */}
      {Array.from({ length: imageRefCount }).map((_, i) => {
        const top = IMAGE_HANDLE_START + i * HANDLE_SPACING;
        return (
          <div key={`img-ref-${i}`} className="absolute -left-3 z-20" style={{ top }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id={`image-ref-${i}`}
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
              />
              <Image className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-white" />
            </div>
          </div>
        );
      })}

      {/* Left: Video reference handles (hidden for Theatre.js) */}
      {engine !== 'theatre' && Array.from({ length: videoRefCount }).map((_, i) => {
        const top = videoHandleStart + i * HANDLE_SPACING;
        return (
          <div key={`vid-ref-${i}`} className="absolute -left-3 z-20" style={{ top }}>
            <div className="relative">
              <Handle
                type="target"
                position={Position.Left}
                id={`video-ref-${i}`}
                className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
              />
              <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-white" />
            </div>
          </div>
        );
      })}

      {/* Left: SVG code handle */}
      <div className="absolute -left-3 z-20" style={{ top: svgCodeHandleTop }}>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            id="svg-code"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Code className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-white" />
        </div>
      </div>

      {/* Right: Output handle (video) */}
      <div className="absolute -right-3 z-20" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Right}
            id="video"
            className="!relative !transform-none !w-7 !h-7 !border-2 !rounded-full node-handle"
          />
          <Video className="absolute inset-0 m-auto h-3.5 w-3.5 pointer-events-none text-white" />
        </div>
      </div>

    </div>
  );
}

export const AnimationNode = memo(AnimationNodeComponent);
