/**
 * Single Canvas API Routes
 * 
 * GET /api/canvases/[id] - Get a canvas by ID
 * PUT /api/canvases/[id] - Update a canvas
 * DELETE /api/canvases/[id] - Delete a canvas
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isSQLiteConfigured } from '@/lib/storage';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;

  // Check if SQLite is configured
  if (!isSQLiteConfigured()) {
    return NextResponse.json(
      { error: 'SQLite not configured', backend: 'localStorage' },
      { status: 400 }
    );
  }

  try {
    const { getSQLiteStorageProvider } = await import('@/lib/storage/sqlite-provider');
    const provider = getSQLiteStorageProvider();
    const canvas = await provider.getCanvas(id);

    if (!canvas) {
      return NextResponse.json(
        { error: 'Canvas not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ canvas, backend: 'sqlite' });
  } catch (error) {
    console.error('Failed to get canvas:', error);
    return NextResponse.json(
      { error: 'Failed to get canvas', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;

  // Check if SQLite is configured
  if (!isSQLiteConfigured()) {
    return NextResponse.json(
      { error: 'SQLite not configured' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      nodes,
      edges,
      thumbnail,
      thumbnailUrl,
      thumbnailStatus,
      thumbnailUpdatedAt,
      thumbnailVersion,
      thumbnailErrorCode,
      createdAt,
      updatedAt,
    } = body;

    const { getSQLiteStorageProvider } = await import('@/lib/storage/sqlite-provider');
    const provider = getSQLiteStorageProvider();

    // Get existing canvas to preserve fields not being updated
    const existing = await provider.getCanvas(id);

    const canvas = {
      id,
      name: name ?? existing?.name ?? 'Untitled',
      nodes: nodes ?? existing?.nodes ?? [],
      edges: edges ?? existing?.edges ?? [],
      thumbnail: thumbnail ?? existing?.thumbnail,
      thumbnailUrl: thumbnailUrl ?? existing?.thumbnailUrl,
      thumbnailStatus: thumbnailStatus ?? existing?.thumbnailStatus,
      thumbnailUpdatedAt: thumbnailUpdatedAt ?? existing?.thumbnailUpdatedAt,
      thumbnailVersion: thumbnailVersion ?? existing?.thumbnailVersion,
      thumbnailErrorCode: thumbnailErrorCode ?? existing?.thumbnailErrorCode,
      createdAt: createdAt ?? existing?.createdAt ?? Date.now(),
      updatedAt: updatedAt ?? Date.now(),
    };

    await provider.saveCanvas(canvas);

    return NextResponse.json({ success: true, canvas });
  } catch (error) {
    console.error('Failed to update canvas:', error);
    return NextResponse.json(
      { error: 'Failed to update canvas', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;

  // Check if SQLite is configured
  if (!isSQLiteConfigured()) {
    return NextResponse.json(
      { error: 'SQLite not configured' },
      { status: 400 }
    );
  }

  try {
    const { getSQLiteStorageProvider } = await import('@/lib/storage/sqlite-provider');
    const provider = getSQLiteStorageProvider();

    await provider.deleteCanvas(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete canvas:', error);
    return NextResponse.json(
      { error: 'Failed to delete canvas', details: String(error) },
      { status: 500 }
    );
  }
}
