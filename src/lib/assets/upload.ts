/**
 * Client-side asset upload helper.
 *
 * Uploads a File to /api/assets/upload and returns the stored asset URL.
 * Works with both local (disk) and cloud (R2) backends — the server decides.
 */

export async function uploadAsset(
  file: File,
  opts?: { nodeId?: string; canvasId?: string }
): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.nodeId) form.append('nodeId', opts.nodeId);
  if (opts?.canvasId) form.append('canvasId', opts.canvasId);

  const res = await fetch('/api/assets/upload', { method: 'POST', body: form });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }

  return res.json();
}

/**
 * Upload a video directly to R2 via presigned URL (bypasses Vercel body limit).
 *
 * Flow:
 *   1. POST /api/assets/presign → { uploadUrl, publicUrl }
 *   2. PUT file body directly to uploadUrl (browser → R2, no Vercel in the middle)
 *
 * Returns the public URL on success, or null if presigned upload isn't available
 * (e.g., local dev without R2), allowing the caller to fall back to data URL.
 */
export async function uploadVideoViaPresigned(
  file: File
): Promise<{ url: string } | null> {
  try {
    // Step 1: Get presigned URL from our API
    const presignRes = await fetch('/api/assets/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type || 'video/mp4' }),
    });

    // 501 = cloud storage not configured → fall back to data URL
    if (presignRes.status === 501) return null;
    if (!presignRes.ok) return null;

    const { uploadUrl, publicUrl } = await presignRes.json();

    // Step 2: PUT file directly to R2/S3
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'video/mp4' },
      body: file,
    });

    if (!uploadRes.ok) {
      console.warn('[uploadVideoViaPresigned] PUT to R2 failed:', uploadRes.status);
      return null;
    }

    return { url: publicUrl };
  } catch (err) {
    console.warn('[uploadVideoViaPresigned] Failed, falling back to data URL:', err);
    return null;
  }
}
