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
import { getCached, loadFromDB } from '../../animation-generator/media-cache';

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

const SERVERLESS_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const BODY_LIMIT_WARNING_THRESHOLD_BYTES = 4 * 1024 * 1024;

function createTraceId(): string {
  return `ma_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl.startsWith('data:')) return 0;
  const commaIndex = dataUrl.indexOf(',');
  const base64Payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return Math.floor((base64Payload.length * 3) / 4);
}

function toMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

async function buildHttpError(response: Response, traceId: string): Promise<Error> {
  const contentType = response.headers.get('content-type') || '';
  const responseTraceId = response.headers.get('x-koda-trace-id') || traceId;
  const vercelRequestId = response.headers.get('x-vercel-id');

  let serverError = '';
  let details = '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null) as
      | { error?: unknown; details?: unknown; reason?: unknown }
      | null;
    if (payload) {
      if (typeof payload.error === 'string') serverError = payload.error;
      if (typeof payload.details === 'string') details = payload.details;
      if (!details && typeof payload.reason === 'string') details = payload.reason;
    }
  } else {
    const text = await response.text().catch(() => '');
    if (text) details = text.slice(0, 200).replace(/\s+/g, ' ').trim();
  }

  const prefix = serverError || `Stream request failed (${response.status})`;
  const suffixes: string[] = [];
  if (response.status === 413) {
    suffixes.push('Request payload is too large (serverless body limit).');
  }
  suffixes.push(`trace=${responseTraceId}`);
  if (vercelRequestId) suffixes.push(`vercel=${vercelRequestId}`);
  if (details) suffixes.push(details);

  return new Error(`${prefix} ${suffixes.join(' ')}`.trim());
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
    async (input: StreamInput, context?: StreamContext, callbacks?: MotionAnalyzerStreamCallbacks): Promise<string> => {
      abort();
      abortControllerRef.current = new AbortController();
      abortedRef.current = false;
      setIsStreaming(true);
      setStreamedText('');
      setError(null);
      completeFiredRef.current = false;

      let fullText = '';

      try {
        const traceId = createTraceId();

        // If video has a remoteUrl (presigned upload to R2), send that instead of the data URL.
        // This keeps the request body tiny and avoids the Vercel 4.5MB limit.
        // Fall back to data URL conversion for local dev (no R2).
        let processedContext = context;
        let localVideoPayloadBytes = 0;
        if (context?.video) {
          if (context.video.remoteUrl) {
            // Remote URL available — strip the heavy dataUrl from the request
            processedContext = {
              ...context,
              video: { ...context.video, dataUrl: context.video.remoteUrl },
            };
          } else if (context.video.dataUrl?.startsWith('cached:')) {
            // Resolve IndexedDB-cached payload (survives refresh in local mode)
            let cached = getCached(context.video.id);
            if (!cached) {
              cached = await loadFromDB(context.video.id);
            }
            if (!cached) {
              throw new Error('Uploaded video data is unavailable after refresh. Please re-upload.');
            }
            processedContext = {
              ...context,
              video: { ...context.video, dataUrl: cached },
            };
            localVideoPayloadBytes = estimateDataUrlBytes(cached);
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
              localVideoPayloadBytes = estimateDataUrlBytes(dataUrl);
            } catch (err) {
              console.warn('[useMotionAnalyzerStream] Failed to convert blob: URL:', err);
            }
          } else if (context.video.dataUrl?.startsWith('data:')) {
            localVideoPayloadBytes = estimateDataUrlBytes(context.video.dataUrl);
          }
        }

        const requestBody = typeof input === 'string'
          ? { prompt: input, context: processedContext }
          : { messages: input, context: processedContext };

        if (localVideoPayloadBytes >= BODY_LIMIT_WARNING_THRESHOLD_BYTES) {
          console.warn(
            `[useMotionAnalyzerStream] Large local video payload (~${toMb(localVideoPayloadBytes)}MB). ` +
            'If this deployment is serverless, the request may be rejected before route code runs.'
          );
        }

        const response = await fetch('/api/plugins/motion-analyzer/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-koda-trace-id': traceId,
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw await buildHttpError(response, traceId);
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
              console.warn('[useMotionAnalyzerStream] Failed to parse SSE event:', dataPayload.slice(0, 200), parseErr);
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
        let errorMessage = err instanceof Error ? err.message : 'Stream failed';

        const video = context?.video;
        if (video && !video.remoteUrl) {
          const sizeFromDataUrl = video.dataUrl?.startsWith('data:')
            ? estimateDataUrlBytes(video.dataUrl)
            : 0;
          if (
            sizeFromDataUrl >= SERVERLESS_BODY_LIMIT_BYTES &&
            /fetch failed|network|failed to fetch|stream request failed/i.test(errorMessage)
          ) {
            errorMessage =
              `Request likely exceeded serverless body limits (~4.5MB) before reaching API code, so no server logs were emitted. ` +
              `Local payload size ~${toMb(sizeFromDataUrl)}MB. Configure presigned cloud uploads (R2/S3) or use a smaller clip.`;
          }
        }
        if (abortedRef.current) {
          setIsStreaming(false);
          return fullText;
        }
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
