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
import { Clapperboard, Plus, Minus, Image, Video, Upload, X } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';

// Chat components
import { ChatInput } from './components';
import {
  UserBubble,
  AssistantText,
  PlanCard,
  QuestionOptions,
  RetryButton,
  TodoSection,
  VideoCard,
} from './components/ChatMessages';

// Hooks
import { useAnimationStream } from './hooks/useAnimationStream';
import type { AnimationStreamCallbacks } from './hooks/useAnimationStream';

// Types
import type {
  AnimationNodeData,
  AnimationNodeState,
  AnimationAttachment,
  AnimationPlan,
  AnimationMessage,
  AnimationVersion,
  AnimationEngine,
  AspectRatio,
  ToolCallItem,
  ThinkingBlockItem,
  MediaEntry,
} from './types';

// ─── Constants ──────────────────────────────────────────────────────────
const MAX_IMAGE_REFS = 8;
const MAX_VIDEO_REFS = 4;
const HANDLE_SPACING = 32;
const IMAGE_HANDLE_START = 70;
const VIDEO_HANDLE_START_OFFSET = 20;

/** Tool names that should appear as cards in the chat timeline */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  generate_code: 'Building animation',
  sandbox_write_file: 'Saving changes',
  sandbox_read_file: 'Checking file',
  sandbox_run_command: 'Processing',
  sandbox_list_files: 'Checking files',
  sandbox_start_preview: 'Preparing preview',
  sandbox_screenshot: 'Capturing frame',
  sandbox_create: 'Setting up workspace',
  sandbox_destroy: 'Cleaning up',
  render_preview: 'Creating preview video',
  render_final: 'Rendering final video',
  generate_plan: 'Planning animation',
};

/** UI tools that update state silently — not shown in the timeline */
const UI_TOOLS = new Set(['update_todo', 'set_thinking', 'add_message', 'request_approval', 'analyze_prompt']);

