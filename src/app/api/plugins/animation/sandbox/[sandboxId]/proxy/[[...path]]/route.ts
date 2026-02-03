/**
 * Sandbox Preview Proxy Route (Catch-All)
 *
 * Proxies ALL requests to the sandbox container's Vite dev server.
 * The optional catch-all [[...path]] handles:
 *
 *   /api/plugins/animation/sandbox/:id/proxy          → /
 *   /api/plugins/animation/sandbox/:id/proxy/@vite/client → /@vite/client
 *   /api/plugins/animation/sandbox/:id/proxy/src/main.tsx → /src/main.tsx
 *
 * A <base> tag is injected into HTML responses so that all relative and
 * absolute asset paths resolve back through the proxy automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSandboxInstance } from '@/lib/sandbox/docker-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string; path?: string[] }> }
) {
  const { sandboxId, path } = await params;
  const instance = await getSandboxInstance(sandboxId);

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

  // Reconstruct the sub-path from catch-all segments
  const subPath = path ? `/${path.join('/')}` : '/';
  // Forward any query string (Vite uses ?t=... for cache busting, ?import, etc.)
  const search = request.nextUrl.search || '';
  const targetUrl = `http://localhost:${instance.port}${subPath}${search}`;

  const proxyBase = `/api/plugins/animation/sandbox/${sandboxId}/proxy`;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      headers: {
        'Accept': request.headers.get('accept') || '*/*',
        'Accept-Encoding': 'identity',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const body = await upstreamResponse.arrayBuffer();
    const responseHeaders = new Headers();

    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Cache-Control', 'no-cache');
    // Allow iframe embedding from same origin
    responseHeaders.delete('X-Frame-Options');

    // For HTML: inject <base> tag and rewrite HMR WebSocket URLs
    if (contentType?.includes('text/html')) {
      let html = new TextDecoder().decode(body);

      // Inject <base> tag so all absolute paths (/@vite/client, /src/main.tsx)
      // resolve through the proxy automatically
      html = html.replace(
        '<head>',
        `<head><base href="${proxyBase}/">`
      );

      // If there's no <head> tag, prepend it
      if (!html.includes('<base href=')) {
        html = `<base href="${proxyBase}/">\n` + html;
      }

      // Rewrite any hardcoded localhost:5173 references
      html = html.replace(/http:\/\/localhost:5173/g, proxyBase);

      // Rewrite Vite HMR WebSocket URLs (ws://localhost:5173 → wss proxied)
      html = html.replace(
        /ws:\/\/localhost:5173/g,
        `ws://${request.headers.get('host') || 'localhost:3000'}`
      );

      const encoded = new TextEncoder().encode(html);
      responseHeaders.set('Content-Length', String(encoded.length));
      return new NextResponse(encoded, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // For JS modules: rewrite any import references to localhost:5173
    if (
      contentType?.includes('javascript') ||
      contentType?.includes('application/javascript') ||
      subPath.endsWith('.js') ||
      subPath.endsWith('.ts') ||
      subPath.endsWith('.tsx') ||
      subPath.endsWith('.jsx')
    ) {
      let js = new TextDecoder().decode(body);

      // Rewrite import paths that reference localhost:5173
      if (js.includes('localhost:5173')) {
        js = js.replace(/http:\/\/localhost:5173/g, proxyBase);
      }

      const encoded = new TextEncoder().encode(js);
      responseHeaders.set('Content-Length', String(encoded.length));
      if (!contentType) responseHeaders.set('Content-Type', 'application/javascript');
      return new NextResponse(encoded, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    responseHeaders.set('Content-Length', String(body.byteLength));
    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
