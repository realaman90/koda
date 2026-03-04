/**
 * Animation Generator Streaming API Route
 *
 * Uses Mastra's agent.stream() with fullStream to forward all chunk types
 * (text-delta, tool-call, tool-result, finish, error) as SSE events.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { animationAgent } from '@/mastra';
import { getEngineInstructions } from '@/mastra/agents/instructions/animation';
import { loadRecipes } from '@/mastra/recipes';
import { STYLE_PRESETS } from '@/lib/plugins/official/agents/animation-generator/presets';
import { RequestContext } from '@mastra/core/di';
import { getSandboxProvider } from '@/lib/sandbox/sandbox-factory';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';
import { evaluatePluginLaunchById, emitPluginPolicyAuditEvent } from '@/lib/plugins/launch-policy';
import { requireActor } from '@/lib/auth/actor';
import { getOrCreateBalance, deductCredits, refundCredits } from '@/lib/db/credit-queries';
import { getCreditCost, PLAN_KEYS } from '@/lib/credits/costs';
import {
  isUpstreamTransportError,
  MAX_CODEGEN_TRANSPORT_FAILURES_PER_STREAM,
  runAnimationSkill,
} from '@/mastra/skills/animation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const bodySizeLimit = '50mb';

const STREAM_HEARTBEAT_MS = 15_000;
const STREAM_SOFT_TIMEOUT_MS = maxDuration * 1000 - 15_000;
const CODEGEN_TOOLS = new Set(['generate_code', 'generate_remotion_code']);


const ANIMATION_DEBUG = process.env.ANIMATION_DEBUG === '1';
const debugLog = (...args: unknown[]) => {
  if (ANIMATION_DEBUG) {
    console.log(...args);
  }
};

interface StreamRequestBody {
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    nodeId?: string;
    phase?: string;
    plan?: unknown;
    planAccepted?: boolean;
    todos?: Array<{ id: string; label: string; status: string }>;
    attachments?: Array<{ type: string; url: string }>;
    media?: Array<{ id: string; source: string; name: string; type: string; dataUrl: string; description?: string; duration?: number; mimeType?: string; svgCode?: string }>;
    sandboxId?: string;
    engine?: 'remotion' | 'theatre';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
    duration?: number;
    techniques?: string[];
    /** When editing from a past version, restore this version's snapshot */
    restoreVersionId?: string;
    designSpec?: {
      style?: string;
      theme?: string;
      colors?: { primary: string; secondary: string; accent?: string };
      fonts?: { title: string; body: string };
    };
    motionSpec?: {
      chips?: {
        energy?: 'calm' | 'medium' | 'energetic';
        feel?: 'smooth' | 'snappy' | 'bouncy';
        camera?: 'static' | 'subtle' | 'dynamic';
        transitions?: 'minimal' | 'cinematic';
      };
      sliders?: {
        speed?: number;
        intensity?: number;
        smoothness?: number;
        cameraActivity?: number;
        transitionAggressiveness?: number;
      };
      variant?: 'safe' | 'balanced' | 'dramatic';
      source?: string;
      followUp?: string;
      holdFinalFrameSeconds?: number;
      referenceProfile?: {
        sourceMediaId: string;
        sourceName: string;
        sourceType: 'video' | 'gif';
        pacing: number;
        cutRhythm: number;
        cameraEnergy: number;
        easingTendency: 'smooth' | 'snappy' | 'bouncy';
        summary: string;
      };
      presetId?: string;
      updatedAt?: string;
    };
    logo?: { url: string; name?: string };
    fps?: number;
    resolution?: string;
  };
}

