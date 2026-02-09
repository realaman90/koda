/**
 * Asset Upload API Route
 *
 * Accepts file uploads via FormData and stores them using the asset storage provider.
 * Returns a short, stable URL that can be stored in node data without bloating localStorage.
 *
 * POST /api/assets/upload
 *   Body: FormData with "file" field (+ optional "nodeId", "canvasId")
 *   Response: { id, url, mimeType, sizeBytes }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssetStorageType, type AssetStorageProvider } from '@/lib/assets';
import { getExtensionFromMime } from '@/lib/assets/types';

/**
 * Get the asset storage provider based on ASSET_STORAGE env var
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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    const nodeId = (formData.get('nodeId') as string) || undefined;
    const canvasId = (formData.get('canvasId') as string) || undefined;

    // Determine asset type from MIME
    let assetType: 'image' | 'video' | 'audio' = 'image';
    if (file.type.startsWith('video/')) assetType = 'video';
    else if (file.type.startsWith('audio/')) assetType = 'audio';

    const extension = getExtensionFromMime(file.type);
    const buffer = Buffer.from(await file.arrayBuffer());

    const provider = await getProvider();
    const asset = await provider.saveFromBuffer(buffer, {
      type: assetType,
      extension,
      metadata: {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        nodeId,
        canvasId,
      },
    });

    return NextResponse.json({
      id: asset.id,
      url: asset.url,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  } catch (error) {
    console.error('[assets/upload] Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
