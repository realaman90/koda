import { getAssetStorageType, getExtensionFromUrl, type AssetStorageProvider } from '@/lib/assets';

/**
 * Get the asset storage provider (server-side only)
 */
export async function getProvider(): Promise<AssetStorageProvider> {
  const storageType = getAssetStorageType();

  if (storageType === 'r2' || storageType === 's3') {
    const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
    return getS3AssetProvider(storageType);
  }

  const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
  return getLocalAssetProvider();
}

/**
 * Save generated video to configured asset storage.
 * Returns local URL if storage is configured, otherwise returns original URL.
 */
export async function saveGeneratedVideo(
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
