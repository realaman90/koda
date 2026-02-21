import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_VIDEO_MODELS, XSKILL_VIDEO_MODELS, VIDEO_MODEL_PROVIDERS, type VideoModelType } from '@/lib/types';
import { getVideoModelAdapter, type VideoGenerateRequest } from '@/lib/model-adapters';
import { saveGeneratedVideo } from '@/lib/video-storage';
import { getAssetStorageType, getExtensionFromUrl, type AssetStorageProvider } from '@/lib/assets';

export const maxDuration = 600;

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

function normalizeMediaUrl(value: unknown, request: Request): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  if (!trimmed.startsWith('/')) {
    return trimmed;
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return trimmed;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}${trimmed}`;
}

function normalizeMediaUrls(value: unknown, request: Request): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value
    .map((item) => normalizeMediaUrl(item, request))
    .filter((url): url is string => !!url);
  return urls.length > 0 ? urls : undefined;
}

async function getProvider(): Promise<AssetStorageProvider> {
  const storageType = getAssetStorageType();

  if (storageType === 'r2' || storageType === 's3') {
    const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
    return getS3AssetProvider(storageType);
  }

  const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
  return getLocalAssetProvider();
}

function defaultExtensionFor(type: 'image' | 'video' | 'audio'): string {
  if (type === 'image') return 'png';
  if (type === 'video') return 'mp4';
  return 'mp3';
}

function isAlreadyPublicAssetUrl(url: string): boolean {
  const prefixes = [
    process.env.R2_PUBLIC_URL,
    process.env.S3_PUBLIC_URL,
    process.env.ASSET_BASE_URL,
  ].filter((v): v is string => !!v);
  return prefixes.some((prefix) => url.startsWith(prefix));
}

async function rehostForXskill(
  url: string | undefined,
  type: 'image' | 'video' | 'audio',
  request: Request,
  meta: { model: string; nodeId?: string; canvasId?: string }
): Promise<string | undefined> {
  if (!url) return undefined;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
  if (isAlreadyPublicAssetUrl(url)) return url;

  const storageType = getAssetStorageType();
  if (storageType === 'local' && !process.env.ASSET_STORAGE) {
    // No persistent/public storage configured; keep original URL.
    return url;
  }

  try {
    const provider = await getProvider();
    const extension = getExtensionFromUrl(url) || defaultExtensionFor(type);
    const asset = await provider.saveFromUrl(url, {
      type,
      extension,
      metadata: {
        mimeType: `${type}/${extension}`,
        model: meta.model,
        nodeId: meta.nodeId,
        canvasId: meta.canvasId,
      },
    });
    return normalizeMediaUrl(asset.url, request) || asset.url;
  } catch (err) {
    console.warn('[generate-video] Failed to rehost xskill media URL, using original:', err);
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
      referenceUrls: rawReferenceUrls,
      videoUrl: inputVideoUrl,
      audioUrl: inputAudioUrl,
      generateAudio,
    } = body;

    const normalizedReferenceUrl = normalizeMediaUrl(referenceUrl, request);
    const normalizedFirstFrameUrl = normalizeMediaUrl(firstFrameUrl, request);
    const normalizedLastFrameUrl = normalizeMediaUrl(lastFrameUrl, request);
    const normalizedReferenceUrls = normalizeMediaUrls(rawReferenceUrls, request);
    const normalizedVideoUrl = normalizeMediaUrl(inputVideoUrl, request);
    const normalizedAudioUrl = normalizeMediaUrl(inputAudioUrl, request);

    const modelType = model as VideoModelType;
    const provider = VIDEO_MODEL_PROVIDERS[modelType] || 'fal';
    const { canvasId, nodeId } = body;

    let finalReferenceUrl = normalizedReferenceUrl;
    let finalFirstFrameUrl = normalizedFirstFrameUrl;
    let finalLastFrameUrl = normalizedLastFrameUrl;
    let finalReferenceUrls = normalizedReferenceUrls;
    let finalVideoUrl = normalizedVideoUrl;
    let finalAudioUrl = normalizedAudioUrl;

    if (provider === 'xskill') {
      finalReferenceUrl = await rehostForXskill(finalReferenceUrl, 'image', request, { model: String(modelType), nodeId, canvasId });
      finalFirstFrameUrl = await rehostForXskill(finalFirstFrameUrl, 'image', request, { model: String(modelType), nodeId, canvasId });
      finalLastFrameUrl = await rehostForXskill(finalLastFrameUrl, 'image', request, { model: String(modelType), nodeId, canvasId });
      finalVideoUrl = await rehostForXskill(finalVideoUrl, 'video', request, { model: String(modelType), nodeId, canvasId });
      finalAudioUrl = await rehostForXskill(finalAudioUrl, 'audio', request, { model: String(modelType), nodeId, canvasId });
      if (finalReferenceUrls?.length) {
        finalReferenceUrls = await Promise.all(
          finalReferenceUrls.map((url) =>
            rehostForXskill(url, 'image', request, { model: String(modelType), nodeId, canvasId })
          )
        ) as string[];
      }
    }

    console.log('Received model from request:', { model, modelType, provider });

    // Validate input - at least prompt or some media reference is needed
    if (
      !prompt &&
      !finalReferenceUrl &&
      !finalFirstFrameUrl &&
      !finalLastFrameUrl &&
      !finalReferenceUrls?.length &&
      !finalVideoUrl &&
      !finalAudioUrl
    ) {
      return NextResponse.json(
        { error: 'Either prompt or a media reference is required' },
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
      referenceUrl: finalReferenceUrl,
      firstFrameUrl: finalFirstFrameUrl,
      lastFrameUrl: finalLastFrameUrl,
      referenceUrls: finalReferenceUrls,
      videoUrl: finalVideoUrl,
      audioUrl: finalAudioUrl,
      generateAudio,
    };

    // Get adapter and build input
    const adapter = getVideoModelAdapter(modelType);
    const input = adapter.buildInput(generateRequest);

    console.log('Video generation request:', {
      provider,
      receivedModel: model,
      hasReferenceUrl: !!finalReferenceUrl,
      hasFirstFrameUrl: !!finalFirstFrameUrl,
      hasLastFrameUrl: !!finalLastFrameUrl,
      referenceUrlsCount: finalReferenceUrls?.length || 0,
      hasVideoUrl: !!finalVideoUrl,
      hasAudioUrl: !!finalAudioUrl,
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
