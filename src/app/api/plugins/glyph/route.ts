/**
 * Glyph Non-Streaming API Route
 *
 * Single-response endpoint for glyph SVG generation via VecGlypher (Fal AI).
 */

import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { z } from 'zod';
import { getAssetStorageType, type AssetStorageProvider } from '@/lib/assets';
import { sanitizeSvg, SvgSanitizationError } from '@/lib/plugins/official/agents/svg-studio/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { withCredits } from '@/lib/credits/with-credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function buildVecglypherInput(input: z.infer<typeof GlyphRequestSchema>, references: string[]): Record<string, unknown> {
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

  throw new Error('VecGlypher did not return SVG output');
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

const MODEL_COST_MAP: Record<string, string> = {
  vecglypher: 'vecglypher',
  'vecglypher-image-to-svg': 'vecglypher-image-to-svg',
};

export const POST = withCredits(
  {
    type: 'svg',
    getCostParams: (body) => ({
      model: MODEL_COST_MAP[(body.model as string) || 'vecglypher'] || 'vecglypher',
    }),
  },
  async (request) => {
    try {
      const policyDecision = evaluatePluginLaunchById('glyph');
      emitPluginPolicyAuditEvent({
        source: 'api',
        decision: policyDecision,
        metadata: { method: 'POST', path: '/api/plugins/glyph' },
      });

      if (!policyDecision.allowed) {
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
      const parsed = GlyphRequestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request payload',
            issues: parsed.error.issues,
          },
          { status: 400 }
        );
      }

      const input = parsed.data;
      const falReferences = Array.from(
        new Set(
          (input.references || []).map((ref) => {
            if (!ref.trim()) return null;
            if (ref.startsWith('/')) return new URL(ref, request.url).toString();
            return ref;
          }).filter((ref): ref is string => !!ref)
        )
      );

      if (input.model === 'vecglypher-image-to-svg' && falReferences.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Glyph Match requires at least one reference image.' },
          { status: 400 }
        );
      }

      const result = await fal.subscribe(
        input.model === 'vecglypher'
          ? 'fal-ai/vecglypher'
          : 'fal-ai/vecglypher/image-to-svg',
        {
          input: buildVecglypherInput(input, falReferences),
          logs: true,
          onQueueUpdate: (update) => {
            console.log('Glyph queue update:', update.status);
          },
        }
      );

      const rawSvg = await extractVecglypherSvg(result as { data?: Record<string, unknown> });
      const sanitized = sanitizeSvg(rawSvg, 300);

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
            model: `fal/${input.model}`,
          },
        });

        asset = {
          id: stored.id,
          url: stored.url,
          mimeType: 'image/svg+xml',
          sizeBytes: svgBuffer.length,
        };
      }

      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'success',
        source: 'api',
        pluginId: 'glyph',
      });

      return NextResponse.json({
        success: true,
        svg: sanitized.svg,
        metadata: sanitized.metadata,
        asset,
      });
    } catch (error) {
      if (error instanceof SvgSanitizationError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }

      console.error('[glyph] Error:', error);
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'glyph',
        errorCode: 'execution_failed',
        metadata: { message: error instanceof Error ? error.message : String(error) },
      });

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      );
    }
  }
);
