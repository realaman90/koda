/**
 * Animation Generator Streaming API Route
 *
 * Uses Mastra's agent.stream() with fullStream to forward all chunk types
 * (text-delta, tool-call, tool-result, finish, error) as SSE events.
 */

import { NextResponse } from 'next/server';
import { animationAgent } from '@/mastra';
import { getEngineInstructions } from '@/mastra/agents/instructions/animation';
import { loadRecipes } from '@/mastra/recipes';
import { RequestContext } from '@mastra/core/di';
import { dockerProvider } from '@/lib/sandbox/docker-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Tools that should NEVER run in the same stream as generate_plan.
// Gemini ignores instruction-level stop rules, so we enforce at the code level.
const EXECUTION_TOOLS = new Set([
  'sandbox_create', 'sandbox_destroy',
  'sandbox_write_file', 'sandbox_read_file', 'sandbox_run_command', 'sandbox_list_files',
  'sandbox_start_preview', 'sandbox_screenshot',
  'sandbox_upload_media', 'sandbox_write_binary', 'extract_video_frames',
  'generate_code', 'generate_remotion_code',
  'render_preview', 'render_final',
]);

interface StreamRequestBody {
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    nodeId?: string;
    phase?: string;
    plan?: unknown;
    todos?: Array<{ id: string; label: string; status: string }>;
    attachments?: Array<{ type: string; url: string }>;
    media?: Array<{ id: string; source: string; name: string; type: string; dataUrl: string; description?: string; duration?: number; mimeType?: string }>;
    sandboxId?: string;
    engine?: 'remotion' | 'theatre';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
    duration?: number;
    techniques?: string[];
    designSpec?: {
      style?: string;
      colors?: { primary: string; secondary: string; accent?: string };
      fonts?: { title: string; body: string };
    };
    fps?: number;
    resolution?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body: StreamRequestBody = await request.json();
    const { prompt, messages, context } = body;

    // Normalize input: accept either prompt (string) or messages (array)
    let agentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;

    if (messages && messages.length > 0) {
      agentMessages = [...messages];
    } else if (prompt) {
      agentMessages = [{ role: 'user', content: prompt }];
    } else {
      return NextResponse.json(
        { error: 'Either prompt or messages is required' },
        { status: 400 }
      );
    }

    // Inject engine-specific instructions as a system message
    const engine = context?.engine || 'remotion';
    const engineInstructions = getEngineInstructions(engine);

    // Load technique recipes if any are selected
    const recipeContent = loadRecipes(context?.techniques || []);
    const systemContent = recipeContent
      ? `${engineInstructions}\n\n${recipeContent}`
      : engineInstructions;

    agentMessages.unshift({
      role: 'system',
      content: systemContent,
    });

    // RequestContext for passing server-side data to tools without going through the LLM.
    // Tools read sandboxId/engine from here instead of relying on LLM-provided args
    // (which can be hallucinated or lost during message windowing).
    const requestContext = new RequestContext();
    requestContext.set('engine' as never, engine as never);
    if (context?.sandboxId) {
      requestContext.set('sandboxId' as never, context.sandboxId as never);
    }
    // Store plan.designSpec in RequestContext so code gen tool auto-resolves it
    if ((context?.plan as Record<string, unknown>)?.designSpec) {
      requestContext.set('designSpec' as never, (context!.plan as Record<string, unknown>).designSpec as never);
    }

