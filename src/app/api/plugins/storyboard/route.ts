/**
 * Storyboard Generator API Route
 *
 * POST /api/plugins/storyboard
 * Generates a storyboard using the AI service with structured output.
 */

import { NextResponse } from 'next/server';
import { AIService } from '@/lib/plugins/ai-service';
import {
  StoryboardInputSchema,
  StoryboardOutputSchema,
  getSystemPrompt,
  buildStoryboardPrompt,
} from '@/lib/plugins/official/storyboard-generator/schema';

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
    console.log('[Storyboard] System prompt:\n', systemPrompt);

    // Generate using AI service
    console.log('[Storyboard] Calling AI service (Gemini 3 Pro with thinking)...');
    const startTime = Date.now();

    const aiService = new AIService();
    const result = await aiService.generateStructured(
      prompt,
      StoryboardOutputSchema,
      {
        systemPrompt,
        temperature: 0.1,
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Storyboard] AI response received in ${duration}s`);
    console.log('[Storyboard] Generated result:', JSON.stringify(result, null, 2));
    console.log('========== STORYBOARD GENERATION END ==========\n');

    return NextResponse.json({
      success: true,
      ...result,
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
