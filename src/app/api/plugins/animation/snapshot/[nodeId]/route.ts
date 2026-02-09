/**
 * Snapshot Management API
 *
 * GET  /api/plugins/animation/snapshot/{nodeId} — check if snapshot exists + metadata
 * DELETE /api/plugins/animation/snapshot/{nodeId} — delete a snapshot
 */

import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  console.log(`[Snapshot API] GET /snapshot/${nodeId}`);
  try {
    const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
    const metadata = await getSnapshotProvider().getMetadata(nodeId);
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
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  console.log(`[Snapshot API] DELETE /snapshot/${nodeId}`);
  try {
    const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
    await getSnapshotProvider().delete(nodeId);
    console.log(`[Snapshot API] Deleted snapshot for ${nodeId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[Snapshot API] DELETE error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete snapshot' },
      { status: 500 }
    );
  }
}
