import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_AUDIO_MODELS } from '@/lib/types';

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      videoUrl,
      duration,
      cfgStrength,
      negativePrompt,
    } = body;

    const modelId = FAL_AUDIO_MODELS['mmaudio-v2'];

    // Validate input
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    // Build input for MMAudio V2
    const input: Record<string, unknown> = {
      prompt: prompt || '',
      video_url: videoUrl,
      duration: duration || 10,
      cfg_strength: cfgStrength || 4.5,
    };

    if (negativePrompt) {
      input.negative_prompt = negativePrompt;
    }

    console.log('Video audio generation request:', { modelId, input });

    // Call Fal API with queue subscription
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Video audio queue update:', update.status);
      },
    });

    console.log('Video audio generation result:', result);

    // MMAudio returns a video with synced audio
    const data = result.data as { video?: { url: string } } | undefined;
    const outputUrl = data?.video?.url;

    if (!outputUrl) {
      throw new Error('No output generated');
    }

    return NextResponse.json({
      success: true,
      videoUrl: outputUrl,
      model: modelId,
    });
  } catch (error) {
    console.error('Video audio generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video audio generation failed' },
      { status: 500 }
    );
  }
}