export async function POST(request: Request) {
  let animUserId: string | undefined;
  let animCreditCost: number | undefined;
  try {
    const policyDecision = evaluatePluginLaunchById('animation-generator');
    emitPluginPolicyAuditEvent({
      source: 'api',
      decision: policyDecision,
      metadata: { method: 'POST', path: '/api/plugins/animation/stream' },
    });

    if (!policyDecision.allowed) {
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'animation-generator',
        errorCode: policyDecision.code,
      });

      return NextResponse.json(
        {
          error: 'Plugin launch blocked by policy.',
          code: policyDecision.code,
          reason: policyDecision.reason,
        },
        { status: policyDecision.code === 'PLUGIN_NOT_FOUND' ? 404 : 403 }
      );
    }

    // ── Auth + Credit check ──────────────────────────────────────────
    const actorResult = await requireActor();
    if (!actorResult.ok) return actorResult.response;
    animUserId = actorResult.actor.user.id;

    // Resolve plan
    let animPlanKey = 'free_user';
    const { has: hasPlan } = await auth();
    if (hasPlan) {
      for (const plan of PLAN_KEYS) {
        if (plan === 'free_user') continue;
        if (hasPlan({ plan })) { animPlanKey = plan; break; }
      }
    }
    await getOrCreateBalance(animUserId!, animPlanKey);

    // Peek at engine + duration from body for per-second credit scaling
    let peekDuration: number | undefined;
    let peekEngine = 'remotion';
    try {
      const peek = await request.clone().json();
      peekDuration = peek?.context?.duration;
      peekEngine = peek?.context?.engine || 'remotion';
    } catch { /* body parse failure — handler will deal with it */ }

    animCreditCost = getCreditCost('animation', { model: peekEngine, duration: peekDuration });
    const deductResult = await deductCredits(
      animUserId!,
      animCreditCost,
      `animation:${peekEngine}`,
      { model: peekEngine, duration: peekDuration }
    );
    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_CREDITS',
          message: `Animation costs ${animCreditCost} credits but you have ${deductResult.balance}. Upgrade your plan for more credits.`,
          required: animCreditCost,
          balance: deductResult.balance,
        },
        { status: 402 }
      );
    }

    const body: StreamRequestBody = await request.json();
    const { prompt, messages, context } = body;

    // Normalize input: accept either prompt (string) or messages (array)
    let agentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;

    if (messages && messages.length > 0) {
      agentMessages = [...messages];
    } else if (prompt) {
      agentMessages = [{ role: 'user', content: prompt }];
    } else {
      emitLaunchMetric({
        metric: 'plugin_execution',
        status: 'error',
        source: 'api',
        pluginId: 'animation-generator',
        errorCode: 'missing_prompt_or_messages',
      });
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

    // RequestContext for passing server-side data to tools without going through the LLM.
    // Tools read sandboxId/engine from here instead of relying on LLM-provided args
    // (which can be hallucinated or lost during message windowing).
    const requestContext = new RequestContext();
    requestContext.set('engine' as never, engine as never);
    requestContext.set('codegenTransportFailures' as never, 0 as never);
    if (context?.sandboxId) {
      requestContext.set('sandboxId' as never, context.sandboxId as never);
    }
    // Store plan.designSpec in RequestContext so code gen tool auto-resolves it
    if ((context?.plan as Record<string, unknown>)?.designSpec) {
      requestContext.set('designSpec' as never, (context!.plan as Record<string, unknown>).designSpec as never);
    }
    // Pass nodeId, phase, and plan flag so sandbox_create can decide whether to restore snapshots
    debugLog(
      `[Animation API] RequestContext: nodeId=${context?.nodeId}, phase=${context?.phase}, hasPlan=${!!context?.plan}, planAccepted=${context?.planAccepted === true}, sandboxId=${context?.sandboxId}`
    );
    if (context?.nodeId) {
      requestContext.set('nodeId' as never, context.nodeId as never);
    }
    if (context?.phase) {
      requestContext.set('phase' as never, context.phase as never);
    }
    if (context?.plan) {
      requestContext.set('plan' as never, true as never);
    }
    if (context?.planAccepted !== undefined) {
      requestContext.set('planAccepted' as never, context.planAccepted as never);
    }
    if (context?.duration) {
      requestContext.set('duration' as never, context.duration as never);
    }
    if (context?.motionSpec) {
      requestContext.set('motionSpec' as never, context.motionSpec as never);
    }
    if (context?.fps) {
      requestContext.set('fps' as never, context.fps as never);
    }
    if (context?.restoreVersionId) {
      requestContext.set('restoreVersionId' as never, context.restoreVersionId as never);
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

      // ── Dead sandbox detection ──────────────────────────────────────
      // If sandboxId points at a dead container, clear it and check for snapshot.
      // This avoids a wasted error/retry cycle where the agent tries to use
      // the dead container, gets an error, then has to create a new one.
      if (context.sandboxId) {
        try {
          const status = await getSandboxProvider().getStatus(context.sandboxId);
          if (!status) {
            debugLog(`[Animation API] Sandbox ${context.sandboxId} is dead — will auto-restore from snapshot`);
            requestContext.set('sandboxId' as never, undefined as never);
            // Check if a code snapshot exists so we can inform the agent
            const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
            const hasSnapshot = context.nodeId ? await getSnapshotProvider().exists(context.nodeId) : false;
            if (hasSnapshot) {
              contextParts.push(`Previous sandbox expired. A code snapshot exists — when you call sandbox_create, your previous code will be auto-restored. Proceed with sandbox_create, then modify the code as needed.`);
            } else {
              contextParts.push(`Previous sandbox expired and no snapshot exists. Create a new sandbox and regenerate from the plan.`);
            }
            context.sandboxId = undefined;
          } else {
            contextParts.push(`Active sandbox ID: ${context.sandboxId}`);
          }
        } catch {
          // getStatus can throw — treat as sandbox dead
          console.warn(`[Animation API] Failed to check sandbox status for ${context.sandboxId} — treating as dead`);
          requestContext.set('sandboxId' as never, undefined as never);
          context.sandboxId = undefined;
        }
      }
      // Log media for debugging (always, even if empty)
      debugLog(`[Animation API] Media received: ${context.media?.length ?? 0} items`, context.media?.map(m => ({ name: m.name, source: m.source, type: m.type, urlPrefix: m.dataUrl?.slice(0, 30) })));

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
          if (/\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov)$/i.test(name)) return name;
          // Infer from data URL mime type
          if (dataUrl.startsWith('data:')) {
            const mime = dataUrl.split(';')[0]?.split(':')[1];
            const mimeExt: Record<string, string> = {
              'image/png': '.png',
              'image/jpeg': '.jpg',
              'image/gif': '.gif',
              'image/webp': '.webp',
              'image/svg+xml': '.svg',
              'video/mp4': '.mp4',
              'video/webm': '.webm',
            };
            if (mime && mimeExt[mime]) return name + mimeExt[mime];
          }
          // Infer from URL path
          const urlExt = dataUrl.split('?')[0].match(/\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov)$/i)?.[0];
          if (urlExt) return name + urlExt;
          // Fallback based on type
          return name + (type === 'video' ? '.mp4' : '.png');
        };
        const usedPaths = new Set<string>();
        const reserveDestPath = (m: typeof context.media[number]): string => {
          const existing = destPathMap.get(m.id);
          if (existing) return existing;
          let safeName = ensureExt(m.name, m.type, m.dataUrl);
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
          return destPath;
        };

        for (const m of context.media) {
          // SVG code entries without a real URL are handled via svgCodeAssets context — skip file upload
          if (m.svgCode && !m.dataUrl) continue;
          const destPath = reserveDestPath(m);
          if (m.dataUrl.startsWith('data:')) {
            const base64Part = m.dataUrl.split(',')[1];
            if (!base64Part) {
              console.warn(`[Animation API] Phase 1: Skipping ${m.name} — no base64 data after comma`);
              continue;
            }
            const buffer = Buffer.from(base64Part, 'base64');
            debugLog(`[Animation API] Phase 1: Decoded ${m.name} → ${destPath} (${Math.round(buffer.length / 1024)}KB)`);
            mediaBuffersLocal.push({ m, buffer, destPath });
          } else if (m.dataUrl.startsWith('/api/assets/')) {
            // Local asset URL — read directly from asset storage (same server, no HTTP needed)
            try {
              const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
              const assetId = m.dataUrl.split('/api/assets/')[1];
              const result = await getLocalAssetProvider().getBuffer(assetId);
              if (result) {
                debugLog(`[Animation API] Phase 1: Read local asset ${m.name} → ${destPath} (${Math.round(result.buffer.length / 1024)}KB)`);
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
        debugLog(`[Animation API] Phase 2: ${httpMedia.length} HTTP URLs to download`);
        if (httpMedia.length > 0) {
          const downloads = await Promise.allSettled(
            httpMedia.map(async (m) => {
              const destPath = reserveDestPath(m);
              debugLog(`[Animation API] Phase 2: Downloading ${m.name} from ${m.dataUrl.slice(0, 80)}...`);
              const resp = await fetch(m.dataUrl, { signal: AbortSignal.timeout(30_000) });
              if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${m.dataUrl.slice(0, 80)}`);
              const buffer = Buffer.from(await resp.arrayBuffer());
              return { m, buffer, destPath };
            })
          );
          for (const result of downloads) {
            if (result.status === 'fulfilled') {
              mediaBuffersLocal.push(result.value);
              debugLog(`[Animation API] Phase 2: Downloaded ${result.value.m.name} → ${result.value.destPath} (${Math.round(result.value.buffer.length / 1024)}KB)`);
            } else {
              console.error(`[Animation API] Phase 2: FAILED to download HTTP media:`, result.reason);
            }
          }
        }

        // ── Phase 3: Upload buffers to sandbox or store as pending ──
        debugLog(`[Animation API] Phase 3: ${mediaBuffersLocal.length} buffers ready, sandboxId=${context.sandboxId || 'NONE'}`);
        let sandboxPreuploadAvailable = !!context.sandboxId;
        let sandboxPreuploadFailure: string | null = null;
        for (const { m, buffer, destPath } of mediaBuffersLocal) {
          if (context.sandboxId && sandboxPreuploadAvailable) {
            try {
              await getSandboxProvider().writeBinary(context.sandboxId, destPath, buffer);
              uploadedPaths.set(m.id, destPath);
              debugLog(`[Animation API] Phase 3: Pre-uploaded ${m.name} (${Math.round(buffer.length / 1024)}KB) → ${destPath}`);
            } catch (err) {
              console.error(`[Animation API] Phase 3: FAILED to pre-upload ${m.name}:`, err);
              sandboxPreuploadAvailable = false;
              sandboxPreuploadFailure = err instanceof Error ? err.message : String(err);
              pendingMediaForSandbox.push({ id: m.id, name: m.name, data: buffer, destPath, type: m.type, source: m.source });
            }
          } else {
            pendingMediaForSandbox.push({ id: m.id, name: m.name, data: buffer, destPath, type: m.type, source: m.source });
          }
        }

        // If pre-upload failed against an existing sandbox, force fallback to sandbox_create
        // so pending media can be uploaded safely in the next create/reuse step.
        if (!sandboxPreuploadAvailable && context.sandboxId) {
          const staleSandboxId = context.sandboxId;
          requestContext.set('sandboxId' as never, undefined as never);
          context.sandboxId = undefined;
          contextParts.push(
            `Active sandbox "${staleSandboxId}" became unavailable during media upload (${sandboxPreuploadFailure || 'unknown error'}). ` +
            'Treat sandbox as unavailable and call sandbox_create to recreate it. Pending media is ready for auto-upload.'
          );
        }

        if (mediaBuffersLocal.length === 0 && context.media.length > 0) {
          console.error(`[Animation API] Phase 3: WARNING — ${context.media.length} media entries received but 0 buffers decoded! Media URLs: ${context.media.map(m => m.dataUrl.slice(0, 40)).join(', ')}`);
        }

        // ── Phase 3b: Handle logo upload ──
        if (context.logo?.url) {
          const logoUrl = context.logo.url;
          const logoName = context.logo.name || 'logo.png';
          const logoDestPath = `public/media/${logoName}`;
          let logoBuffer: Buffer | null = null;
          let logoUploadFailedReason: string | null = null;

          if (logoUrl.startsWith('data:')) {
            const base64Data = logoUrl.split(',')[1];
            if (base64Data) logoBuffer = Buffer.from(base64Data, 'base64');
          } else if (logoUrl.startsWith('http')) {
            try {
              const resp = await fetch(logoUrl, { signal: AbortSignal.timeout(15_000) });
              if (resp.ok) {
                logoBuffer = Buffer.from(await resp.arrayBuffer());
              } else {
                logoUploadFailedReason = `Logo HTTP fetch failed (${resp.status})`;
              }
            } catch (err) {
              console.warn(`[Animation API] Logo download failed:`, err);
              logoUploadFailedReason = `Logo download failed: ${err instanceof Error ? err.message : String(err)}`;
            }
          }

          if (logoBuffer) {
            if (context.sandboxId && sandboxPreuploadAvailable) {
              try {
                await getSandboxProvider().writeBinary(context.sandboxId, logoDestPath, logoBuffer);
                debugLog(`[Animation API] Logo pre-uploaded → ${logoDestPath} (${Math.round(logoBuffer.length / 1024)}KB)`);
                requestContext.set('logoPath' as never, logoDestPath as never);
              } catch (err) {
                console.error(`[Animation API] Logo pre-upload failed:`, err);
                sandboxPreuploadAvailable = false;
                sandboxPreuploadFailure = err instanceof Error ? err.message : String(err);
                logoUploadFailedReason = `Logo pre-upload failed: ${err instanceof Error ? err.message : String(err)}`;
                pendingMediaForSandbox.push({ id: 'logo', name: logoName, data: logoBuffer, destPath: logoDestPath, type: 'image', source: 'upload' });
                requestContext.set('logoPath' as never, logoDestPath as never);
              }
            } else {
              pendingMediaForSandbox.push({ id: 'logo', name: logoName, data: logoBuffer, destPath: logoDestPath, type: 'image', source: 'upload' });
              requestContext.set('logoPath' as never, logoDestPath as never);
            }
          } else {
            logoUploadFailedReason = logoUploadFailedReason || 'Logo buffer resolution failed';
          }

          if (logoUploadFailedReason) {
            requestContext.set('logoUploadError' as never, logoUploadFailedReason as never);
          }
        }

        // Store pending media in requestContext for sandbox_create tool (media + logo).
        if (pendingMediaForSandbox.length > 0) {
          const totalBytes = pendingMediaForSandbox.reduce((sum, p) => sum + p.data.length, 0);
          debugLog(`[Animation API] Phase 3: Storing ${pendingMediaForSandbox.length} pending media (${Math.round(totalBytes / 1024)}KB total) in requestContext for sandbox_create`);
          requestContext.set('pendingMedia' as never, pendingMediaForSandbox as never);
        }

        // Store mediaFiles in requestContext for generate_remotion_code to auto-resolve.
        // Includes ALL media (pre-uploaded + pending) — by the time code gen runs,
        // sandbox_create will have auto-uploaded pending files.
        const mediaPrepareResult = await runAnimationSkill('media_prepare', {
          action: 'build_media_files',
          engine,
          phase: (context?.phase as 'idle' | 'question' | 'plan' | 'executing' | 'preview' | 'complete' | 'error' | undefined),
          planAccepted: context?.planAccepted,
          requestContext,
          payload: {
            mediaFiles: mediaBuffersLocal.map(({ m, destPath }) => ({
              path: destPath,
              type: m.type as 'image' | 'video',
              description: m.description || m.name,
              name: m.name,
            })),
          },
        });

        const mediaFilesForCodeGen = (mediaPrepareResult.ok && Array.isArray(mediaPrepareResult.artifacts?.mediaFiles))
          ? (mediaPrepareResult.artifacts?.mediaFiles as Array<{ path: string; type: 'image' | 'video'; description?: string }>)
          : mediaBuffersLocal.map(({ m, destPath }) => ({
            path: destPath,
            type: m.type as 'image' | 'video',
            description: m.description || m.name,
          }));

        if (mediaFilesForCodeGen.length > 0) {
          requestContext.set('mediaFiles' as never, mediaFilesForCodeGen as never);
          debugLog(`[Animation API] Stored ${mediaFilesForCodeGen.length} mediaFiles in requestContext for code gen:`, mediaFilesForCodeGen.map(f => f.path));
        }

        // Store media buffers for analyze_media tool to read without needing sandbox access.
        // We index by multiple keys (name/url/path) so tool calls can resolve deterministically.
        const mediaBuffers = new Map<string, { buffer: Buffer; mimeType: string }>();
        const addMediaBufferKey = (key: string | undefined, value: { buffer: Buffer; mimeType: string }) => {
          if (!key) return;
          const trimmed = key.trim();
          if (!trimmed) return;
          mediaBuffers.set(trimmed, value);
        };
        for (const { m, buffer, destPath } of mediaBuffersLocal) {
          const entry = { buffer, mimeType: m.mimeType || (m.type === 'video' ? 'video/mp4' : 'image/png') };
          const fileName = destPath.split('/').pop() || m.name;

          addMediaBufferKey(m.name, entry);
          addMediaBufferKey(fileName, entry);
          addMediaBufferKey(m.dataUrl, entry);
          addMediaBufferKey(m.dataUrl.split('?')[0], entry);
          addMediaBufferKey(destPath, entry);
          addMediaBufferKey(`/app/${destPath}`, entry);
          addMediaBufferKey(`/${destPath.replace(/^public\//, '')}`, entry);

          if (m.dataUrl.startsWith('http')) {
            try {
              const parsed = new URL(m.dataUrl);
              addMediaBufferKey(parsed.pathname, entry);
              addMediaBufferKey(`${parsed.origin}${parsed.pathname}`, entry);
              addMediaBufferKey(parsed.pathname.split('/').pop(), entry);
            } catch {
              // ignore malformed URL
            }
          }
        }
        if (mediaBuffers.size > 0) {
          requestContext.set('mediaBuffers' as never, mediaBuffers as never);
        }

        // Exclude svgCode-only entries from file-based media lists (handled separately)
        const fileMedia = context.media.filter(m => !(m.svgCode && !m.dataUrl));
        const edgeMedia = fileMedia.filter(m => m.source === 'edge');
        const uploadMedia = fileMedia.filter(m => m.source !== 'edge');

        // Engine-aware media reference format
        const mediaRef = engine === 'remotion'
          ? (fileName: string) => `staticFile("media/${fileName}")`
          : (fileName: string) => `"/media/${fileName}"`;

        const formatMedia = (m: typeof context.media[0]) => {
          const uploaded = uploadedPaths.has(m.id);
          const pending = pendingMediaForSandbox.some(p => p.id === m.id);
          const desc = m.description ? ` — "${m.description}"` : '';
          const dp = destPathMap.get(m.id) || `public/media/${m.name}`;
          const fileName = dp.split('/').pop()!;
          if (uploaded) {
            return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) ALREADY UPLOADED to ${uploadedPaths.get(m.id)} — reference as ${mediaRef(fileName)} in code`;
          }
          if (pending) {
            return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) WILL BE AUTO-UPLOADED to ${dp} after sandbox creation — reference as ${mediaRef(fileName)} in code`;
          }
          // blob: or cached: URLs that couldn't be resolved — skip with warning
          if (m.dataUrl.startsWith('blob:') || m.dataUrl.startsWith('cached:')) {
            console.warn(`[Animation API] Skipping unresolvable media: ${m.name} (${m.dataUrl.slice(0, 30)}...)`);
            return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) ⚠️ UNAVAILABLE — could not be resolved server-side. Skip this file.`;
          }
          // Never inline full data: URLs in LLM context — this can blow token limits.
          if (m.dataUrl.startsWith('data:')) {
            const mime = m.dataUrl.slice(5, m.dataUrl.indexOf(';') > -1 ? m.dataUrl.indexOf(';') : 40);
            return `- [${m.type}] "${m.name}"${desc} (source: ${m.source}) INLINE DATA (${mime || 'unknown mime'}, omitted) — unavailable for direct URL download.`;
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

        // Inject raw SVG code for code-output edges — lets the agent decompose
        // and animate individual SVG elements instead of just referencing an image file.
        const svgCodeEntries = context.media.filter(m => m.svgCode);
        if (svgCodeEntries.length > 0) {
          const svgBlocks = svgCodeEntries.map(m =>
            `<svg-source name="${m.name}" description="${m.description || ''}">\n${m.svgCode}\n</svg-source>`
          ).join('\n');
          contextParts.push(
            `<svg-code-assets>\n` +
            `The following SVG source code was provided via SVG Studio code-output edges.\n` +
            `You can INLINE these SVGs directly in Remotion components as JSX (convert SVG attributes to React: class→className, stroke-width→strokeWidth, etc.).\n` +
            `This lets you animate individual SVG elements (paths, groups, circles, etc.) with Remotion's interpolate/spring.\n` +
            `The SVG is also available as a static file — use whichever approach best fits the animation.\n` +
            svgBlocks +
            `\n</svg-code-assets>`
          );
          // Store SVG code in requestContext for generate_remotion_code to access
          const svgCodeMap = new Map<string, string>();
          for (const m of svgCodeEntries) {
            svgCodeMap.set(m.name, m.svgCode!);
          }
          requestContext.set('svgCodeAssets' as never, svgCodeMap as never);
        }

        const codeGenToolName = engine === 'remotion' ? 'generate_remotion_code' : 'generate_code';
        contextParts.push(
          `For CONTENT media: Pass file paths via mediaFiles to ${codeGenToolName}. ` +
          'For REFERENCE media: Use analyze_media for design cues, do NOT upload to sandbox. ' +
          'For URL media: Use sandbox_upload_media to download to public/media/. ' +
          'For videos, call analyze_media first for scene understanding, then extract_video_frames for key frame images.'
        );
      }
      if ((!context.media || context.media.length === 0) && context.logo?.url && !requestContext.get('logoPath' as never)) {
        const logoUrl = context.logo.url;
        const logoName = context.logo.name || 'logo.png';
        const logoDestPath = `public/media/${logoName}`;
        let logoBuffer: Buffer | null = null;
        let logoUploadFailedReason: string | null = null;

        if (logoUrl.startsWith('data:')) {
          const base64Data = logoUrl.split(',')[1];
          if (base64Data) {
            logoBuffer = Buffer.from(base64Data, 'base64');
          } else {
            logoUploadFailedReason = 'Logo data URL missing base64 payload';
          }
        } else if (logoUrl.startsWith('http')) {
          try {
            const resp = await fetch(logoUrl, { signal: AbortSignal.timeout(15_000) });
            if (resp.ok) {
              logoBuffer = Buffer.from(await resp.arrayBuffer());
            } else {
              logoUploadFailedReason = `Logo HTTP fetch failed (${resp.status})`;
            }
          } catch (err) {
            console.warn(`[Animation API] Logo download failed:`, err);
            logoUploadFailedReason = `Logo download failed: ${err instanceof Error ? err.message : String(err)}`;
          }
        } else {
          logoUploadFailedReason = `Unsupported logo URL scheme: ${logoUrl.slice(0, 30)}`;
        }

        if (logoBuffer) {
          if (context.sandboxId) {
            try {
              await getSandboxProvider().writeBinary(context.sandboxId, logoDestPath, logoBuffer);
              requestContext.set('logoPath' as never, logoDestPath as never);
              debugLog(`[Animation API] Logo pre-uploaded (logo-only flow) → ${logoDestPath}`);
            } catch (err) {
              console.error(`[Animation API] Logo pre-upload failed:`, err);
              logoUploadFailedReason = `Logo pre-upload failed: ${err instanceof Error ? err.message : String(err)}`;
            }
          } else {
            const existingPending = (requestContext.get('pendingMedia' as never) as Array<{ id: string; name: string; data: Buffer; destPath: string; type: string; source: string }> | undefined) || [];
            existingPending.push({ id: 'logo', name: logoName, data: logoBuffer, destPath: logoDestPath, type: 'image', source: 'upload' });
            requestContext.set('pendingMedia' as never, existingPending as never);
            requestContext.set('logoPath' as never, logoDestPath as never);
          }
        }

        if (logoUploadFailedReason) {
          requestContext.set('logoUploadError' as never, logoUploadFailedReason as never);
        }
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
        if (ds.style) {
          contextParts.push(`Design style: ${ds.style}`);
          // Look up and inject style-specific instructions
          const stylePreset = STYLE_PRESETS.find(p => p.id === ds.style);
          if (stylePreset?.instructions) {
            contextParts.push(`<style-instructions>\n${stylePreset.instructions}\n</style-instructions>`);
          }
        }
        if (ds.theme) contextParts.push(`Color theme preset: ${ds.theme}`);
        if (ds.colors) contextParts.push(`Color palette — Primary: ${ds.colors.primary}, Secondary: ${ds.colors.secondary}${ds.colors.accent ? `, Accent: ${ds.colors.accent}` : ''}`);
        if (ds.fonts) contextParts.push(`Typography — Title font: ${ds.fonts.title}, Body font: ${ds.fonts.body}`);
      } else if (!(context?.plan as Record<string, unknown>)?.designSpec) {
        // When NO designSpec is set at all, add guidance to prevent dark-mode default
        contextParts.push(`No design spec selected. You MUST choose colors appropriate to the content — NOT default dark/indigo. Light backgrounds for product/lifestyle/corporate, dark for tech/developer, colorful for creative/brand. Include your chosen palette in generate_plan's designSpec field.`);
      }
      if (context.motionSpec) {
        const ms = context.motionSpec;
        const chipSummary = [
          ms.chips?.energy ? `energy=${ms.chips.energy}` : null,
          ms.chips?.feel ? `feel=${ms.chips.feel}` : null,
          ms.chips?.camera ? `camera=${ms.chips.camera}` : null,
          ms.chips?.transitions ? `transitions=${ms.chips.transitions}` : null,
        ]
          .filter(Boolean)
          .join(', ');
        const sliderSummary = ms.sliders
          ? `speed=${ms.sliders.speed ?? 'n/a'}, intensity=${ms.sliders.intensity ?? 'n/a'}, smoothness=${ms.sliders.smoothness ?? 'n/a'}, cameraActivity=${ms.sliders.cameraActivity ?? 'n/a'}, transitionAggressiveness=${ms.sliders.transitionAggressiveness ?? 'n/a'}`
          : '';
        contextParts.push(
          `<motion-spec>\n` +
          `User-selected structured motion profile. Treat as authoritative for timing/easing/camera behavior.\n` +
          `Variant: ${ms.variant || 'balanced'}\n` +
          `Source: ${ms.source || 'manual'}\n` +
          `${chipSummary ? `Chips: ${chipSummary}\n` : ''}` +
          `${sliderSummary ? `Sliders: ${sliderSummary}\n` : ''}` +
          `${ms.followUp ? `Follow-up notes: ${ms.followUp}\n` : ''}` +
          `${ms.holdFinalFrameSeconds ? `Hold final frame: ${ms.holdFinalFrameSeconds}s\n` : ''}` +
          `${ms.referenceProfile ? `Reference profile: ${ms.referenceProfile.summary}\n` : ''}` +
          `${ms.presetId ? `Preset: ${ms.presetId}\n` : ''}` +
          `When generating/revising plan, explicitly reflect this motion profile in plan motion decisions.\n` +
          `When editing existing animation, apply targeted timing/easing/camera updates according to this profile.\n` +
          `</motion-spec>`
        );
      }
      if (context.logo?.url) {
        const uploadedLogoPath = requestContext.get('logoPath' as never) as string | undefined;
        const logoUploadError = requestContext.get('logoUploadError' as never) as string | undefined;
        if (uploadedLogoPath) {
          const logoName = uploadedLogoPath.split('/').pop() || context.logo.name || 'logo.png';
          const availabilityHint = context.sandboxId
            ? 'already uploaded to sandbox'
            : 'scheduled for auto-upload at sandbox_create';
          contextParts.push(
            `<logo>\nThe user has provided a logo image that MUST be prominently featured in the animation.\nLogo file: ${uploadedLogoPath} (${availabilityHint})\nUse <Img src={staticFile("media/${logoName}")} /> in Remotion to display it.\nFeature it in intros, outros, or as a persistent element. Ensure it's well-positioned and properly sized.\n</logo>`
          );
        } else {
          contextParts.push(
            `<logo>\nA logo URL was provided but could not be resolved to a sandbox file path (${logoUploadError || 'upload unavailable'}).\nDo NOT reference staticFile("media/...") for the logo unless a concrete path is provided.\nContinue without logo rendering and mention this limitation in user-facing status.\n</logo>`
          );
        }
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
    // Keep recent conversational turns and inject mandatory system
    // instructions after windowing so they never get dropped.
    const MAX_MESSAGES = 10;
    if (agentMessages.length > MAX_MESSAGES) {
      agentMessages = agentMessages.slice(-MAX_MESSAGES);
    }

    // ── Mandatory system injection (post-windowing) ────────────────
    // sandboxId and engine are now in RequestContext (tools read directly),
    // but the LLM still needs engine/recipe awareness for planning/reasoning.
    {
      const trailingParts: string[] = [];
      trailingParts.push(`ENGINE: ${engine}. All sandbox tools auto-resolve sandboxId and engine from server context — you do NOT need to pass them.`);
      if (context?.sandboxId) {
        trailingParts.push(`A sandbox is already active. Do NOT call sandbox_create again.`);
      }
      agentMessages.push({
        role: 'system',
        content: `${systemContent}\n\n${trailingParts.join(' ')}`,
      });
    }

    // ⏱ Server-side timing
    const serverStart = Date.now();

    // No plan gate — always use full step budget for direct execution
    const maxSteps = 75;

    debugLog(
      `⏱ [Animation API] Stream request — engine: ${engine}, messages: ${agentMessages.length}, sandboxId: ${context?.sandboxId || 'NONE'}, phase: ${context?.phase || 'unknown'}, techniques: ${context?.techniques?.length || 0}${recipeContent ? ` (~${Math.round(recipeContent.length / 4)} tokens)` : ''}, maxSteps: ${maxSteps}, designSpec: ${context?.designSpec ? JSON.stringify(context.designSpec) : 'NONE'}`
    );

    // AbortController to kill the agent loop when client disconnects or soft timeout.
    const agentAbort = new AbortController();
    requestContext.set('streamAbortSignal' as never, agentAbort.signal as never);

    const result = await animationAgent.stream(
      agentMessages as Parameters<typeof animationAgent.stream>[0],
      {
        maxSteps,
        requestContext,
        abortSignal: agentAbort.signal,
        providerOptions: {
          // Each provider ignores keys meant for other providers.
          // Orchestrator thinking budget kept small — creative work is in the code-gen subagent.
          google: { thinkingConfig: { thinkingBudget: 2048, includeThoughts: true } },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 1500 } },
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

    // ── Video delivery tracking (for credit refund) ─────────────────
    // If the stream completes without delivering a video, refund credits.
    let videoDelivered = false;
    let codegenTransportFailures = 0;
    // planCalledInStream: true if agent called generate_plan this stream (plan-only run, no video expected)
    const planCalledInStream = false;

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let softTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    const clearStreamTimers = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (softTimeoutTimer) {
        clearTimeout(softTimeoutTimer);
        softTimeoutTimer = null;
      }
    };

    const readable = new ReadableStream({
      async start(controller) {
        const safeEnqueue = (data: Uint8Array) => {
          if (!closed) {
            try { controller.enqueue(data); } catch { closed = true; }
          }
        };
        const safeClose = () => {
          clearStreamTimers();
          if (!closed) {
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
          }
        };

        // Close early when the client disconnects — also abort agent loop
        request.signal.addEventListener('abort', () => {
          requestContext.set('streamClosed' as never, true as never);
          agentAbort.abort();
          safeClose();
        });

        try {
          const reader = result.fullStream.getReader();

          const emitRecoveryVideoReady = () => {
            if (videoDelivered) return;
            const lastVideoUrl = requestContext.get('lastVideoUrl' as never) as string | undefined;
            if (!lastVideoUrl) return;
            videoDelivered = true;
            const duration = requestContext.get('duration' as never) as number | undefined;
            const lastVersionId = requestContext.get('lastVersionId' as never) as string | undefined;
            debugLog(`⏱ [Animation API] Emitting video-ready recovery event: ${lastVideoUrl} (versionId=${lastVersionId})`);
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'video-ready',
              videoUrl: lastVideoUrl,
              versionId: lastVersionId,
              duration: duration || 7,
            })}\n\n`));
          };

          const closeWithComplete = (finishReason: string) => {
            if (closed) return;
            // If final video already exists in persistent storage, deliver it
            // even when closing early (e.g. soft timeout, transport guard).
            emitRecoveryVideoReady();
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              text: '',
              finishReason,
            })}\n\n`));
            requestContext.set('streamClosed' as never, true as never);
            agentAbort.abort();
            void reader.cancel();
            safeClose();
          };

          // Keep the SSE connection alive through proxies/load balancers during long tool runs.
          heartbeatTimer = setInterval(() => {
            if (!closed) {
              safeEnqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
            }
          }, STREAM_HEARTBEAT_MS);

          // Gracefully end before the platform hard timeout to avoid abrupt client "network error".
          softTimeoutTimer = setTimeout(() => {
            if (!closed) {
              console.warn(`[Animation API] Soft stream timeout reached (${STREAM_SOFT_TIMEOUT_MS}ms) — ending stream gracefully`);
              closeWithComplete('server-timeout');
            }
          }, STREAM_SOFT_TIMEOUT_MS);

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
                debugLog(`⏱ [Animation API] Tool call: ${chunk.payload.toolName} at +${toolElapsed}s`);

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
                // For render tools, log success field so we can see actual render failures (not just isError)
                const resultPayload = chunk.payload.result as Record<string, unknown> | undefined;
                const renderInfo = (chunk.payload.toolName === 'render_final' || chunk.payload.toolName === 'render_preview')
                  ? ` [success=${resultPayload?.success}, msg=${typeof resultPayload?.message === 'string' ? resultPayload.message.slice(0, 120) : 'none'}]`
                  : '';
                debugLog(`⏱ [Animation API] Tool result: ${chunk.payload.toolName} at +${resultElapsed}s ${isErr ? '❌' : '✅'}${renderInfo}`);

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
                    debugLog(`⏱ [Animation API] Discovered sandbox ID: ${discoveredSandboxId}`);
                    // Send a custom SSE event so the frontend can store it
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'sandbox-created',
                      sandboxId: discoveredSandboxId,
                    })}\n\n`));
                  }
                }

                // Track video delivery from render_final success
                if (
                  chunk.payload.toolName === 'render_final' &&
                  !isErr &&
                  resultPayload?.success &&
                  resultPayload?.videoUrl
                ) {
                  videoDelivered = true;
                  debugLog(`⏱ [Animation API] Video delivered via render_final`);
                }

                if (CODEGEN_TOOLS.has(chunk.payload.toolName)) {
                  const summary = typeof resultPayload?.summary === 'string' ? resultPayload.summary : '';
                  const transportDrop = summary ? isUpstreamTransportError(summary) : false;

                  if (transportDrop) {
                    // NOTE: generate_*_code already records transport failures via codegen skill.
                    // Do not increment again here, otherwise we double-count (2/2 in route log
                    // while tool summary still says 1/2), which is confusing and can close too early.
                    const ctxFailuresRaw = requestContext.get('codegenTransportFailures' as never);
                    const ctxFailures = typeof ctxFailuresRaw === 'number'
                      ? ctxFailuresRaw
                      : Number(ctxFailuresRaw || 0);
                    const summaryFailures = Number(summary.match(/\((\d+)\/\d+\s+failures?\s+this\s+run\)/i)?.[1] || 0);
                    const failures = Math.max(ctxFailures, summaryFailures, codegenTransportFailures + 1);
                    codegenTransportFailures = failures;
                    console.warn(
                      `[Animation API] Upstream codegen transport failure ${codegenTransportFailures}/${MAX_CODEGEN_TRANSPORT_FAILURES_PER_STREAM}: ${summary.slice(0, 160)}`
                    );
                    // The codegen tool already performed its bounded internal retries.
                    // If it still returns a transport failure, end this stream now so the
                    // agent can't start another long codegen cycle in the same run.
                    const codegenErrorSSE = JSON.stringify({
                      type: 'tool-result',
                      toolCallId: chunk.payload.toolCallId,
                      toolName: chunk.payload.toolName,
                      result: chunk.payload.result,
                      isError: chunk.payload.isError,
                    });
                    safeEnqueue(encoder.encode(`data: ${codegenErrorSSE}\n\n`));
                    closeWithComplete('upstream-transport-failure');
                    sseData = null;
                    break;
                  } else if (!isErr && codegenTransportFailures > 0) {
                    codegenTransportFailures = 0;
                    await runAnimationSkill('codegen', {
                      action: 'success',
                      requestContext,
                      metadata: { toolName: chunk.payload.toolName },
                    });
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
          debugLog(`⏱ [Animation API] Stream complete — total: ${serverTotal}s`);

          // Recovery: if render_final saved a video but the tool-result may have been
          // lost (e.g., maxSteps hit during render), emit a video-ready SSE event so
          // the client can create a version from the permanent URL.
          if (!closed) {
            emitRecoveryVideoReady();
          }

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

            emitLaunchMetric({
              metric: 'plugin_execution',
              status: 'success',
              source: 'api',
              pluginId: 'animation-generator',
              metadata: { finishReason: finishReason ?? null },
            });
            emitLaunchMetric({
              metric: 'activation_first_plugin_run',
              status: 'success',
              source: 'api',
              pluginId: 'animation-generator',
              metadata: { finishReason: finishReason ?? null },
            });

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
            emitLaunchMetric({
              metric: 'plugin_execution',
              status: 'error',
              source: 'api',
              pluginId: 'animation-generator',
              errorCode: 'stream_error',
              metadata: { message: error instanceof Error ? error.message : String(error) },
            });
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Stream error',
            })}\n\n`));
          }
          safeClose();
        }

        // ── Credit refund if no video was delivered ──────────────────
        // Covers: plan-only streams, agent errors, maxSteps exhaustion,
        // render failures, and any other case where the stream ends
        // without a successful video delivery.
        if (!videoDelivered && animUserId && animCreditCost) {
          const reason = planCalledInStream ? 'no-video:plan-only' : 'no-video:animation';
          try {
            await refundCredits(animUserId, animCreditCost, reason, {
              engine: peekEngine,
              duration: peekDuration,
              planCalledInStream,
              discoveredSandboxId,
            });
            debugLog(`⏱ [Animation API] Refunded ${animCreditCost} credits — ${reason}`);
          } catch (refundErr) {
            console.error(`⏱ [Animation API] Credit refund failed:`, refundErr);
          }
        }
      },
      cancel() {
        closed = true;
        clearStreamTimers();
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
    // Refund credits on stream-level failure (actorResult may not be in scope if auth failed)
    try {
      if (typeof animUserId === 'string' && typeof animCreditCost === 'number') {
        await refundCredits(animUserId, animCreditCost, 'error:animation', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch { /* refund best-effort */ }
    emitLaunchMetric({
      metric: 'plugin_execution',
      status: 'error',
      source: 'api',
      pluginId: 'animation-generator',
      errorCode: 'execution_failed',
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });
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
      // Research / docs
      'search_web',
      'fetch_docs',
      // Sandbox Lifecycle
      'sandbox_create',
      'sandbox_destroy',
      // Sandbox Operations
      'sandbox_write_file',
      'sandbox_read_file',
      'sandbox_run_command',
      'sandbox_list_files',
      // Visual Verification
      'sandbox_screenshot',
      // Video Verification
      'verify_animation',
      // Rendering
      'render_final',
      // Skill adapters
      'skill_recover',
      'skill_media_prepare',
    ],
  });
}
