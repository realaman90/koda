import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_VIDEO_MODELS, XSKILL_VIDEO_MODELS, VIDEO_MODEL_PROVIDERS, type VideoModelType } from '@/lib/types';
import { getVideoModelAdapter, type VideoGenerateRequest } from '@/lib/model-adapters';
import { saveGeneratedVideo } from '@/lib/video-storage';

export const maxDuration = 600;

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

/**
 * Generate video via Fal.ai
 */
async function generateViaFal(
  modelId: string,
  input: Record<string, unknown>,
  adapter: { extractVideoUrl: (result: Record<string, unknown>) => string | undefined }
): Promise<string> {
  const result = await fal.subscribe(modelId, {
    input,
    logs: true,
    onQueueUpdate: (update) => {
      console.log('Video queue update:', update.status);
    },
  });

  console.log('Fal generation result:', result);

  const videoUrl = adapter.extractVideoUrl(result as Record<string, unknown>);
  if (!videoUrl) {
    throw new Error('No video generated from Fal');
  }
  return videoUrl;
}

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
      videoUrl: inputVideoUrl,
      generateAudio,
    } = body;

    const modelType = model as VideoModelType;
    const provider = VIDEO_MODEL_PROVIDERS[modelType] || 'fal';

    console.log('Received model from request:', { model, modelType, provider });

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
      videoUrl: inputVideoUrl,
      generateAudio,
    };

    // Get adapter and build input
    const adapter = getVideoModelAdapter(modelType);
    const input = adapter.buildInput(generateRequest);

    console.log('Video generation request:', {
      provider,
      receivedModel: model,
      hasReferenceUrl: !!referenceUrl,
      hasFirstFrameUrl: !!firstFrameUrl,
      hasLastFrameUrl: !!lastFrameUrl,
      referenceUrlsCount: referenceUrls?.length || 0,
      input,
    });

    if (provider === 'xskill') {
      // xskill.ai path — return taskId immediately for client-side polling
      const xskillModelId = XSKILL_VIDEO_MODELS[modelType];
      if (!xskillModelId) {
        throw new Error(`No xskill model ID for ${modelType}`);
      }

      const { xskillCreateTask } = await import('@/lib/xskill');
      const { taskId } = await xskillCreateTask({ model: xskillModelId, params: input });

      return NextResponse.json({
        async: true,
        taskId,
        model: xskillModelId,
      });
    }

    // Fal path (default) — synchronous
    const falModelId = FAL_VIDEO_MODELS[modelType];
    if (!falModelId) {
      console.warn(`No Fal model ID for "${modelType}". Falling back to veo-3.`);
    }
    const modelLabel = falModelId || FAL_VIDEO_MODELS['veo-3']!;
    const videoUrl = await generateViaFal(modelLabel, input, adapter);

    // Save video to configured asset storage (local filesystem, R2, or S3)
    const { canvasId, nodeId } = body;
    const savedUrl = await saveGeneratedVideo(videoUrl, {
      prompt: prompt || '',
      model: modelLabel,
      canvasId,
      nodeId,
    });

    return NextResponse.json({
      success: true,
      videoUrl: savedUrl,
      originalUrl: videoUrl,
      model: modelLabel,
    });
  } catch (error) {
    console.error('Video generation error:', error);

    // Extract detailed error
    let errorMessage = 'Video generation failed';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Fal SDK errors may have a body with validation details
      const falError = error as Error & { body?: unknown; status?: number; detail?: string };
      if (falError.body) {
        console.error('Fal error body:', JSON.stringify(falError.body, null, 2));
        const body = falError.body as { detail?: string | Array<{ msg: string }> };
        if (typeof body.detail === 'string') {
          errorMessage = body.detail;
        } else if (Array.isArray(body.detail)) {
          errorMessage = body.detail.map(d => d.msg).join('; ');
        }
      }
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
