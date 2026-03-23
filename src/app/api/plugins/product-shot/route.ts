/**
 * Product Shot API Route
 *
 * POST /api/plugins/product-shot
 * Generates a product shot plan using a multimodal agent with structured output.
 */

import { NextResponse } from 'next/server';
import { Agent } from '@mastra/core/agent';
import {
  ProductShotInputSchema,
  ProductShotOutputSchema,
  PRODUCT_SHOT_SYSTEM_PROMPT,
  buildProductShotPrompt,
} from '@/lib/plugins/official/product-shot/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';

const DEFAULT_MODEL = 'google/gemini-3-pro-preview';

async function fetchImageAsBase64(url: string, requestUrl: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return { base64: match[2], mediaType: match[1] };
      }
      console.warn('[ProductShot] Malformed data URL');
      return null;
    }

    const resolvedUrl = /^https?:\/\//i.test(url) ? url : new URL(url, requestUrl).toString();
    const res = await fetch(resolvedUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`[ProductShot] Failed to fetch reference image (${res.status}): ${resolvedUrl}`);
      return null;
    }

    const contentType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    const buffer = await res.arrayBuffer();
    return {
      base64: Buffer.from(buffer).toString('base64'),
      mediaType: contentType,
    };
  } catch (err) {
    console.warn('[ProductShot] Reference image fetch error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const policyDecision = evaluatePluginLaunchById('product-shot');
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/product-shot' },
    });

    if (!policyDecision.allowed) {
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'product-shot',
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
    console.log('\n========== PRODUCT SHOT GENERATION START ==========');
    console.log('[ProductShot] Input received:', JSON.stringify(body, null, 2));

    // Validate input
    const parseResult = ProductShotInputSchema.safeParse(body);
    if (!parseResult.success) {
      console.log('[ProductShot] Validation failed:', parseResult.error.flatten().fieldErrors);
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'product-shot',
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
    console.log('[ProductShot] Validated input:', JSON.stringify(input, null, 2));

    // Build the prompt
    const prompt = buildProductShotPrompt(input);
    console.log('[ProductShot] Built prompt:\n', prompt);

    // Build multimodal input if a reference image was supplied
    let agentInput: string | Array<{ role: 'user'; content: Array<Record<string, unknown>> }> = prompt;
    if (input.productImageUrl) {
      const referenceImage = await fetchImageAsBase64(input.productImageUrl, request.url);
      if (referenceImage) {
        agentInput = [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: referenceImage.base64,
                mediaType: referenceImage.mediaType,
              },
              {
                type: 'text',
                text:
                  `${prompt}\n\nREFERENCE PRODUCT IMAGE ATTACHED.\n` +
                  'The attached image is the source of truth. Identify the exact product from the image and preserve its category, silhouette, materials, finishes, and visible details in every shot prompt. ' +
                  'Do not reinterpret or replace it with another product type.',
              },
            ],
          },
        ];
      }
    }

    // Generate using Gemini with the reference image attached when available
    console.log('[ProductShot] Calling multimodal agent (Gemini 3 Pro with thinking)...');
    const startTime = Date.now();

    const agent = new Agent({
      id: `product-shot-ai-${Date.now()}`,
      name: 'product-shot-ai',
      instructions: PRODUCT_SHOT_SYSTEM_PROMPT,
      model: DEFAULT_MODEL,
    });

    const result = await agent.generate(agentInput as Parameters<typeof agent.generate>[0], {
      structuredOutput: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: ProductShotOutputSchema as any,
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

    if (result.object === undefined) {
      throw new Error('Product shot agent failed to generate structured output');
    }

    const output = result.object;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ProductShot] AI response received in ${duration}s`);
    console.log('[ProductShot] Generated result:', JSON.stringify(output, null, 2));
    console.log('========== PRODUCT SHOT GENERATION END ==========\n');

    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'success',
      source: 'api',
      pluginId: 'product-shot',
    });

    return NextResponse.json({
      success: true,
      ...output,
    });
  } catch (error) {
    console.error('Product shot generation error:', error);
    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'error',
      source: 'api',
      pluginId: 'product-shot',
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
