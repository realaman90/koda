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
    referenceImages: z.array(z.string()).max(10).optional(),
    canvasContext: z.object({
      connectedNodes: z.array(z.object({
        direction: z.enum(['upstream', 'downstream']),
        handleId: z.string(),
        nodeType: z.string(),
        pluginId: z.string().optional(),
        name: z.string().optional(),
        detail: z.string().optional(),
      })),
    }).optional(),
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

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

function getRequestOrigin(request: Request): string | null {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return null;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

function toAbsoluteUrl(raw: string, request: Request): URL | null {
  const value = raw.trim();
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    if (!value.startsWith('/')) return null;
    const origin = getRequestOrigin(request);
    if (!origin) return null;
    try {
      return new URL(`${origin}${value}`);
    } catch {
      return null;
    }
  }
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '127.0.0.1' || h === '::1') return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true;
  return false;
}

function isLikelyPublicReferenceUrl(url: URL, request: Request): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (isPrivateHostname(url.hostname)) return false;
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/assets/')) return false;

  const publicPrefixes = [
    process.env.R2_PUBLIC_URL,
    process.env.S3_PUBLIC_URL,
    process.env.ASSET_BASE_URL,
  ]
    .map(normalizeBaseUrl)
    .filter((v): v is string => !!v);

  const href = url.toString();
  if (publicPrefixes.some((prefix) => href.startsWith(prefix))) {
    return true;
  }

  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').toLowerCase();
  if (host && url.hostname.toLowerCase() === host) {
    return !url.pathname.startsWith('/api/');
  }

  return true;
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content may be multimodal parts
    let agentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: any }>;

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

    // Inject reference images as multimodal parts on the last user message
    if (context?.referenceImages?.length) {
      const imageParts = context.referenceImages
        .map((rawUrl) => toAbsoluteUrl(rawUrl, request))
        .filter((url): url is URL => !!url)
        .filter((url) => isLikelyPublicReferenceUrl(url, request))
        .map((url) => ({ type: 'image' as const, image: url }));

      if (imageParts.length < context.referenceImages.length) {
        console.warn(
          `[Prompt Studio API] Skipped ${context.referenceImages.length - imageParts.length} non-public/invalid reference image URL(s) to avoid upstream fetch failures`
        );
      }

      for (let i = agentMessages.length - 1; i >= 0; i--) {
        if (agentMessages[i].role === 'user') {
          const textContent = agentMessages[i].content as string;
          if (imageParts.length > 0) {
            agentMessages[i].content = [
              { type: 'text', text: textContent },
              ...imageParts,
            ];
          }
          break;
        }
      }
    }

    // Inject canvas context as a system message so the agent knows about connected nodes
    if (context?.canvasContext?.connectedNodes?.length) {
      const nodes = context.canvasContext.connectedNodes;
      const downstream = nodes.filter(n => n.direction === 'downstream');
      const upstream = nodes.filter(n => n.direction === 'upstream');

      const lines: string[] = ['<canvas-context>'];
      lines.push('You are on a design canvas. Here are the nodes connected to your Prompt Studio:');

      if (downstream.length > 0) {
        lines.push('\nDownstream (your prompt output flows TO these nodes):');
        for (const n of downstream) {
          const label = n.name || n.pluginId || n.nodeType;
          const detail = n.detail ? ` (${n.detail})` : '';
          lines.push(`  - ${label}${detail} [type: ${n.nodeType}, handle: ${n.handleId}]`);
        }
      }

      if (upstream.length > 0) {
        lines.push('\nUpstream (these nodes provide input TO you):');
        for (const n of upstream) {
          const label = n.name || n.pluginId || n.nodeType;
          const detail = n.detail ? ` (${n.detail})` : '';
          lines.push(`  - ${label}${detail} [type: ${n.nodeType}, handle: ${n.handleId}]`);
        }
      }

      lines.push('</canvas-context>');

      // Prepend as system message
      agentMessages = [
        { role: 'system', content: lines.join('\n') },
        ...agentMessages,
      ];
    }

    const requestContext = new RequestContext();
    if (context?.nodeId) {
      requestContext.set('nodeId' as never, context.nodeId as never);
    }

    console.log(`[Prompt Studio API] Starting stream: nodeId=${context?.nodeId}, messageCount=${agentMessages.length}, connectedNodes=${context?.canvasContext?.connectedNodes?.length || 0}`);

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
          // Gate: when ask_questions is called, suppress everything else
          // and close stream after its tool-result so agent waits for user answers
          let askQuestionsGate = false;
          let streamErrored = false;
          let streamErrorMessage: string | null = null;
          const UI_TOOLS = new Set(['ask_questions', 'set_thinking']);

          while (!closed) {
            const { done, value: chunk } = await reader.read();
            if (done || closed) break;

            let sseData: string | null = null;

            switch (chunk.type) {
              case 'text-delta':
                // Suppress text after ask_questions (agent may write "Let me ask..." before tool)
                if (askQuestionsGate) break;
                sseData = JSON.stringify({
                  type: 'text-delta',
                  text: chunk.payload.text,
                });
                break;

              case 'tool-call':
                if (chunk.payload.toolName === 'ask_questions') {
                  askQuestionsGate = true;
                }
                // After gate, suppress non-UI tool calls (e.g. generate_prompt called in same step)
                if (askQuestionsGate && !UI_TOOLS.has(chunk.payload.toolName)) break;
                sseData = JSON.stringify({
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                });
                break;

              case 'tool-result':
                // After gate, suppress non-UI tool results
                if (askQuestionsGate && !UI_TOOLS.has(chunk.payload.toolName)) break;
                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                  result: chunk.payload.result,
                  isError: chunk.payload.isError,
                });
                // Close stream after ask_questions result — wait for user answers
                if (chunk.payload.toolName === 'ask_questions' && !chunk.payload.isError) {
                  if (sseData && !closed) {
                    safeEnqueue(encoder.encode(`data: ${sseData}\n\n`));
                  }
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', text: '' })}\n\n`));
                  console.log('[Prompt Studio API] ask_questions gate: closing stream to wait for user answers');
                  safeClose();
                  return;
                }
                break;

              case 'tool-error':
                if (askQuestionsGate && !UI_TOOLS.has(chunk.payload.toolName)) break;
                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
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
                streamErrored = true;
                streamErrorMessage = chunk.payload.error instanceof Error
                  ? chunk.payload.error.message
                  : String(chunk.payload.error);
                sseData = JSON.stringify({
                  type: 'error',
                  error: streamErrorMessage,
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

            if (streamErrored) {
              emitLaunchMetric({
                metric: 'plugin_execution',
                status: 'error',
                source: 'api',
                pluginId: 'prompt-studio',
                errorCode: 'stream_provider_error',
                metadata: { message: streamErrorMessage || 'Unknown stream provider error' },
              });
              safeClose();
              return;
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
