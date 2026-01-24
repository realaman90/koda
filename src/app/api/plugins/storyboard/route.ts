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
  STORYBOARD_SYSTEM_PROMPT,
  buildStoryboardPrompt,
} from '@/lib/plugins/official/storyboard-generator/schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const parseResult = StoryboardInputSchema.safeParse(body);
    if (!parseResult.success) {
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

    // Build the prompt
    const prompt = buildStoryboardPrompt(input);

    // Generate using AI service
    const aiService = new AIService();
    const result = await aiService.generateStructured(
      prompt,
      StoryboardOutputSchema,
      {
        systemPrompt: STORYBOARD_SYSTEM_PROMPT,
        temperature: 0.7,
      }
    );

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
