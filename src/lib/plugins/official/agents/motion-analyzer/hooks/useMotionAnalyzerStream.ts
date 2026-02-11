/**
 * useMotionAnalyzerStream Hook
 *
 * Consumes the motion analyzer streaming API via SSE.
 * Simpler than animation stream — no sandbox events, no video-ready recovery.
 */

import { useState, useCallback, useRef } from 'react';
import type { VideoInput } from '../types';
import type { MotionAnalyzerStreamEvent, MotionAnalyzerAppEvent } from '../events';
import { toolCallToAppEvent, toolResultToAppEvent } from '../events';

// ============================================
// Types
// ============================================

interface StreamContext {
  nodeId?: string;
  phase?: string;
  video?: VideoInput;
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

export interface MotionAnalyzerStreamCallbacks {
  onTextDelta?: (text: string) => void;
  onReasoningDelta?: (text: string) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onComplete?: (text: string) => void;
  onError?: (error: string) => void;
  onAppEvent?: (event: MotionAnalyzerAppEvent) => void;
}

export type StreamInput = string | Array<{ role: 'user' | 'assistant'; content: string }>;

interface UseMotionAnalyzerStreamReturn {
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
  stream: (input: StreamInput, context?: StreamContext, callbacks?: MotionAnalyzerStreamCallbacks) => Promise<string>;
  abort: () => void;
}

// ============================================
// Hook
// ============================================

export function useMotionAnalyzerStream(): UseMotionAnalyzerStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const completeFiredRef = useRef(false);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const stream = useCallback(
    async (input: StreamInput, context?: StreamContext, callbacks?: MotionAnalyzerStreamCallbacks): Promise<string> => {
      abort();
      abortControllerRef.current = new AbortController();
      setIsStreaming(true);
      setStreamedText('');
      setError(null);
      completeFiredRef.current = false;

      let fullText = '';

      try {
        // If video has a remoteUrl (presigned upload to R2), send that instead of the data URL.
        // This keeps the request body tiny and avoids the Vercel 4.5MB limit.
        // Fall back to data URL conversion for local dev (no R2).
        let processedContext = context;
        if (context?.video) {
          if (context.video.remoteUrl) {
            // Remote URL available — strip the heavy dataUrl from the request
            processedContext = {
              ...context,
              video: { ...context.video, dataUrl: context.video.remoteUrl },
            };
          } else if (context.video.dataUrl?.startsWith('blob:')) {
            // No remote URL — convert blob to data URL (local dev fallback)
            try {
              const response = await fetch(context.video.dataUrl);
              const blob = await response.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
              });
              processedContext = {
                ...context,
                video: { ...context.video, dataUrl },
              };
            } catch (err) {
              console.warn('[useMotionAnalyzerStream] Failed to convert blob: URL:', err);
            }
          }
        }

        const requestBody = typeof input === 'string'
          ? { prompt: input, context: processedContext }
          : { messages: input, context: processedContext };

        const response = await fetch('/api/plugins/motion-analyzer/stream', {
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
              const data: MotionAnalyzerStreamEvent = JSON.parse(dataPayload);

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
                  callbacks?.onToolResult?.({
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    result: data.result,
                    isError: data.isError,
                  });
                  if (!data.isError) {
                    const appEvent = toolResultToAppEvent(data.toolName, data.result);
                    if (appEvent) callbacks?.onAppEvent?.(appEvent);
                  }
                  break;
                }

                case 'complete':
                  fullText = data.text || fullText;
                  setStreamedText(fullText);
                  completeFiredRef.current = true;
                  callbacks?.onComplete?.(fullText);
                  break;

                case 'error':
                  setError(data.error || 'Unknown stream error');
                  callbacks?.onError?.(data.error || 'Unknown stream error');
                  break;

                default:
                  break;
              }
            } catch (parseErr) {
              console.warn('[useMotionAnalyzerStream] Failed to parse SSE event:', dataPayload.slice(0, 200), parseErr);
            }
          }
        }

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
        console.error('[useMotionAnalyzerStream] Stream error:', errorMessage);
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
