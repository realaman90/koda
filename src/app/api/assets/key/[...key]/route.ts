import { NextRequest, NextResponse } from 'next/server';
import { getAssetStorageType } from '@/lib/assets';
import { signRequest, type S3Config } from '@/lib/assets/s3-signing';

function sanitizeEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
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

    return {
      type: 'r2',
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      region: 'auto',
      endpoint,
    };
  }

  if (storageType === 's3') {
    const accessKeyId = sanitizeEnv(process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = sanitizeEnv(process.env.S3_SECRET_ACCESS_KEY);
    const bucket = sanitizeEnv(process.env.S3_BUCKET_NAME);
    const region = sanitizeEnv(process.env.S3_REGION) || 'us-east-1';

    if (!accessKeyId || !secretAccessKey || !bucket) return null;

    return {
      type: 's3',
      accessKeyId,
      secretAccessKey,
      bucket,
      region,
    };
  }

  return null;
}

function normalizeKey(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return null;
  const key = segments.join('/').replace(/^\/+|\/+$/g, '');
  if (!key || key.includes('..')) return null;
  return key;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key?: string[] }> }
) {
  try {
    const storageType = getAssetStorageType();
    if (storageType !== 'r2' && storageType !== 's3') {
      return NextResponse.json({ error: 'Cloud asset storage not configured' }, { status: 404 });
    }

    const { key: keySegments } = await params;
    const key = normalizeKey(keySegments);
    if (!key) {
      return NextResponse.json({ error: 'Asset key required' }, { status: 400 });
    }

    const config = getS3Config();
    if (!config) {
      return NextResponse.json({ error: 'Cloud asset storage credentials missing' }, { status: 503 });
    }

    const signed = await signRequest(config, 'GET', key);
    const upstream = await fetch(signed.url, {
      method: 'GET',
      headers: signed.headers,
    });

    if (!upstream.ok) {
      const bodyText = (await upstream.text().catch(() => '')).slice(0, 300);
      console.error(
        `[assets/key] Upstream fetch failed: status=${upstream.status} key=${key} body=${bodyText}`
      );
      return NextResponse.json({ error: 'Asset not found' }, { status: upstream.status === 404 ? 404 : 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=31536000, immutable';

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[assets/key] Error:', error);
    return NextResponse.json({ error: 'Failed to serve asset' }, { status: 500 });
  }
}
