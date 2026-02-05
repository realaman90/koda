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
import type { AnimationPlan, AnimationTodo, AnimationAttachment } from '../types';
import type { AnimationStreamEvent, AnimationAppEvent } from '../events';
import { toolCallToAppEvent, toolResultToAppEvent } from '../events';

// ============================================
// Types
// ============================================

interface StreamContext {
  nodeId?: string;
  phase?: string;
  plan?: AnimationPlan;
  todos?: AnimationTodo[];
  attachments?: AnimationAttachment[];
  sandboxId?: string;
  engine?: 'remotion' | 'theatre';
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
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

interface UseAnimationStreamReturn {
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
  stream: (prompt: string, context?: StreamContext, callbacks?: AnimationStreamCallbacks) => Promise<string>;
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
    async (prompt: string, context?: StreamContext, callbacks?: AnimationStreamCallbacks): Promise<string> => {
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
        const response = await fetch('/api/plugins/animation/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, context }),
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
                    callbacks?.onAppEvent?.(appEvent);
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
