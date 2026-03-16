/**
 * Glyph Streaming API Route
 *
 * SSE endpoint that streams glyph SVG generation via VecGlypher (Fal AI).
 * Supports two modes:
 * - vecglypher: renders text as styled SVG vector glyphs
 * - vecglypher-image-to-svg: converts reference images into SVG glyphs
 */

import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getAssetStorageType, type AssetStorageProvider } from '@/lib/assets';
import { sanitizeSvg, SvgSanitizationError } from '@/lib/plugins/official/agents/svg-studio/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { requireActor } from '@/lib/auth/actor';
import { getOrCreateBalance, deductCredits, refundCredits } from '@/lib/db/credit-queries';
import { getCreditCost, PLAN_KEYS } from '@/lib/credits/costs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

fal.config({
  credentials: process.env.FAL_KEY,
});

const GlyphRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  model: z.enum(['vecglypher', 'vecglypher-image-to-svg']).default('vecglypher'),
  references: z.array(z.string().min(1)).max(8).optional(),
  settings: z.object({
    fillColor: z.string().max(64).default('black'),
    strokeColor: z.string().max(64).default(''),
    strokeWidth: z.number().min(0.1).max(50).default(1),
    outputSize: z.number().int().min(64).max(4096).default(512),
    temperature: z.number().min(0).max(2).default(0.1),
    seed: z.number().int().optional(),
    maxTokens: z.number().int().min(256).max(16384).default(8192),
  }).optional(),
  persistAsset: z.boolean().default(true),
  nodeId: z.string().optional(),
  canvasId: z.string().optional(),
});

function normalizeFalReferenceUrl(ref: string, request: Request): string | undefined {
  if (!ref.trim()) return undefined;
  if (ref.startsWith('data:')) return ref;

  try {
    const absolute = new URL(ref);
    if (absolute.protocol === 'http:' || absolute.protocol === 'https:') {
      return absolute.toString();
    }
    return undefined;
  } catch {
    if (ref.startsWith('/')) {
      return new URL(ref, request.url).toString();
    }
    return undefined;
  }
}

function buildVecglypherInput(
  input: z.infer<typeof GlyphRequestSchema>,
  references: string[],
): Record<string, unknown> {
  const s = input.settings;
  const outputSize = s?.outputSize || 512;
  const fillColor = s?.fillColor || 'black';
  const strokeColor = s?.strokeColor || undefined;
  const strokeWidth = s?.strokeWidth ?? 1;
  const temperature = s?.temperature ?? 0.1;
  const maxTokens = s?.maxTokens ?? 8192;
  const seed = s?.seed;

  const common: Record<string, unknown> = {
    output_size: outputSize,
    fill_color: fillColor,
    temperature,
    max_tokens: maxTokens,
    ...(strokeColor ? { stroke_color: strokeColor, stroke_width: strokeWidth } : {}),
    ...(seed !== undefined ? { seed } : {}),
  };

  if (input.model === 'vecglypher-image-to-svg') {
    if (references.length === 0) {
      throw new Error('Glyph Match requires at least one reference image');
    }

    return {
      prompt: input.prompt,
      reference_image_urls: references,
      ...common,
    };
  }

  const userPrompt = input.prompt.trim();
  let glyphText = userPrompt;
  let styleDesc = 'bold, sans-serif, modern, clean';

  if (userPrompt.includes(' ') && userPrompt.length > 15) {
    const quotedMatch = userPrompt.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      glyphText = quotedMatch[1];
      styleDesc = userPrompt.replace(quotedMatch[0], '').trim() || styleDesc;
    } else {
      const words = userPrompt.split(/\s+/);
      glyphText = words[0];
      styleDesc = words.slice(1).join(' ') || styleDesc;
    }
  }

  return {
    prompt: glyphText,
    style_description: styleDesc,
    ...common,
  };
}

async function extractVecglypherSvg(result: { data?: Record<string, unknown> }): Promise<string> {
  const data = result.data || {};
  const svgContent = typeof data.svg_content === 'string' ? data.svg_content : '';
  if (svgContent.trim()) {
    return svgContent;
  }

  const imageUrl = (data.image as { url?: string } | undefined)?.url;
  if (typeof imageUrl === 'string' && imageUrl.trim()) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('VecGlypher returned an unreadable SVG asset');
    }
    return await response.text();
  }

  throw new Error('VecGlypher did not produce SVG output');
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

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

type SendFn = (event: string, data: Record<string, unknown>) => void;

export async function POST(request: Request) {
  let userId: string | undefined;
  let creditCost: number | undefined;

  try {
    // ── Policy check ──
    const policyDecision = evaluatePluginLaunchById('glyph');
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/glyph/stream' },
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
    const parsed = GlyphRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const model = input.model;
    const costModel = model;
    const normalizedFalReferences = Array.from(
      new Set((input.references || []).map((ref) => normalizeFalReferenceUrl(ref, request)).filter((ref): ref is string => !!ref))
    );

    if (model === 'vecglypher-image-to-svg' && normalizedFalReferences.length === 0) {
      return NextResponse.json(
        { error: 'Glyph Match requires at least one reference image.' },
        { status: 400 }
      );
    }

    creditCost = getCreditCost('svg', { model: costModel });

    const deductResult = await deductCredits(userId!, creditCost, `glyph:${costModel}`, { model: costModel });
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
        const send: SendFn = (event, data) => {
          try {
            controller.enqueue(encoder.encode(sseEvent(event, data)));
          } catch {
            // Stream already closed
          }
        };

        try {
          send('phase', { phase: 'generating' });

          const result = await fal.subscribe(
            model === 'vecglypher'
              ? 'fal-ai/vecglypher'
              : 'fal-ai/vecglypher/image-to-svg',
            {
              input: buildVecglypherInput(input, normalizedFalReferences),
              logs: true,
              onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                  send('phase', { phase: 'drafting' });
                }
              },
            }
          );

          const rawSvg = await extractVecglypherSvg(result as { data?: Record<string, unknown> });
          send('svg-update', { svg: rawSvg, final: true });

          // ── Sanitize ──
          send('phase', { phase: 'finalizing' });
          const sanitized = sanitizeSvg(rawSvg, 300);

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
                model: `fal/${costModel}`,
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
            pluginId: 'glyph',
          });
        } catch (error) {
          const message = error instanceof SvgSanitizationError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Glyph generation failed';

          console.error('[glyph/stream] Error:', error);
          send('error', { error: message });

          emitLaunchMetric({
            metric: 'plugin_execution',
            status: 'error',
            source: 'api',
            pluginId: 'glyph',
            errorCode: 'execution_failed',
            metadata: { message },
          });
        } finally {
          if (!svgDelivered && userId && creditCost) {
            await refundCredits(userId, creditCost, `failed:glyph:${costModel}`, { reason: 'no_svg_delivered' });
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
    if (userId && creditCost) {
      await refundCredits(userId, creditCost, 'error:glyph:pre-stream', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    console.error('[glyph/stream] Pre-stream error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
