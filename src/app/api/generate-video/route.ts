import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_VIDEO_MODELS, type VideoModelType } from '@/lib/types';
import { getVideoModelAdapter, type VideoGenerateRequest } from '@/lib/model-adapters';
import { getAssetStorageType, getExtensionFromUrl, type AssetStorageProvider } from '@/lib/assets';

export const maxDuration = 300;

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

/**
 * Get the asset storage provider (server-side only)
 */
async function getProvider(): Promise<AssetStorageProvider> {
  const storageType = getAssetStorageType();
  
  if (storageType === 'r2' || storageType === 's3') {
    const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
    return getS3AssetProvider(storageType);
  }
  
  const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
  return getLocalAssetProvider();
}

/**
 * Save generated video to configured asset storage
 * Returns local URL if storage is configured, otherwise returns original URL
 */
async function saveGeneratedVideo(
  url: string,
  options: { prompt: string; model: string; canvasId?: string; nodeId?: string }
): Promise<string> {
  const storageType = getAssetStorageType();
  
  // If using default (no storage configured), return original URL
  if (storageType === 'local' && !process.env.ASSET_STORAGE) {
    return url;
  }

  const provider = await getProvider();

  try {
    const extension = getExtensionFromUrl(url) || 'mp4';
    const asset = await provider.saveFromUrl(url, {
      type: 'video',
      extension,
      metadata: {
        mimeType: `video/${extension}`,
        prompt: options.prompt,
        model: options.model,
        canvasId: options.canvasId,
        nodeId: options.nodeId,
      },
    });
    return asset.url;
  } catch (error) {
    console.error('Failed to save video asset:', error);
    // Fall back to original URL if save fails
    return url;
  }
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
      generateAudio,
    } = body;

    const modelType = model as VideoModelType;

    // Debug: Log received model
    console.log('Received model from request:', { model, modelType, isValidKey: modelType in FAL_VIDEO_MODELS });

    if (!model || !(model in FAL_VIDEO_MODELS)) {
      console.warn(`Invalid or missing model: "${model}". Falling back to veo-3.`);
    }

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

    console.log('Video generation request:', {
      modelId,
      receivedModel: model,
      hasReferenceUrl: !!referenceUrl,
      hasFirstFrameUrl: !!firstFrameUrl,
      hasLastFrameUrl: !!lastFrameUrl,
      referenceUrlsCount: referenceUrls?.length || 0,
      input,
    });

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

    // Save video to configured asset storage (local filesystem, R2, or S3)
    const { canvasId, nodeId } = body;
    const savedUrl = await saveGeneratedVideo(videoUrl, {
      prompt: prompt || '',
      model: modelId,
      canvasId,
      nodeId,
    });

    return NextResponse.json({
      success: true,
      videoUrl: savedUrl, // Now local URL if storage configured
      originalUrl: videoUrl, // Keep original fal.ai URL as backup
      model: modelId,
    });
  } catch (error) {
    console.error('Video generation error:', error);

    // Extract detailed error from Fal SDK (may include body/detail with validation info)
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
