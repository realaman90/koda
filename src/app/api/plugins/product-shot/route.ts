/**
 * Product Shot API Route
 *
 * POST /api/plugins/product-shot
 * Generates a product shot plan using the AI service with structured output.
 */

import { NextResponse } from 'next/server';
import { AIService } from '@/lib/plugins/ai-service';
import {
  ProductShotInputSchema,
  ProductShotOutputSchema,
  PRODUCT_SHOT_SYSTEM_PROMPT,
  buildProductShotPrompt,
} from '@/lib/plugins/official/product-shot/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';

export async function POST(request: Request) {
  try {
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

    // Generate using AI service
    console.log('[ProductShot] Calling AI service (Gemini 3 Pro with thinking)...');
    const startTime = Date.now();

    const aiService = new AIService();
    const result = await aiService.generateStructured(
      prompt,
      ProductShotOutputSchema,
      {
        systemPrompt: PRODUCT_SHOT_SYSTEM_PROMPT,
        temperature: 0.1,
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ProductShot] AI response received in ${duration}s`);
    console.log('[ProductShot] Generated result:', JSON.stringify(result, null, 2));
    console.log('========== PRODUCT SHOT GENERATION END ==========\n');

    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'success',
      source: 'api',
      pluginId: 'product-shot',
    });

    return NextResponse.json({
      success: true,
      ...result,
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
