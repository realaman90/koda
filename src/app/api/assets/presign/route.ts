/**
 * Presigned Upload URL API Route
 *
 * Returns a presigned PUT URL for direct browser→R2 uploads,
 * bypassing the Vercel 4.5MB body size limit.
 *
 * POST /api/assets/presign
 *   Body: { contentType: string, prefix?: string }
 *   Response: { uploadUrl, publicUrl, key }
 *
 * Returns 501 if R2/S3 is not configured (client falls back to data URL).
 */

import { NextResponse } from 'next/server';
import { getAssetStorageType } from '@/lib/assets';
import { generatePresignedPutUrl, type S3Config } from '@/lib/assets/s3-signing';
import { generateAssetId } from '@/lib/assets/types';

function sanitizeEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function r2EndpointIncludesBucket(endpoint: string, bucket: string): boolean {
  try {
    const parsed = new URL(endpoint);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] === bucket;
  } catch {
    return false;
  }
}

function getS3Config(): S3Config | null {
  const storageType = getAssetStorageType();

  if (storageType === 'r2') {
    const accountId = sanitizeEnv(process.env.R2_ACCOUNT_ID);
    const accessKeyId = sanitizeEnv(process.env.R2_ACCESS_KEY_ID);
    const secretAccessKey = sanitizeEnv(process.env.R2_SECRET_ACCESS_KEY);
    const bucket = sanitizeEnv(process.env.R2_BUCKET_NAME);

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

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
    const publicUrl = sanitizeEnv(process.env.S3_PUBLIC_URL);

    if (!accessKeyId || !secretAccessKey || !bucket) return null;

    return {
      type: 's3',
      accessKeyId,
      secretAccessKey,
      bucket,
      region,
      publicUrl: publicUrl ? trimTrailingSlashes(publicUrl) : undefined,
    };
  }

  return null;
}

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function toCloudProxyUrl(key: string): string {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `/api/assets/key/${encoded}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contentType, prefix } = body as { contentType?: string; prefix?: string };

    if (!contentType) {
      return NextResponse.json({ error: 'contentType is required' }, { status: 400 });
    }

    const config = getS3Config();
    if (!config) {
      return NextResponse.json(
        { error: 'Cloud storage not configured' },
        { status: 501 }
      );
    }

    const ext = MIME_TO_EXT[contentType] || 'bin';
    const assetType = contentType.startsWith('video/') ? 'video'
      : contentType.startsWith('audio/') ? 'audio'
      : 'image';
    const id = generateAssetId(prefix as 'image' | 'video' | 'audio' || assetType);
    const key = `${id}.${ext}`;

    const uploadUrl = await generatePresignedPutUrl(config, key, contentType, 3600);

    // Build direct public URL (storage-native) and proxy URL (always app-served).
    let directPublicUrl: string;
    if (config.publicUrl) {
      directPublicUrl = `${config.publicUrl}/${key}`;
    } else if (config.type === 'r2') {
      const endpoint = trimTrailingSlashes(config.endpoint || '');
      directPublicUrl = r2EndpointIncludesBucket(endpoint, config.bucket)
        ? `${endpoint}/${key}`
        : `${endpoint}/${config.bucket}/${key}`;
    } else {
      directPublicUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
    }

    return NextResponse.json({
      uploadUrl,
      publicUrl: toCloudProxyUrl(key),
      directPublicUrl,
      key,
    });
  } catch (error) {
    console.error('[assets/presign] Error:', error);
    return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 });
  }
}
