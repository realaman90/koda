import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_VIDEO_MODELS, type VideoModelType } from '@/lib/types';
import { getVideoModelAdapter, type VideoGenerateRequest } from '@/lib/model-adapters';

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      model,
      aspectRatio,
      duration,
      resolution,
      referenceUrl,
      firstFrameUrl,
      lastFrameUrl,
      referenceUrls,
      generateAudio,
    } = body;

    const modelType = model as VideoModelType;
    const modelId = FAL_VIDEO_MODELS[modelType] || FAL_VIDEO_MODELS['veo-3'];

    // Validate input - at least prompt or some image reference is needed
    if (!prompt && !referenceUrl && !firstFrameUrl && !referenceUrls?.length) {
      return NextResponse.json(
        { error: 'Either prompt or image reference is required' },
        { status: 400 }
      );
    }

    // Build request for adapter
    const generateRequest: VideoGenerateRequest = {
      prompt: prompt || '',
      model: modelType,
      aspectRatio,
      duration,
      resolution,
      referenceUrl,
      firstFrameUrl,
      lastFrameUrl,
      referenceUrls,
      generateAudio,
    };

    // Get adapter and build input
    const adapter = getVideoModelAdapter(modelType);
    const input = adapter.buildInput(generateRequest);

    console.log('Video generation request:', { modelId, input });

    // Call Fal API with queue subscription for long-running video generation
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Video queue update:', update.status);
      },
    });

    console.log('Video generation result:', result);

    // Extract video URL using adapter
    const videoUrl = adapter.extractVideoUrl(result as Record<string, unknown>);

    if (!videoUrl) {
      throw new Error('No video generated');
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      model: modelId,
    });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 }
    );
  }
}
