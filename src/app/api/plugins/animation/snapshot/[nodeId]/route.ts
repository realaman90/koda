/**
 * Snapshot Management API
 *
 * GET  /api/plugins/animation/snapshot/{nodeId}?versionId=... — check if snapshot exists + metadata
 * DELETE /api/plugins/animation/snapshot/{nodeId}?versionId=... — delete a snapshot (or all if no versionId)
 */

import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId') || undefined;
  console.log(`[Snapshot API] GET /snapshot/${nodeId}${versionId ? `?versionId=${versionId}` : ''}`);
  try {
    const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
    const metadata = await getSnapshotProvider().getMetadata(nodeId, versionId);
    console.log(`[Snapshot API] GET result: exists=${!!metadata}, size=${metadata?.sizeBytes ?? 0}`);
    return NextResponse.json({ exists: !!metadata, metadata });
  } catch (error) {
    console.error(`[Snapshot API] GET error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check snapshot' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId') || undefined;
  console.log(`[Snapshot API] DELETE /snapshot/${nodeId}${versionId ? `?versionId=${versionId}` : ''}`);
  try {
    const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
    await getSnapshotProvider().delete(nodeId, versionId);
    console.log(`[Snapshot API] Deleted snapshot for ${nodeId}${versionId ? `/${versionId}` : ' (all versions)'}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[Snapshot API] DELETE error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete snapshot' },
      { status: 500 }
    );
  }
}
