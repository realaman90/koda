/**
 * Animation Generator Streaming API Route
 *
 * Uses Mastra's agent.stream() with fullStream to forward all chunk types
 * (text-delta, tool-call, tool-result, finish, error) as SSE events.
 */

import { NextResponse } from 'next/server';
import { animationAgent } from '@/mastra';

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
    sandboxId?: string;
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

    // Prepend context as a system-style user message if provided
    if (context) {
      const contextParts: string[] = [];
      if (context.sandboxId) {
        contextParts.push(`Active sandbox ID: ${context.sandboxId}`);
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

    // Stream the response using Mastra's agent.stream()
    // Type assertion needed: our {role, content}[] is a valid CoreMessage[] but
    // TypeScript can't narrow the MessageListInput union (string | string[] | MessageInput[])
    const result = await animationAgent.stream(
      agentMessages as Parameters<typeof animationAgent.stream>[0],
      {
        providerOptions: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 10000,
            },
          },
        },
      }
    );

    // Create encoder for SSE streaming
    const encoder = new TextEncoder();

    // Track closed state for the stream controller
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
                sseData = JSON.stringify({
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                });
                break;
              }

              case 'tool-result': {
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

              // Handle reasoning/extended thinking (may not be in Mastra's type union yet)
              default: {
                const chunkType = (chunk as { type: string }).type;
                if (chunkType === 'reasoning' || chunkType === 'reasoning-delta') {
                  const payload = (chunk as { payload: Record<string, unknown> }).payload;
                  const reasoningText = payload?.text ?? payload?.content ?? '';
                  if (reasoningText) {
                    sseData = JSON.stringify({
                      type: 'reasoning-delta',
                      text: String(reasoningText),
                    });
                  }
                }
                break;
              }
            }

            if (sseData) {
              safeEnqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
          }

          // Send final complete event (skip if client disconnected)
          if (!closed) {
            try {
              const [text, usage, finishReason] = await Promise.all([
                result.text,
                result.usage,
                result.finishReason,
              ]);

              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                text,
                usage,
                finishReason,
              })}\n\n`));
            } catch {
              // Aggregation failed after stream ended — skip complete event
            }
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