    // Prepend context as a system-style user message if provided
    if (context) {
      const contextParts: string[] = [];
      // Engine is ALWAYS included prominently so the agent can't miss it
      contextParts.push(`ANIMATION ENGINE: ${engine.toUpperCase()} — You MUST use template "${engine}" when creating a sandbox. Do NOT use any other engine.`);
      if (context.aspectRatio) {
        contextParts.push(`Aspect ratio: ${context.aspectRatio}`);
      }
      if (context.duration) {
        contextParts.push(`Target duration: ${context.duration} seconds`);
      }
      if (context.sandboxId) {
        contextParts.push(`Active sandbox ID: ${context.sandboxId}`);
      }
      // Log media for debugging (always, even if empty)
      console.log(`[Animation API] Media received: ${context.media?.length ?? 0} items`, context.media?.map(m => ({ name: m.name, source: m.source, type: m.type, urlPrefix: m.dataUrl?.slice(0, 30) })));

      if (context.media && context.media.length > 0) {
        // ── Server-side media upload ──────────────────────────────────
        // Base64 media is uploaded server-side to avoid bloating the LLM context.
        // - If sandbox exists: upload immediately, tell agent "ALREADY AT path"
        // - If no sandbox: store in requestContext, sandbox_create auto-uploads
        const uploadedPaths: Map<string, string> = new Map(); // mediaId → sandbox path
        const destPathMap: Map<string, string> = new Map(); // mediaId → destPath (for consistent staticFile refs)
        const pendingMediaForSandbox: Array<{ id: string; name: string; data: Buffer; destPath: string; type: string; source: string }> = [];

        // ── Phase 1: Decode data: URLs to buffers ──
        const mediaBuffersLocal: Array<{ m: typeof context.media[0]; buffer: Buffer; destPath: string }> = [];
        // Ensure filenames have proper extensions for sandbox filesystem
        const ensureExt = (name: string, type: string, dataUrl: string): string => {
          if (/\.(png|jpg|jpeg|gif|webp|mp4|webm|mov)$/i.test(name)) return name;
          // Infer from data URL mime type
          if (dataUrl.startsWith('data:')) {
            const mime = dataUrl.split(';')[0]?.split(':')[1];
            const mimeExt: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm' };
            if (mime && mimeExt[mime]) return name + mimeExt[mime];
          }
          // Infer from URL path
          const urlExt = dataUrl.split('?')[0].match(/\.(png|jpg|jpeg|gif|webp|mp4|webm|mov)$/i)?.[0];
          if (urlExt) return name + urlExt;
          // Fallback based on type
          return name + (type === 'video' ? '.mp4' : '.png');
        };
        const usedPaths = new Set<string>();
        for (const m of context.media) {
          let safeName = ensureExt(m.name, m.type, m.dataUrl);
          // Deduplicate paths — if two media share a name, append index
          let destPath = `public/media/${safeName}`;
          if (usedPaths.has(destPath)) {
            const dot = safeName.lastIndexOf('.');
            const base = dot > 0 ? safeName.slice(0, dot) : safeName;
            const ext = dot > 0 ? safeName.slice(dot) : '.png';
            let i = 2;
            while (usedPaths.has(`public/media/${base}_${i}${ext}`)) i++;
            safeName = `${base}_${i}${ext}`;
            destPath = `public/media/${safeName}`;
          }
          usedPaths.add(destPath);
          destPathMap.set(m.id, destPath);
          if (m.dataUrl.startsWith('data:')) {
            const base64Part = m.dataUrl.split(',')[1];
            if (!base64Part) {
              console.warn(`[Animation API] Phase 1: Skipping ${m.name} — no base64 data after comma`);
              continue;
            }
            const buffer = Buffer.from(base64Part, 'base64');
            console.log(`[Animation API] Phase 1: Decoded ${m.name} → ${destPath} (${Math.round(buffer.length / 1024)}KB)`);
            mediaBuffersLocal.push({ m, buffer, destPath });
          } else if (m.dataUrl.startsWith('/api/assets/')) {
            // Local asset URL — read directly from asset storage (same server, no HTTP needed)
            try {
              const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
              const assetId = m.dataUrl.split('/api/assets/')[1];
              const result = await getLocalAssetProvider().getBuffer(assetId);
              if (result) {
                console.log(`[Animation API] Phase 1: Read local asset ${m.name} → ${destPath} (${Math.round(result.buffer.length / 1024)}KB)`);
                mediaBuffersLocal.push({ m, buffer: result.buffer, destPath });
              } else {
                console.warn(`[Animation API] Phase 1: Asset not found for ${m.name}: ${m.dataUrl}`);
              }
            } catch (err) {
              console.error(`[Animation API] Phase 1: Failed to read local asset ${m.name}:`, err);
            }
          } else if (!m.dataUrl.startsWith('http')) {
            console.warn(`[Animation API] Phase 1: Unrecognized URL scheme for ${m.name}: ${m.dataUrl.slice(0, 40)}...`);
          }
        }

        // ── Phase 2: Download HTTP URL media to buffers (parallel, 30s timeout) ──
        const httpMedia = context.media.filter(m => m.dataUrl.startsWith('http'));
        console.log(`[Animation API] Phase 2: ${httpMedia.length} HTTP URLs to download`);
        if (httpMedia.length > 0) {
          const downloads = await Promise.allSettled(
            httpMedia.map(async (m) => {
              const safeName = ensureExt(m.name, m.type, m.dataUrl);
              const destPath = `public/media/${safeName}`;
              destPathMap.set(m.id, destPath);
              console.log(`[Animation API] Phase 2: Downloading ${m.name} from ${m.dataUrl.slice(0, 80)}...`);
              const resp = await fetch(m.dataUrl, { signal: AbortSignal.timeout(30_000) });
              if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${m.dataUrl.slice(0, 80)}`);
              const buffer = Buffer.from(await resp.arrayBuffer());
              return { m, buffer, destPath };
            })
          );
          for (const result of downloads) {
            if (result.status === 'fulfilled') {
              mediaBuffersLocal.push(result.value);
              console.log(`[Animation API] Phase 2: Downloaded ${result.value.m.name} → ${result.value.destPath} (${Math.round(result.value.buffer.length / 1024)}KB)`);
            } else {
              console.error(`[Animation API] Phase 2: FAILED to download HTTP media:`, result.reason);
            }
          }
        }

        // ── Phase 3: Upload buffers to sandbox or store as pending ──
        console.log(`[Animation API] Phase 3: ${mediaBuffersLocal.length} buffers ready, sandboxId=${context.sandboxId || 'NONE'}`);
        for (const { m, buffer, destPath } of mediaBuffersLocal) {
          if (context.sandboxId) {
            try {
              await dockerProvider.writeBinary(context.sandboxId, destPath, buffer);
              uploadedPaths.set(m.id, destPath);
              console.log(`[Animation API] Phase 3: Pre-uploaded ${m.name} (${Math.round(buffer.length / 1024)}KB) → ${destPath}`);
            } catch (err) {
              console.error(`[Animation API] Phase 3: FAILED to pre-upload ${m.name}:`, err);
            }
          } else {
            pendingMediaForSandbox.push({ id: m.id, name: m.name, data: buffer, destPath, type: m.type, source: m.source });
          }
        }

        // Store pending media in requestContext for sandbox_create tool
        if (pendingMediaForSandbox.length > 0) {
          const totalBytes = pendingMediaForSandbox.reduce((sum, p) => sum + p.data.length, 0);
          console.log(`[Animation API] Phase 3: Storing ${pendingMediaForSandbox.length} pending media (${Math.round(totalBytes / 1024)}KB total) in requestContext for sandbox_create`);
          requestContext.set('pendingMedia' as never, pendingMediaForSandbox as never);
        } else if (mediaBuffersLocal.length === 0 && context.media.length > 0) {
          console.error(`[Animation API] Phase 3: WARNING — ${context.media.length} media entries received but 0 buffers decoded! Media URLs: ${context.media.map(m => m.dataUrl.slice(0, 40)).join(', ')}`);
        }

        // Store mediaFiles in requestContext for generate_remotion_code to auto-resolve.
        // Includes ALL media (pre-uploaded + pending) — by the time code gen runs,
        // sandbox_create will have auto-uploaded pending files.
        const mediaFilesForCodeGen = mediaBuffersLocal.map(({ m, destPath }) => ({
          path: destPath,
          type: m.type as 'image' | 'video',
          description: m.description || m.name,
        }));
        if (mediaFilesForCodeGen.length > 0) {
          requestContext.set('mediaFiles' as never, mediaFilesForCodeGen as never);
          console.log(`[Animation API] Stored ${mediaFilesForCodeGen.length} mediaFiles in requestContext for code gen:`, mediaFilesForCodeGen.map(f => f.path));
        }

        // Store media buffers for analyze_media tool to read without needing sandbox access.
        const mediaBuffers = new Map<string, { buffer: Buffer; mimeType: string }>();
        for (const { m, buffer } of mediaBuffersLocal) {
          mediaBuffers.set(m.name, { buffer, mimeType: m.mimeType || (m.type === 'video' ? 'video/mp4' : 'image/png') });
        }
        if (mediaBuffers.size > 0) {
          requestContext.set('mediaBuffers' as never, mediaBuffers as never);
        }

        const edgeMedia = context.media.filter(m => m.source === 'edge');
        const uploadMedia = context.media.filter(m => m.source !== 'edge');

        const formatMedia = (m: typeof context.media[0]) => {
          const uploaded = uploadedPaths.has(m.id);
          const pending = pendingMediaForSandbox.some(p => p.id === m.id);
          const desc = m.description ? ` — "${m.description}"` : '';
          // Use the actual dest path (with ensured extension) for staticFile references
          const dp = destPathMap.get(m.id) || `public/media/${m.name}`;
          const fileName = dp.split('/').pop()!;
          if (uploaded) {
            return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) ALREADY UPLOADED to ${uploadedPaths.get(m.id)} — reference as staticFile("media/${fileName}") in code`;
          }
          if (pending) {
            return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) WILL BE AUTO-UPLOADED to ${dp} after sandbox creation — reference as staticFile("media/${fileName}") in code`;
          }
          // blob: or cached: URLs that couldn't be resolved — skip with warning
          if (m.dataUrl.startsWith('blob:') || m.dataUrl.startsWith('cached:')) {
            console.warn(`[Animation API] Skipping unresolvable media: ${m.name} (${m.dataUrl.slice(0, 30)}...)`);
            return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) ⚠️ UNAVAILABLE — could not be resolved server-side. Skip this file.`;
          }
          // URL-based media — agent downloads via sandbox_upload_media
          return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) URL: ${m.dataUrl} — use sandbox_upload_media to download to public/media/${fileName}`;
        };

        if (edgeMedia.length > 0) {
          contextParts.push(`⚠️ EDGE MEDIA — ${edgeMedia.length} file(s) ALREADY PROVIDED by the user via canvas edges. These are READY TO USE — do NOT ask the user if they have images. Feature ALL of them prominently in the animation:\n${edgeMedia.map(formatMedia).join('\n')}`);
        }
        if (uploadMedia.length > 0) {
          contextParts.push(`📎 UPLOADED MEDIA — Determine purpose from prompt context (content vs reference):\n${uploadMedia.map(formatMedia).join('\n')}`);
        }
        contextParts.push(
          'For CONTENT media: Pass file paths via mediaFiles to generate_remotion_code. ' +
          'For REFERENCE media: Use analyze_media for design cues, do NOT upload to sandbox. ' +
          'For URL media: Use sandbox_upload_media to download to public/media/. ' +
          'For videos, call analyze_media first for scene understanding, then extract_video_frames for key frame images.'
        );
      }
      if (context.techniques && context.techniques.length > 0) {
        contextParts.push(`Selected technique presets: ${context.techniques.join(', ')} — recipe patterns are injected in the system message.`);
      }
      if (context.fps) {
        contextParts.push(`Target FPS: ${context.fps}`);
      }
      if (context.resolution) {
        contextParts.push(`Target resolution: ${context.resolution}`);
      }
      if (context.designSpec) {
        const ds = context.designSpec;
        if (ds.style) contextParts.push(`Design style preset: ${ds.style}`);
        if (ds.colors) contextParts.push(`Color palette — Primary: ${ds.colors.primary}, Secondary: ${ds.colors.secondary}${ds.colors.accent ? `, Accent: ${ds.colors.accent}` : ''}`);
        if (ds.fonts) contextParts.push(`Typography — Title font: ${ds.fonts.title}, Body font: ${ds.fonts.body}`);
      } else if (!(context?.plan as Record<string, unknown>)?.designSpec) {
        // When NO designSpec is set at all, add guidance to prevent dark-mode default
        contextParts.push(`No design spec selected. You MUST choose colors appropriate to the content — NOT default dark/indigo. Light backgrounds for product/lifestyle/corporate, dark for tech/developer, colorful for creative/brand. Include your chosen palette in generate_plan's designSpec field.`);
      }
      if (context.phase) {
        contextParts.push(`Current phase: ${context.phase}`);
      }
      if (context.plan) {
        contextParts.push(`Animation plan:\n${JSON.stringify(context.plan, null, 2)}`);
      }
      if (context.todos && context.todos.length > 0) {
        contextParts.push(`Progress:\n${context.todos.map(t => `- [${t.status}] ${t.label}`).join('\n')}`);
      }
      if (context.attachments && context.attachments.length > 0) {
        contextParts.push(`${context.attachments.length} reference files attached`);
      }

      if (contextParts.length > 0) {
        // Prepend context to the first user message
        const contextStr = contextParts.join('\n');
        const firstUserIdx = agentMessages.findIndex(m => m.role === 'user');
        if (firstUserIdx >= 0) {
          agentMessages[firstUserIdx] = {
            ...agentMessages[firstUserIdx],
            content: `${agentMessages[firstUserIdx].content}\n\n<context>\n${contextStr}\n</context>`,
          };
        }
      }
    }

    // ── Message windowing ──────────────────────────────────────────
    // Only keep the last N messages to prevent token overflow.
    // The system context (prepended to first user message) provides
    // enough state for the agent to continue coherently.
    const MAX_MESSAGES = 10;
    if (agentMessages.length > MAX_MESSAGES) {
      agentMessages = agentMessages.slice(-MAX_MESSAGES);
    }

    // ── Critical state injection (post-windowing) ────────────────
    // sandboxId and engine are now in RequestContext (tools read directly),
    // but the LLM still needs engine awareness for planning/reasoning.
    {
      const trailingParts: string[] = [];
      trailingParts.push(`ENGINE: ${engine}. All sandbox tools auto-resolve sandboxId and engine from server context — you do NOT need to pass them.`);
      if (context?.sandboxId) {
        trailingParts.push(`A sandbox is already active. Do NOT call sandbox_create again.`);
      }
      agentMessages.push({
        role: 'system',
        content: trailingParts.join(' '),
      });
    }

    // ⏱ Server-side timing
    const serverStart = Date.now();

    // ── Plan approval enforcement ──────────────────────────────────
    // Gemini ignores instruction-level "stop after generate_plan" rules.
    // We enforce it at the code level:
    // - If no approved plan in context, limit maxSteps (defense-in-depth)
    // - Stream-level: after generate_plan, block execution tools & close stream
    const hasApprovedPlan = !!context?.plan;
    const hasSandbox = !!context?.sandboxId;
    // Planning phase: no approved plan AND no existing sandbox (not a revision)
    // Give limited steps — enough for enhance + plan + approval request
    // Execution/revision phase: full 50 steps
    const maxSteps = (hasApprovedPlan || hasSandbox) ? 50 : 12;

    console.log(`⏱ [Animation API] Stream request — engine: ${engine}, messages: ${agentMessages.length}, sandboxId: ${context?.sandboxId || 'NONE'}, phase: ${context?.phase || 'unknown'}, techniques: ${context?.techniques?.length || 0}${recipeContent ? ` (~${Math.round(recipeContent.length / 4)} tokens)` : ''}, maxSteps: ${maxSteps}, hasApprovedPlan: ${hasApprovedPlan}, designSpec: ${context?.designSpec ? JSON.stringify(context.designSpec) : 'NONE'}`);

    const result = await animationAgent.stream(
      agentMessages as Parameters<typeof animationAgent.stream>[0],
      {
        maxSteps,
        requestContext,
        providerOptions: {
          // Each provider ignores keys meant for other providers
          google: { thinkingConfig: { thinkingBudget: 8192, includeThoughts: true } },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
        },
      }
    );

    // Create encoder for SSE streaming
    const encoder = new TextEncoder();

    // Track closed state for the stream controller
    let closed = false;

    // Track sandbox ID discovered from sandbox_create tool results
    // so the client can store it for subsequent stream calls
    let discoveredSandboxId: string | null = null;

    // ── Plan approval gate ──────────────────────────────────────────
    // Track whether generate_plan was called in THIS stream.
    // If so, block all execution tools to force the user to approve first.
    let planCalledInStream = false;

    const readable = new ReadableStream({
      async start(controller) {
        const safeEnqueue = (data: Uint8Array) => {
          if (!closed) {
            try { controller.enqueue(data); } catch { closed = true; }
          }
        };
        const safeClose = () => {
          if (!closed) {
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
          }
        };

        // Close early when the client disconnects
        request.signal.addEventListener('abort', () => {
          closed = true;
          safeClose();
        });

        try {
          const reader = result.fullStream.getReader();

          while (!closed) {
            const { done, value: chunk } = await reader.read();
            if (done || closed) break;

            let sseData: string | null = null;

            switch (chunk.type) {
              case 'text-delta': {
                sseData = JSON.stringify({
                  type: 'text-delta',
                  text: chunk.payload.text,
                });
                break;
              }

              case 'tool-call': {
                const toolElapsed = ((Date.now() - serverStart) / 1000).toFixed(1);
                console.log(`⏱ [Animation API] Tool call: ${chunk.payload.toolName} at +${toolElapsed}s`);

                // Track generate_plan call — once seen, execution tools are blocked
                if (chunk.payload.toolName === 'generate_plan') {
                  planCalledInStream = true;
                }

                // ── Plan approval gate: block execution tools after generate_plan ──
                // Gemini ignores instruction-level "stop after plan" rules and
                // calls sandbox_create / generate_remotion_code in the same turn.
                // We enforce the gate here by closing the stream.
                if (planCalledInStream && EXECUTION_TOOLS.has(chunk.payload.toolName)) {
                  console.log(`⏱ [Animation API] ⛔ BLOCKING post-plan tool: ${chunk.payload.toolName} — plan needs user approval first`);
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'complete',
                    text: '',
                    finishReason: 'plan-approval-required',
                  })}\n\n`));
                  reader.cancel();
                  safeClose();
                  sseData = null; // Don't forward the blocked tool-call
                  break;
                }

                sseData = JSON.stringify({
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                });
                break;
              }

              case 'tool-result': {
                const resultElapsed = ((Date.now() - serverStart) / 1000).toFixed(1);
                const isErr = chunk.payload.isError;
                console.log(`⏱ [Animation API] Tool result: ${chunk.payload.toolName} at +${resultElapsed}s ${isErr ? '❌' : '✅'}`);

                // Track generate_plan from tool-result too (in case tool-call was missed)
                if (chunk.payload.toolName === 'generate_plan' && !isErr) {
                  planCalledInStream = true;
                }

                // ── Close stream after request_approval for plan ──
                // The plan card is the last thing the user should see in this stream.
                // Forward the result, send complete, then close.
                if (planCalledInStream && chunk.payload.toolName === 'request_approval' && !isErr) {
                  const resultObj = chunk.payload.result as Record<string, unknown>;
                  if (resultObj?.type === 'plan') {
                    console.log(`⏱ [Animation API] ✅ Plan approval sent — closing stream for user review`);
                    // Forward the request_approval result
                    const approvalSSE = JSON.stringify({
                      type: 'tool-result',
                      toolCallId: chunk.payload.toolCallId,
                      toolName: chunk.payload.toolName,
                      result: chunk.payload.result,
                      isError: false,
                    });
                    safeEnqueue(encoder.encode(`data: ${approvalSSE}\n\n`));
                    // Send complete
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'complete',
                      text: '',
                      finishReason: 'plan-approval-sent',
                    })}\n\n`));
                    reader.cancel();
                    safeClose();
                    sseData = null; // Already forwarded manually
                    break;
                  }
                }

                // Track sandbox ID from sandbox_create results so the client
                // can persist it for subsequent stream calls (Issue #47)
                if (
                  chunk.payload.toolName === 'sandbox_create' &&
                  !isErr &&
                  chunk.payload.result &&
                  typeof chunk.payload.result === 'object' &&
                  'sandboxId' in (chunk.payload.result as Record<string, unknown>)
                ) {
                  const newSandboxId = (chunk.payload.result as Record<string, unknown>).sandboxId;
                  if (typeof newSandboxId === 'string' && newSandboxId) {
                    discoveredSandboxId = newSandboxId;
                    console.log(`⏱ [Animation API] Discovered sandbox ID: ${discoveredSandboxId}`);
                    // Send a custom SSE event so the frontend can store it
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'sandbox-created',
                      sandboxId: discoveredSandboxId,
                    })}\n\n`));
                  }
                }

                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  result: chunk.payload.result,
                  isError: chunk.payload.isError,
                });
                break;
              }

              case 'finish': {
                sseData = JSON.stringify({
                  type: 'finish',
                  finishReason: chunk.payload.stepResult?.reason,
                });
                break;
              }

              case 'step-finish': {
                sseData = JSON.stringify({
                  type: 'step-finish',
                  usage: chunk.payload.output?.usage ?? chunk.payload.totalUsage,
                });
                break;
              }

              case 'tool-error': {
                sseData = JSON.stringify({
                  type: 'tool-result',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  result: { error: chunk.payload.error instanceof Error ? chunk.payload.error.message : String(chunk.payload.error) },
                  isError: true,
                });
                break;
              }

              case 'error': {
                sseData = JSON.stringify({
                  type: 'error',
                  error: chunk.payload.error instanceof Error
                    ? chunk.payload.error.message
                    : String(chunk.payload.error),
                });
                break;
              }

              case 'reasoning-delta': {
                if (chunk.payload.text) {
                  sseData = JSON.stringify({
                    type: 'reasoning-delta',
                    text: chunk.payload.text,
                  });
                }
                break;
              }

              // reasoning-start, reasoning-end, reasoning-signature — skip silently
              case 'reasoning-start':
              case 'reasoning-end':
              case 'reasoning-signature':
              case 'redacted-reasoning':
                break;

              default:
                break;
            }

            if (sseData) {
              safeEnqueue(encoder.encode(`data: ${sseData}\n\n`));
            }
          }

          // ⏱ Server total time
          const serverTotal = ((Date.now() - serverStart) / 1000).toFixed(1);
          console.log(`⏱ [Animation API] Stream complete — total: ${serverTotal}s`);

          // Send final complete event (ALWAYS — even if aggregation fails)
          // This is critical: the client relies on 'complete' to know the stream ended
          if (!closed) {
            let text = '';
            let usage = undefined;
            let finishReason = undefined;
            try {
              [text, usage, finishReason] = await Promise.all([
                result.text,
                result.usage,
                result.finishReason,
              ]);
            } catch (aggregationErr) {
              // Aggregation failed — send complete with empty text
              // This happens when agent only did tool calls without generating text
              console.warn('Stream aggregation failed (likely tool-only response):', aggregationErr);
            }

            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              text: text || '',
              usage,
              finishReason,
            })}\n\n`));
          }
          safeClose();
        } catch (error) {
          if (!closed) {
            console.error('Stream processing error:', error);
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Stream error',
            })}\n\n`));
          }
          safeClose();
        }
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Animation streaming error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Streaming failed' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking stream status
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('nodeId');

  if (!nodeId) {
    return NextResponse.json(
      { error: 'nodeId parameter required' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    status: 'ready',
    nodeId,
    agentId: 'animation-agent',
    capabilities: [
      // UI Tools
      'update_todo',
      'batch_update_todos',
      'set_thinking',
      'add_message',
      'request_approval',
      // Planning Tools
      'analyze_prompt',
      'generate_plan',
      // Sandbox Lifecycle
      'sandbox_create',
      'sandbox_destroy',
      // Sandbox Operations
      'sandbox_write_file',
      'sandbox_read_file',
      'sandbox_run_command',
      'sandbox_list_files',
      // Preview & Visual
      'sandbox_start_preview',
      'sandbox_screenshot',
      // Rendering
      'render_preview',
      'render_final',
    ],
  });
}
