/**
 * Save Video Route
 *
 * Copies a rendered video from sandbox to permanent storage (local/R2/S3).
 * Returns a permanent URL that persists after sandbox is destroyed.
 *
 * POST /api/plugins/animation/save-video
 * Body: { sandboxId, filePath, nodeId, prompt, duration }
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSandboxFileRaw, getSandboxInstance } from '@/lib/sandbox/sandbox-factory';
import { getAssetStorageType } from '@/lib/assets';
import type { SaveAssetOptions } from '@/lib/assets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sandboxId, filePath, nodeId, prompt, duration } = body;

    if (!sandboxId || !filePath) {
      return NextResponse.json(
        { error: 'Missing sandboxId or filePath' },
        { status: 400 }
      );
    }

    // Verify sandbox exists
    const instance = await getSandboxInstance(sandboxId);
    if (!instance || instance.status === 'destroyed' || instance.status === 'error') {
      return NextResponse.json(
        { error: 'Sandbox not found or not running' },
        { status: 404 }
      );
    }

    // Read the video file from sandbox
    const buffer = await readSandboxFileRaw(sandboxId, filePath);

    // Generate a thumbnail (first frame) - skip for now, can add later
    const thumbnailUrl = '';

    // Save to configured storage
    const storageType = getAssetStorageType();
    const options: SaveAssetOptions = {
      type: 'video',
      extension: 'mp4',
      metadata: {
        mimeType: 'video/mp4',
        nodeId,
        prompt: prompt?.slice(0, 500), // Truncate for storage
        extra: {
          duration,
          source: 'animation-generator',
        },
      },
    };

    let savedAsset;
    if (storageType === 'local') {
      const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
      const provider = getLocalAssetProvider();
      savedAsset = await provider.saveFromBuffer(Buffer.from(buffer), options);
    } else {
      const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
      const provider = getS3AssetProvider(storageType);
      savedAsset = await provider.saveFromBuffer(Buffer.from(buffer), options);
    }

    // Persist version in DB (non-critical — wrapped in try/catch)
    const versionId = body.versionId || `v${Date.now()}`;
    try {
      const { upsertProject, addVersion } = await import('@/lib/db/animation-queries');
      const now = new Date();

      if (nodeId) {
        await upsertProject({
          id: nodeId,
          canvasId: body.canvasId,
          engine: body.engine,
          activeVersionId: versionId,
          sandboxId,
          updatedAt: now,
          createdAt: now,
        });

        await addVersion({
          id: versionId,
          projectId: nodeId,
          videoUrl: savedAsset.url,
          snapshotKey: body.snapshotKey,
          thumbnailUrl: thumbnailUrl || undefined,
          prompt: prompt?.slice(0, 2000),
          duration,
          sizeBytes: buffer.length,
          createdAt: now,
        });
      }
    } catch (dbErr) {
      // DB persistence is non-critical — log and continue
      console.warn('[save-video] DB write failed (non-critical):', dbErr);
    }

    return NextResponse.json({
      success: true,
      videoUrl: savedAsset.url,
      thumbnailUrl,
      assetId: savedAsset.id,
      versionId,
      duration,
      sizeBytes: buffer.length,
    });
  } catch (error) {
    console.error('[save-video] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save video' },
      { status: 500 }
    );
  }
}
