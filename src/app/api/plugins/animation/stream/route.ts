/**
 * Animation Generator Streaming API Route
 *
 * Uses Mastra's agent.stream() with fullStream to forward all chunk types
 * (text-delta, tool-call, tool-result, finish, error) as SSE events.
 */

import { NextResponse } from 'next/server';
import { animationAgent } from '@/mastra';
import { getEngineInstructions } from '@/mastra/agents/instructions/animation';
import { loadRecipes } from '@/mastra/recipes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface StreamRequestBody {
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    nodeId?: string;
    phase?: string;
    plan?: unknown;
    todos?: Array<{ id: string; label: string; status: string }>;
    attachments?: Array<{ type: string; url: string }>;
    media?: Array<{ id: string; source: string; name: string; type: string; dataUrl: string; duration?: number; mimeType?: string }>;
    sandboxId?: string;
    engine?: 'remotion' | 'theatre';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
    duration?: number;
    techniques?: string[];
  };
}

export async function POST(request: Request) {
  try {
    const body: StreamRequestBody = await request.json();
    const { prompt, messages, context } = body;

    // Normalize input: accept either prompt (string) or messages (array)
    let agentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;

    if (messages && messages.length > 0) {
      agentMessages = [...messages];
    } else if (prompt) {
      agentMessages = [{ role: 'user', content: prompt }];
    } else {
      return NextResponse.json(
        { error: 'Either prompt or messages is required' },
        { status: 400 }
      );
    }

    // Inject engine-specific instructions as a system message
    const engine = context?.engine || 'remotion';
    const engineInstructions = getEngineInstructions(engine);

    // Load technique recipes if any are selected
    const recipeContent = loadRecipes(context?.techniques || []);
    const systemContent = recipeContent
      ? `${engineInstructions}\n\n${recipeContent}`
      : engineInstructions;

    agentMessages.unshift({
      role: 'system',
      content: systemContent,
    });

    // Prepend context as a system-style user message if provided
    if (context) {
      const contextParts: string[] = [];
      // Engine is ALWAYS included prominently so the agent can't miss it
      contextParts.push(`ANIMATION ENGINE: ${engine.toUpperCase()} — You MUST use template "${engine}" when creating a sandbox. Do NOT use any other engine.`);
      if (context.aspectRatio) {
        contextParts.push(`Aspect ratio: ${context.aspectRatio}`);
      }
      if (context.duration) {
        contextParts.push(`Target duration: ${context.duration} seconds`);
      }
      if (context.sandboxId) {
        contextParts.push(`Active sandbox ID: ${context.sandboxId}`);
      }
      if (context.media && context.media.length > 0) {
        const edgeMedia = context.media.filter(m => m.source === 'edge');
        const uploadMedia = context.media.filter(m => m.source !== 'edge');
        const formatMedia = (m: typeof context.media[0]) =>
          `- [${m.type}] "${m.name}" (source: ${m.source}) ${m.dataUrl.startsWith('data:') ? `BASE64 (~${Math.round(m.dataUrl.length * 0.75 / 1024)}KB) — use sandbox_write_binary to write to public/media/` : `URL: ${m.dataUrl} — use sandbox_upload_media to download to public/media/`}`;

        if (edgeMedia.length > 0) {
          contextParts.push(`⚠️ EDGE MEDIA — ALWAYS CONTENT. Upload and feature prominently in the animation:\n${edgeMedia.map(formatMedia).join('\n')}`);
        }
        if (uploadMedia.length > 0) {
          contextParts.push(`📎 UPLOADED MEDIA — Determine purpose from prompt context (content vs reference):\n${uploadMedia.map(formatMedia).join('\n')}`);
        }
        contextParts.push(
          'For CONTENT media: Upload to public/media/ BEFORE writing code, then pass via mediaFiles to generate_remotion_code. ' +
          'For REFERENCE media: Use analyze_media for design cues, do NOT upload to sandbox. ' +
          'For base64: extract the portion after the comma in "data:mime;base64,DATA" and pass to sandbox_write_binary. ' +
          'For videos, call analyze_media first for scene understanding, then extract_video_frames for key frame images.'
        );
      }
      if (context.techniques && context.techniques.length > 0) {
        contextParts.push(`Selected technique presets: ${context.techniques.join(', ')} — recipe patterns are injected in the system message.`);
      }
      if (context.phase) {
        contextParts.push(`Current phase: ${context.phase}`);
      }
      if (context.plan) {
        contextParts.push(`Animation plan:\n${JSON.stringify(context.plan, null, 2)}`);
      }
      if (context.todos && context.todos.length > 0) {
        contextParts.push(`Progress:\n${context.todos.map(t => `- [${t.status}] ${t.label}`).join('\n')}`);
      }
      if (context.attachments && context.attachments.length > 0) {
        contextParts.push(`${context.attachments.length} reference files attached`);
      }

      if (contextParts.length > 0) {
        // Prepend context to the first user message
        const contextStr = contextParts.join('\n');
        const firstUserIdx = agentMessages.findIndex(m => m.role === 'user');
        if (firstUserIdx >= 0) {
          agentMessages[firstUserIdx] = {
            ...agentMessages[firstUserIdx],
            content: `${agentMessages[firstUserIdx].content}\n\n<context>\n${contextStr}\n</context>`,
          };
        }
      }
    }

    // ── Message windowing ──────────────────────────────────────────
    // Only keep the last N messages to prevent token overflow.
    // The system context (prepended to first user message) provides
    // enough state for the agent to continue coherently.
    const MAX_MESSAGES = 10;
    if (agentMessages.length > MAX_MESSAGES) {
      agentMessages = agentMessages.slice(-MAX_MESSAGES);
    }

    // ── Critical state injection (post-windowing) ────────────────
    // The sandbox ID and engine are critical state — if the agent
    // loses them (pushed out by windowing), it hallucinates fake IDs
    // or picks the wrong engine. Always append as a single trailing
    // system message so it's never lost.
    {
      const trailingParts: string[] = [];
      if (context?.sandboxId) {
        trailingParts.push(`Your active sandbox ID is "${context.sandboxId}". Use EXACTLY this ID for ALL sandbox tool calls. Do NOT invent, guess, or create new sandbox IDs.`);
      }
      trailingParts.push(`ENGINE: ${engine}. Use template="${engine}" for sandbox_create. Do NOT use any other engine.`);
      agentMessages.push({
        role: 'system',
        content: `CRITICAL STATE: ${trailingParts.join(' ')}`,
      });
    }

    // ⏱ Server-side timing
    const serverStart = Date.now();
    console.log(`⏱ [Animation API] Stream request — engine: ${engine}, messages: ${agentMessages.length}, sandboxId: ${context?.sandboxId || 'NONE'}, phase: ${context?.phase || 'unknown'}, techniques: ${context?.techniques?.length || 0}${recipeContent ? ` (~${Math.round(recipeContent.length / 4)} tokens)` : ''}`);

    const result = await animationAgent.stream(
      agentMessages as Parameters<typeof animationAgent.stream>[0],
      {
        maxSteps: 50,
        providerOptions: {
          // Each provider ignores keys meant for other providers
          google: { thinkingConfig: { thinkingBudget: 8192 } },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
        },
      }
    );

    // Create encoder for SSE streaming
    const encoder = new TextEncoder();

    // Track closed state for the stream controller
    let closed = false;

    // Track sandbox ID discovered from sandbox_create tool results
    // so the client can store it for subsequent stream calls
    let discoveredSandboxId: string | null = null;

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

        // Close early when the client disconnects
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
              case 'text-delta': {
                sseData = JSON.stringify({
                  type: 'text-delta',
                  text: chunk.payload.text,
                });
                break;
              }

              case 'tool-call': {
                const toolElapsed = ((Date.now() - serverStart) / 1000).toFixed(1);
                console.log(`⏱ [Animation API] Tool call: ${chunk.payload.toolName} at +${toolElapsed}s`);
                sseData = JSON.stringify({
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                });
                break;
              }

              case 'tool-result': {
                const resultElapsed = ((Date.now() - serverStart) / 1000).toFixed(1);
                const isErr = chunk.payload.isError;
                console.log(`⏱ [Animation API] Tool result: ${chunk.payload.toolName} at +${resultElapsed}s ${isErr ? '❌' : '✅'}`);

                // Track sandbox ID from sandbox_create results so the client
                // can persist it for subsequent stream calls (Issue #47)
                if (
                  chunk.payload.toolName === 'sandbox_create' &&
                  !isErr &&
                  chunk.payload.result &&
                  typeof chunk.payload.result === 'object' &&
                  'sandboxId' in (chunk.payload.result as Record<string, unknown>)
                ) {
                  const newSandboxId = (chunk.payload.result as Record<string, unknown>).sandboxId;
                  if (typeof newSandboxId === 'string' && newSandboxId) {
                    discoveredSandboxId = newSandboxId;
                    console.log(`⏱ [Animation API] Discovered sandbox ID: ${discoveredSandboxId}`);
                    // Send a custom SSE event so the frontend can store it
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'sandbox-created',
                      sandboxId: discoveredSandboxId,
                    })}\n\n`));
                  }
                }

                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  result: chunk.payload.result,
                  isError: chunk.payload.isError,
                });
                break;
              }

              case 'finish': {
                sseData = JSON.stringify({
                  type: 'finish',
                  finishReason: chunk.payload.stepResult?.reason,
                });
                break;
              }

              case 'step-finish': {
                sseData = JSON.stringify({
                  type: 'step-finish',
                  usage: chunk.payload.output?.usage ?? chunk.payload.totalUsage,
                });
                break;
              }

              case 'tool-error': {
                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  result: { error: chunk.payload.error instanceof Error ? chunk.payload.error.message : String(chunk.payload.error) },
                  isError: true,
                });
                break;
              }

              case 'error': {
                sseData = JSON.stringify({
                  type: 'error',
                  error: chunk.payload.error instanceof Error
                    ? chunk.payload.error.message
                    : String(chunk.payload.error),
                });
                break;
              }

              case 'reasoning-delta': {
                if (chunk.payload.text) {
                  sseData = JSON.stringify({
                    type: 'reasoning-delta',
                    text: chunk.payload.text,
                  });
                }
                break;
              }

              // reasoning-start, reasoning-end, reasoning-signature — skip silently
              case 'reasoning-start':
              case 'reasoning-end':
              case 'reasoning-signature':
              case 'redacted-reasoning':
                break;

              default:
                break;
            }

            if (sseData) {
              safeEnqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
          }

          // ⏱ Server total time
          const serverTotal = ((Date.now() - serverStart) / 1000).toFixed(1);
          console.log(`⏱ [Animation API] Stream complete — total: ${serverTotal}s`);

          // Send final complete event (ALWAYS — even if aggregation fails)
          // This is critical: the client relies on 'complete' to know the stream ended
          if (!closed) {
            let text = '';
            let usage = undefined;
            let finishReason = undefined;
            try {
              [text, usage, finishReason] = await Promise.all([
                result.text,
                result.usage,
                result.finishReason,
              ]);
            } catch (aggregationErr) {
              // Aggregation failed — send complete with empty text
              // This happens when agent only did tool calls without generating text
              console.warn('Stream aggregation failed (likely tool-only response):', aggregationErr);
            }

            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              text: text || '',
              usage,
              finishReason,
            })}\n\n`));
          }
          safeClose();
        } catch (error) {
          if (!closed) {
            console.error('Stream processing error:', error);
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Stream error',
            })}\n\n`));
          }
          safeClose();
        }
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Animation streaming error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Streaming failed' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking stream status
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('nodeId');

  if (!nodeId) {
    return NextResponse.json(
      { error: 'nodeId parameter required' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    status: 'ready',
    nodeId,
    agentId: 'animation-agent',
    capabilities: [
      // UI Tools
      'update_todo',
      'batch_update_todos',
      'set_thinking',
      'add_message',
      'request_approval',
      // Planning Tools
      'analyze_prompt',
      'generate_plan',
      // Sandbox Lifecycle
      'sandbox_create',
      'sandbox_destroy',
      // Sandbox Operations
      'sandbox_write_file',
      'sandbox_read_file',
      'sandbox_run_command',
      'sandbox_list_files',
      // Preview & Visual
      'sandbox_start_preview',
      'sandbox_screenshot',
      // Rendering
      'render_preview',
      'render_final',
    ],
  });
}
