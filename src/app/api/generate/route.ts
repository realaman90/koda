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
import { getAssetStorageType, getExtensionFromMime, getExtensionFromUrl, type AssetStorageProvider } from '@/lib/assets';
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

const GEMINI_IMAGE_FALLBACK_MODELS: Partial<Record<ImageModelType, string>> = {
  'nanobanana-pro': 'gemini-3.1-flash-image-preview',
  'nanobanana-2': 'gemini-3.1-flash-image-preview',
};

interface GeminiInlineImagePart {
  mimeType: string;
  base64Data: string;
}

interface GeneratedImageBuffer {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
  error?: { message?: string };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const value = error as {
    status?: unknown;
    response?: { status?: unknown };
    body?: { status?: unknown; status_code?: unknown };
    cause?: { status?: unknown };
    message?: string;
  };

  const fromObject =
    toNumber(value.status)
    ?? toNumber(value.response?.status)
    ?? toNumber(value.body?.status)
    ?? toNumber(value.body?.status_code)
    ?? toNumber(value.cause?.status);

  if (fromObject) return fromObject;

  const message = value.message || '';
  const match = message.match(/\b([45]\d{2})\b/);
  if (!match) return undefined;
  return toNumber(match[1]);
}

function isFalServiceFailure(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (typeof status === 'number' && status >= 500) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('internal server error') ||
    message.includes('service unavailable') ||
    message.includes('bad gateway') ||
    message.includes('gateway timeout') ||
    message.includes('upstream') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

function parseDataImageUrl(value: string): GeminiInlineImagePart | undefined {
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return undefined;
  const mimeType = match[1].toLowerCase();
  const base64Data = match[2];
  if (!mimeType.startsWith('image/') || !base64Data) {
    return undefined;
  }
  return { mimeType, base64Data };
}

async function fetchReferenceAsGeminiInlineImage(referenceUrl: string): Promise<GeminiInlineImagePart | undefined> {
  const inline = parseDataImageUrl(referenceUrl);
  if (inline) return inline;

  try {
    const response = await fetch(referenceUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return undefined;

    const mimeType = (response.headers.get('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
    if (!mimeType.startsWith('image/')) return undefined;

    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      mimeType,
      base64Data: bytes.toString('base64'),
    };
  } catch {
    return undefined;
  }
}

function extractGeminiImages(payload: GeminiGenerateContentResponse): GeneratedImageBuffer[] {
  const result: GeneratedImageBuffer[] = [];

  for (const candidate of payload.candidates || []) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      const camel = part.inlineData;
      const snake = part.inline_data;

      const mimeType = (camel?.mimeType || snake?.mime_type || '').toLowerCase();
      const data = camel?.data || snake?.data || '';
      if (!mimeType.startsWith('image/') || !data) continue;

      try {
        const buffer = Buffer.from(data, 'base64');
        if (buffer.length === 0) continue;

        const extension = getExtensionFromMime(mimeType);
        result.push({
          buffer,
          mimeType,
          extension: extension === 'bin' ? 'png' : extension,
        });
      } catch {
        // Skip invalid image payloads.
      }
    }
  }

  return result;
}

async function generateWithGeminiFallback(options: {
  modelType: ImageModelType;
  prompt: string;
  referenceUrls: string[];
}): Promise<{ modelId: string; images: GeneratedImageBuffer[] }> {
  const modelId = GEMINI_IMAGE_FALLBACK_MODELS[options.modelType];
  if (!modelId) {
    throw new Error(`No Gemini fallback configured for model "${options.modelType}"`);
  }

  const apiKey = sanitizeEnv(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
  }

  const inlineReferences = await Promise.all(
    options.referenceUrls.slice(0, 14).map(fetchReferenceAsGeminiInlineImage)
  );
  const validReferences = inlineReferences.filter((item): item is GeminiInlineImagePart => !!item);

  if (options.referenceUrls.length > 0 && validReferences.length === 0) {
    throw new Error('Gemini fallback could not read any reference images');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: options.prompt },
          ...validReferences.map((image) => ({
            inlineData: {
              mimeType: image.mimeType,
              data: image.base64Data,
            },
          })),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new Error(`Gemini API ${response.status}: ${payload.error?.message || response.statusText}`);
  }

  const images = extractGeminiImages(payload);
  if (images.length === 0) {
    throw new Error('Gemini fallback returned no images');
  }

  return { modelId, images };
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

/**
 * Save generated image buffers to configured asset storage.
 * Used for providers that return inline image bytes (Gemini fallback).
 */
async function saveGeneratedImageBuffers(
  images: GeneratedImageBuffer[],
  options: { prompt: string; model: string; canvasId?: string; nodeId?: string }
): Promise<string[]> {
  const provider = await getProvider();
  const savedUrls: string[] = [];

  for (const image of images) {
    try {
      const asset = await provider.saveFromBuffer(image.buffer, {
        type: 'image',
        extension: image.extension,
        metadata: {
          mimeType: image.mimeType,
          prompt: options.prompt,
          model: options.model,
          canvasId: options.canvasId,
          nodeId: options.nodeId,
        },
      });
      savedUrls.push(asset.url);
    } catch (error) {
      console.error('Failed to save generated image buffer:', error);
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

      const { canvasId, nodeId } = body;
      let responseModelId = modelId;
      let originalUrls: string[] = [];
      let savedUrls: string[] = [];

      try {
        // Primary path: Fal generation
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

        originalUrls = imageUrls;

        // Save images to configured asset storage (local filesystem, R2, or S3)
        savedUrls = await saveGeneratedImages(imageUrls, {
          prompt,
          model: modelId,
          canvasId,
          nodeId,
        });
      } catch (falError) {
        const fallbackModelId = GEMINI_IMAGE_FALLBACK_MODELS[modelType];
        const hasGeminiKey = !!sanitizeEnv(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
        const shouldFallback =
          !!fallbackModelId &&
          hasGeminiKey &&
          isFalServiceFailure(falError);

        if (!shouldFallback) {
          throw falError;
        }

        console.warn(
          `Fal image generation failed for ${modelId}. Falling back to Gemini ${fallbackModelId}.`,
          falError
        );

        try {
          const fallback = await generateWithGeminiFallback({
            modelType,
            prompt,
            referenceUrls: normalizedReferences,
          });

          responseModelId = `google/${fallback.modelId}`;
          originalUrls = [];
          savedUrls = await saveGeneratedImageBuffers(fallback.images, {
            prompt,
            model: responseModelId,
            canvasId,
            nodeId,
          });

          if (savedUrls.length === 0) {
            throw new Error('Gemini fallback generated images but none could be saved');
          }
        } catch (fallbackError) {
          throw new Error(
            `Fal generation failed (${getErrorMessage(falError)}). Gemini fallback failed (${getErrorMessage(fallbackError)}).`
          );
        }
      }

      return NextResponse.json({
        success: true,
        imageUrl: savedUrls[0], // For backwards compatibility
        imageUrls: savedUrls, // Array of all generated images (now local URLs if storage configured)
        originalUrls, // Keep original fal.ai URLs as backup when available
        model: responseModelId,
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
