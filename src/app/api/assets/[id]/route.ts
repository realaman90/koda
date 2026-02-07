/**
 * Asset Serving API Route
 * 
 * Serves locally stored assets (images, videos, audio).
 * Only used when ASSET_STORAGE=local.
 * 
 * GET /api/assets/[id] - Serve an asset by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { isLocalAssetStorage } from '@/lib/assets';

// Cache assets for 1 year (they're immutable by ID)
const CACHE_MAX_AGE = 60 * 60 * 24 * 365;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only serve local assets
  if (!isLocalAssetStorage()) {
    return NextResponse.json(
      { error: 'Local asset storage not configured' },
      { status: 404 }
    );
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Asset ID required' },
      { status: 400 }
    );
  }

  try {
    const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
    const provider = getLocalAssetProvider();
    const result = await provider.getBuffer(id);

    if (!result) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Return the file with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': result.buffer.length.toString(),
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
        // Allow cross-origin requests for canvas/image elements
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error serving asset:', error);
    return NextResponse.json(
      { error: 'Failed to serve asset' },
      { status: 500 }
    );
  }
}
