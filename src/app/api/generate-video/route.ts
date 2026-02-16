import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_VIDEO_MODELS, XSKILL_VIDEO_MODELS, VIDEO_MODEL_PROVIDERS, type VideoModelType } from '@/lib/types';
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

/**
 * Generate video via xskill.ai (async task-based)
 */
async function generateViaXskill(
  xskillModelId: string,
  params: Record<string, unknown>
): Promise<string> {
  const { xskillGenerate } = await import('@/lib/xskill');

  const videoUrl = await xskillGenerate(
    { model: xskillModelId, params },
    {
      onStatusUpdate: (status) => {
        console.log('xskill task status:', status);
      },
    }
  );

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

    let videoUrl: string;
    let modelLabel: string;

    if (provider === 'xskill') {
      // xskill.ai path — adapter.buildInput() returns the params block
      const xskillModelId = XSKILL_VIDEO_MODELS[modelType];
      if (!xskillModelId) {
        throw new Error(`No xskill model ID for ${modelType}`);
      }
      modelLabel = xskillModelId;
      videoUrl = await generateViaXskill(xskillModelId, input);
    } else {
      // Fal path (default)
      const falModelId = FAL_VIDEO_MODELS[modelType];
      if (!falModelId) {
        console.warn(`No Fal model ID for "${modelType}". Falling back to veo-3.`);
      }
      modelLabel = falModelId || FAL_VIDEO_MODELS['veo-3']!;
      videoUrl = await generateViaFal(modelLabel, input, adapter);
    }

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
