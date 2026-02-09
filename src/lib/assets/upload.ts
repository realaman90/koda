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
