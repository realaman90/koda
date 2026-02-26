/**
 * usePromptStudioStream Hook
 *
 * Consumes the prompt studio streaming API via SSE.
 * Simple pattern — no sandbox events, no video handling.
 */

import { useState, useCallback, useRef } from 'react';
import type { PromptStudioStreamEvent, PromptStudioAppEvent } from '../events';
import { toolCallToAppEvent, toolResultToAppEvent } from '../events';

// ============================================
// Types
// ============================================

interface StreamContext {
  nodeId?: string;
  phase?: string;
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

export interface PromptStudioStreamCallbacks {
  onTextDelta?: (text: string) => void;
  onReasoningDelta?: (text: string) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onComplete?: (text: string) => void;
  onError?: (error: string) => void;
  onAppEvent?: (event: PromptStudioAppEvent) => void;
}

export type StreamInput = string | Array<{ role: 'user' | 'assistant'; content: string }>;

interface UsePromptStudioStreamReturn {
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
  stream: (input: StreamInput, context?: StreamContext, callbacks?: PromptStudioStreamCallbacks) => Promise<string>;
  abort: () => void;
}

// ============================================
// Hook
// ============================================

// Track tool-call args so we can pair them with tool-result
const pendingToolArgs = new Map<string, Record<string, unknown>>();

export function usePromptStudioStream(): UsePromptStudioStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const completeFiredRef = useRef(false);
  const abortedRef = useRef(false);

  const abort = useCallback(() => {
    abortedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const stream = useCallback(
    async (input: StreamInput, context?: StreamContext, callbacks?: PromptStudioStreamCallbacks): Promise<string> => {
      abort();
      abortControllerRef.current = new AbortController();
      abortedRef.current = false;
      setIsStreaming(true);
      setStreamedText('');
      setError(null);
      completeFiredRef.current = false;
      pendingToolArgs.clear();

      let fullText = '';

      try {
        const requestBody = typeof input === 'string'
          ? { prompt: input, context }
          : { messages: input, context };

        const response = await fetch('/api/plugins/prompt-studio/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Stream request failed' }));
          throw new Error(errorData.error || `Stream request failed (${response.status})`);
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.trim()) continue;

            const dataPayload = event
              .split('\n')
              .filter(line => line.startsWith('data: '))
              .map(line => line.slice(6))
              .join('');

            if (!dataPayload) continue;

            try {
              const data: PromptStudioStreamEvent = JSON.parse(dataPayload);

              switch (data.type) {
                case 'text-delta':
                  fullText += data.text;
                  setStreamedText(fullText);
                  callbacks?.onTextDelta?.(data.text);
                  break;

                case 'reasoning-delta':
                  callbacks?.onReasoningDelta?.(data.text);
                  break;

                case 'tool-call': {
                  // Store args for pairing with tool-result
                  pendingToolArgs.set(data.toolCallId, data.args);
                  callbacks?.onToolCall?.({
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    args: data.args,
                  });
                  const appEvent = toolCallToAppEvent(data.toolName, data.args);
                  if (appEvent) callbacks?.onAppEvent?.(appEvent);
                  break;
                }

                case 'tool-result': {
                  const args = pendingToolArgs.get(data.toolCallId) || {};
                  pendingToolArgs.delete(data.toolCallId);
                  callbacks?.onToolResult?.({
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    result: data.result,
                    isError: data.isError,
                  });
                  if (!data.isError) {
                    const appEvent = toolResultToAppEvent(data.toolName, args, data.result);
                    if (appEvent) callbacks?.onAppEvent?.(appEvent);
                  }
                  break;
                }

                case 'complete':
                  fullText = data.text || fullText;
                  setStreamedText(fullText);
                  completeFiredRef.current = true;
                  if (!abortedRef.current) {
                    callbacks?.onComplete?.(fullText);
                  }
                  break;

                case 'error':
                  setError(data.error || 'Unknown stream error');
                  callbacks?.onError?.(data.error || 'Unknown stream error');
                  break;

                default:
                  break;
              }
            } catch (parseErr) {
              console.warn('[usePromptStudioStream] Failed to parse SSE event:', dataPayload.slice(0, 200), parseErr);
            }
          }
        }

        if (!completeFiredRef.current && !abortedRef.current) {
          completeFiredRef.current = true;
          callbacks?.onComplete?.(fullText);
        }

        abortControllerRef.current = null;
        setIsStreaming(false);
        return fullText;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          abortControllerRef.current = null;
          setIsStreaming(false);
          return fullText;
        }
        const errorMessage = err instanceof Error ? err.message : 'Stream failed';
        if (abortedRef.current) {
          setIsStreaming(false);
          return fullText;
        }
        console.error('[usePromptStudioStream] Stream error:', errorMessage);
        setError(errorMessage);
        setIsStreaming(false);
        callbacks?.onError?.(errorMessage);
        return fullText;
      }
    },
    [abort]
  );

  return { isStreaming, streamedText, error, stream, abort };
}