// ─── Timeline item union ────────────────────────────────────────────────
// Simplified: only user messages, assistant messages, plan cards, and videos
// Tool calls and thinking blocks are hidden for cleaner UX
type TimelineItem =
  | { kind: 'user'; id: string; content: string; ts: string; seq: number }
  | { kind: 'assistant'; id: string; content: string; ts: string; seq: number }
  | { kind: 'plan'; id: string; ts: string; seq: number }
  | { kind: 'video'; id: string; ts: string; seq: number; videoUrl: string; duration: number };

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
  const updateNodeInternals = useUpdateNodeInternals();
  const [isHovered, setIsHovered] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // ─── Data accessors ─────────────────────────────────────────────────
  const imageRefCount = data.imageRefCount || 1;
  const videoRefCount = data.videoRefCount || 1;
  const attachments = data.attachments || [];
  const media: MediaEntry[] = data.media || [];
  const engine: AnimationEngine = data.engine || 'remotion';
  const aspectRatio: AspectRatio = data.aspectRatio || '16:9';

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, imageRefCount, videoRefCount, updateNodeInternals]);

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
      if (node.type === 'imageGenerator' || node.type === 'media') {
        const d = node.data as Record<string, unknown>;
        const url = (d.outputUrl as string) || (d.imageUrl as string);
        if (url) outputs.push({ nodeId: node.id, name: (d.name as string) || 'Image', type: 'image', url });
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
      // Revoke blob URLs for removed media
      edgeMedia.filter((m) => removedIds.includes(m.edgeId!) && m.dataUrl.startsWith('blob:')).forEach((m) => {
        try { URL.revokeObjectURL(m.dataUrl); } catch { /* ignore */ }
      });
      changed = true;
    }

    // Add media for new edges
    for (const edge of incomingEdges) {
      if (currentEdgeIds.has(edge.id)) continue; // Already tracked

      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;

      const d = sourceNode.data as Record<string, unknown>;
      let mediaUrl: string | undefined;
      let mediaType: 'image' | 'video' = 'image';
      let mediaName = (d.name as string) || sourceNode.type || 'Media';

      if (sourceNode.type === 'imageGenerator' || sourceNode.type === 'media') {
        mediaUrl = (d.outputUrl as string) || (d.imageUrl as string);
        mediaType = 'image';
      } else if (sourceNode.type === 'videoGenerator') {
        mediaUrl = d.outputUrl as string;
        mediaType = 'video';
        mediaName = (d.name as string) || 'Video';
      }

      if (mediaUrl) {
        updatedEdgeMedia.push({
          id: `edge_${edge.id}`,
          source: 'edge',
          edgeId: edge.id,
          sourceNodeId: edge.source,
          name: mediaName,
          type: mediaType,
          dataUrl: mediaUrl,
        });
        changed = true;
      }
    }

    // Check for updated source node outputs (re-generated images/videos)
    for (const entry of updatedEdgeMedia) {
      const sourceNode = nodes.find((n) => n.id === entry.sourceNodeId);
      if (!sourceNode) continue;
      const d = sourceNode.data as Record<string, unknown>;
      const currentUrl = (d.outputUrl as string) || (d.imageUrl as string) || '';
      if (currentUrl && currentUrl !== entry.dataUrl) {
        entry.dataUrl = currentUrl;
        changed = true;
      }
    }

    if (changed) {
      updateNodeData(id, { media: [...uploadMedia, ...updatedEdgeMedia] });
    }
  }, [id, incomingEdges, nodes, data.media, updateNodeData]);

  // ─── Media upload handler ─────────────────────────────────────────
  const handleMediaUpload = useCallback(
    (files: FileList) => {
      const currentMedia = data.media || [];
      const newEntries: MediaEntry[] = [];

      Array.from(files).forEach((file) => {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (!isVideo && !isImage) return;

        // For videos, we validate duration client-side after creating the blob
        const blobUrl = URL.createObjectURL(file);
        const entry: MediaEntry = {
          id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          source: 'upload',
          name: file.name,
          type: isVideo ? 'video' : 'image',
          dataUrl: blobUrl,
          mimeType: file.type,
        };

        if (isVideo) {
          // Validate video duration (max 10s) via hidden <video> element
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            URL.revokeObjectURL(video.src);
            if (video.duration > 10) {
              URL.revokeObjectURL(blobUrl);
              // Could use toast here but keeping it simple
              console.warn(`[AnimationNode] Video "${file.name}" is ${video.duration.toFixed(1)}s — max 10s allowed`);
              return;
            }
            entry.duration = video.duration;
            updateNodeData(id, { media: [...(data.media || []), entry] });
          };
          video.src = blobUrl;
        } else {
          newEntries.push(entry);
        }
      });

      if (newEntries.length > 0) {
        updateNodeData(id, { media: [...currentMedia, ...newEntries] });
      }
    },
    [id, data.media, updateNodeData]
  );

  const handleRemoveMedia = useCallback(
    (mediaId: string) => {
      const currentMedia = data.media || [];
      const entry = currentMedia.find((m) => m.id === mediaId);
      if (entry?.dataUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(entry.dataUrl); } catch { /* ignore */ }
      }
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
        if (textFlushTimerRef.current) {
          clearTimeout(textFlushTimerRef.current);
          textFlushTimerRef.current = null;
        }
        const ls = getLatestState();
        const trimmed = fullText.trim();
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

        updateNodeData(id, {
          state: {
            ...ls,
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
            updatedTodos = updatedTodos.filter((t) => t.id !== todoId);
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
            console.log(`[AnimationNode] Code generated: ${result.files.length} files written to sandbox`);
            autoMarkTodo('setup', 'done');
          }
        }

        if (event.toolName === 'sandbox_start_preview') {
          const result = event.result as { success?: boolean; previewUrl?: string; message?: string };
          if (result.success === false || event.isError) {
            // Log technical details, show friendly message
            console.error(`[AnimationNode] Preview failed:`, result.message);
            addUserMessage('Preview is taking longer than expected. Retrying...');
          } else if (result.previewUrl) {
            // Append cache-busting timestamp so the iframe actually reloads
            // (same URL string = React skips re-render = browser shows stale/broken content)
            const bustUrl = `${result.previewUrl}?t=${Date.now()}`;
            const now = new Date().toISOString();
            updateNodeData(id, {
              state: { ...ls, previewUrl: bustUrl, previewUrlTimestamp: now, previewState: 'active', updatedAt: now },
            });
            ls = { ...ls, previewUrl: bustUrl, previewUrlTimestamp: now, previewState: 'active' };
            // Mark post-processing done (preview means we're past it)
            autoMarkTodo('postprocess', 'done');
            autoMarkTodo('render', 'active');
          }
        }

        if (event.toolName === 'render_preview' || event.toolName === 'render_final') {
          console.log(`[AnimationNode] Render tool result:`, JSON.stringify(event.result, null, 2));
          const result = event.result as { success?: boolean; videoUrl?: string; duration?: number; message?: string };
          if (result.success === false || event.isError) {
            // Log technical details, show friendly message
            console.error(`[AnimationNode] Render failed:`, result.message);
            addUserMessage('Video rendering encountered an issue. Retrying...');
          } else if (result.videoUrl && result.videoUrl.length > 0) {
            console.log(`[AnimationNode] Creating video version with URL:`, result.videoUrl);
            // Add cache-busting timestamp to prevent browser from serving stale video
            const separator = result.videoUrl.includes('?') ? '&' : '?';
            const sandboxVideoUrl = `${result.videoUrl}${separator}t=${Date.now()}`;
            const duration = result.duration || ls.plan?.totalDuration || 7;

            // Immediately show the sandbox video URL (for instant feedback)
            const tempVersion: AnimationVersion = {
              id: `v${Date.now()}`,
              videoUrl: sandboxVideoUrl,
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
              preview: { videoUrl: sandboxVideoUrl, duration },
              previewTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            console.log(`[AnimationNode] Updating state with video version:`, {
              versionCount: newState.versions.length,
              activeVersionId: newState.activeVersionId,
              phase: newState.phase,
              videoUrl: sandboxVideoUrl.slice(0, 50) + '...',
            });
            updateNodeData(id, { state: newState });
            // Force update ls reference for subsequent handlers
            ls = newState;
            autoMarkTodo('render', 'done');

            // Persist video to storage in background (async)
            // This replaces the temp sandbox URL with a permanent storage URL
            if (ls.sandboxId) {
              // Extract the file path from the sandbox URL
              // Format: /api/plugins/animation/sandbox/{id}/file?path=output/preview.mp4
              const pathMatch = sandboxVideoUrl.match(/[?&]path=([^&]+)/);
              const filePath = pathMatch ? decodeURIComponent(pathMatch[1]) : 'output/preview.mp4';
              const versionId = tempVersion.id; // Capture for async callback

              console.log(`[AnimationNode] Saving video to permanent storage...`, { sandboxId: ls.sandboxId, filePath, versionId });

              fetch('/api/plugins/animation/save-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sandboxId: ls.sandboxId,
                  filePath,
                  nodeId: id,
                  prompt: data.prompt,
                  duration,
                }),
              })
                .then((res) => {
                  if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                  }
                  return res.json();
                })
                .then((saved) => {
                  console.log(`[AnimationNode] save-video response:`, saved);
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
                    console.log(`[AnimationNode] Video URL updated to permanent storage: ${saved.videoUrl}`);
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
          }
        }

        if (event.toolName === 'generate_plan' && !event.isError) {
          const result = event.result as { plan?: AnimationPlan };
          if (result.plan) {
            updateNodeData(id, {
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

  // ─── Handle count management ────────────────────────────────────────
  const handleAddImageRef = useCallback(() => {
    if (imageRefCount < MAX_IMAGE_REFS) updateNodeData(id, { imageRefCount: imageRefCount + 1 });
  }, [id, imageRefCount, updateNodeData]);

  const handleRemoveImageRef = useCallback(() => {
    if (imageRefCount > 1) updateNodeData(id, { imageRefCount: imageRefCount - 1 });
  }, [id, imageRefCount, updateNodeData]);

  const handleAddVideoRef = useCallback(() => {
    if (videoRefCount < MAX_VIDEO_REFS) updateNodeData(id, { videoRefCount: videoRefCount + 1 });
  }, [id, videoRefCount, updateNodeData]);

  const handleRemoveVideoRef = useCallback(() => {
    if (videoRefCount > 1) updateNodeData(id, { videoRefCount: videoRefCount - 1 });
  }, [id, videoRefCount, updateNodeData]);

  const handleAttachmentsChange = useCallback(
    (newAttachments: AnimationAttachment[]) => updateNodeData(id, { attachments: newAttachments }),
    [id, updateNodeData]
  );

  const handleAspectRatioChange = useCallback(
    (newAspectRatio: AspectRatio) => updateNodeData(id, { aspectRatio: newAspectRatio }),
    [id, updateNodeData]
  );

  const handleEngineChange = useCallback(
    (newEngine: AnimationEngine) => updateNodeData(id, { engine: newEngine }),
    [id, updateNodeData]
  );

  // ─── Stream lifecycle ───────────────────────────────────────────────
  const resetStreamingRefs = useCallback(() => {
    streamingTextRef.current = '';
    reasoningTextRef.current = '';
    if (textFlushTimerRef.current) {
      clearTimeout(textFlushTimerRef.current);
      textFlushTimerRef.current = null;
    }
  }, []);

  // ─── Phase handlers ─────────────────────────────────────────────────

  const handleAnalyzePrompt = useCallback(
    async (prompt: string, promptAttachments?: AnimationAttachment[]) => {
      const ls = getLatestState();
      const userMsg = { id: `msg_${Date.now()}`, role: 'user' as const, content: prompt, timestamp: new Date().toISOString(), seq: getNextSeq() };
      const thinkingBlock: ThinkingBlockItem = {
        id: `tb_${Date.now()}`,
        label: 'Analyzing your prompt...',
        startedAt: new Date().toISOString(),
        seq: getNextSeq(),
      };

      updateNodeData(id, {
        prompt,
        attachments: promptAttachments || attachments,
        state: {
          ...ls,
          phase: 'executing',
          messages: [...ls.messages, userMsg],
          thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
          execution: { todos: [], thinking: 'Analyzing your prompt...', files: [] },
          updatedAt: new Date().toISOString(),
        },
      });

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          `Analyze this animation request and either ask a clarifying question (if style is unclear) or generate a plan directly:\n\n${prompt}`,
          { nodeId: id, phase: 'idle', attachments: promptAttachments || attachments, media, engine, aspectRatio },
          callbacks
        );
        // Fallback if agent didn't use tools
        const latest = getLatestState();
        if (latest.phase === 'executing') {
          updateNodeData(id, {
            state: {
              ...latest,
              phase: 'plan',
              plan: {
                scenes: [
                  { number: 1, title: 'Intro', duration: 2, description: 'Opening animation' },
                  { number: 2, title: 'Main', duration: 3, description: prompt.slice(0, 100) },
                  { number: 3, title: 'Outro', duration: 2, description: 'Closing animation' },
                ],
                totalDuration: 7,
                style: 'smooth',
                fps: 60,
              },
              planTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
        }
      } catch {
        // Error handled by onError callback
      }
    },
    [id, attachments, engine, aspectRatio, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]
  );

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

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          `Generate an animation plan for this request with style "${selectedStyle}":\n\n${data.prompt || 'Animation request'}`,
          { nodeId: id, phase: 'question', engine, aspectRatio },
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
                fps: 60,
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
    [id, data.prompt, engine, aspectRatio, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]
  );

  const handleAcceptPlan = useCallback(async () => {
    const ls = getLatestState();
    if (!ls.plan) return;

    const todos = [
      { id: 'setup', label: 'Set up Theatre.js project', status: 'pending' as const },
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
      label: 'Initializing animation sandbox...',
      startedAt: new Date().toISOString(),
      seq: getNextSeq(),
    };

    updateNodeData(id, {
      state: {
        ...ls,
        phase: 'executing',
        planAccepted: true,
        thinkingBlocks: [...ls.thinkingBlocks, thinkingBlock],
        execution: { todos, thinking: 'Initializing animation sandbox...', files: [] },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    try {
      const todoList = todos.map((t) => `  - [${t.status}] ${t.id}: ${t.label}`).join('\n');
      await streamToAgent(
        [
          'The user has approved the animation plan. Execute it step by step.',
          '',
          'IMPORTANT — keep the todo list accurate at all times:',
          `  call update_todo({ action: "update", todoId: "<id>", status: "active" }) BEFORE starting each task`,
          `  call update_todo({ action: "update", todoId: "<id>", status: "done" })   AFTER completing each task`,
          `  If you discover extra work, call update_todo({ action: "add", todoId, label }) to add it.`,
          `  If a task becomes irrelevant, call update_todo({ action: "remove", todoId }) to clean it up.`,
          '',
          'Current todos:',
          todoList,
          '',
          'Use set_thinking to explain what you are doing.',
          'Write all code files using sandbox_write_file.',
          'After all scenes are done, call render_preview to generate the video.',
          '',
          `Prompt: ${data.prompt || 'Animation request'}`,
        ].join('\n'),
        { nodeId: id, phase: 'executing', plan: ls.plan, todos, sandboxId: ls.sandboxId, media, engine, aspectRatio },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, data.prompt, engine, media, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]);

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

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          `The user wants to revise the animation plan. Feedback: "${feedback}"\n\nGenerate an updated plan using the generate_plan tool.`,
          { nodeId: id, phase: 'plan', plan: ls.plan, sandboxId: ls.sandboxId, engine, aspectRatio },
          callbacks
        );
        const latest = getLatestState();
        if (latest.execution && latest.phase !== 'plan') {
          updateNodeData(id, {
            state: { ...latest, phase: 'plan', execution: undefined, updatedAt: new Date().toISOString() },
          });
        }
      } catch {
        // Error handled by callback
      }
    },
    [id, engine, aspectRatio, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      const ls = getLatestState();
      const userMsg = { id: `msg_${Date.now()}`, role: 'user' as const, content, timestamp: new Date().toISOString(), seq: getNextSeq() };
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

      // If plan was accepted but we're back in plan phase (failed execution), transition to executing
      if (ls.planAccepted && ls.phase === 'plan') {
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

      updateNodeData(id, { state: { ...ls, ...stateUpdate } });

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      // Build a contextual prompt so the agent understands the situation
      let prompt = content;
      if (ls.planAccepted && (ls.phase === 'plan' || ls.phase === 'executing')) {
        // User is giving feedback after execution — emphasize retry, not replan
        prompt = [
          content,
          '',
          'IMPORTANT: The plan has already been approved. Do NOT re-generate the plan.',
          'Instead, investigate what went wrong with the previous execution,',
          'fix the issue (check vite logs, file contents, etc.), and retry.',
          ls.sandboxId ? `Active sandbox: ${ls.sandboxId}` : 'No sandbox — create one first with sandbox_create.',
        ].join('\n');
      }

      try {
        await streamToAgent(prompt, {
          nodeId: id,
          phase: ls.phase,
          plan: ls.plan,
          todos: ls.execution?.todos,
          sandboxId: ls.sandboxId,
          media,
          engine,
          aspectRatio,
        }, callbacks);
      } catch {
        // Error handled by callback
      }
    },
    [id, engine, aspectRatio, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]
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

    const todos = [
      { id: 'setup', label: 'Set up Theatre.js project', status: 'pending' as const },
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

    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    try {
      await streamToAgent(
        `Regenerate the animation from the plan. Execute all steps again.\n\nPrompt: ${data.prompt || 'Animation request'}`,
        { nodeId: id, phase: 'executing', plan: ls.plan, todos, sandboxId: ls.sandboxId, media, engine, aspectRatio },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, data.prompt, engine, media, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]);

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

    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    try {
      await streamToAgent(
        [
          'The user clicked Export. Render the final video now.',
          '',
          'Use render_preview to create the video.',
          `Active sandbox: ${ls.sandboxId}`,
        ].join('\n'),
        { nodeId: id, phase: 'executing', plan: ls.plan, sandboxId: ls.sandboxId, engine, aspectRatio },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, engine, aspectRatio, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]);

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
    updateNodeData(id, { prompt: '', attachments: [], state: createDefaultState(id) });
  }, [id, updateNodeData, abortStream]);

  // ─── Input routing ──────────────────────────────────────────────────
  const handleInputSubmit = useCallback(
    (message: string, msgAttachments?: AnimationAttachment[]) => {
      switch (state.phase) {
        case 'idle':
        case 'error':
          handleAnalyzePrompt(message, msgAttachments);
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
          handleAnalyzePrompt(message, msgAttachments);
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
        return 'Or type your own answer...';
      case 'error':
        return 'Describe what you\'d like to try...';
      case 'preview':
        return 'Request changes...';
      case 'complete':
        return 'Start a new animation...';
      default:
        return 'Describe the animation you want...';
    }
  }, [state.phase, state.planAccepted]);

  // ─── Header config ──────────────────────────────────────────────────
  const headerConfig = useMemo(() => {
    switch (state.phase) {
      case 'idle':
        return { iconColor: '#3B82F6', statusColor: '#52525B', statusText: 'Idle', iconBg: '#1E3A5F' };
      case 'question':
        return { iconColor: '#FBBF24', statusColor: '#FBBF24', statusText: 'Question', iconBg: '#422006' };
      case 'plan':
        return { iconColor: '#3B82F6', statusColor: '#52525B', statusText: 'Idle', iconBg: '#1E3A5F' };
      case 'executing':
        return { iconColor: '#3B82F6', statusColor: '#3B82F6', statusText: 'Generating', iconBg: '#1E3A5F' };
      case 'preview':
        return { iconColor: '#3B82F6', statusColor: '#3B82F6', statusText: 'Generating', iconBg: '#1E3A5F' };
      case 'complete':
        return { iconColor: '#22C55E', statusColor: '#22C55E', statusText: 'Complete', iconBg: '#14532D' };
      case 'error':
        return { iconColor: '#EF4444', statusColor: '#EF4444', statusText: 'Error', iconBg: '#3B1111' };
      default:
        return { iconColor: '#3B82F6', statusColor: '#52525B', statusText: 'Idle', iconBg: '#1E3A5F' };
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
        });
      }
    });

    // Include plan card in timeline if it has a timestamp
    if (state.plan && state.planTimestamp) {
      items.push({ kind: 'plan', id: 'plan', ts: state.planTimestamp, seq: state.planSeq ?? 0 });
    }

    // Include video versions in timeline - each version appears where it was created
    if (state.versions && state.versions.length > 0) {
      console.log(`[AnimationNode] Timeline: Adding ${state.versions.length} video(s) to timeline`);
      state.versions.forEach((version, idx) => {
        console.log(`[AnimationNode] Timeline video ${idx}:`, { id: version.id, url: version.videoUrl?.slice(0, 50) });
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
      console.log(`[AnimationNode] Timeline: No videos in state.versions`);
    }

    // Sort by timestamp first, then by sequence number for stable ordering
    items.sort((a, b) => {
      const tsCompare = a.ts.localeCompare(b.ts);
      if (tsCompare !== 0) return tsCompare;
      return a.seq - b.seq;
    });
    return items;
  }, [state.messages, state.plan, state.planTimestamp, state.planSeq, state.versions, state.createdAt]);

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
    const base = 'w-[340px] min-h-[450px] max-h-[600px] rounded-xl bg-[#18181b] overflow-hidden flex flex-col border border-[#27272a]';
    if (selected) return `${base} ring-1 ring-[#3B82F6]/70`;
    return base;
  }, [selected]);

  const videoHandleStart = IMAGE_HANDLE_START + imageRefCount * HANDLE_SPACING + VIDEO_HANDLE_START_OFFSET;
  const totalHandles = imageRefCount + videoRefCount;
  const minHeight = Math.max(200, IMAGE_HANDLE_START + totalHandles * HANDLE_SPACING + 60);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className={`${nodeClasses}${isDragOver ? ' ring-1 ring-teal-500/50' : ''}`}
      style={{ minHeight }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
      {/* Hidden file input for media uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleMediaUpload(e.target.files);
            e.target.value = ''; // Reset so same file can be re-selected
          }
        }}
      />
      {/* ── Left: Image reference handles ─────────────────────────────── */}
      {Array.from({ length: imageRefCount }).map((_, i) => {
        const top = IMAGE_HANDLE_START + i * HANDLE_SPACING;
        return (
          <div key={`img-ref-${i}`} className="absolute -left-3 group" style={{ top }}>
            <Handle
              type="target"
              position={Position.Left}
              id={`image-ref-${i}`}
              className="!w-3 !h-3 !bg-teal-500 !border-2 !border-teal-400 relative !left-0"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Image className="h-3 w-3 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {imageRefCount > 1 ? `Image ${i + 1}` : 'Image'}
              </span>
            </div>
          </div>
        );
      })}

      {/* Image handle add/remove */}
      {(selected || isHovered) && (
        <div
          className="absolute -left-3 flex flex-col gap-0.5 transition-opacity duration-200"
          style={{ top: IMAGE_HANDLE_START + imageRefCount * HANDLE_SPACING + 4 }}
        >
          {imageRefCount < MAX_IMAGE_REFS && (
            <button
              onClick={handleAddImageRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-teal-500 hover:text-teal-400 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          {imageRefCount > 1 && (
            <button
              onClick={handleRemoveImageRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-red-500 hover:text-red-400 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* ── Left: Video reference handles ─────────────────────────────── */}
      {Array.from({ length: videoRefCount }).map((_, i) => {
        const top = videoHandleStart + i * HANDLE_SPACING;
        return (
          <div key={`vid-ref-${i}`} className="absolute -left-3 group" style={{ top }}>
            <Handle
              type="target"
              position={Position.Left}
              id={`video-ref-${i}`}
              className="!w-3 !h-3 !bg-purple-500 !border-2 !border-purple-400 relative !left-0"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Video className="h-3 w-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {videoRefCount > 1 ? `Video ${i + 1}` : 'Video'}
              </span>
            </div>
          </div>
        );
      })}

      {/* Video handle add/remove */}
      {(selected || isHovered) && (
        <div
          className="absolute -left-3 flex flex-col gap-0.5 transition-opacity duration-200"
          style={{ top: videoHandleStart + videoRefCount * HANDLE_SPACING + 4 }}
        >
          {videoRefCount < MAX_VIDEO_REFS && (
            <button
              onClick={handleAddVideoRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-purple-500 hover:text-purple-400 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          {videoRefCount > 1 && (
            <button
              onClick={handleRemoveVideoRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-red-500 hover:text-red-400 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 border-b border-[#27272a]">
        <div
          className="h-7 w-7 rounded-[7px] flex items-center justify-center"
          style={{ backgroundColor: headerConfig.iconBg }}
        >
          <Clapperboard className="h-3.5 w-3.5" style={{ color: headerConfig.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-[#FAFAFA] leading-tight truncate">
            {data.name || 'Animation Generator'}
          </h3>
          <p className="text-[10px] leading-tight" style={{ color: headerConfig.statusColor }}>
            {headerConfig.statusText}
            {isStreaming && state.phase === 'executing' ? ' (streaming)' : ''}
          </p>
        </div>
      </div>

      {/* ── Chat area (scrollable) ───────────────────────────────────── */}
      {hasTimelineContent && (
        <div
          ref={chatScrollRef}
          className="nowheel flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          onWheel={(e) => { if (!e.ctrlKey) e.stopPropagation(); }}
        >
          <div className="px-3.5 py-2.5 space-y-2.5">
            {/* Timeline items - messages, plan, and videos in chronological order */}
            {timeline.map((item, idx) => {
              if (item.kind === 'user') {
                return <UserBubble key={item.id} content={item.content} />;
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
                  />
                );
              }
              return null;
            })}

            {/* Simple progress indicator during execution */}
            {state.phase === 'executing' && isStreaming && (
              <div className="flex items-center gap-2 py-2">
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <span className="absolute w-3 h-3 rounded-full bg-[#3B82F6] animate-ping opacity-30" />
                  <span className="absolute w-2 h-2 rounded-full bg-[#3B82F6]" />
                </div>
                <span className="text-[11px] text-[#71717A]">
                  {state.execution?.thinking || 'Creating your video...'}
                </span>
              </div>
            )}

            {/* Question options */}
            {state.phase === 'question' && state.question && (
              <>
                <AssistantText content={state.question.text} />
                <QuestionOptions question={state.question} onSelect={handleSelectStyle} />
              </>
            )}

            {/* Complete output */}
            {state.phase === 'complete' && state.output && (
              <div className="rounded-lg overflow-hidden bg-[#14161A] border border-[#3f3f46]">
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
                    className="px-2.5 py-1 rounded-md bg-[#27272a] text-[#A1A1AA] text-[10px] font-medium hover:bg-[#3f3f46] transition-colors"
                  >
                    New Animation
                  </button>
                </div>
              </div>
            )}

            {/* Error display */}
            {state.phase === 'error' && state.error && (
              <div className="space-y-2">
                <div className="px-2.5 py-2 rounded-md bg-[#1C1011] border border-[#7F1D1D]">
                  <p className="text-[11px] text-[#FCA5A5] font-medium">{state.error.message}</p>
                  {state.error.details && (
                    <p className="text-[10px] text-[#71717A] mt-1">{state.error.details}</p>
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

      {/* ── Media strip (thumbnails of attached media + upload button) */}
      {(media.length > 0 || state.phase === 'idle') && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-[#27272a]">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden items-center">
            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-10 h-10 rounded border border-dashed border-[#3f3f46] flex items-center justify-center text-zinc-500 hover:border-teal-500/50 hover:text-teal-400 transition-colors"
              title="Upload image or video"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            {media.map((m) => (
              <div key={m.id} className="relative group flex-shrink-0">
                <div className="w-10 h-10 rounded bg-[#27272a] overflow-hidden border border-[#3f3f46]">
                  {m.type === 'image' ? (
                    <img src={m.dataUrl} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-4 h-4 text-purple-400" />
                    </div>
                  )}
                </div>
                {m.source === 'upload' && (
                  <button
                    onClick={() => handleRemoveMedia(m.id)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2 h-2 text-white" />
                  </button>
                )}
                <span className="absolute bottom-0 left-0 right-0 text-[7px] text-center text-zinc-400 bg-black/60 truncate px-0.5">
                  {m.type === 'video' && m.duration ? `${m.duration.toFixed(1)}s` : ''}
                  {m.source === 'edge' ? '⚡' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat input (always visible) ──────────────────────────────── */}
      <div className="shrink-0">
        <ChatInput
          onSubmit={handleInputSubmit}
          isGenerating={isStreaming}
          hasActiveTool={state.toolCalls.some((tc) => tc.status === 'running')}
          onStop={() => abortStream()}
          placeholder={inputPlaceholder}
          engine={engine}
          onEngineChange={handleEngineChange}
          aspectRatio={aspectRatio}
          onAspectRatioChange={handleAspectRatioChange}
          attachments={state.phase === 'idle' || state.phase === 'error' ? attachments : undefined}
          onAttachmentsChange={state.phase === 'idle' || state.phase === 'error' ? handleAttachmentsChange : undefined}
          availableNodeOutputs={state.phase === 'idle' || state.phase === 'error' ? availableNodeOutputs : undefined}
        />
      </div>

      {/* ── Right: Output handles ────────────────────────────────────── */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-purple-400"
        style={{ top: '30px' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="thumbnail"
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-teal-400"
        style={{ top: '60px' }}
      />
    </div>
  );
}

export const AnimationNode = memo(AnimationNodeComponent);
