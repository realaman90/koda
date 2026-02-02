'use client';

/**
 * AnimationNode Component
 *
 * Main canvas node component for the Animation Generator plugin.
 * Uses real agent streaming — tool-call events from the stream are
 * bridged to Zustand state updates in real time.
 */

import { memo, useCallback, useMemo, useEffect, useState, useRef } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Clapperboard, Plus, Minus, Image, Video } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';

// Phase components
import {
  QuestionPhase,
  PlanPhase,
  ExecutingPhase,
  PreviewPhase,
  CompletePhase,
  ErrorPhase,
} from './phases';

// Components
import { ChatInput } from './components';

// Hooks
import { useAnimationStream } from './hooks/useAnimationStream';
import type { AnimationStreamCallbacks } from './hooks/useAnimationStream';

// Types
import type { AnimationNodeData, AnimationNodeState, AnimationAttachment, AnimationPlan } from './types';

// Constants
const MAX_IMAGE_REFS = 8;
const MAX_VIDEO_REFS = 4;
const HANDLE_SPACING = 32;
const IMAGE_HANDLE_START = 70;
const VIDEO_HANDLE_START_OFFSET = 20;

// Default state factory
const createDefaultState = (nodeId: string): AnimationNodeState => ({
  nodeId,
  phase: 'idle',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export type AnimationNodeType = Node<AnimationNodeData, 'pluginNode'>;

interface AnimationNodeProps extends NodeProps<AnimationNodeType> {}

/**
 * AnimationNode - Main component
 */
function AnimationNodeComponent({ id, data, selected }: AnimationNodeProps) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const nodes = useCanvasStore((state) => state.nodes);
  const updateNodeInternals = useUpdateNodeInternals();
  const [isHovered, setIsHovered] = useState(false);

  // Streaming hook
  const { isStreaming, stream: streamToAgent, abort: abortStream } = useAnimationStream();

  // Abort controller ref for cleanup
  const abortRef = useRef(abortStream);
  abortRef.current = abortStream;

  // Track sandboxId ref for cleanup (avoids stale closure in unmount effect)
  const sandboxIdRef = useRef<string | undefined>(undefined);

  // Refs for batching text-delta and reasoning-delta updates (avoids excessive re-renders)
  const streamingTextRef = useRef('');
  const reasoningTextRef = useRef('');
  const textFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount — abort stream, clear timers, and destroy sandbox
  useEffect(() => {
    return () => {
      abortRef.current();
      if (textFlushTimerRef.current) {
        clearTimeout(textFlushTimerRef.current);
      }
      // Best-effort sandbox cleanup on unmount
      const sid = sandboxIdRef.current;
      if (sid) {
        fetch('/api/plugins/animation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: id, action: 'cleanup', sandboxId: sid }),
        }).catch(() => { /* ignore cleanup errors */ });
      }
    };
  }, [id]);

  // Handle counts
  const imageRefCount = data.imageRefCount || 1;
  const videoRefCount = data.videoRefCount || 1;
  const attachments = data.attachments || [];
  const model = data.model || 'anthropic/claude-sonnet-4-5';

  // Update node internals when handles change
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, imageRefCount, videoRefCount, updateNodeInternals]);

  // Ensure we have state initialized
  const state = useMemo((): AnimationNodeState => {
    if (data.state) return data.state;
    return createDefaultState(id);
  }, [data.state, id]);

  // Keep sandboxId ref in sync with state (for unmount cleanup)
  sandboxIdRef.current = state.sandboxId;

  // Initialize state if needed
  useEffect(() => {
    if (!data.state) {
      updateNodeData(id, { state: createDefaultState(id) });
    }
  }, [id, data.state, updateNodeData]);

  // Get available node outputs for reference picker
  const availableNodeOutputs = useMemo(() => {
    const outputs: Array<{ nodeId: string; name: string; type: 'image' | 'video'; url: string }> = [];

    nodes.forEach((node) => {
      if (node.id === id) return;

      if (node.type === 'imageGenerator' || node.type === 'media') {
        const nodeData = node.data as Record<string, unknown>;
        const outputUrl = nodeData.outputUrl as string | undefined;
        const imageUrl = nodeData.imageUrl as string | undefined;
        const url = outputUrl || imageUrl;
        if (url) {
          outputs.push({
            nodeId: node.id,
            name: (nodeData.name as string) || 'Image',
            type: 'image',
            url,
          });
        }
      }

      if (node.type === 'videoGenerator') {
        const nodeData = node.data as Record<string, unknown>;
        const outputUrl = nodeData.outputUrl as string | undefined;
        if (outputUrl) {
          outputs.push({
            nodeId: node.id,
            name: (nodeData.name as string) || 'Video',
            type: 'video',
            url: outputUrl,
          });
        }
      }
    });

    return outputs;
  }, [nodes, id]);

  // ─── State update helpers ───────────────────────────────────────────

  const updateState = useCallback(
    (updates: Partial<AnimationNodeState>) => {
      updateNodeData(id, {
        state: {
          ...state,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [id, state, updateNodeData]
  );

  /**
   * Get the latest state from Zustand (avoids stale closures in callbacks)
   */
  const getLatestState = useCallback((): AnimationNodeState => {
    const node = useCanvasStore.getState().nodes.find(n => n.id === id);
    if (!node) return state;
    return (node.data as AnimationNodeData).state || state;
  }, [id, state]);

  // ─── Streaming text flush helper ────────────────────────────────────

  /**
   * Flush accumulated streaming text / reasoning to Zustand state.
   * Called on a 100ms timer to batch rapid text-delta events.
   */
  const flushStreamingText = useCallback(() => {
    const latestState = getLatestState();
    if (!latestState.execution) return;

    const updates: Partial<typeof latestState.execution> = {};
    if (streamingTextRef.current) {
      updates.streamingText = streamingTextRef.current;
    }
    if (reasoningTextRef.current) {
      updates.reasoning = reasoningTextRef.current;
    }

    if (Object.keys(updates).length > 0) {
      updateNodeData(id, {
        state: {
          ...latestState,
          execution: {
            ...latestState.execution,
            ...updates,
          },
          updatedAt: new Date().toISOString(),
        },
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

  // ─── Tool-call → UI bridging callbacks ──────────────────────────────

  const createStreamCallbacks = useCallback((): AnimationStreamCallbacks => ({
    onTextDelta: (text) => {
      streamingTextRef.current += text;
      scheduleFlush();
    },

    onReasoningDelta: (text) => {
      reasoningTextRef.current += text;
      scheduleFlush();
    },

    onComplete: (fullText) => {
      // Final flush
      if (textFlushTimerRef.current) {
        clearTimeout(textFlushTimerRef.current);
        textFlushTimerRef.current = null;
      }

      const latestState = getLatestState();
      if (!latestState.execution) return;

      // Add the full agent response as an assistant message (if non-trivial)
      const trimmedText = fullText.trim();
      const updatedMessages = [...latestState.execution.messages];
      if (trimmedText.length > 0) {
        updatedMessages.push({
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: trimmedText,
          timestamp: new Date().toISOString(),
        });
      }

      updateNodeData(id, {
        state: {
          ...latestState,
          execution: {
            ...latestState.execution,
            messages: updatedMessages,
            streamingText: undefined, // Clear streaming text
            reasoning: reasoningTextRef.current || undefined, // Keep reasoning for display
          },
          updatedAt: new Date().toISOString(),
        },
      });

      // Reset refs for next stream
      streamingTextRef.current = '';
      reasoningTextRef.current = '';
    },

    onToolCall: (event) => {
      const latestState = getLatestState();

      // Handle UI tools by updating Zustand state
      if (event.toolName === 'update_todo') {
        const { todoId, status } = event.args as { todoId: string; status: string };
        if (latestState.execution) {
          const updatedTodos = latestState.execution.todos.map(t =>
            t.id === todoId ? { ...t, status: status as 'pending' | 'active' | 'done' } : t
          );
          updateNodeData(id, {
            state: {
              ...latestState,
              execution: {
                ...latestState.execution,
                todos: updatedTodos,
              },
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      if (event.toolName === 'set_thinking') {
        const { message } = event.args as { message: string };
        if (latestState.execution) {
          updateNodeData(id, {
            state: {
              ...latestState,
              execution: {
                ...latestState.execution,
                thinking: message,
              },
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      if (event.toolName === 'add_message') {
        const { content } = event.args as { content: string };
        if (latestState.execution) {
          const newMsg = {
            id: `msg_${Date.now()}`,
            role: 'assistant' as const,
            content,
            timestamp: new Date().toISOString(),
          };
          updateNodeData(id, {
            state: {
              ...latestState,
              execution: {
                ...latestState.execution,
                messages: [...latestState.execution.messages, newMsg],
              },
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      // Track sandbox file writes
      if (event.toolName === 'sandbox_write_file') {
        const { path } = event.args as { path: string };
        if (latestState.execution) {
          const files = latestState.execution.files || [];
          if (!files.includes(path)) {
            updateNodeData(id, {
              state: {
                ...latestState,
                execution: {
                  ...latestState.execution,
                  files: [...files, path],
                },
                updatedAt: new Date().toISOString(),
              },
            });
          }
        }
      }
    },

    onToolResult: (event) => {
      const latestState = getLatestState();

      // When sandbox_create completes, store the sandboxId in state
      if (event.toolName === 'sandbox_create' && !event.isError) {
        const result = event.result as { sandboxId?: string };
        if (result.sandboxId) {
          updateNodeData(id, {
            state: {
              ...latestState,
              sandboxId: result.sandboxId,
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      // When render_preview completes, transition to preview phase
      if (event.toolName === 'render_preview' && !event.isError) {
        const result = event.result as { videoUrl?: string; duration?: number };
        if (result.videoUrl) {
          updateNodeData(id, {
            state: {
              ...latestState,
              phase: 'preview',
              preview: {
                videoUrl: result.videoUrl,
                duration: result.duration || latestState.plan?.totalDuration || 7,
              },
              execution: undefined,
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      // When generate_plan completes, transition to plan phase
      if (event.toolName === 'generate_plan' && !event.isError) {
        const result = event.result as { plan?: AnimationPlan; todos?: Array<{ id: string; label: string; status: string }> };
        if (result.plan) {
          updateNodeData(id, {
            state: {
              ...latestState,
              phase: 'plan',
              plan: result.plan,
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      // When analyze_prompt completes, check if clarification needed
      if (event.toolName === 'analyze_prompt' && !event.isError) {
        const result = event.result as {
          needsClarification?: boolean;
          question?: { text: string; options: Array<{ id: string; label: string; description?: string }>; customInput?: boolean };
          inferredStyle?: string;
        };
        if (result.needsClarification && result.question) {
          updateNodeData(id, {
            state: {
              ...latestState,
              phase: 'question',
              question: result.question,
              updatedAt: new Date().toISOString(),
            },
          });
        }
        // If style was inferred, the agent will continue and call generate_plan
      }
    },

    onError: (errorMsg) => {
      const latestState = getLatestState();
      updateNodeData(id, {
        state: {
          ...latestState,
          phase: 'error',
          error: {
            message: errorMsg,
            code: 'STREAM_ERROR',
            canRetry: true,
          },
          updatedAt: new Date().toISOString(),
        },
      });
    },
  }), [id, getLatestState, updateNodeData, scheduleFlush]);

  // ─── Handle count management ────────────────────────────────────────

  const handleAddImageRef = useCallback(() => {
    if (imageRefCount < MAX_IMAGE_REFS) {
      updateNodeData(id, { imageRefCount: imageRefCount + 1 });
    }
  }, [id, imageRefCount, updateNodeData]);

  const handleRemoveImageRef = useCallback(() => {
    if (imageRefCount > 1) {
      updateNodeData(id, { imageRefCount: imageRefCount - 1 });
    }
  }, [id, imageRefCount, updateNodeData]);

  const handleAddVideoRef = useCallback(() => {
    if (videoRefCount < MAX_VIDEO_REFS) {
      updateNodeData(id, { videoRefCount: videoRefCount + 1 });
    }
  }, [id, videoRefCount, updateNodeData]);

  const handleRemoveVideoRef = useCallback(() => {
    if (videoRefCount > 1) {
      updateNodeData(id, { videoRefCount: videoRefCount - 1 });
    }
  }, [id, videoRefCount, updateNodeData]);

  // Attachments management
  const handleAttachmentsChange = useCallback(
    (newAttachments: AnimationAttachment[]) => {
      updateNodeData(id, { attachments: newAttachments });
    },
    [id, updateNodeData]
  );

  // Model change
  const handleModelChange = useCallback(
    (newModel: string) => {
      updateNodeData(id, { model: newModel });
    },
    [id, updateNodeData]
  );

  // ─── Stream lifecycle ───────────────────────────────────────────────

  /** Reset streaming refs before starting a new stream */
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
      // Store prompt in node data
      updateNodeData(id, {
        prompt,
        attachments: promptAttachments || attachments,
      });

      // Set a transient "analyzing" state
      updateState({ phase: 'executing', execution: { todos: [], thinking: 'Analyzing your prompt...', messages: [], files: [] } });

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          `Analyze this animation request and either ask a clarifying question (if style is unclear) or generate a plan directly:\n\n${prompt}`,
          {
            nodeId: id,
            phase: 'idle',
            attachments: promptAttachments || attachments,
          },
          callbacks
        );

        // If the stream finished but we're still in executing state (agent didn't call
        // analyze_prompt or generate_plan tool), check the text response
        const latestState = getLatestState();
        if (latestState.phase === 'executing') {
          // Fallback: the agent responded with text instead of using tools.
          // Show the plan phase with a simple default plan.
          updateState({
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
          });
        }
      } catch {
        // Error already handled by onError callback
      }
    },
    [id, state, attachments, updateNodeData, updateState, streamToAgent, createStreamCallbacks, getLatestState, resetStreamingRefs]
  );

  const handleSelectStyle = useCallback(
    async (styleId: string, customStyle?: string) => {
      const selectedStyle = customStyle || styleId;
      updateState({ phase: 'executing', selectedStyle, execution: { todos: [], thinking: 'Generating animation plan...', messages: [], files: [] } });

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          `Generate an animation plan for this request with style "${selectedStyle}":\n\n${data.prompt || 'Animation request'}`,
          {
            nodeId: id,
            phase: 'question',
          },
          callbacks
        );

        // Fallback if agent didn't use generate_plan tool
        const latestState = getLatestState();
        if (latestState.phase === 'executing') {
          updateState({
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
          });
        }
      } catch {
        // Error handled by callback
      }
    },
    [id, data.prompt, updateState, streamToAgent, createStreamCallbacks, getLatestState, resetStreamingRefs]
  );

  const handleAcceptPlan = useCallback(async () => {
    if (!state.plan) return;

    // Build todos from plan
    const todos = [
      { id: 'setup', label: 'Set up Theatre.js project', status: 'pending' as const },
      ...state.plan.scenes.map(scene => ({
        id: `scene-${scene.number}`,
        label: `Create Scene ${scene.number} (${scene.title})`,
        status: 'pending' as const,
      })),
      { id: 'postprocess', label: 'Add post-processing effects', status: 'pending' as const },
      { id: 'render', label: 'Render preview', status: 'pending' as const },
    ];

    updateState({
      phase: 'executing',
      execution: {
        todos,
        thinking: 'Initializing animation sandbox...',
        messages: [],
        files: [],
      },
      startedAt: new Date().toISOString(),
    });

    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    try {
      await streamToAgent(
        `The user has approved the animation plan. Now execute it step by step.\n\nUse update_todo to mark each task as active/done.\nUse set_thinking to explain what you're doing.\nWrite all code files using sandbox_write_file.\nWhen done, call render_preview.\n\nPrompt: ${data.prompt || 'Animation request'}`,
        {
          nodeId: id,
          phase: 'executing',
          plan: state.plan,
          todos,
        },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, data.prompt, state, updateState, streamToAgent, createStreamCallbacks, resetStreamingRefs]);

  const handleRejectPlan = useCallback(() => {
    updateState({
      phase: 'idle',
      plan: undefined,
      question: undefined,
    });
  }, [updateState]);

  const handleRevisePlan = useCallback(
    async (feedback: string) => {
      if (!state.plan) return;

      updateState({
        execution: { todos: [], thinking: 'Revising animation plan...', messages: [], files: [] },
      });

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          `The user wants to revise the animation plan. Feedback: "${feedback}"\n\nGenerate an updated plan using the generate_plan tool.`,
          {
            nodeId: id,
            phase: 'plan',
            plan: state.plan,
          },
          callbacks
        );

        // Fallback
        const latestState = getLatestState();
        if (latestState.execution && latestState.phase !== 'plan') {
          updateState({
            phase: 'plan',
            execution: undefined,
          });
        }
      } catch {
        // Error handled by callback
      }
    },
    [id, state, updateState, streamToAgent, createStreamCallbacks, getLatestState, resetStreamingRefs]
  );

  const handleCancelExecution = useCallback(() => {
    abortStream();
    updateState({
      phase: state.plan ? 'plan' : 'idle',
      execution: undefined,
    });
  }, [state.plan, updateState, abortStream]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const latestState = getLatestState();
      if (!latestState.execution) return;

      // Add user message to state
      const newMessage = {
        id: `msg_${Date.now()}`,
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString(),
      };

      updateNodeData(id, {
        state: {
          ...latestState,
          execution: {
            ...latestState.execution,
            messages: [...latestState.execution.messages, newMessage],
          },
          updatedAt: new Date().toISOString(),
        },
      });

      resetStreamingRefs();
      const callbacks = createStreamCallbacks();

      try {
        await streamToAgent(
          content,
          {
            nodeId: id,
            phase: latestState.phase,
            plan: latestState.plan,
            todos: latestState.execution.todos,
          },
          callbacks
        );
      } catch {
        // Error handled by callback
      }
    },
    [id, getLatestState, updateNodeData, streamToAgent, createStreamCallbacks, resetStreamingRefs]
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

      if (response.ok) {
        const result = await response.json();
        updateState({
          phase: 'complete',
          output: {
            videoUrl: result.outputUrl || state.preview.videoUrl,
            thumbnailUrl: result.thumbnailUrl || state.preview.videoUrl.replace('.mp4', '-thumb.jpg'),
            duration: state.preview.duration,
          },
          completedAt: new Date().toISOString(),
        });
      } else {
        // Render failed — fall back to preview URL
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
    } catch {
      // Network error — fall back to preview URL
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
    if (!state.plan) return;

    const todos = [
      { id: 'setup', label: 'Set up Theatre.js project', status: 'pending' as const },
      ...state.plan.scenes.map(scene => ({
        id: `scene-${scene.number}`,
        label: `Create Scene ${scene.number} (${scene.title})`,
        status: 'pending' as const,
      })),
      { id: 'postprocess', label: 'Add post-processing effects', status: 'pending' as const },
      { id: 'render', label: 'Render preview', status: 'pending' as const },
    ];

    updateState({
      phase: 'executing',
      execution: {
        todos,
        thinking: 'Regenerating animation...',
        messages: [],
        files: [],
      },
      preview: undefined,
    });

    resetStreamingRefs();
    const callbacks = createStreamCallbacks();

    try {
      await streamToAgent(
        `Regenerate the animation from the plan. Execute all steps again.\n\nPrompt: ${data.prompt || 'Animation request'}`,
        {
          nodeId: id,
          phase: 'executing',
          plan: state.plan,
          todos,
        },
        callbacks
      );
    } catch {
      // Error handled by callback
    }
  }, [id, data.prompt, state, updateState, streamToAgent, createStreamCallbacks, resetStreamingRefs]);

  const handleRetry = useCallback(() => {
    if (state.plan) {
      updateState({ phase: 'plan', error: undefined });
    } else {
      updateState({ phase: 'idle', error: undefined });
    }
  }, [state.plan, updateState]);

  const handleReset = useCallback(() => {
    abortStream();
    updateNodeData(id, {
      prompt: '',
      attachments: [],
      state: createDefaultState(id),
    });
  }, [id, updateNodeData, abortStream]);

  // ─── Render ─────────────────────────────────────────────────────────

  // Calculate video handle start position
  const videoHandleStart = IMAGE_HANDLE_START + imageRefCount * HANDLE_SPACING + VIDEO_HANDLE_START_OFFSET;

  // Render phase content
  const renderPhaseContent = () => {
    switch (state.phase) {
      case 'idle':
        return (
          <div className="space-y-3">
            <ChatInput
              onSubmit={handleAnalyzePrompt}
              placeholder="Describe the animation you want..."
              model={model}
              onModelChange={handleModelChange}
              attachments={attachments}
              onAttachmentsChange={handleAttachmentsChange}
              availableNodeOutputs={availableNodeOutputs}
            />
          </div>
        );

      case 'question':
        return state.question ? (
          <QuestionPhase
            question={state.question}
            onSelect={handleSelectStyle}
          />
        ) : null;

      case 'plan':
        return state.plan ? (
          <div className="space-y-3">
            <PlanPhase
              plan={state.plan}
              onAccept={handleAcceptPlan}
              onReject={handleRejectPlan}
              onRevise={handleRevisePlan}
            />
            <ChatInput
              onSubmit={(msg) => handleRevisePlan(msg)}
              placeholder="Suggest changes to the plan..."
              model={model}
              onModelChange={handleModelChange}
              attachments={attachments}
              onAttachmentsChange={handleAttachmentsChange}
              availableNodeOutputs={availableNodeOutputs}
            />
          </div>
        ) : null;

      case 'executing':
        return state.execution ? (
          <div className="flex flex-col">
            {/* Scrollable chat area */}
            <ExecutingPhase
              todos={state.execution.todos}
              thinking={state.execution.thinking}
              messages={state.execution.messages}
              streamingText={state.execution.streamingText}
              reasoning={state.execution.reasoning}
              onCancel={handleCancelExecution}
            />
            {/* Fixed chat input at bottom */}
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <ChatInput
                onSubmit={handleSendMessage}
                isGenerating={isStreaming}
                onStop={handleCancelExecution}
                placeholder="Ask the agent a question..."
                model={model}
                onModelChange={handleModelChange}
                availableNodeOutputs={availableNodeOutputs}
              />
            </div>
          </div>
        ) : null;

      case 'preview':
        return state.preview ? (
          <PreviewPhase
            preview={state.preview}
            onAccept={handleAcceptPreview}
            onRegenerate={handleRegenerate}
          />
        ) : null;

      case 'complete':
        return state.output ? (
          <CompletePhase output={state.output} onNew={handleReset} />
        ) : null;

      case 'error':
        return state.error ? (
          <ErrorPhase
            error={state.error}
            onRetry={handleRetry}
            onStartOver={handleReset}
          />
        ) : null;

      default:
        return (
          <ChatInput
            onSubmit={handleAnalyzePrompt}
            placeholder="Describe the animation you want..."
            model={model}
            onModelChange={handleModelChange}
            attachments={attachments}
            onAttachmentsChange={handleAttachmentsChange}
            availableNodeOutputs={availableNodeOutputs}
          />
        );
    }
  };

  // Node border style based on phase
  const nodeClasses = useMemo(() => {
    const baseClasses =
      'w-[420px] rounded-2xl bg-zinc-900 border-2 overflow-hidden shadow-xl transition-all';

    if (state.phase === 'executing') {
      return `${baseClasses} generating-border-blue`;
    }
    if (state.phase === 'error') {
      return `${baseClasses} border-red-500`;
    }
    if (state.phase === 'complete') {
      return `${baseClasses} border-green-500`;
    }
    if (selected) {
      return `${baseClasses} border-blue-500 ring-2 ring-blue-500/30`;
    }
    return `${baseClasses} border-zinc-700`;
  }, [state.phase, selected]);

  // Calculate min height based on handles
  const totalHandles = imageRefCount + videoRefCount;
  const minHeight = Math.max(300, IMAGE_HANDLE_START + totalHandles * HANDLE_SPACING + 60);

  return (
    <div
      className={nodeClasses}
      style={{ minHeight }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Side: Dynamic Input Handles */}

      {/* Image reference handles */}
      {Array.from({ length: imageRefCount }).map((_, index) => {
        const top = IMAGE_HANDLE_START + index * HANDLE_SPACING;
        return (
          <div
            key={`img-ref-${index}`}
            className="absolute -left-3 group"
            style={{ top }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`image-ref-${index}`}
              className="!w-3 !h-3 !bg-teal-500 !border-2 !border-teal-400 relative !left-0"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Image className="h-3 w-3 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {imageRefCount > 1 ? `Image ${index + 1}` : 'Image'}
              </span>
            </div>
          </div>
        );
      })}

      {/* Image handle add/remove buttons */}
      {(selected || isHovered) && (
        <div
          className="absolute -left-3 flex flex-col gap-0.5 transition-opacity duration-200"
          style={{ top: IMAGE_HANDLE_START + imageRefCount * HANDLE_SPACING + 4 }}
        >
          {imageRefCount < MAX_IMAGE_REFS && (
            <button
              onClick={handleAddImageRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-teal-500 hover:text-teal-400 transition-colors"
              title={`Add image reference (${imageRefCount}/${MAX_IMAGE_REFS})`}
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          {imageRefCount > 1 && (
            <button
              onClick={handleRemoveImageRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-red-500 hover:text-red-400 transition-colors"
              title="Remove image reference"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Video reference handles */}
      {Array.from({ length: videoRefCount }).map((_, index) => {
        const top = videoHandleStart + index * HANDLE_SPACING;
        return (
          <div
            key={`vid-ref-${index}`}
            className="absolute -left-3 group"
            style={{ top }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`video-ref-${index}`}
              className="!w-3 !h-3 !bg-purple-500 !border-2 !border-purple-400 relative !left-0"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Video className="h-3 w-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {videoRefCount > 1 ? `Video ${index + 1}` : 'Video'}
              </span>
            </div>
          </div>
        );
      })}

      {/* Video handle add/remove buttons */}
      {(selected || isHovered) && (
        <div
          className="absolute -left-3 flex flex-col gap-0.5 transition-opacity duration-200"
          style={{ top: videoHandleStart + videoRefCount * HANDLE_SPACING + 4 }}
        >
          {videoRefCount < MAX_VIDEO_REFS && (
            <button
              onClick={handleAddVideoRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-purple-500 hover:text-purple-400 transition-colors"
              title={`Add video reference (${videoRefCount}/${MAX_VIDEO_REFS})`}
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          {videoRefCount > 1 && (
            <button
              onClick={handleRemoveVideoRef}
              className="w-6 h-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-red-500 hover:text-red-400 transition-colors"
              title="Remove video reference"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/80">
        <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Clapperboard className="h-4 w-4 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-zinc-100">
            {data.name || 'Animation Generator'}
          </h3>
          <p className="text-xs text-zinc-500 capitalize">
            {state.phase}
            {isStreaming && state.phase === 'executing' ? ' (streaming)' : ''}
          </p>
        </div>
      </div>

      {/* Phase Content */}
      <div className="p-4">{renderPhaseContent()}</div>

      {/* Right Side: Output Handles */}
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
