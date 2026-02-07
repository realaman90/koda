/**
 * Storyboard Generator Streaming API Route
 *
 * POST /api/plugins/storyboard
 * Generates a storyboard using Mastra's agent.stream() with fullStream,
 * forwarding reasoning-delta events as SSE for live thinking display.
 */

import { NextResponse } from 'next/server';
import { Agent } from '@mastra/core/agent';
import {
  StoryboardInputSchema,
  StoryboardOutputSchema,
  getSystemPrompt,
  buildStoryboardPrompt,
} from '@/lib/plugins/official/storyboard-generator/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Default model for storyboard generation */
const DEFAULT_MODEL = 'google/gemini-3-pro-preview';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('\n========== STORYBOARD GENERATION START ==========');
    console.log('[Storyboard] Input received:', JSON.stringify(body, null, 2));

    // Validate input
    const parseResult = StoryboardInputSchema.safeParse(body);
    if (!parseResult.success) {
      console.log('[Storyboard] Validation failed:', parseResult.error.flatten().fieldErrors);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    console.log('[Storyboard] Validated input:', JSON.stringify(input, null, 2));

    // Build the prompt
    const prompt = buildStoryboardPrompt(input);
    const systemPrompt = getSystemPrompt(input.mode);
    console.log('[Storyboard] Built prompt:\n', prompt);
    console.log('[Storyboard] Mode:', input.mode);

    // Create a lightweight agent for this request
    const agent = new Agent({
      id: `storyboard-ai-${Date.now()}`,
      name: 'storyboard-ai',
      instructions: systemPrompt,
      model: DEFAULT_MODEL,
    });

    // Server-side timing
    const serverStart = Date.now();
    console.log('[Storyboard] Starting stream with thinking...');

    // Stream with structured output and thinking enabled
    const result = await agent.stream(prompt, {
      structuredOutput: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: StoryboardOutputSchema as any,
      },
      modelSettings: {
        temperature: 0.1,
      },
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 10000,
            includeThoughts: true,
          },
        },
      },
    });

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
                // Text deltas from structured output generation
                sseData = JSON.stringify({
                  type: 'text-delta',
                  text: chunk.payload.text,
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

              case 'error': {
                sseData = JSON.stringify({
                  type: 'error',
                  error: chunk.payload.error instanceof Error
                    ? chunk.payload.error.message
                    : String(chunk.payload.error),
                });
                break;
              }

              // Handle reasoning/extended thinking
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

          // Server total time
          const serverTotal = ((Date.now() - serverStart) / 1000).toFixed(1);
          console.log(`[Storyboard] Stream complete -- total: ${serverTotal}s`);

          // Send final result event with the structured object
          if (!closed) {
            let structuredObject = undefined;
            try {
              structuredObject = await result.object;
            } catch (err) {
              console.warn('[Storyboard] Failed to get structured object:', err);
            }

            if (structuredObject) {
              console.log('[Storyboard] Generated result:', JSON.stringify(structuredObject, null, 2));
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'result',
                success: true,
                ...structuredObject,
              })}\n\n`));
            } else {
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: 'AI service failed to generate structured output',
              })}\n\n`));
            }
          }

          console.log('========== STORYBOARD GENERATION END ==========\n');
          safeClose();
        } catch (error) {
          if (!closed) {
            console.error('[Storyboard] Stream processing error:', error);
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
    console.error('Storyboard generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      },
      { status: 500 }
    );
  }
}
