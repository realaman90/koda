/**
 * Motion Analyzer Streaming API Route
 *
 * Simple Mastra agent stream — no sandbox, no plan gate.
 * Receives video (base64 or URL) + prompt, streams analysis results as SSE.
 */

import { NextResponse } from 'next/server';
import { motionAnalyzerAgent } from '@/mastra/agents/motion-analyzer-agent';
import { RequestContext } from '@mastra/core/di';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export const bodySizeLimit = '50mb';

interface StreamRequestBody {
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    nodeId?: string;
    phase?: string;
    video?: {
      id: string;
      source: 'upload' | 'youtube';
      name: string;
      dataUrl: string; // data: URL, http(s) URL (from presigned upload), or blob URL
      remoteUrl?: string; // R2/S3 URL from presigned upload
      youtubeUrl?: string;
      mimeType?: string;
      duration?: number;
      trimStart?: number;
      trimEnd?: number;
    };
  };
}

export async function POST(request: Request) {
  try {
    const body: StreamRequestBody = await request.json();
    const { prompt, messages, context } = body;

    // Normalize input
    let agentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;

    if (messages && messages.length > 0) {
      agentMessages = [...messages];
    } else if (prompt) {
      agentMessages = [{ role: 'user', content: prompt }];
    } else {
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'motion-analyzer',
        errorCode: 'missing_prompt_or_messages',
      });
      return NextResponse.json(
        { error: 'Either prompt or messages is required' },
        { status: 400 }
      );
    }

    // RequestContext for server-side data
    const requestContext = new RequestContext();
    if (context?.nodeId) {
      requestContext.set('nodeId' as never, context.nodeId as never);
    }

    // If a video was provided, extract base64 data and pass to requestContext
    // so the analyze_video_motion tool can access it
    if (context?.video?.dataUrl) {
      const dataUrl = context.video.dataUrl;

      if (dataUrl.startsWith('data:')) {
        const commaIdx = dataUrl.indexOf(',');
        const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        const mimeMatch = dataUrl.match(/^data:([^;,]+)/);
        const mimeType = mimeMatch?.[1] || context.video.mimeType || 'video/mp4';

        requestContext.set('videoBase64' as never, base64 as never);
        requestContext.set('videoMimeType' as never, mimeType as never);
        requestContext.set('videoName' as never, context.video.name as never);

        // Pass trim range to RequestContext so the analyze tool can use it
        if (context.video.trimStart !== undefined) {
          requestContext.set('trimStart' as never, context.video.trimStart as never);
        }
        if (context.video.trimEnd !== undefined) {
          requestContext.set('trimEnd' as never, context.video.trimEnd as never);
        }

        const hasTrim = context.video.trimStart !== undefined && context.video.trimEnd !== undefined;
        const trimInfo = hasTrim
          ? `\nIMPORTANT: The user selected a trim range of ${context.video.trimStart}s to ${context.video.trimEnd}s (${(context.video.trimEnd! - context.video.trimStart!).toFixed(1)}s segment). Focus your analysis ONLY on this time window. Timestamps in your response should be relative to the start of the full video.`
          : '';

        console.log(`[Motion Analyzer API] Video loaded: ${context.video.name} (${mimeType}, ${Math.round(base64.length * 0.75 / 1024)}KB)${hasTrim ? ` [trim: ${context.video.trimStart}s-${context.video.trimEnd}s]` : ''}`);

        agentMessages.unshift({
          role: 'system',
          content: `[VIDEO UPLOADED: "${context.video.name}" (${mimeType}${context.video.duration ? `, ${context.video.duration}s total` : ''})]
The video data is available. Use the analyze_video_motion tool with the video data to perform motion analysis.${trimInfo}`,
        });
      } else if (dataUrl.startsWith('http')) {
        requestContext.set('videoUrl' as never, dataUrl as never);
        requestContext.set('videoMimeType' as never, (context.video.mimeType || 'video/mp4') as never);
        requestContext.set('videoName' as never, context.video.name as never);

        if (context.video.trimStart !== undefined) {
          requestContext.set('trimStart' as never, context.video.trimStart as never);
        }
        if (context.video.trimEnd !== undefined) {
          requestContext.set('trimEnd' as never, context.video.trimEnd as never);
        }

        const hasTrim = context.video.trimStart !== undefined && context.video.trimEnd !== undefined;
        const trimInfo = hasTrim
          ? `\nIMPORTANT: The user selected a trim range of ${context.video.trimStart}s to ${context.video.trimEnd}s (${(context.video.trimEnd! - context.video.trimStart!).toFixed(1)}s segment). Focus your analysis ONLY on this time window.`
          : '';

        console.log(`[Motion Analyzer API] Video URL: ${context.video.name} → ${dataUrl.slice(0, 80)}${hasTrim ? ` [trim: ${context.video.trimStart}s-${context.video.trimEnd}s]` : ''}`);

        agentMessages.unshift({
          role: 'system',
          content: `[VIDEO URL: "${context.video.name}" (${context.video.mimeType || 'video/mp4'}${context.video.duration ? `, ${context.video.duration}s total` : ''})]
The video is available at a URL. Use the analyze_video_motion tool with videoUrl to perform motion analysis.${trimInfo}`,
        });
      }
    }

    // YouTube URL handling
    if (context?.video?.source === 'youtube' && context.video.youtubeUrl) {
      requestContext.set('youtubeUrl' as never, context.video.youtubeUrl as never);
      agentMessages.unshift({
        role: 'system',
        content: `[YOUTUBE VIDEO: ${context.video.youtubeUrl}]
Note: YouTube URL provided. Analyze the video content using the URL.`,
      });
    }

    console.log(`[Motion Analyzer API] Starting stream: nodeId=${context?.nodeId}, hasVideo=${!!context?.video}, messageCount=${agentMessages.length}`);

    // Stream the agent response
    const result = await motionAnalyzerAgent.stream(
      agentMessages as Parameters<typeof motionAnalyzerAgent.stream>[0],
      {
        maxSteps: 20,
        requestContext,
      }
    );

    const encoder = new TextEncoder();
    let closed = false;

    const readable = new ReadableStream({
      async start(controller) {
        const safeEnqueue = (data: Uint8Array) => {
          if (!closed) {
            try { controller.enqueue(data); } catch { closed = true; }
          }
        };
        const safeClose = () => {
          if (!closed) {
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
          }
        };

        request.signal.addEventListener('abort', () => {
          closed = true;
          safeClose();
        });

        try {
          const reader = result.fullStream.getReader();

          while (!closed) {
            const { done, value: chunk } = await reader.read();
            if (done || closed) break;

            let sseData: string | null = null;

            switch (chunk.type) {
              case 'text-delta':
                sseData = JSON.stringify({
                  type: 'text-delta',
                  text: chunk.payload.text,
                });
                break;

              case 'tool-call':
                sseData = JSON.stringify({
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                });
                break;

              case 'tool-result':
                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  result: chunk.payload.result,
                  isError: chunk.payload.isError,
                });
                break;

              case 'tool-error':
                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  result: { error: chunk.payload.error instanceof Error ? chunk.payload.error.message : String(chunk.payload.error) },
                  isError: true,
                });
                break;

              case 'step-finish':
                sseData = JSON.stringify({
                  type: 'step-finish',
                  usage: chunk.payload.output?.usage ?? chunk.payload.totalUsage,
                });
                break;

              case 'finish':
                sseData = JSON.stringify({
                  type: 'finish',
                  finishReason: chunk.payload.stepResult?.reason,
                });
                break;

              case 'error':
                sseData = JSON.stringify({
                  type: 'error',
                  error: chunk.payload.error instanceof Error
                    ? chunk.payload.error.message
                    : String(chunk.payload.error),
                });
                break;

              case 'reasoning-delta':
                if (chunk.payload.text) {
                  sseData = JSON.stringify({
                    type: 'reasoning-delta',
                    text: chunk.payload.text,
                  });
                }
                break;

              case 'reasoning-start':
              case 'reasoning-end':
              case 'reasoning-signature':
              case 'redacted-reasoning':
                break;

              default:
                break;
            }

            if (sseData && !closed) {
              safeEnqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
          }

          // Send complete event
          if (!closed) {
            const text = await result.text;
            const usage = await result.usage;
            emitLaunchMetric({
              metric: 'plugin_execution',
              status: 'success',
              source: 'api',
              pluginId: 'motion-analyzer',
            });
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              text,
              usage,
            })}\n\n`));
          }

          safeClose();
        } catch (error) {
          console.error('[Motion Analyzer API] Stream error:', error);
          emitLaunchMetric({
            metric: 'plugin_execution',
            status: 'error',
            source: 'api',
            pluginId: 'motion-analyzer',
            errorCode: 'stream_error',
            metadata: { message: error instanceof Error ? error.message : String(error) },
          });
          if (!closed) {
            const errMsg = error instanceof Error ? error.message : String(error);
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`));
          }
          safeClose();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Motion Analyzer API] Error:', error);
    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'error',
      source: 'api',
      pluginId: 'motion-analyzer',
      errorCode: 'execution_failed',
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
