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
  getRefinementSystemPrompt,
  buildRefinementPrompt,
  type VideoModelFamily,
} from '@/lib/plugins/official/storyboard-generator/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { loadVideoRecipes, VIDEO_RECIPE_PRESETS } from '@/mastra/recipes/video';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Default model for storyboard generation */
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';

/**
 * Fetch an image URL and return base64 data + media type.
 * Handles both HTTP URLs and data: URLs.
 * Returns null on failure (non-blocking — storyboard still works without the image).
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    // Handle data: URLs directly (already base64-encoded)
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return { base64: match[2], mediaType: match[1] };
      }
      console.warn('[Storyboard] Malformed data URL');
      return null;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`[Storyboard] Failed to fetch image (${res.status}): ${url}`);
      return null;
    }
    const contentType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return { base64, mediaType: contentType };
  } catch (err) {
    console.warn('[Storyboard] Image fetch error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const policyDecision = evaluatePluginLaunchById('storyboard-generator');
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/storyboard' },
    });

    if (!policyDecision.allowed) {
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'storyboard-generator',
        errorCode: policyDecision.code,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Plugin launch blocked by policy.',
          code: policyDecision.code,
          reason: policyDecision.reason,
        },
        { status: policyDecision.code === 'PLUGIN_NOT_FOUND' ? 404 : 403 }
      );
    }

    const body = await request.json();
    console.log('\n========== STORYBOARD GENERATION START ==========');
    console.log('[Storyboard] Input received:', JSON.stringify(body, null, 2));

    // Check if this is a refinement request
    const isRefinement = body.previousDraft && body.feedback;

    let prompt: string;
    let systemPrompt: string;

    // --- Backward compat: synthesize references from legacy product/character ---
    if (!body.references && (body.product || body.character)) {
      const syntheticRefs: Array<{ id: string; role: string; label: string; description: string; imageUrl?: string }> = [];
      if (body.product) {
        syntheticRefs.push({
          id: 'ref_legacy_product',
          role: 'subject',
          label: body.product,
          description: body.product,
          imageUrl: body.productImageUrl,
        });
      }
      if (body.character) {
        syntheticRefs.push({
          id: 'ref_legacy_character',
          role: 'character',
          label: body.character,
          description: body.character,
          imageUrl: body.characterImageUrl,
        });
      }
      body.references = syntheticRefs;
    }

    // Collect reference image URLs from references array
    const references: Array<{ id: string; role: string; label: string; description: string; imageUrl?: string }> =
      body.references || [];

    if (isRefinement) {
      // Refinement turn: use previous draft + feedback
      const mode = body.mode || 'transition';
      const targetVideoModel: VideoModelFamily = body.targetVideoModel || 'veo';
      prompt = buildRefinementPrompt(body.previousDraft, body.feedback, mode);
      systemPrompt = getRefinementSystemPrompt(mode, targetVideoModel);
      console.log('[Storyboard] Refinement mode, target model:', targetVideoModel);
      console.log('[Storyboard] Feedback:', body.feedback);
    } else {
      // Initial generation: validate full input
      const parseResult = StoryboardInputSchema.safeParse(body);
      if (!parseResult.success) {
        console.log('[Storyboard] Validation failed:', parseResult.error.flatten().fieldErrors);
        emitLaunchMetric({
          metric: 'plugin_execution',
          status: 'error',
          source: 'api',
          pluginId: 'storyboard-generator',
          errorCode: 'invalid_input',
        });
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

      prompt = buildStoryboardPrompt(input);
      systemPrompt = getSystemPrompt(input.mode, input.targetVideoModel);

      // Inject video recipes if explicitly selected by caller
      if (input.videoRecipes && input.videoRecipes.length > 0) {
        const recipeContent = loadVideoRecipes(input.videoRecipes);
        if (recipeContent) {
          systemPrompt = `${systemPrompt}\n\n${recipeContent}`;
          console.log('[Storyboard] Injected video recipes:', input.videoRecipes.join(', '));
        }
      }
    }

    // Fetch all reference images in parallel (non-blocking)
    const refsWithImages = references.filter(r => r.imageUrl);
    const fetchedImages = await Promise.all(
      refsWithImages.map(async (ref) => ({
        ref,
        image: await fetchImageAsBase64(ref.imageUrl!),
      }))
    );

    // Build multimodal message if we have reference images
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: Array<Record<string, any>> = [];
    const imageLabels: string[] = [];

    for (const { ref, image } of fetchedImages) {
      if (image) {
        contentParts.push({
          type: 'file',
          data: image.base64,
          mediaType: image.mediaType,
        });
        const roleLabel = ref.role.toUpperCase();
        imageLabels.push(`REFERENCE IMAGE [${roleLabel}]: "${ref.label}"`);
        console.log(`[Storyboard] Attached ${roleLabel} image for "${ref.label}":`, ref.imageUrl);
      }
    }

    // Augment prompt with image context instructions
    if (imageLabels.length > 0) {
      const imageInstructions = `\n\nREFERENCE IMAGES ATTACHED: ${imageLabels.join(', ')}
Study the attached image(s) carefully. Your referenceIdentities descriptions must match the EXACT visual details you see — colors, materials, textures, shapes, clothing, accessories. Do NOT invent or change any visual attribute. Every scene prompt must reproduce these exact visual details for the referenced items.`;
      prompt = prompt + imageInstructions;
    }

    // Add the text prompt as the final content part
    contentParts.push({ type: 'text', text: prompt });

    // Use multimodal message if images are attached, plain string otherwise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentInput: any = imageLabels.length > 0
      ? [{ role: 'user', content: contentParts }]
      : prompt;

    console.log('[Storyboard] Built prompt:\n', prompt);

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
    const result = await agent.stream(agentInput, {
      structuredOutput: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: StoryboardOutputSchema as any,
      },
      modelSettings: {
        temperature: 0.4,
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
              emitLaunchMetric({
                metric: 'plugin_execution',
                status: 'success',
                source: 'api',
                pluginId: 'storyboard-generator',
              });
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'result',
                success: true,
                ...structuredObject,
              })}\n\n`));
            } else {
              emitLaunchMetric({
                metric: 'plugin_execution',
                status: 'error',
                source: 'api',
                pluginId: 'storyboard-generator',
                errorCode: 'missing_structured_output',
              });
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
            emitLaunchMetric({
              metric: 'plugin_execution',
              status: 'error',
              source: 'api',
              pluginId: 'storyboard-generator',
              errorCode: 'stream_error',
              metadata: { message: error instanceof Error ? error.message : String(error) },
            });
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
    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'error',
      source: 'api',
      pluginId: 'storyboard-generator',
      errorCode: 'execution_failed',
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      },
      { status: 500 }
    );
  }
}
