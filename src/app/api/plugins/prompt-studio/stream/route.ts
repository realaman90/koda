/**
 * Prompt Studio Streaming API Route
 *
 * Simple Mastra agent stream — no sandbox, no plan gate.
 * Receives chat messages, streams creative prompt generation as SSE.
 */

import { NextResponse } from 'next/server';
import { promptStudioAgent } from '@/mastra/agents/prompt-studio-agent';
import { RequestContext } from '@mastra/core/di';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PromptStudioRequestSchema = z.object({
  prompt: z.string().min(1).max(4000).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).max(50).optional(),
  context: z.object({
    nodeId: z.string().max(128).optional(),
    phase: z.string().max(64).optional(),
  }).optional(),
}).superRefine((value, ctx) => {
  if ((!value.prompt || value.prompt.trim().length === 0) && (!value.messages || value.messages.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either prompt or messages is required',
      path: ['prompt'],
    });
  }
});

export async function POST(request: Request) {
  try {
    const policyDecision = evaluatePluginLaunchById('prompt-studio');
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/prompt-studio/stream' },
    });

    if (!policyDecision.allowed) {
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'prompt-studio',
        errorCode: policyDecision.code,
      });

      return NextResponse.json(
        {
          error: 'Plugin launch blocked by policy.',
          code: policyDecision.code,
          reason: policyDecision.reason,
        },
        { status: policyDecision.code === 'PLUGIN_NOT_FOUND' ? 404 : 403 }
      );
    }

    const rawBody = await request.json();
    const parsedBody = PromptStudioRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          issues: parsedBody.error.issues,
        },
        { status: 400 }
      );
    }

    const { prompt, messages, context } = parsedBody.data;

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
        pluginId: 'prompt-studio',
        errorCode: 'missing_prompt_or_messages',
      });
      return NextResponse.json(
        { error: 'Either prompt or messages is required' },
        { status: 400 }
      );
    }

    const requestContext = new RequestContext();
    if (context?.nodeId) {
      requestContext.set('nodeId' as never, context.nodeId as never);
    }

    console.log(`[Prompt Studio API] Starting stream: nodeId=${context?.nodeId}, messageCount=${agentMessages.length}`);

    const result = await promptStudioAgent.stream(
      agentMessages as Parameters<typeof promptStudioAgent.stream>[0],
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

          if (!closed) {
            const text = await result.text;
            const usage = await result.usage;
            emitLaunchMetric({
              metric: 'plugin_execution',
              status: 'success',
              source: 'api',
              pluginId: 'prompt-studio',
            });
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              text,
              usage,
            })}\n\n`));
          }

          safeClose();
        } catch (error) {
          console.error('[Prompt Studio API] Stream error:', error);
          emitLaunchMetric({
            metric: 'plugin_execution',
            status: 'error',
            source: 'api',
            pluginId: 'prompt-studio',
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
    console.error('[Prompt Studio API] Error:', error);
    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'error',
      source: 'api',
      pluginId: 'prompt-studio',
      errorCode: 'execution_failed',
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
