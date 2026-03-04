import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import {
  FAL_MODELS,
  resolveAutoModel,
  normalizeAspectRatio,
  extractExplicitAspectRatioFromPrompt,
  type ImageModelType,
} from '@/lib/types';
import { getModelAdapter, type GenerateRequest } from '@/lib/model-adapters';
import { getAssetStorageType, getExtensionFromUrl, type AssetStorageProvider } from '@/lib/assets';
import { generatePresignedGetUrl, type S3Config } from '@/lib/assets/s3-signing';
import { withCredits } from '@/lib/credits/with-credits';

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

function sanitizeEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local')
  ) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split('.').map((part) => Number(part));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function extractAssetKeyFromProxyPath(pathname: string): string | undefined {
  if (!pathname.startsWith('/api/assets/key/')) return undefined;
  const encodedKey = pathname.slice('/api/assets/key/'.length);
  if (!encodedKey) return undefined;
  try {
    const key = encodedKey
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/')
      .replace(/^\/+|\/+$/g, '');
    return key || undefined;
  } catch {
    return undefined;
  }
}

function getS3ConfigForAssetReads(): S3Config | undefined {
  const storageType = getAssetStorageType();

  if (storageType === 'r2') {
    const accountId = sanitizeEnv(process.env.R2_ACCOUNT_ID);
    const accessKeyId = sanitizeEnv(process.env.R2_ACCESS_KEY_ID);
    const secretAccessKey = sanitizeEnv(process.env.R2_SECRET_ACCESS_KEY);
    const bucket = sanitizeEnv(process.env.R2_BUCKET_NAME);
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return undefined;

    const endpoint = trimTrailingSlashes(
      sanitizeEnv(process.env.R2_ENDPOINT) || `https://${accountId}.r2.cloudflarestorage.com`
    );

    const publicUrl = sanitizeEnv(process.env.R2_PUBLIC_URL);

    return {
      type: 'r2',
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      region: 'auto',
      endpoint,
      publicUrl: publicUrl ? trimTrailingSlashes(publicUrl) : undefined,
    };
  }

  if (storageType === 's3') {
    const accessKeyId = sanitizeEnv(process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = sanitizeEnv(process.env.S3_SECRET_ACCESS_KEY);
    const bucket = sanitizeEnv(process.env.S3_BUCKET_NAME);
    const region = sanitizeEnv(process.env.S3_REGION) || 'us-east-1';
    if (!accessKeyId || !secretAccessKey || !bucket) return undefined;

    const publicUrl = sanitizeEnv(process.env.S3_PUBLIC_URL);

    return {
      type: 's3',
      accessKeyId,
      secretAccessKey,
      bucket,
      region,
      publicUrl: publicUrl ? trimTrailingSlashes(publicUrl) : undefined,
    };
  }

  return undefined;
}

async function getFalReachableAssetUrl(key: string): Promise<string | undefined> {
  const config = getS3ConfigForAssetReads();
  if (!config) return undefined;

  if (config.publicUrl) {
    return `${config.publicUrl}/${key}`;
  }

  // Private bucket fallback: generate temporary signed GET URL Fal can fetch.
  return generatePresignedGetUrl(config, key, 3600);
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

export const POST = withCredits(
  { type: 'image' },
  async (request) => {
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

      const normalizeAbsoluteReferenceUrl = async (absolute: URL): Promise<string | undefined> => {
        if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') {
          return undefined;
        }

        if (!isPrivateOrLocalHost(absolute.hostname)) {
          return absolute.toString();
        }

        const key = extractAssetKeyFromProxyPath(absolute.pathname);
        if (!key) {
          return undefined;
        }

        return getFalReachableAssetUrl(key);
      };

      const normalizeReferenceUrl = async (value: unknown): Promise<string | undefined> => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        if (trimmed.startsWith('data:')) return trimmed;
        try {
          const absolute = new URL(trimmed);
          return await normalizeAbsoluteReferenceUrl(absolute);
        } catch {
          // Convert relative app URLs (e.g. /api/assets/...) to absolute URLs.
          if (trimmed.startsWith('/')) {
            const absolute = new URL(trimmed, request.url);
            return await normalizeAbsoluteReferenceUrl(absolute);
          }
          return undefined;
        }
      };

      if (!prompt) {
        return NextResponse.json(
          { error: 'Prompt is required' },
          { status: 400 }
        );
      }

      const requestedReferenceCount =
        (typeof referenceUrl === 'string' && referenceUrl.trim() ? 1 : 0)
        + (Array.isArray(referenceUrls) ? referenceUrls.filter((url) => typeof url === 'string' && url.trim()).length : 0);

      const normalizedRefCandidates = await Promise.all([
        normalizeReferenceUrl(referenceUrl),
        ...(Array.isArray(referenceUrls) ? referenceUrls.map(normalizeReferenceUrl) : []),
      ]);
      const normalizedReferences = Array.from(new Set(
        normalizedRefCandidates.filter((url): url is string => !!url)
      ));
      const primaryReferenceUrl = normalizedReferences[0];

      if (requestedReferenceCount > 0 && normalizedReferences.length === 0) {
        return NextResponse.json(
          { error: 'Reference images must use publicly reachable URLs. Localhost/private URLs are not supported unless cloud-public storage URLs are available.' },
          { status: 400 }
        );
      }

      const modelType = resolveAutoModel(model as ImageModelType);
      const requestedAspectRatio = normalizeAspectRatio(aspectRatio);
      const aspectRatioFromPrompt =
        requestedAspectRatio === 'auto'
          ? extractExplicitAspectRatioFromPrompt(prompt)
          : null;
      const resolvedAspectRatio = aspectRatioFromPrompt || requestedAspectRatio;

      // Clamp imageCount to 1-4
      const numImages = Math.max(1, Math.min(4, imageCount));

      // Build request for adapter
      const generateRequest: GenerateRequest = {
        prompt,
        model: modelType,
        aspectRatio: resolvedAspectRatio,
        imageSize,
        resolution,
        numImages,
        referenceUrl: primaryReferenceUrl,
        referenceUrls: normalizedReferences.length > 0 ? normalizedReferences : undefined, // Pass multi-reference array
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
);
