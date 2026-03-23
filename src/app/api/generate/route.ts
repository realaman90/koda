import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { FAL_MODELS, type ImageModelType } from '@/lib/types';
import { getModelAdapter, type GenerateRequest } from '@/lib/model-adapters';
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
 * Save generated images to configured asset storage
 * Returns local URLs if storage is configured, otherwise returns original URLs
 */
async function saveGeneratedImages(
  urls: string[],
  options: { prompt: string; model: string; canvasId?: string; nodeId?: string }
): Promise<string[]> {
  const storageType = getAssetStorageType();
  
  // If using default (no storage configured), return original URLs
  if (storageType === 'local' && !process.env.ASSET_STORAGE) {
    return urls;
  }

  const provider = await getProvider();
  const savedUrls: string[] = [];

  for (const url of urls) {
    try {
      const extension = getExtensionFromUrl(url) || 'png';
      const asset = await provider.saveFromUrl(url, {
        type: 'image',
        extension,
        metadata: {
          mimeType: `image/${extension}`,
          prompt: options.prompt,
          model: options.model,
          canvasId: options.canvasId,
          nodeId: options.nodeId,
        },
      });
      savedUrls.push(asset.url);
    } catch (error) {
      console.error('Failed to save image asset:', error);
      // Fall back to original URL if save fails
      savedUrls.push(url);
    }
  }

  return savedUrls;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      model,
      aspectRatio,
      imageSize,
      resolution,
      imageCount = 1,
      referenceUrl,
      referenceUrls, // Multi-reference support (up to 14 for NanoBanana)
      // New model-specific params
      style,
      magicPrompt,
      cfgScale,
      steps,
      strength,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const modelType = model as ImageModelType;

    // Clamp imageCount to 1-4
    const numImages = Math.max(1, Math.min(4, imageCount));

    // Build request for adapter
    const generateRequest: GenerateRequest = {
      prompt,
      model: modelType,
      aspectRatio,
      imageSize,
      resolution,
      numImages,
      referenceUrl,
      referenceUrls, // Pass multi-reference array
      style,
      magicPrompt,
      cfgScale,
      steps,
      strength,
    };

    // Get adapter and build input
    const adapter = getModelAdapter(modelType);
    const input = adapter.buildInput(generateRequest);

    // Get model ID - use adapter's dynamic ID if available (for dual-endpoint models like NanoBanana)
    const modelId = adapter.getModelId
      ? adapter.getModelId(generateRequest)
      : FAL_MODELS[modelType] || FAL_MODELS['flux-schnell'];

    // Call Fal API
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Queue update:', update.status);
      },
    });

    // Extract image URLs using adapter
    const imageUrls = adapter.extractImageUrls(result as { data?: { images?: Array<{ url: string }> } });

    if (imageUrls.length === 0) {
      throw new Error('No images generated');
    }

    // Save images to configured asset storage (local filesystem, R2, or S3)
    const { canvasId, nodeId } = body;
    const savedUrls = await saveGeneratedImages(imageUrls, {
      prompt,
      model: modelId,
      canvasId,
      nodeId,
    });

    return NextResponse.json({
      success: true,
      imageUrl: savedUrls[0], // For backwards compatibility
      imageUrls: savedUrls, // Array of all generated images (now local URLs if storage configured)
      originalUrls: imageUrls, // Keep original fal.ai URLs as backup
      model: modelId,
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
