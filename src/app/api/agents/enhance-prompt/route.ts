import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const agent = mastra.getAgent('promptEnhancer');
    const response = await agent.generate(prompt);

    return NextResponse.json({
      success: true,
      originalPrompt: prompt,
      enhancedPrompt: response.text,
    });
  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent failed' },
      { status: 500 }
    );
  }
}
