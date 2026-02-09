/**
 * useAnimationStream Hook
 *
 * Consumes the animation streaming API via SSE.
 * Forwards text-delta, tool-call, and tool-result events to callbacks
 * so the parent component can bridge them to Zustand state.
 *
 * Also maps raw tool events to typed AnimationAppEvent instances
 * for structured state management.
 */

import { useState, useCallback, useRef } from 'react';
import type { AnimationPlan, AnimationTodo, AnimationAttachment, MediaEntry } from '../types';
import type { AnimationStreamEvent, AnimationAppEvent } from '../events';
import { toolCallToAppEvent, toolResultToAppEvent } from '../events';
import { resolveMediaCache } from '../media-cache';

// ============================================
// Types
// ============================================

interface StreamContext {
  nodeId?: string;
  phase?: string;
  plan?: AnimationPlan;
  todos?: AnimationTodo[];
  attachments?: AnimationAttachment[];
  media?: MediaEntry[];
  sandboxId?: string;
  engine?: 'remotion' | 'theatre';
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  duration?: number;
  techniques?: string[];
  designSpec?: {
    style?: string;
    colors?: { primary: string; secondary: string; accent?: string };
    fonts?: { title: string; body: string };
  };
  fps?: number;
  resolution?: string;
}

interface ToolCallEvent {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface ToolResultEvent {
  toolCallId: string;
  toolName: string;
  result: Record<string, unknown>;
  isError?: boolean;
}

export interface AnimationStreamCallbacks {
  /** Raw text delta from the agent */
  onTextDelta?: (text: string) => void;
  /** Extended thinking / reasoning delta from the model */
  onReasoningDelta?: (text: string) => void;
  /** Raw tool call event (for all tools) */
  onToolCall?: (event: ToolCallEvent) => void;
  /** Raw tool result event (for all tools) */
  onToolResult?: (event: ToolResultEvent) => void;
  /** Stream completed */
  onComplete?: (text: string) => void;
  /** Error occurred */
  onError?: (error: string) => void;
  /** Typed application event derived from tool calls/results */
  onAppEvent?: (event: AnimationAppEvent) => void;
}

/** Input can be a single prompt string or a conversation history array */
export type StreamInput = string | Array<{ role: 'user' | 'assistant'; content: string }>;

interface UseAnimationStreamReturn {
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
  stream: (input: StreamInput, context?: StreamContext, callbacks?: AnimationStreamCallbacks) => Promise<string>;
  abort: () => void;
}

// ============================================
// Hook
// ============================================

export function useAnimationStream(): UseAnimationStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track whether we've received a complete event to avoid double-firing onComplete
  const completeFiredRef = useRef(false);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const stream = useCallback(
    async (input: StreamInput, context?: StreamContext, callbacks?: AnimationStreamCallbacks): Promise<string> => {
      // Abort any existing stream
      abort();

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setStreamedText('');
      setError(null);
      completeFiredRef.current = false;

      let fullText = '';

      try {
        // Resolve cached: placeholders back to real data URLs from memory/IndexedDB,
        // then convert blob: URLs to data: URLs (blob: is browser-only, can't reach server).
        const rawMedia = context?.media || [];
        const resolvedMedia = rawMedia.length > 0 ? resolveMediaCache(rawMedia) : [];

        // Convert blob: URLs to data: URLs so they can be sent to the server.
        // blob: URLs are created by URL.createObjectURL() and only work in the current browser session.
        const processedMedia = await Promise.all(resolvedMedia.map(async (m) => {
          if (m.dataUrl.startsWith('blob:')) {
            try {
              const response = await fetch(m.dataUrl);
              const blob = await response.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
              });
              console.log(`[useAnimationStream] Converted blob: → data: for ${m.name} (${Math.round(dataUrl.length / 1024)}KB)`);
              return { ...m, dataUrl };
            } catch (err) {
              console.warn(`[useAnimationStream] Failed to convert blob: URL for ${m.name}:`, err);
              return null;
            }
          }
          if (m.dataUrl.startsWith('cached:')) {
            console.warn(`[useAnimationStream] Skipping unresolvable cached: media: ${m.name}`);
            return null;
          }
          return m;
        }));
        const filteredMedia = processedMedia.filter(Boolean) as typeof resolvedMedia;

        console.log(`[useAnimationStream] Media: ${rawMedia.length} raw → ${resolvedMedia.length} resolved → ${filteredMedia.length} sent`,
          rawMedia.map(m => ({ name: m.name, source: m.source, urlPrefix: m.dataUrl?.slice(0, 30) })));

        const cleanContext = context ? {
          ...context,
          media: filteredMedia.length > 0 ? filteredMedia : undefined,
        } : context;

        // Send either a single prompt or full conversation history
        const requestBody = typeof input === 'string'
          ? { prompt: input, context: cleanContext }
          : { messages: input, context: cleanContext };

        const response = await fetch('/api/plugins/animation/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Stream request failed' }));
          throw new Error(errorData.error || `Stream request failed (${response.status})`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from the buffer
          // SSE spec: events are separated by \n\n
          const events = buffer.split('\n\n');
          // Keep the last incomplete chunk in the buffer (may be partial)
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.trim()) continue;

            // Extract the data payload from potentially multi-line SSE event
            // An event can have: "event: type\ndata: {...}" or just "data: {...}"
            // Concatenate all data: lines per the SSE spec
            const dataPayload = event
              .split('\n')
              .filter(line => line.startsWith('data: '))
              .map(line => line.slice(6))
              .join('');

            if (!dataPayload) continue;

            try {
              const data: AnimationStreamEvent = JSON.parse(dataPayload);

              switch (data.type) {
                case 'text-delta': {
                  fullText += data.text;
                  setStreamedText(fullText);
                  callbacks?.onTextDelta?.(data.text);
                  break;
                }

                case 'reasoning-delta': {
                  callbacks?.onReasoningDelta?.(data.text);
                  break;
                }

                case 'tool-call': {
                  const toolCallEvt: ToolCallEvent = {
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    args: data.args,
                  };
                  callbacks?.onToolCall?.(toolCallEvt);

                  // Map to typed app event (for UI tools with actionable args)
                  const appEvent = toolCallToAppEvent(data.toolName, data.args);
                  if (appEvent) {
                    // batch_update_todos returns an array of events
                    const events = Array.isArray(appEvent) ? appEvent : [appEvent];
                    for (const evt of events) {
                      callbacks?.onAppEvent?.(evt);
                    }
                  }
                  break;
                }

                case 'tool-result': {
                  const toolResultEvt: ToolResultEvent = {
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    result: data.result,
                    isError: data.isError,
                  };
                  callbacks?.onToolResult?.(toolResultEvt);

                  // Map to typed app event (for tools with meaningful results)
                  if (!data.isError) {
                    const appEvent = toolResultToAppEvent(data.toolName, data.result);
                    if (appEvent) {
                      callbacks?.onAppEvent?.(appEvent);
                    }
                  }
                  break;
                }

                case 'complete': {
                  fullText = data.text || fullText;
                  setStreamedText(fullText);
                  completeFiredRef.current = true;
                  callbacks?.onComplete?.(fullText);
                  break;
                }

                case 'error': {
                  const errMsg = data.error || 'Unknown stream error';
                  setError(errMsg);
                  callbacks?.onError?.(errMsg);
                  break;
                }

                // sandbox-created: custom SSE event from server when sandbox_create succeeds.
                // Redundant with tool-result, but ensures sandboxId is saved even if
                // tool-result processing is delayed or skipped.
                case 'sandbox-created': {
                  const sandboxData = data as { type: 'sandbox-created'; sandboxId: string };
                  if (sandboxData.sandboxId) {
                    console.log(`[useAnimationStream] sandbox-created SSE: ${sandboxData.sandboxId}`);
                    callbacks?.onToolResult?.({
                      toolCallId: `sse_sandbox_${Date.now()}`,
                      toolName: 'sandbox_create',
                      result: { success: true, sandboxId: sandboxData.sandboxId },
                    });
                  }
                  break;
                }

                // step-finish, finish — informational, no UI action needed
                default:
                  break;
              }
            } catch (parseErr) {
              // Log malformed SSE data for debugging (but don't crash the stream)
              console.warn('[useAnimationStream] Failed to parse SSE event:', dataPayload.slice(0, 200), parseErr);
            }
          }
        }

        // Fallback: If we didn't receive a 'complete' event (stream ended unexpectedly),
        // fire onComplete anyway to ensure the UI knows the stream is done.
        // This handles edge cases where the server crashes or disconnects without sending 'complete'.
        if (!completeFiredRef.current) {
          completeFiredRef.current = true;
          callbacks?.onComplete?.(fullText);
        }

        setIsStreaming(false);
        return fullText;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setIsStreaming(false);
          return fullText;
        }

        const errorMessage = err instanceof Error ? err.message : 'Stream failed';
        setError(errorMessage);
        setIsStreaming(false);
        callbacks?.onError?.(errorMessage);
        throw err;
      }
    },
    [abort]
  );

  return {
    isStreaming,
    streamedText,
    error,
    stream,
    abort,
  };
}
