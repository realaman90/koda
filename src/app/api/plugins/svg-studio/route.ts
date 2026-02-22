import { NextResponse } from 'next/server';
import { AIService } from '@/lib/plugins/ai-service';
import { getAssetStorageType, type AssetStorageProvider } from '@/lib/assets';
import {
  buildSvgStudioPrompt,
  sanitizeSvg,
  SvgSanitizationError,
  SVG_STUDIO_SYSTEM_PROMPT,
  SvgStudioAgentOutputSchema,
  SvgStudioRequestSchema,
  SVG_STUDIO_MAX_RAW_SIZE,
} from '@/lib/plugins/official/agents/svg-studio/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SVG_PLUGIN_ENABLED = process.env.NEXT_PUBLIC_SVG_PLUGIN_V1 === 'true';

async function getProvider(): Promise<AssetStorageProvider> {
  const storageType = getAssetStorageType();

  if (storageType === 'r2' || storageType === 's3') {
    const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
    return getS3AssetProvider(storageType);
  }

  const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
  return getLocalAssetProvider();
}

export async function POST(request: Request) {
  try {
    if (!SVG_PLUGIN_ENABLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'svg-studio is disabled. Set NEXT_PUBLIC_SVG_PLUGIN_V1=true to enable.',
        },
        { status: 404 }
      );
    }

    const policyDecision = evaluatePluginLaunchById('svg-studio');
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/svg-studio' },
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
    const parsed = SvgStudioRequestSchema.safeParse(body);

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

    if (input.svg && input.svg.length > SVG_STUDIO_MAX_RAW_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `SVG exceeds ${SVG_STUDIO_MAX_RAW_SIZE} bytes`,
        },
        { status: 413 }
      );
    }

    const aiService = new AIService();
    const prompt = buildSvgStudioPrompt(input);

    const result = await aiService.generateStructured(prompt, SvgStudioAgentOutputSchema, {
      systemPrompt: SVG_STUDIO_SYSTEM_PROMPT,
      model: 'google/gemini-3.1-pro-preview',
      temperature: 0.2,
    });

    const sanitized = sanitizeSvg(result.svg, input.constraints?.maxPaths ?? 300);

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
          model: 'google/gemini-3.1-pro-preview',
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
      pluginId: 'svg-studio',
    });

    return NextResponse.json({
      success: true,
      svg: sanitized.svg,
      metadata: {
        ...sanitized.metadata,
        warnings: [...sanitized.metadata.warnings, ...(result.warnings || [])],
      },
      asset,
    });
  } catch (error) {
    if (error instanceof SvgSanitizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('[svg-studio] Error:', error);
    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'error',
      source: 'api',
      pluginId: 'svg-studio',
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
