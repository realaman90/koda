/**
 * Sandbox File Serving Route
 *
 * Serves files (videos, images, code) from a running sandbox container.
 *
 * GET /api/plugins/animation/sandbox/:sandboxId/file?path=output/preview.mp4
 *
 * Security: validates path (no traversal), validates sandbox exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSandboxInstance, readSandboxFileRaw } from '@/lib/sandbox/docker-provider';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.txt': 'text/plain',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;
  const filePath = request.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Missing "path" query parameter' }, { status: 400 });
  }

  // Path traversal protection
  const normalized = path.normalize(filePath);
  if (normalized.startsWith('..') || normalized.startsWith('/') || normalized.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Verify sandbox exists
  const instance = getSandboxInstance(sandboxId);
  if (!instance || instance.status === 'destroyed' || instance.status === 'error') {
    return NextResponse.json({ error: 'Sandbox not found or not running' }, { status: 404 });
  }

  try {
    const buffer = await readSandboxFileRaw(sandboxId, normalized);

    const ext = path.extname(normalized).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read file';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
