/**
 * Canvas API Routes
 * 
 * GET /api/canvases - List all canvases
 * POST /api/canvases - Create a new canvas
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isSQLiteConfigured } from '@/lib/storage';

export async function GET() {
  // Check if SQLite is configured
  if (!isSQLiteConfigured()) {
    return NextResponse.json({ canvases: [], backend: 'localStorage' });
  }

  try {
    const { getSQLiteStorageProvider } = await import('@/lib/storage/sqlite-provider');
    const provider = getSQLiteStorageProvider();
    const canvases = await provider.listCanvases();
    
    return NextResponse.json({ canvases, backend: 'sqlite' });
  } catch (error) {
    console.error('Failed to list canvases:', error);
    return NextResponse.json(
      { error: 'Failed to list canvases', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Check if SQLite is configured
  if (!isSQLiteConfigured()) {
    return NextResponse.json(
      { error: 'SQLite not configured' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { id, name, nodes, edges, thumbnail, createdAt, updatedAt } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name' },
        { status: 400 }
      );
    }

    const { getSQLiteStorageProvider } = await import('@/lib/storage/sqlite-provider');
    const provider = getSQLiteStorageProvider();

    const canvas = {
      id,
      name,
      nodes: nodes || [],
      edges: edges || [],
      thumbnail,
      createdAt: createdAt || Date.now(),
      updatedAt: updatedAt || Date.now(),
    };

    await provider.saveCanvas(canvas);

    return NextResponse.json({ success: true, canvas });
  } catch (error) {
    console.error('Failed to create canvas:', error);
    return NextResponse.json(
      { error: 'Failed to create canvas', details: String(error) },
      { status: 500 }
    );
  }
}
