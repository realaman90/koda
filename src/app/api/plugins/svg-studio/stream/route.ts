/**
 * SVG Studio Streaming API Route
 *
 * SSE endpoint that streams SVG generation progressively.
 * Supports two paths:
 * - LLM (Gemini): uses Mastra agent.stream() with raw SVG output
 * - Quiver Arrow: raw fetch + SSE parsing against Quiver REST API
 */

import { NextResponse } from 'next/server';
import { Agent } from '@mastra/core/agent';
import { auth } from '@clerk/nextjs/server';
import { getAssetStorageType, type AssetStorageProvider } from '@/lib/assets';
import {
  autoCloseSvg,
  buildStreamingPrompt,
  sanitizeSvg,
  SvgSanitizationError,
  SVG_STUDIO_STREAMING_SYSTEM_PROMPT,
  SvgStudioRequestSchema,
} from '@/lib/plugins/official/agents/svg-studio/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { requireActor } from '@/lib/auth/actor';
import { getOrCreateBalance, deductCredits, refundCredits } from '@/lib/db/credit-queries';
import { getCreditCost, PLAN_KEYS } from '@/lib/credits/costs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SVG_MODEL = 'gemini-3.1-pro-preview';

const MODEL_COST_MAP: Record<string, string> = {
  gemini: SVG_MODEL,
  'quiver-arrow': 'quiver-arrow',
};

function getExecutionModelLabel(model: string, costModel: string): string {
  if (model === 'quiver-arrow') return `quiver/${costModel}`;
  return `google/${costModel}`;
}

async function getProvider(): Promise<AssetStorageProvider> {
  const storageType = getAssetStorageType();
  if (storageType === 'r2' || storageType === 's3') {
    const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
    return getS3AssetProvider(storageType);
  }
  const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
  return getLocalAssetProvider();
}

/** Helper to send an SSE event */
function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Extract <svg>...</svg> from raw text */
function extractSvg(text: string): string | null {
  const match = text.match(/<svg[\s\S]*<\/svg>/i);
  return match ? match[0] : null;
}

