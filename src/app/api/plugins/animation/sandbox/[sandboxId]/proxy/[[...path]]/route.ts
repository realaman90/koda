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
 * IMPORTANT: Vite uses absolute paths (/@vite/client, /src/main.tsx, /node_modules/...)
 * for all module loading. A <base> tag does NOT rewrite absolute paths (HTML spec).
 * Instead, we rewrite all absolute paths in HTML, JS, and CSS responses to route
 * through the proxy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSandboxInstance } from '@/lib/sandbox/docker-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rewrite absolute paths in text content to go through the proxy.
 *
 * IMPORTANT: We must be very careful not to corrupt JS regex literals.
 * A regex like /["']/ contains quote+slash but should NOT be rewritten.
 *
 * Strategy: Only rewrite paths that look like actual Vite module paths,
 * not arbitrary "/..." sequences. Vite uses these patterns:
 *   /@vite/..., /@react-refresh, /@fs/...  (Vite internal)
 *   /src/..., /node_modules/..., /public/... (project files)
 *
 * We match: (quote)(/)(@|src/|node_modules/|public/|assets/|[a-zA-Z0-9_-]+\.)
 * This avoids matching regex character classes like /["']/
 */
function rewriteAbsolutePaths(content: string, proxyBase: string): string {
  // Skip if already proxied
  if (content.includes(proxyBase)) {
    // Already has some proxied paths, be more careful
  }

  // 1. Rewrite Vite special paths: "/@vite/...", "/@react-refresh", "/@fs/..."
  let result = content.replace(
    /(["'])\/@/g,
    `$1${proxyBase}/@`
  );

  // 2. Rewrite source paths: "/src/..."
  result = result.replace(
    /(["'])\/src\//g,
    `$1${proxyBase}/src/`
  );

  // 3. Rewrite node_modules: "/node_modules/..."
  result = result.replace(
    /(["'])\/node_modules\//g,
    `$1${proxyBase}/node_modules/`
  );

  // 4. Rewrite public/assets: "/public/...", "/assets/..."
  result = result.replace(
    /(["'])\/(public|assets)\//g,
    `$1${proxyBase}/$2/`
  );

  // 5. Rewrite file paths with extensions: "/something.js", "/file.tsx", etc.
  //    This catches imports like "/vite.svg" but not regex patterns
  result = result.replace(
    /(["'])\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/g,
    (match, quote, path) => {
      // Skip if looks like it's already proxied
      if (path.startsWith('api/')) return match;
      return `${quote}${proxyBase}/${path}`;
    }
  );

  // 6. Rewrite CSS url(/...) - only for paths starting with known prefixes
  result = result.replace(
    /url\(\s*\/((?:@|src\/|node_modules\/|public\/|assets\/|[a-zA-Z0-9_-]+\.))/g,
    `url(${proxyBase}/$1`
  );

  return result;
}

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
  let search = request.nextUrl.search || '';

  // REMOTION FIX: When loading the root URL without a composition selection,
  // Remotion Studio interprets the full proxy path as a composition ID.
  // Add ?selected=MainVideo to tell Remotion which composition to display.
  // This is only needed for the root URL (no subPath) without an existing 'selected' param.
  if (subPath === '/' && !search.includes('selected=')) {
    search = search ? `${search}&selected=MainVideo` : '?selected=MainVideo';
  }

  const targetUrl = `http://localhost:${instance.port}${subPath}${search}`;

  const proxyBase = `/api/plugins/animation/sandbox/${sandboxId}/proxy`;

  try {
    // Retry up to 3 times with backoff — handles race where the iframe loads
    // before the Vite dev server is fully ready (ECONNREFUSED).
    let upstreamResponse: Response | null = null;
    let lastError: Error | null = null;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        upstreamResponse = await fetch(targetUrl, {
          headers: {
            'Accept': request.headers.get('accept') || '*/*',
            'Accept-Encoding': 'identity',
          },
          signal: AbortSignal.timeout(10_000),
        });
        break; // success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Only retry on connection errors (ECONNREFUSED, ECONNRESET)
        const isRetryable = lastError.message.includes('ECONNREFUSED')
          || lastError.message.includes('ECONNRESET')
          || lastError.message.includes('fetch failed');
        if (!isRetryable || attempt === MAX_RETRIES - 1) break;
        // Backoff: 500ms, 1000ms
        await new Promise(r => setTimeout(r, (attempt + 1) * 500));
      }
    }

    if (!upstreamResponse) {
      const msg = lastError?.message || 'Proxy request failed';
      // For HTML requests (iframe root), return a user-visible error page
      // instead of raw JSON so the iframe shows something useful.
      if (request.headers.get('accept')?.includes('text/html')) {
        const errorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#ff6b6b;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;"><div><div style="font-size:20px;margin-bottom:12px;">⚠ Preview Unavailable</div><div style="color:#aaa;font-size:13px;">${msg.replace(/</g, '&lt;')}</div><div style="color:#666;font-size:12px;margin-top:16px;">The dev server may still be starting. Try refreshing.</div></div></body></html>`;
        return new NextResponse(errorHtml, {
          status: 502,
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
        });
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const body = await upstreamResponse.arrayBuffer();
    const responseHeaders = new Headers();

    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Cache-Control', 'no-cache');
    // Allow iframe embedding from same origin
    responseHeaders.delete('X-Frame-Options');

    // ── HTML responses ──
    // Rewrite all absolute paths so Vite's modules load through the proxy.
    // Also inject a script to suppress Vite HMR errors (WebSocket won't connect through proxy).
    if (contentType?.includes('text/html')) {
      let html = new TextDecoder().decode(body);

      // Rewrite all absolute paths in the HTML (src, href, inline scripts)
      html = rewriteAbsolutePaths(html, proxyBase);

      // Also rewrite any hardcoded localhost:PORT references
      html = html.replace(/http:\/\/localhost:5173/g, proxyBase);

      // Inject scripts:
      // 1. REMOTION FIX: Override pathname so Remotion doesn't interpret proxy path as composition ID
      // 2. Silence HMR WebSocket errors (HMR doesn't work through proxy)
      // 3. Error capture overlay — catches uncaught JS errors and displays them
      //    visually instead of showing a black screen in the iframe.
      const injectedScripts = `<script>
// REMOTION FIX: Use history.replaceState to change the URL to "/" before Remotion loads.
// Remotion uses window.location.pathname to determine which composition to show.
// When embedded via proxy, the path is "/api/plugins/animation/sandbox/.../proxy"
// which Remotion interprets as a composition ID and fails.
// By using replaceState, we actually change the browser's URL to "/" which Remotion sees correctly.
(function() {
  try {
    var path = window.location.pathname;
    if (path.includes('/api/plugins/animation/sandbox/') && path.includes('/proxy')) {
      // Store the real proxy path for our internal use
      window.__KODA_PROXY_BASE__ = path.replace(/\\/$/, '');
      // Replace the URL with "/" - this changes what window.location.pathname returns
      window.history.replaceState({}, '', '/' + window.location.search + window.location.hash);
    }
  } catch(e) {
    console.warn('[Koda] Failed to rewrite URL for Remotion:', e);
  }
})();
</script>
<script>
window.__vite_plugin_react_preamble_installed__=true;
window.__HMR_ENABLE_OVERLAY__=false;
(function(){
  var overlay=null;
  function show(msg){
    if(overlay)overlay.remove();
    overlay=document.createElement('div');
    overlay.id='__koda_error_overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);color:#ff6b6b;font-family:monospace;font-size:13px;padding:24px;overflow:auto;white-space:pre-wrap;word-break:break-word;';
    overlay.innerHTML='<div style="color:#ff6b6b;font-size:15px;font-weight:bold;margin-bottom:12px;">⚠ Animation Error</div><div style="color:#e0e0e0;">'+msg.replace(/</g,'&lt;')+'</div>';
    document.body?document.body.appendChild(overlay):document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(overlay)});
  }
  window.onerror=function(msg,src,line,col,err){
    show((err&&err.stack?err.stack:msg)+'\\n\\nSource: '+(src||'unknown')+':'+line+':'+col);
  };
  window.onunhandledrejection=function(e){
    var r=e.reason;
    show('Unhandled Promise Rejection:\\n'+(r&&r.stack?r.stack:String(r)));
  };
})();
</script>`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${injectedScripts}`);
      } else {
        html = injectedScripts + html;
      }

      const encoded = new TextEncoder().encode(html);
      responseHeaders.set('Content-Length', String(encoded.length));
      return new NextResponse(encoded, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // ── JS / TS responses ──
    // Vite's module system uses absolute import paths like:
    //   import "/node_modules/.vite/deps/react.js?v=abc"
    //   import "/@react-refresh"
    //   from "/src/App.tsx"
    // These must be rewritten to go through the proxy.
    if (
      contentType?.includes('javascript') ||
      contentType?.includes('typescript') ||
      contentType?.includes('application/javascript') ||
      subPath.endsWith('.js') ||
      subPath.endsWith('.ts') ||
      subPath.endsWith('.tsx') ||
      subPath.endsWith('.jsx') ||
      subPath.endsWith('.mjs')
    ) {
      let js = new TextDecoder().decode(body);

      // Rewrite all absolute paths in JS content
      js = rewriteAbsolutePaths(js, proxyBase);

      // Rewrite any hardcoded localhost references
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

    // ── CSS responses ──
    // Rewrite url(/...) references in CSS
    if (contentType?.includes('text/css') || subPath.endsWith('.css')) {
      let css = new TextDecoder().decode(body);

      css = rewriteAbsolutePaths(css, proxyBase);

      const encoded = new TextEncoder().encode(css);
      responseHeaders.set('Content-Length', String(encoded.length));
      return new NextResponse(encoded, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // ── Binary / other responses ──
    // Pass through without modification (images, fonts, wasm, etc.)
    responseHeaders.set('Content-Length', String(body.byteLength));
    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    if (request.headers.get('accept')?.includes('text/html')) {
      const errorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#ff6b6b;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;"><div><div style="font-size:20px;margin-bottom:12px;">⚠ Preview Unavailable</div><div style="color:#aaa;font-size:13px;">${message.replace(/</g, '&lt;')}</div><div style="color:#666;font-size:12px;margin-top:16px;">The dev server may still be starting. Try refreshing.</div></div></body></html>`;
      return new NextResponse(errorHtml, {
        status: 502,
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
      });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
