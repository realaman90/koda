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

function getS3Config(): S3Config | null {
  const storageType = getAssetStorageType();

  if (storageType === 'r2') {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

    const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

    return {
      type: 'r2',
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      region: 'auto',
      endpoint,
      publicUrl: process.env.R2_PUBLIC_URL,
    };
  }

  if (storageType === 's3') {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.S3_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey || !bucket) return null;

    return {
      type: 's3',
      accessKeyId,
      secretAccessKey,
      bucket,
      region,
      publicUrl: process.env.S3_PUBLIC_URL,
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
};

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

    // Build public URL
    let publicUrl: string;
    if (config.publicUrl) {
      publicUrl = `${config.publicUrl}/${key}`;
    } else if (config.type === 'r2') {
      publicUrl = `${config.endpoint}/${config.bucket}/${key}`;
    } else {
      publicUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
    }

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    console.error('[assets/presign] Error:', error);
    return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 });
  }
}