export async function POST(request: Request) {
  let userId: string | undefined;
  let creditCost: number | undefined;

  try {
    // ── Policy check ──
    const policyDecision = evaluatePluginLaunchById('svg-studio');
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/svg-studio/stream' },
    });

    if (!policyDecision.allowed) {
      return NextResponse.json(
        { error: 'Plugin launch blocked by policy.', code: policyDecision.code, reason: policyDecision.reason },
        { status: policyDecision.code === 'PLUGIN_NOT_FOUND' ? 404 : 403 }
      );
    }

    // ── Auth + Credits ──
    const actorResult = await requireActor();
    if (!actorResult.ok) return actorResult.response;
    userId = actorResult.actor.user.id;

    let planKey = 'free_user';
    const { has: hasPlan } = await auth();
    if (hasPlan) {
      for (const plan of PLAN_KEYS) {
        if (plan === 'free_user') continue;
        if (hasPlan({ plan })) { planKey = plan; break; }
      }
    }
    await getOrCreateBalance(userId!, planKey);

    const body = await request.json();
    const parsed = SvgStudioRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const model = input.model || 'gemini';
    const costModel = MODEL_COST_MAP[model] || SVG_MODEL;

    // Resolve all reference images to base64 server-side.
    // Gemini can't reliably fetch external URLs via file parts, so we
    // always convert to base64 for both LLM and Quiver paths.
    const resolvedReferenceBase64s: Array<{ base64: string; mimeType: string }> = [];
    if (input.references?.length) {
      for (const ref of input.references) {
        try {
          if (ref.startsWith('data:')) {
            // Data URI — extract base64 directly
            const match = ref.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              resolvedReferenceBase64s.push({ base64: match[2], mimeType: match[1] });
            }
          } else if (ref.startsWith('/api/assets/')) {
            // Local asset path — resolve to public URL via provider, then fetch
            const assetId = ref.split('/api/assets/')[1];
            const provider = await getProvider();
            const asset = await provider.get(assetId);
            if (asset?.url) {
              const imgRes = await fetch(asset.url);
              if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                resolvedReferenceBase64s.push({
                  base64: buf.toString('base64'),
                  mimeType: asset.metadata?.mimeType || imgRes.headers.get('content-type')?.split(';')[0] || 'image/png',
                });
              }
            }
          } else if (ref.startsWith('http')) {
            // Public URL (R2/S3) — fetch and convert to base64
            const imgRes = await fetch(ref);
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              const contentType = imgRes.headers.get('content-type') || 'image/png';
              resolvedReferenceBase64s.push({
                base64: buf.toString('base64'),
                mimeType: contentType.split(';')[0],
              });
            }
          } else if (ref.startsWith('/')) {
            // Relative URL — make absolute then fetch
            const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/$/, '') || '';
            if (origin) {
              const imgRes = await fetch(`${origin}${ref}`);
              if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                const contentType = imgRes.headers.get('content-type') || 'image/png';
                resolvedReferenceBase64s.push({
                  base64: buf.toString('base64'),
                  mimeType: contentType.split(';')[0],
                });
              }
            }
          }
        } catch (err) {
          console.warn(`[svg-studio/stream] Failed to resolve ref: ${ref}`, err);
        }
      }
    }

    creditCost = getCreditCost('svg', { model: costModel });

    const deductResult = await deductCredits(userId!, creditCost, `svg:${costModel}`, { model: costModel });
    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_CREDITS',
          message: `This generation costs ${creditCost} credits but you have ${deductResult.balance}. Upgrade your plan for more credits.`,
          required: creditCost,
          balance: deductResult.balance,
        },
        { status: 402 }
      );
    }

    // ── Stream setup ──
    const encoder = new TextEncoder();
    let svgDelivered = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(sseEvent(event, data)));
          } catch {
            // Stream already closed
          }
        };

        try {
          let finalSvg: string;

          if (model === 'quiver-arrow') {
            finalSvg = await streamFromQuiver(input, send, resolvedReferenceBase64s);
          } else {
            finalSvg = await streamFromLLM(input, send, resolvedReferenceBase64s);
          }

          // ── Sanitize ──
          send('phase', { phase: 'finalizing' });
          const sanitized = sanitizeSvg(finalSvg, input.constraints?.maxPaths ?? 300);

          // ── Persist asset ──
          let asset: { id: string; url: string; mimeType: 'image/svg+xml'; sizeBytes: number } | undefined;
          if (input.persistAsset) {
            const provider = await getProvider();
            const svgBuffer = Buffer.from(sanitized.svg, 'utf-8');
            const stored = await provider.saveFromBuffer(svgBuffer, {
              type: 'image',
              extension: 'svg',
              metadata: {
                mimeType: 'image/svg+xml',
                sizeBytes: svgBuffer.length,
                nodeId: input.nodeId,
                canvasId: input.canvasId,
                prompt: input.prompt,
                model: getExecutionModelLabel(model, costModel),
              },
            });

            asset = {
              id: stored.id,
              url: stored.url,
              mimeType: 'image/svg+xml',
              sizeBytes: svgBuffer.length,
            };
          }

          svgDelivered = true;

          send('complete', {
            svg: sanitized.svg,
            metadata: sanitized.metadata,
            asset,
          });

          emitLaunchMetric({
            metric: 'plugin_execution',
            status: 'success',
            source: 'api',
            pluginId: 'svg-studio',
          });
        } catch (error) {
          const message = error instanceof SvgSanitizationError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'SVG generation failed';

          console.error('[svg-studio/stream] Error:', error);
          send('error', { error: message });

          emitLaunchMetric({
            metric: 'plugin_execution',
            status: 'error',
            source: 'api',
            pluginId: 'svg-studio',
            errorCode: 'execution_failed',
            metadata: { message },
          });
        } finally {
          // Refund credits if no SVG was delivered
          if (!svgDelivered && userId && creditCost) {
            await refundCredits(userId, creditCost, `failed:svg:${costModel}`, { reason: 'no_svg_delivered' });
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    // Pre-stream error (auth, parse, etc.)
    if (userId && creditCost) {
      await refundCredits(userId, creditCost, 'error:svg:pre-stream', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    console.error('[svg-studio/stream] Pre-stream error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// LLM Path (Gemini)
// ═══════════════════════════════════════════════════════════════════

type SendFn = (event: string, data: Record<string, unknown>) => void;

async function streamFromLLM(
  input: ReturnType<typeof SvgStudioRequestSchema.parse>,
  send: SendFn,
  base64Refs: Array<{ base64: string; mimeType: string }>,
): Promise<string> {
  send('phase', { phase: 'generating' });

  const agent = new Agent({
    id: `svg-studio-stream-${Date.now()}`,
    name: 'svg-studio-streaming',
    instructions: SVG_STUDIO_STREAMING_SYSTEM_PROMPT,
    model: `google/${SVG_MODEL}`,
  });

  const promptText = buildStreamingPrompt(input);

  // Build multimodal message parts: text prompt + reference images
  // Images are passed as proper file content parts (not dumped as base64 text)
  const contentParts: Array<Record<string, unknown>> = [];

  // Add reference images as file content parts (base64)
  for (const ref of base64Refs) {
    contentParts.push({
      type: 'file',
      data: ref.base64,
      mediaType: ref.mimeType,
    });
  }

  // Add the text prompt
  contentParts.push({ type: 'text', text: promptText });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any = (base64Refs.length > 0)
    ? [{ role: 'user', content: contentParts }]
    : promptText;

  const result = await agent.stream(messages, {
    modelSettings: { temperature: 0.2 },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 10000,
          includeThoughts: true,
        },
      },
    },
  });

  let accumulated = '';
  let lastSentLength = 0;
  const CHUNK_THRESHOLD = 200; // chars between updates
  let sentReasoning = false;

  const reader = result.fullStream.getReader();
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;

    if (chunk.type === 'redacted-reasoning') {
      if (!sentReasoning) {
        send('phase', { phase: 'reasoning' });
        sentReasoning = true;
      }
      continue;
    }

    if (chunk.type === 'text-delta') {
      accumulated += chunk.payload.text;

      // Send partial SVG updates periodically
      if (accumulated.length - lastSentLength >= CHUNK_THRESHOLD) {
        const closed = autoCloseSvg(accumulated);
        if (closed) {
          send('svg-update', { svg: closed, final: false });
          lastSentLength = accumulated.length;
        }
      }
    }
  }

  // Extract final SVG
  const finalSvg = extractSvg(accumulated);
  if (!finalSvg) {
    throw new Error('LLM did not produce valid SVG markup');
  }

  return finalSvg;
}

// ═══════════════════════════════════════════════════════════════════
// Quiver Arrow Path
// ═══════════════════════════════════════════════════════════════════
// Uses raw fetch + SSE parsing instead of the SDK's generateSVG()
// because the SDK's internal Zod validation rejects non-standard
// SSE event types (e.g. "generating") that the Quiver API emits.

const QUIVER_API_URL = 'https://api.quiver.ai/v1/svgs/generations';

async function streamFromQuiver(
  input: ReturnType<typeof SvgStudioRequestSchema.parse>,
  send: SendFn,
  base64Refs: Array<{ base64: string; mimeType: string }>,
): Promise<string> {
  const apiKey = process.env.QUIVER_API_KEY;
  if (!apiKey) {
    throw new Error('QUIVER_API_KEY is not configured');
  }

  send('phase', { phase: 'generating' });

  const body: Record<string, unknown> = {
    model: 'arrow-preview',
    prompt: input.prompt,
    stream: true,
    temperature: 0.8,
  };

  if (input.instructions) {
    body.instructions = input.instructions;
  }

  // Pass references as base64
  const refs: Array<Record<string, string>> = [];
  for (const r of base64Refs) refs.push({ base64: r.base64 });
  if (refs.length > 0) body.references = refs;

  // If editing, include source SVG in instructions
  if (input.action === 'edit' && input.svg) {
    body.instructions = `${input.instructions || ''}\n\nEdit the following SVG while preserving its intent:\n${input.svg}`.trim();
  }

  const response = await fetch(QUIVER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Quiver API error ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream from Quiver API');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalSvg: string | null = null;
  let currentEvent = '';

  // Quiver streams SVG token-by-token (1-2 chars per draft event).
  // Accumulate tokens and periodically send auto-closed partial SVGs.
  let accumulated = '';
  let lastSentLength = 0;
  const CHUNK_THRESHOLD = 150; // chars between client updates
  let sentDraftPhase = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }

      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const eventData = JSON.parse(dataStr) as Record<string, unknown>;
          const eventType = currentEvent || (eventData.type as string) || (eventData.event as string);
          const svgField = (eventData.svg as string) || '';

          if (eventType === 'reasoning') {
            send('phase', { phase: 'reasoning' });
          } else if (eventType === 'draft' || eventType === 'generating') {
            if (!sentDraftPhase) {
              send('phase', { phase: 'drafting' });
              sentDraftPhase = true;
            }

            // Accumulate token-by-token SVG content
            accumulated += svgField;

            // Periodically send renderable partial SVG
            if (accumulated.length - lastSentLength >= CHUNK_THRESHOLD) {
              const closed = autoCloseSvg(accumulated);
              if (closed) {
                send('svg-update', { svg: closed, final: false });
                lastSentLength = accumulated.length;
              }
            }
          } else if (eventType === 'content') {
            // Content event may also stream token-by-token
            if (svgField.length <= 10) {
              accumulated += svgField;
            } else {
              // Large content = complete SVG
              finalSvg = svgField;
              send('svg-update', { svg: svgField, final: true });
            }
            // Also check data array format (non-streaming response shape)
            const dataArr = eventData.data as Array<{ svg: string }> | undefined;
            if (dataArr?.[0]?.svg) {
              finalSvg = dataArr[0].svg;
            }
          }
        } catch {
          // Ignore unparseable SSE lines
        }
        currentEvent = '';
      }
    }
  }

  // If accumulated tokens but no explicit final SVG, extract from accumulated
  if (!finalSvg && accumulated.length > 0) {
    finalSvg = extractSvg(accumulated) || accumulated;
  }

  // Send one last partial update if we have unsent content
  if (finalSvg && lastSentLength < accumulated.length) {
    send('svg-update', { svg: finalSvg, final: true });
  }

  // Fallback: try parsing remaining buffer as JSON
  if (!finalSvg && buffer.trim()) {
    try {
      const fallback = JSON.parse(buffer) as { data?: Array<{ svg: string }> };
      if (fallback.data?.[0]?.svg) {
        finalSvg = fallback.data[0].svg;
      }
    } catch { /* not JSON */ }
  }

  if (!finalSvg) {
    throw new Error('Quiver Arrow did not produce SVG output');
  }

  return finalSvg;
}
