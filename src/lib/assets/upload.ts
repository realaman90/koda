/**
 * Client-side asset upload helper.
 *
 * Uploads a File to /api/assets/upload and returns the stored asset URL.
 * Works with both local (disk) and cloud (R2/S3) backends.
 */

const SERVERLESS_SAFE_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4MB

function inferAssetPrefix(contentType: string): 'image' | 'video' | 'audio' {
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'image';
}

function extractIdFromKeyOrUrl(key: string | undefined, url: string): string {
  const keyLike = key || url.split('?')[0].split('#')[0].split('/').pop() || `asset_${Date.now()}`;
  const lastDot = keyLike.lastIndexOf('.');
  return lastDot > 0 ? keyLike.slice(0, lastDot) : keyLike;
}

async function uploadViaPresignedUrl(file: File): Promise<{ id: string; url: string } | null> {
  try {
    const presignRes = await fetch('/api/assets/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: file.type || 'application/octet-stream',
        prefix: inferAssetPrefix(file.type || ''),
      }),
    });

    // Cloud storage not configured (or route unavailable) -> caller should fallback.
    if (presignRes.status === 501 || presignRes.status === 404) return null;
    if (!presignRes.ok) return null;

    const body = await presignRes.json().catch(() => null) as
      | { uploadUrl?: string; publicUrl?: string; key?: string }
      | null;
    if (!body?.uploadUrl || !body.publicUrl) return null;

    const uploadRes = await fetch(body.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    if (!uploadRes.ok) return null;

    return {
      id: extractIdFromKeyOrUrl(body.key, body.publicUrl),
      url: body.publicUrl,
    };
  } catch {
    return null;
  }
}

export async function uploadAsset(
  file: File,
  opts?: { nodeId?: string; canvasId?: string }
): Promise<{ id: string; url: string }> {
  let directAttempted = false;

  // Prefer direct-to-storage for larger files to avoid serverless body limits.
  if (file.size >= SERVERLESS_SAFE_UPLOAD_THRESHOLD_BYTES) {
    directAttempted = true;
    const direct = await uploadViaPresignedUrl(file);
    if (direct) return direct;
  }

  const form = new FormData();
  form.append('file', file);
  if (opts?.nodeId) form.append('nodeId', opts.nodeId);
  if (opts?.canvasId) form.append('canvasId', opts.canvasId);

  const res = await fetch('/api/assets/upload', { method: 'POST', body: form });

  // Retry via direct upload when server-side upload fails (body limits, timeouts, storage transient).
  if (!res.ok && !directAttempted) {
    directAttempted = true;
    const direct = await uploadViaPresignedUrl(file);
    if (direct) return direct;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }

  return res.json();
}

/**
 * Upload a video directly to R2/S3 via presigned URL.
 *
 * Returns the public URL on success, or null if presigned upload isn't available
 * (e.g., local dev without cloud storage), allowing caller fallback behavior.
 */
export async function uploadVideoViaPresigned(
  file: File
): Promise<{ url: string } | null> {
  const uploaded = await uploadViaPresignedUrl(file);
  if (!uploaded) return null;
  return { url: uploaded.url };
}
