import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS } from '@/lib/types';
import type { MusicGenerateRequest } from '@/lib/model-adapters';

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      duration,
      instrumental,
      guidanceScale,
    } = body;

    const modelId = FAL_AUDIO_MODELS['ace-step'];

    // Validate input
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Build request
    const generateRequest: MusicGenerateRequest = {
      prompt,
      duration: duration || 30,
      instrumental: instrumental ?? false,
      guidanceScale: guidanceScale || 7,
    };

    // Build input for ACE-Step
    const input = {
      prompt: generateRequest.prompt,
      duration: generateRequest.duration,
      instrumental: generateRequest.instrumental,
      guidance_scale: generateRequest.guidanceScale,
    };

    console.log('Music generation request:', { modelId, input });

    // Call Fal API with queue subscription for long-running generation
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Music queue update:', update.status);
      },
    });

    console.log('Music generation result:', result);

    // Extract audio URL
    const data = result.data as { audio?: { url: string } } | undefined;
    const audioUrl = data?.audio?.url;

    if (!audioUrl) {
      throw new Error('No audio generated');
    }

    return NextResponse.json({
      success: true,
      audioUrl,
      model: modelId,
    });
  } catch (error) {
    console.error('Music generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Music generation failed' },
      { status: 500 }
    );
  }
}
