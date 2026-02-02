/**
 * Sandbox Preview Proxy Route
 *
 * Proxies requests to a sandbox container's Vite dev server (port 5173).
 * The frontend embeds this URL in an iframe to show a live preview.
 *
 * GET /api/plugins/animation/sandbox/:sandboxId/proxy
 * GET /api/plugins/animation/sandbox/:sandboxId/proxy?path=/src/main.tsx
 *
 * Also handles Vite HMR WebSocket upgrade via the same port.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSandboxInstance } from '@/lib/sandbox/docker-provider';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;
  const instance = getSandboxInstance(sandboxId);

  if (!instance || !instance.port) {
    return NextResponse.json(
      { error: 'Sandbox not found or no port allocated' },
      { status: 404 }
    );
  }

  if (instance.status !== 'ready' && instance.status !== 'busy') {
    return NextResponse.json(
      { error: `Sandbox not running (status: ${instance.status})` },
      { status: 503 }
    );
  }

  // Build the target URL (Vite dev server inside the container)
  const subPath = request.nextUrl.searchParams.get('path') || '/';
  const targetUrl = `http://localhost:${instance.port}${subPath}`;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      headers: {
        // Forward relevant headers
        'Accept': request.headers.get('accept') || '*/*',
        'Accept-Encoding': request.headers.get('accept-encoding') || 'identity',
      },
      signal: AbortSignal.timeout(10_000),
    });

    // Forward the response with correct headers
    const body = await upstreamResponse.arrayBuffer();
    const responseHeaders = new Headers();

    // Copy content-type and other relevant headers
    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);

    // Rewrite Vite's HMR URLs to go through our proxy
    // (Vite injects `<script>` tags with localhost:5173 URLs)
    if (contentType?.includes('text/html')) {
      let html = new TextDecoder().decode(body);
      // Replace direct localhost references with proxy path
      html = html.replace(
        /http:\/\/localhost:5173/g,
        `/api/plugins/animation/sandbox/${sandboxId}/proxy?path=`
      );
      const encoded = new TextEncoder().encode(html);
      responseHeaders.set('Content-Length', String(encoded.length));
      return new NextResponse(encoded, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    responseHeaders.set('Content-Length', String(body.byteLength));
    responseHeaders.set('Cache-Control', 'no-cache');

    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
