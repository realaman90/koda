/**
 * Animation Sandbox Tools
 *
 * Tools for interacting with the animation sandbox via Docker containers.
 * Each tool delegates to the Docker sandbox provider.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getSandboxProvider, readSandboxFileRaw } from '@/lib/sandbox/sandbox-factory';

// ── Permanent video save helper ─────────────────────────────────────
// After render, copy the video out of the sandbox into permanent storage
// (data/generations/) so it survives container death and page refresh.
async function saveVideoToPermanentStorage(
  sandboxId: string,
  sandboxFilePath: string,
  nodeId?: string,
): Promise<string | null> {
  try {
    console.log(`[saveVideo] Reading ${sandboxFilePath} from sandbox ${sandboxId}...`);
    const buffer = await readSandboxFileRaw(sandboxId, sandboxFilePath);
    console.log(`[saveVideo] Got ${Math.round(buffer.length / 1024)}KB, saving to permanent storage...`);

    const { getAssetStorageType } = await import('@/lib/assets');
    const storageType = getAssetStorageType();

    const options = {
      type: 'video' as const,
      extension: 'mp4',
      metadata: {
        mimeType: 'video/mp4',
        nodeId,
        extra: { source: 'animation-generator' },
      },
    };

    let savedAsset;
    if (storageType === 'local') {
      const { getLocalAssetProvider } = await import('@/lib/assets/local-provider');
      savedAsset = await getLocalAssetProvider().saveFromBuffer(buffer, options);
    } else {
      const { getS3AssetProvider } = await import('@/lib/assets/s3-provider');
      savedAsset = await getS3AssetProvider(storageType).saveFromBuffer(buffer, options);
    }

    console.log(`[saveVideo] Saved permanently: ${savedAsset.url} (${Math.round(buffer.length / 1024)}KB)`);
    return savedAsset.url;
  } catch (err) {
    console.warn(`[saveVideo] Failed to save video permanently (non-critical):`, err);
    return null;
  }
}

// ── Token-saving helpers ──────────────────────────────────────────
/** Max chars for command output to keep token usage manageable */
const MAX_OUTPUT_CHARS = 3000;

function truncateOutput(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2) - 30;
  return text.slice(0, half) + `\n\n... [truncated ${text.length - max} chars] ...\n\n` + text.slice(-half);
}

// ── RequestContext helpers ────────────────────────────────────────
// sandboxId and engine are set by route.ts in RequestContext so tools
// can read them directly, eliminating LLM hallucination of sandbox IDs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolContext = { requestContext?: { get: (key: string) => any; set: (key: string, value: any) => void } };

/** Resolve sandboxId: prefer requestContext (server-set, correct), fallback to input (may be hallucinated by LLM) */
function resolveSandboxId(input: string | undefined, context?: ToolContext): string | undefined {
  return context?.requestContext?.get('sandboxId') || input || undefined;
}

/** Resolve engine: prefer input arg, fallback to requestContext, default 'remotion' */
function resolveEngine(input: string | undefined, context?: ToolContext): 'remotion' | 'theatre' {
  return (input || context?.requestContext?.get('engine') || 'remotion') as 'remotion' | 'theatre';
}

/**
 * sandbox_create - Create a new sandbox container
 */
export const sandboxCreateTool = createTool({
  id: 'sandbox_create',
  description: `Create a new isolated Docker sandbox for animation development.
The engine/template is auto-resolved from server context. Call this before writing any files or running commands.`,
  inputSchema: z.object({
    projectId: z.string().describe('Unique project identifier for this animation'),
    template: z.enum(['remotion', 'theatre']).optional().describe('Override engine template (auto-resolved from context if omitted)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    sandboxId: z.string(),
    status: z.string(),
    previewUrl: z.string(),
    template: z.string(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    try {
      const ctx = context as ToolContext;

      // ── Guard: if stream was already closed (plan gate), skip execution ──
      // The AbortController should prevent this, but as belt-and-suspenders
      // we check the flag to avoid creating orphan containers.
      if (ctx?.requestContext?.get('streamClosed')) {
        console.log(`[sandbox_create] Stream already closed (plan gate) — skipping to prevent orphan container`);
        return {
          success: false,
          sandboxId: '',
          status: 'skipped',
          previewUrl: '',
          template: 'remotion',
          message: 'Stream closed — sandbox creation skipped.',
        };
      }

      const template = resolveEngine(inputData.template, ctx);

      // ── Guard: if a live sandbox already exists, reuse it ──────────
      // Gemini sometimes calls sandbox_create even when one is active.
      // Creating a duplicate wastes resources and causes sandboxId mismatch.
      const existingSandboxId = resolveSandboxId(undefined, ctx);
      if (existingSandboxId) {
        try {
          const status = await getSandboxProvider().getStatus(existingSandboxId);
          if (status) {
            console.log(`[sandbox_create] Reusing existing live sandbox ${existingSandboxId} (skipping duplicate creation)`);
            return {
              success: true,
              sandboxId: existingSandboxId,
              status: status.status,
              previewUrl: `/api/plugins/animation/sandbox/${existingSandboxId}/proxy`,
              template,
              message: `Sandbox already active: ${existingSandboxId}. Reusing existing sandbox.`,
            };
          }
          console.log(`[sandbox_create] Existing sandbox ${existingSandboxId} is dead — creating new one`);
        } catch {
          console.log(`[sandbox_create] Could not check existing sandbox ${existingSandboxId} — creating new one`);
        }
      }

      const instance = await getSandboxProvider().create(inputData.projectId, template);
      console.log(`[sandbox_create] Created new sandbox ${instance.id} (template=${template})`);

      // Store sandboxId in requestContext so all subsequent tools auto-resolve it
      ctx?.requestContext?.set('sandboxId', instance.id);

      // Auto-upload any pending media stored in requestContext by route.ts.
      // This handles base64 media that arrived before the sandbox existed —
      // the data never touches the LLM context, preventing context window blowup.
      const uploadedFiles: string[] = [];
      const pendingMedia = ctx?.requestContext?.get('pendingMedia') as
        Array<{ id: string; name: string; data: Buffer; destPath: string }> | undefined;
      console.log(`[sandbox_create] pendingMedia from requestContext: ${pendingMedia ? `${pendingMedia.length} entries` : 'NULL/UNDEFINED'}`);
      if (pendingMedia && Array.isArray(pendingMedia) && pendingMedia.length > 0) {
        for (const media of pendingMedia) {
          const bufferSize = media.data?.length ?? 0;
          console.log(`[sandbox_create] Uploading: ${media.name} → ${media.destPath} (buffer=${bufferSize} bytes)`);
          if (bufferSize === 0) {
            console.error(`[sandbox_create] SKIPPING ${media.name} — buffer is empty!`);
            continue;
          }
          try {
            await getSandboxProvider().writeBinary(instance.id, media.destPath, media.data);
            uploadedFiles.push(media.destPath);
            console.log(`[sandbox_create] ✓ Auto-uploaded: ${media.name} → ${media.destPath} (${Math.round(bufferSize / 1024)}KB)`);
          } catch (err) {
            console.error(`[sandbox_create] ✗ FAILED to auto-upload ${media.name}:`, err);
          }
        }
        // Verify files actually exist in the container
        if (uploadedFiles.length > 0) {
          try {
            const verifyResult = await getSandboxProvider().runCommand(instance.id, 'ls -la /app/public/media/ 2>/dev/null || echo "DIR_NOT_FOUND"');
            console.log(`[sandbox_create] Media verification:\n${verifyResult.stdout}`);
          } catch (verifyErr) {
            console.warn(`[sandbox_create] Could not verify media files:`, verifyErr);
          }
        }
      } else {
        console.log(`[sandbox_create] No pending media to auto-upload`);
      }

      // Check for code snapshot to restore (edit/revision flow after container died)
      let snapshotRestored = false;
      const nodeId = ctx?.requestContext?.get('nodeId');
      const phase = ctx?.requestContext?.get('phase');
      const hasPlan = !!ctx?.requestContext?.get('plan');
      const restoreVersionId = ctx?.requestContext?.get('restoreVersionId') as string | undefined;

      console.log(`[sandbox_create] Snapshot check: nodeId=${nodeId}, phase=${phase}, hasPlan=${hasPlan}, restoreVersionId=${restoreVersionId || 'latest'}`);

      if (nodeId && (phase !== 'idle' || hasPlan || restoreVersionId)) {
        console.log(`[sandbox_create] Attempting snapshot restore for node ${nodeId}${restoreVersionId ? `/${restoreVersionId}` : ''} into sandbox ${instance.id}...`);
        try {
          const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
          // If restoreVersionId is set, load that specific version; otherwise load latest
          const exists = await getSnapshotProvider().exists(nodeId, restoreVersionId);
          console.log(`[sandbox_create] Snapshot exists: ${exists}`);
          if (exists) {
            const buffer = await getSnapshotProvider().load(nodeId, restoreVersionId);
            if (buffer) {
              snapshotRestored = await getSandboxProvider().importSnapshot(instance.id, buffer);
            }
            console.log(`[sandbox_create] Snapshot restore result: ${snapshotRestored}`);
          }
        } catch (err) {
          console.warn(`[sandbox_create] Snapshot restore failed (starting fresh):`, err);
        }
      } else {
        console.log(`[sandbox_create] Skipping snapshot restore (fresh generation or no nodeId)`);
      }

      const mediaMsg = uploadedFiles.length > 0
        ? ` Media auto-uploaded: ${uploadedFiles.join(', ')}`
        : '';
      const restoreMsg = snapshotRestored
        ? ' Previous code restored from snapshot.'
        : '';

      return {
        success: true,
        sandboxId: instance.id,
        status: instance.status,
        previewUrl: `/api/plugins/animation/sandbox/${instance.id}/proxy`,
        template,
        message: `Sandbox created with ${template} template: ${instance.id}.${mediaMsg}${restoreMsg}`,
      };
    } catch (error) {
      return {
        success: false,
        sandboxId: '',
        status: 'error',
        previewUrl: '',
        template: resolveEngine(inputData.template, context as ToolContext),
        message: error instanceof Error ? error.message : 'Failed to create sandbox',
      };
    }
  },
});

/**
 * sandbox_destroy - Destroy a sandbox container
 */
export const sandboxDestroyTool = createTool({
  id: 'sandbox_destroy',
  description: 'Destroy a sandbox container and clean up resources. sandboxId is auto-resolved from context.',
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    try {
      await getSandboxProvider().destroy(sandboxId);
      return {
        success: true,
        message: `Sandbox destroyed: ${sandboxId}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to destroy sandbox',
      };
    }
  },
});

/**
 * sandbox_write_file - Write file to sandbox
 */
export const sandboxWriteFileTool = createTool({
  id: 'sandbox_write_file',
  description: `Write a file to the animation sandbox. sandboxId is auto-resolved from context.

Common files:
- src/App.tsx - Root component
- src/components/*.tsx - Animation components
- src/theatre/project.ts - Theatre.js config
- src/utils/easing.ts - Easing functions`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    path: z.string().describe('File path relative to project root'),
    content: z.string().describe('File content'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, path: inputData.path, message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    try {
      await getSandboxProvider().writeFile(sandboxId, inputData.path, inputData.content);
      return {
        success: true,
        path: inputData.path,
        message: `File written: ${inputData.path}`,
      };
    } catch (error) {
      return {
        success: false,
        path: inputData.path,
        message: error instanceof Error ? error.message : `Failed to write: ${inputData.path}`,
      };
    }
  },
});

/**
 * sandbox_read_file - Read file from sandbox
 */
export const sandboxReadFileTool = createTool({
  id: 'sandbox_read_file',
  description: 'Read a file from the sandbox filesystem. sandboxId is auto-resolved from context.',
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    path: z.string().describe('File path to read'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, content: 'No active sandbox. Create one first with sandbox_create.' };
    }
    try {
      const content = await getSandboxProvider().readFile(sandboxId, inputData.path);
      // Cap file content to save tokens — agent can request specific sections if needed
      return { success: true, content: truncateOutput(content, 5000) };
    } catch (error) {
      return {
        success: false,
        content: error instanceof Error ? error.message : `Failed to read: ${inputData.path}`,
      };
    }
  },
});

/**
 * sandbox_run_command - Execute command in sandbox
 */
export const sandboxRunCommandTool = createTool({
  id: 'sandbox_run_command',
  description: `Run a shell command in the sandbox. sandboxId is auto-resolved from context.

Common commands:
- bun install - Install dependencies
- bun run dev - Start dev server (use background: true)
- bun run build - Build project`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    command: z.string().describe('Shell command'),
    background: z.boolean().optional().describe('Run in background'),
    timeout: z.number().optional().describe('Timeout in milliseconds (max 300000)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, stdout: '', stderr: 'No active sandbox. Create one first with sandbox_create.', exitCode: 1 };
    }
    try {
      const result = await getSandboxProvider().runCommand(sandboxId, inputData.command, {
        background: inputData.background,
        timeout: inputData.timeout,
      });
      return {
        ...result,
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Command failed',
        exitCode: 1,
      };
    }
  },
});

/**
 * sandbox_list_files - List files in directory
 */
export const sandboxListFilesTool = createTool({
  id: 'sandbox_list_files',
  description: 'List files in a sandbox directory. sandboxId is auto-resolved from context.',
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    path: z.string().describe('Directory path'),
    recursive: z.boolean().optional().describe('Include subdirectories'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    files: z.array(z.object({
      path: z.string(),
      type: z.enum(['file', 'directory']),
    })),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, files: [] };
    }
    try {
      const files = await getSandboxProvider().listFiles(sandboxId, inputData.path, inputData.recursive);
      return { success: true, files };
    } catch (error) {
      return {
        success: false,
        files: [],
      };
    }
  },
});

/**
 * sandbox_upload_media - Upload image/video to sandbox
 */
export const sandboxUploadMediaTool = createTool({
  id: 'sandbox_upload_media',
  description: `Upload an image or video from a URL to the sandbox. sandboxId is auto-resolved from context.

Use this for URL-based media (not base64 — base64 is auto-uploaded server-side).
Common destination paths:
- public/media/image.png - For images
- public/media/video.mp4 - For videos

After uploading, reference in code as '/media/image.png' or '/media/video.mp4'.`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    mediaUrl: z.string().describe('URL of the media to upload'),
    destPath: z.string().describe('Destination path in sandbox (e.g., public/media/image.png)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    size: z.number().optional(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, path: inputData.destPath, message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    try {
      const result = await getSandboxProvider().uploadMedia(
        sandboxId,
        inputData.mediaUrl,
        inputData.destPath
      );
      if (!result.success) {
        return {
          success: false,
          path: inputData.destPath,
          message: result.error || 'Failed to upload media',
        };
      }
      return {
        success: true,
        path: result.path,
        size: result.size,
        message: `Media uploaded: ${result.path} (${result.size ? Math.round(result.size / 1024) + ' KB' : 'unknown size'})`,
      };
    } catch (error) {
      return {
        success: false,
        path: inputData.destPath,
        message: error instanceof Error ? error.message : 'Failed to upload media',
      };
    }
  },
});

/**
 * sandbox_write_binary - Write binary data (base64) to sandbox
 */
export const sandboxWriteBinaryTool = createTool({
  id: 'sandbox_write_binary',
  description: `Write binary data to the sandbox from base64. sandboxId is auto-resolved from context.

NOTE: User-uploaded base64 media is auto-uploaded server-side — you rarely need this tool.
Use this only for programmatically generated binary data.
For URL-based media, prefer sandbox_upload_media instead.`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    path: z.string().describe('Destination path in sandbox (e.g., public/media/image.png)'),
    base64Data: z.string().describe('Base64-encoded binary data'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    size: z.number().optional(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, path: inputData.path, message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    try {
      const buffer = Buffer.from(inputData.base64Data, 'base64');
      await getSandboxProvider().writeBinary(sandboxId, inputData.path, buffer);
      return {
        success: true,
        path: inputData.path,
        size: buffer.length,
        message: `Binary file written: ${inputData.path} (${Math.round(buffer.length / 1024)} KB)`,
      };
    } catch (error) {
      return {
        success: false,
        path: inputData.path,
        message: error instanceof Error ? error.message : `Failed to write binary: ${inputData.path}`,
      };
    }
  },
});

/**
 * extract_video_frames - Extract frames from a video in the sandbox using FFmpeg
 */
export const extractVideoFramesTool = createTool({
  id: 'extract_video_frames',
  description: `Extract frames from a video file in the sandbox using FFmpeg.

Use this after uploading a video to the sandbox and analyzing it with analyze_media.
The Gemini analysis returns keyMoments timestamps — pass those here for targeted extraction.

Modes:
- "fps": Extract at N frames per second (default 1fps). Good for overview.
- "timestamps": Extract at specific second timestamps. Good for key moments.

Frames are saved as JPG images in /app/public/media/frames/.`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    videoPath: z.string().describe('Path to video file in sandbox (e.g., public/media/video.mp4)'),
    mode: z.enum(['fps', 'timestamps']).describe('Extraction mode'),
    timestamps: z.array(z.number()).optional().describe('Specific second timestamps to extract (for "timestamps" mode)'),
    fps: z.number().optional().describe('Frames per second (for "fps" mode, default: 1)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    frames: z.array(z.object({
      timestamp: z.number(),
      path: z.string(),
      url: z.string(),
    })),
    totalFrames: z.number(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, frames: [], totalFrames: 0, message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    try {
      const videoPath = inputData.videoPath.startsWith('/') ? inputData.videoPath : `/app/${inputData.videoPath}`;
      const framesDir = '/app/public/media/frames';

      // Ensure frames directory exists
      await getSandboxProvider().runCommand(sandboxId, `mkdir -p ${framesDir}`, { timeout: 5_000 });

      const frames: Array<{ timestamp: number; path: string; url: string }> = [];

      if (inputData.mode === 'timestamps' && inputData.timestamps && inputData.timestamps.length > 0) {
        // Extract specific timestamps
        for (const ts of inputData.timestamps) {
          const filename = `frame_${ts.toFixed(1)}s.jpg`;
          const outputPath = `${framesDir}/${filename}`;

          const result = await getSandboxProvider().runCommand(
            sandboxId,
            `ffmpeg -ss ${ts} -i ${videoPath} -frames:v 1 -q:v 2 -y ${outputPath} 2>&1`,
            { timeout: 15_000 }
          );

          if (result.success) {
            // Verify file exists
            const check = await getSandboxProvider().runCommand(
              sandboxId,
              `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
              { timeout: 5_000 }
            );
            if (check.stdout.trim() === 'OK') {
              frames.push({
                timestamp: ts,
                path: `public/media/frames/${filename}`,
                url: `/api/plugins/animation/sandbox/${sandboxId}/file?path=public/media/frames/${filename}`,
              });
            }
          }
        }
      } else {
        // FPS-based extraction
        const fpsRate = inputData.fps || 1;

        // Get video duration first
        const durationResult = await getSandboxProvider().runCommand(
          sandboxId,
          `ffprobe -v error -show_entries format=duration -of csv=p=0 ${videoPath} 2>/dev/null`,
          { timeout: 10_000 }
        );
        const duration = parseFloat(durationResult.stdout.trim()) || 10;

        // Extract frames at the specified fps
        const result = await getSandboxProvider().runCommand(
          sandboxId,
          `ffmpeg -i ${videoPath} -vf fps=${fpsRate} -q:v 2 -y ${framesDir}/frame_%03d.jpg 2>&1`,
          { timeout: 30_000 }
        );

        if (result.success) {
          // List extracted frames
          const listResult = await getSandboxProvider().runCommand(
            sandboxId,
            `ls -1 ${framesDir}/frame_*.jpg 2>/dev/null | sort`,
            { timeout: 5_000 }
          );

          const filePaths = listResult.stdout.trim().split('\n').filter(Boolean);
          filePaths.forEach((fp, idx) => {
            const filename = fp.split('/').pop() || '';
            const timestamp = idx / fpsRate;
            if (timestamp <= duration) {
              frames.push({
                timestamp: Math.round(timestamp * 10) / 10,
                path: `public/media/frames/${filename}`,
                url: `/api/plugins/animation/sandbox/${sandboxId}/file?path=public/media/frames/${filename}`,
              });
            }
          });
        }
      }

      return {
        success: frames.length > 0,
        frames,
        totalFrames: frames.length,
        message: frames.length > 0
          ? `Extracted ${frames.length} frame(s) from video`
          : 'No frames extracted — check if the video file exists and is valid',
      };
    } catch (error) {
      return {
        success: false,
        frames: [],
        totalFrames: 0,
        message: error instanceof Error ? error.message : 'Frame extraction failed',
      };
    }
  },
});

/**
 * sandbox_start_preview - Start dev server and get live preview URL
 */
export const sandboxStartPreviewTool = createTool({
  id: 'sandbox_start_preview',
  description: `Start the Vite dev server in the sandbox and return a live preview URL.
sandboxId and engine are auto-resolved from context.

Call this after writing your animation code. The preview URL can be embedded in an iframe.
This tool kills any existing dev server, starts a new one, and waits until it's ready.`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    engine: z.enum(['remotion', 'theatre']).optional().describe('Override engine (auto-resolved from context if omitted)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    previewUrl: z.string(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, previewUrl: '', message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    try {
      // Kill any existing dev server
      await getSandboxProvider().runCommand(sandboxId, 'pkill -f "vite" || true', { timeout: 5_000 });
      // Small delay to let the process die
      await new Promise((r) => setTimeout(r, 500));

      // Check that package.json exists
      const pkgCheck = await getSandboxProvider().runCommand(
        sandboxId,
        'test -f /app/package.json && echo "OK" || echo "MISSING"',
        { timeout: 5_000 }
      );
      if (pkgCheck.stdout.trim() === 'MISSING') {
        return {
          success: false,
          previewUrl: '',
          message: 'Cannot start dev server: /app/package.json is missing. Write project files first.',
        };
      }

      // Ensure dependencies are installed
      const nodeModulesCheck = await getSandboxProvider().runCommand(
        sandboxId,
        'test -d /app/node_modules && echo "OK" || echo "MISSING"',
        { timeout: 5_000 }
      );
      if (nodeModulesCheck.stdout.trim() === 'MISSING') {
        // Install deps before starting
        const installResult = await getSandboxProvider().runCommand(
          sandboxId,
          'cd /app && bun install 2>&1',
          { timeout: 60_000 }
        );
        if (!installResult.success) {
          return {
            success: false,
            previewUrl: '',
            message: `Failed to install dependencies: ${installResult.stderr || installResult.stdout}`,
          };
        }
      }

      // Start the dev server. Remotion uses a custom vite config for the Player;
      // Theatre.js uses the default vite.config.ts.
      const engine = resolveEngine(inputData.engine, context as ToolContext);
      const viteCmd = engine === 'remotion'
        ? 'cd /app && nohup bunx vite --config vite.player.config.ts > /tmp/vite.log 2>&1 &'
        : 'cd /app && nohup bunx vite > /tmp/vite.log 2>&1 &';
      await getSandboxProvider().runCommand(
        sandboxId,
        viteCmd,
        { background: true }
      );

      // Poll until the server is ready (max 20 seconds)
      const maxAttempts = 40;
      let ready = false;
      let lastCheckOutput = '';
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 500));
        // Use wget as fallback if curl isn't available
        const check = await getSandboxProvider().runCommand(
          sandboxId,
          '(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null || wget -q -O /dev/null --server-response http://localhost:5173/ 2>&1 | grep "HTTP/" | tail -1 | awk "{print \\$2}" || echo "000")',
          { timeout: 5_000 }
        );
        lastCheckOutput = check.stdout.trim();
        if (lastCheckOutput.startsWith('200') || lastCheckOutput.startsWith('304')) {
          ready = true;
          break;
        }
      }

      if (!ready) {
        // Grab the vite log for diagnostics
        const viteLog = await getSandboxProvider().runCommand(
          sandboxId,
          'tail -30 /tmp/vite.log 2>/dev/null || echo "No log available"',
          { timeout: 5_000 }
        );
        // Also check if any process is listening on 5173
        const portCheck = await getSandboxProvider().runCommand(
          sandboxId,
          'ss -tlnp 2>/dev/null | grep 5173 || netstat -tlnp 2>/dev/null | grep 5173 || echo "No listener on 5173"',
          { timeout: 5_000 }
        );
        const logSnippet = viteLog.stdout.trim().slice(0, 500);
        const portInfo = portCheck.stdout.trim();
        return {
          success: false,
          previewUrl: '',
          message: [
            `Dev server failed to start within 20 seconds.`,
            `Last check: ${lastCheckOutput}`,
            `Port 5173: ${portInfo}`,
            `Vite log:\n${logSnippet}`,
            ``,
            `ACTION REQUIRED: Do NOT skip this step. Diagnose using:`,
            `1. Read /tmp/vite.log via sandbox_read_file for the full error`,
            `2. If error mentions missing modules, run "bun install" then retry`,
            `3. If Vite config has issues, read and fix vite.config.ts, then retry`,
            `4. If port is in use, run "pkill -f vite" then retry sandbox_start_preview`,
          ].join('\n'),
        };
      }

      return {
        success: true,
        previewUrl: `/api/plugins/animation/sandbox/${sandboxId}/proxy`,
        message: 'Dev server running — preview ready. NEXT STEP: Call sandbox_screenshot with timestamps=[0, 0.5, 1, 1.5, 2, ...] (batch mode, ~10 frames spread across your animation duration) to verify the animation renders AND animates before proceeding.',
      };
    } catch (error) {
      return {
        success: false,
        previewUrl: '',
        message: error instanceof Error ? error.message : 'Failed to start preview',
      };
    }
  },
});

/**
 * sandbox_screenshot - Capture a screenshot of the animation at a given time
 */
export const sandboxScreenshotTool = createTool({
  id: 'sandbox_screenshot',
  description: `Capture screenshots of the animation at specific frames. sandboxId and engine are auto-resolved from context.

**Single mode**: Pass \`frame\` for one screenshot.
**Batch mode**: Pass \`frames\` array (e.g. [0, 30, 60, 90]) to capture multiple frames.

To convert seconds to frames: frame = seconds * fps (default 30fps)
Example: 2 seconds at 30fps = frame 60`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    frame: z.number().optional().describe('Single screenshot: capture this frame number'),
    frames: z.array(z.number()).optional().describe('Batch mode: array of frame numbers'),
    fps: z.number().optional().describe('Frames per second for time conversion (default: 30)'),
    engine: z.enum(['remotion', 'theatre']).optional().describe('Override engine (auto-resolved from context if omitted)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    screenshots: z.array(z.object({
      imageUrl: z.string(),
      frame: z.number(),
    })),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, screenshots: [], message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    const fps = inputData.fps || 30;
    const engine = resolveEngine(inputData.engine, context as ToolContext);

    // Determine which frames to capture
    let frames: number[];
    if (inputData.frames && inputData.frames.length > 0) {
      frames = inputData.frames;
    } else {
      frames = [inputData.frame || 0];
    }

    // Cap at 10 screenshots per call
    if (frames.length > 10) {
      frames = frames.slice(0, 10);
    }

    console.log(`[sandbox_screenshot] engine=${engine} sandbox=${sandboxId} frames=[${frames.join(',')}] fps=${fps}`);

    try {
      // Ensure output directory
      await getSandboxProvider().runCommand(sandboxId, 'mkdir -p /app/output', { timeout: 5_000 });

      const screenshots: { imageUrl: string; frame: number }[] = [];
      const errors: string[] = [];

      if (engine === 'theatre') {
        // ── Theatre.js: Puppeteer-based screenshot capture ──
        // Write a temp capture script, run it, then clean up
        const framesJson = JSON.stringify(frames);
        const captureScript = `
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const frames = JSON.parse(process.argv[2]);
const outputDir = process.argv[3] || '/app/output';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--window-size=1920,1080'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('#root', { timeout: 10000 });
  await page.evaluate(() => { window.__EXPORT_MODE__ = true; });
  await new Promise(r => setTimeout(r, 1000));

  const results = [];
  for (const frame of frames) {
    const filename = 'frame-' + frame + '.png';
    const filePath = outputDir + '/' + filename;
    await page.evaluate(f => window.dispatchEvent(new CustomEvent('theatre-seek', { detail: { frame: f } })), frame);
    await new Promise(r => setTimeout(r, 150));
    await page.screenshot({ path: filePath, type: 'png' });
    results.push({ frame, filename, exists: fs.existsSync(filePath) });
  }
  await browser.close();
  console.log(JSON.stringify({ success: true, results }));
})().catch(e => { console.error(e.message); process.exit(1); });
`.trim();

        // Write the capture script to sandbox
        await getSandboxProvider().runCommand(
          sandboxId,
          `cat > /app/_capture_frames.cjs << 'CAPTURE_SCRIPT_EOF'\n${captureScript}\nCAPTURE_SCRIPT_EOF`,
          { timeout: 5_000 }
        );

        // Execute the capture script
        const result = await getSandboxProvider().runCommand(
          sandboxId,
          `cd /app && node _capture_frames.cjs '${framesJson}' /app/output 2>&1`,
          { timeout: 60_000 }
        );

        // Clean up
        await getSandboxProvider().runCommand(sandboxId, 'rm -f /app/_capture_frames.cjs', { timeout: 5_000 });

        console.log(`[sandbox_screenshot] Theatre.js capture result: success=${result.success} stdout=${result.stdout.slice(0, 300)}`);
        if (result.stderr) console.log(`[sandbox_screenshot] Theatre.js stderr: ${result.stderr.slice(0, 300)}`);

        if (!result.success) {
          return {
            success: false,
            screenshots: [],
            message: `Theatre.js screenshot capture failed: ${(result.stderr || result.stdout).slice(0, 500)}`,
          };
        }

        // Parse output and check which frames were captured
        for (const frame of frames) {
          const filename = `frame-${frame}.png`;
          const outputPath = `/app/output/${filename}`;

          const checkFile = await getSandboxProvider().runCommand(
            sandboxId,
            `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
            { timeout: 5_000 }
          );

          if (checkFile.stdout.trim() === 'OK') {
            screenshots.push({
              imageUrl: `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/${filename}`,
              frame,
            });
          } else {
            errors.push(`Frame ${frame}: file not created`);
          }
        }
      } else {
        // ── Remotion: bundle once, then take stills from the bundle ──

        // Step 1: Auto-detect composition ID (same logic as render_preview)
        const listResult = await getSandboxProvider().runCommand(
          sandboxId,
          `cd /app && bunx remotion compositions src/index.ts --props='{}' 2>&1 | grep 'fps' | head -1 | awk '{print $1}'`,
          { timeout: 60_000 }
        );
        let compositionId = listResult.stdout.trim();
        if (!compositionId) {
          const rootCheck = await getSandboxProvider().runCommand(
            sandboxId,
            `grep -oP 'id="\\K[^"]+' /app/src/Root.tsx 2>/dev/null | head -1 || echo "MainVideo"`,
            { timeout: 5_000 }
          );
          compositionId = rootCheck.stdout.trim() || 'MainVideo';
        }
        console.log(`[sandbox_screenshot] Detected composition: ${compositionId}`);

        // Step 2: Bundle once (the expensive part — ~30-60s)
        const bundleDir = '/tmp/remotion-bundle';
        console.log(`[sandbox_screenshot] Bundling to ${bundleDir}...`);
        const bundleResult = await getSandboxProvider().runCommand(
          sandboxId,
          `cd /app && bunx remotion bundle src/index.ts --out-dir ${bundleDir} 2>&1`,
          { timeout: 90_000 }
        );

        if (!bundleResult.success) {
          console.log(`[sandbox_screenshot] Bundle failed: ${bundleResult.stderr || bundleResult.stdout}`);
          return {
            success: false,
            screenshots: [],
            message: `Remotion bundling failed: ${(bundleResult.stderr || bundleResult.stdout).slice(0, 500)}`,
          };
        }
        console.log(`[sandbox_screenshot] Bundle complete`);

        // Step 3: Take stills from the bundle (fast — no rebundling)
        for (const frame of frames) {
          const filename = `frame-${frame}.png`;
          const outputPath = `/app/output/${filename}`;

          const cmd = `cd /app && bunx remotion still ${bundleDir} ${compositionId} ${outputPath} --frame=${frame} 2>&1`;
          console.log(`[sandbox_screenshot] Remotion frame ${frame}: taking still from bundle`);
          const result = await getSandboxProvider().runCommand(
            sandboxId,
            cmd,
            { timeout: 30_000 }
          );
          console.log(`[sandbox_screenshot] Remotion frame ${frame}: success=${result.success} stdout=${result.stdout.slice(0, 200)}`);
          if (result.stderr) console.log(`[sandbox_screenshot] Remotion frame ${frame} stderr: ${result.stderr.slice(0, 200)}`);

          if (result.success) {
            // Verify file was created
            const checkFile = await getSandboxProvider().runCommand(
              sandboxId,
              `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
              { timeout: 5_000 }
            );

            if (checkFile.stdout.trim() === 'OK') {
              screenshots.push({
                imageUrl: `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/${filename}`,
                frame,
              });
            } else {
              errors.push(`Frame ${frame}: file not created`);
            }
          } else {
            errors.push(`Frame ${frame}: ${result.stderr || result.stdout}`.slice(0, 100));
          }
        }

        // Clean up bundle to save disk space
        await getSandboxProvider().runCommand(sandboxId, `rm -rf ${bundleDir}`, { timeout: 5_000 });
      }

      if (screenshots.length === 0) {
        console.log(`[sandbox_screenshot] ALL FAILED. Errors: ${errors.join('; ')}`);
        return {
          success: false,
          screenshots: [],
          message: `All screenshots failed. Errors: ${errors.join('; ')}`,
        };
      }

      const msg = screenshots.length === frames.length
        ? `Captured ${screenshots.length} screenshot(s) [${engine}]`
        : `Captured ${screenshots.length}/${frames.length} screenshots [${engine}]. Errors: ${errors.join('; ')}`;
      console.log(`[sandbox_screenshot] ${msg}`);
      return { success: true, screenshots, message: msg };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Screenshot failed';
      console.error(`[sandbox_screenshot] Exception: ${errMsg}`);
      return {
        success: false,
        screenshots: [],
        message: errMsg,
      };
    }
  },
});

/**
 * render_preview - Generate preview video
 */
export const renderPreviewTool = createTool({
  id: 'render_preview',
  description: `Render a preview video of the animation. sandboxId and engine are auto-resolved from context.`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    duration: z.number().describe('Video duration in seconds'),
    fps: z.number().optional().describe('Frames per second (default: 30)'),
    compositionId: z.string().optional().describe('Composition ID to render (auto-detected if not provided, Remotion only)'),
    engine: z.enum(['remotion', 'theatre']).optional().describe('Override engine (auto-resolved from context if omitted)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    videoUrl: z.string(),
    thumbnailUrl: z.string(),
    duration: z.number(),
    message: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, videoUrl: '', thumbnailUrl: '', duration: inputData.duration, message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    const fps = inputData.fps || 30;
    const engine = resolveEngine(inputData.engine, context as ToolContext);
    const outputPath = '/app/output/preview.mp4';

    try {
      // Ensure output directory exists
      await getSandboxProvider().runCommand(sandboxId, 'mkdir -p /app/output', { timeout: 5_000 });

      if (engine === 'theatre') {
        // ── Theatre.js: Puppeteer + FFmpeg via export-video.cjs ──
        // Verify Vite dev server is running on port 5173
        const portCheck = await getSandboxProvider().runCommand(
          sandboxId,
          '(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null || echo "000")',
          { timeout: 10_000 }
        );
        if (!portCheck.stdout.trim().startsWith('200') && !portCheck.stdout.trim().startsWith('304')) {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            message: 'Theatre.js render requires the Vite dev server running on port 5173. Call sandbox_start_preview first.',
          };
        }

        // Verify export script exists
        const scriptCheck = await getSandboxProvider().runCommand(
          sandboxId,
          'test -f /app/export-video.cjs && echo "OK" || echo "MISSING"',
          { timeout: 5_000 }
        );
        if (scriptCheck.stdout.trim() !== 'OK') {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            message: 'export-video.cjs not found at /app/export-video.cjs. Theatre.js sandbox may not be set up correctly.',
          };
        }

        console.log(`[render_preview] Theatre.js render: duration=${inputData.duration}s, quality=preview`);

        const result = await getSandboxProvider().runCommand(
          sandboxId,
          `cd /app && node export-video.cjs --duration ${inputData.duration} --quality preview --output ${outputPath} 2>&1`,
          { timeout: 180_000 } // 3 minutes for preview render
        );

        if (!result.success) {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            message: `Theatre.js render failed: ${(result.stderr || result.stdout).slice(0, 500)}`,
          };
        }

        // Check if the file was created
        const checkFile = await getSandboxProvider().runCommand(
          sandboxId,
          `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
          { timeout: 5_000 }
        );

        if (checkFile.stdout.trim() !== 'OK') {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            message: 'Video file was not created. Render output: ' + (result.stdout || '').slice(0, 300),
          };
        }

        // Save code snapshot + video to permanent storage (non-critical)
        const nodeId_tp = (context as ToolContext)?.requestContext?.get('nodeId');
        console.log(`[render_preview] Theatre render success. nodeId=${nodeId_tp}, sandboxId=${sandboxId}`);
        if (nodeId_tp && sandboxId) {
          try {
            console.log(`[render_preview] Saving snapshot for node ${nodeId_tp}...`);
            const snapshotBuffer = await getSandboxProvider().exportSnapshot(sandboxId);
            const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
            const versionId = `v${Date.now()}`;
            await getSnapshotProvider().save(nodeId_tp, versionId, snapshotBuffer, { engine });
            console.log(`[render_preview] Snapshot saved for node ${nodeId_tp}`);
          } catch (err) {
            console.warn(`[render_preview] Snapshot save failed (non-critical):`, err);
          }
        }

        // Save video to permanent storage so it survives container death
        const permanentUrl_tp = await saveVideoToPermanentStorage(sandboxId, 'output/preview.mp4', nodeId_tp);
        const videoUrl_tp = permanentUrl_tp || `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/preview.mp4`;

        return {
          success: true,
          videoUrl: videoUrl_tp,
          thumbnailUrl: '',
          duration: inputData.duration,
          message: `Video rendered successfully [theatre, preview quality]`,
        };
      }

      // ── Remotion: native renderer ──
      // Detect composition ID if not provided
      let compositionId = inputData.compositionId;
      if (!compositionId) {
        // List available compositions and pick the first one.
        // `remotion compositions` outputs bundling progress ("Bundling 6%", "Bundling 100%", "Getting composition")
        // followed by actual composition lines like "MainVideo  30fps  1920x1080  7s".
        // Filter for lines containing "fps" to skip progress noise.
        const listResult = await getSandboxProvider().runCommand(
          sandboxId,
          `cd /app && bunx remotion compositions src/index.ts --props='{}' 2>&1 | grep 'fps' | head -1 | awk '{print $1}'`,
          { timeout: 30_000 }
        );
        compositionId = listResult.stdout.trim();

        if (!compositionId) {
          // Fallback: try to extract from Root.tsx
          const rootCheck = await getSandboxProvider().runCommand(
            sandboxId,
            `grep -oP 'id="\\K[^"]+' /app/src/Root.tsx 2>/dev/null | head -1 || echo "MainVideo"`,
            { timeout: 5_000 }
          );
          compositionId = rootCheck.stdout.trim() || 'MainVideo';
        }
      }

      console.log(`[render_preview] Using composition ID: ${compositionId}`);

      // Use Remotion's built-in renderer
      // --concurrency=1 for lower memory usage in container
      const result = await getSandboxProvider().runCommand(
        sandboxId,
        `cd /app && bunx remotion render src/index.ts ${compositionId} ${outputPath} --props='{}' --concurrency=1 2>&1`,
        { timeout: 180_000 } // 3 minutes for rendering
      );

      if (!result.success) {
        return {
          success: false,
          videoUrl: '',
          thumbnailUrl: '',
          duration: inputData.duration,
          message: `Render failed: ${result.stderr || result.stdout}`.slice(0, 500),
        };
      }

      // Check if the file was created
      const checkFile = await getSandboxProvider().runCommand(
        sandboxId,
        `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
        { timeout: 5_000 }
      );

      if (checkFile.stdout.trim() !== 'OK') {
        return {
          success: false,
          videoUrl: '',
          thumbnailUrl: '',
          duration: inputData.duration,
          message: 'Video file was not created. Render output: ' + result.stdout.slice(0, 300),
        };
      }

      // Save code snapshot + video to permanent storage (non-critical)
      const nodeId_rp = (context as ToolContext)?.requestContext?.get('nodeId');
      console.log(`[render_preview] Remotion render success. nodeId=${nodeId_rp}, sandboxId=${sandboxId}`);
      if (nodeId_rp && sandboxId) {
        try {
          console.log(`[render_preview] Saving snapshot for node ${nodeId_rp}...`);
          const snapshotBuffer = await getSandboxProvider().exportSnapshot(sandboxId);
          const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
          const versionId = `v${Date.now()}`;
          await getSnapshotProvider().save(nodeId_rp, versionId, snapshotBuffer, { engine });
          console.log(`[render_preview] Snapshot saved for node ${nodeId_rp}`);
        } catch (err) {
          console.warn(`[render_preview] Snapshot save failed (non-critical):`, err);
        }
      }

      // Save video to permanent storage so it survives container death
      const permanentUrl_rp = await saveVideoToPermanentStorage(sandboxId, 'output/preview.mp4', nodeId_rp);
      const videoUrl_rp = permanentUrl_rp || `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/preview.mp4`;

      return {
        success: true,
        videoUrl: videoUrl_rp,
        thumbnailUrl: '',
        duration: inputData.duration,
        message: `Video rendered successfully (composition: ${compositionId})`,
      };
    } catch (error) {
      return {
        success: false,
        videoUrl: '',
        thumbnailUrl: '',
        duration: inputData.duration,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * render_final - Generate final high-quality video
 */
export const renderFinalTool = createTool({
  id: 'render_final',
  description: `Render the final high-quality video. sandboxId and engine are auto-resolved from context.`,
  inputSchema: z.object({
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
    duration: z.number().describe('Video duration'),
    resolution: z.enum(['720p', '1080p', '4k']).optional().describe('Output resolution'),
    compositionId: z.string().optional().describe('Composition ID to render (auto-detected if not provided, Remotion only)'),
    engine: z.enum(['remotion', 'theatre']).optional().describe('Override engine (auto-resolved from context if omitted)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    videoUrl: z.string(),
    thumbnailUrl: z.string(),
    duration: z.number(),
    resolution: z.string(),
    versionId: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const sandboxId = resolveSandboxId(inputData.sandboxId, context as ToolContext);
    if (!sandboxId) {
      return { success: false, videoUrl: '', thumbnailUrl: '', duration: inputData.duration, resolution: inputData.resolution || '1080p', message: 'No active sandbox. Create one first with sandbox_create.' };
    }
    const resolution = inputData.resolution || '1080p';
    const engine = resolveEngine(inputData.engine, context as ToolContext);
    const outputPath = '/app/output/final.mp4';

    try {
      // Ensure output directory exists
      await getSandboxProvider().runCommand(sandboxId, 'mkdir -p /app/output', { timeout: 5_000 });

      if (engine === 'theatre') {
        // ── Theatre.js: Puppeteer + FFmpeg via export-video.cjs ──
        // Verify Vite dev server is running on port 5173
        const portCheck = await getSandboxProvider().runCommand(
          sandboxId,
          '(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null || echo "000")',
          { timeout: 10_000 }
        );
        if (!portCheck.stdout.trim().startsWith('200') && !portCheck.stdout.trim().startsWith('304')) {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            resolution,
            message: 'Theatre.js render requires the Vite dev server running on port 5173. Call sandbox_start_preview first.',
          };
        }

        // Verify export script exists
        const scriptCheck = await getSandboxProvider().runCommand(
          sandboxId,
          'test -f /app/export-video.cjs && echo "OK" || echo "MISSING"',
          { timeout: 5_000 }
        );
        if (scriptCheck.stdout.trim() !== 'OK') {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            resolution,
            message: 'export-video.cjs not found at /app/export-video.cjs. Theatre.js sandbox may not be set up correctly.',
          };
        }

        console.log(`[render_final] Theatre.js render: duration=${inputData.duration}s, quality=final, resolution=${resolution}`);

        const result = await getSandboxProvider().runCommand(
          sandboxId,
          `cd /app && node export-video.cjs --duration ${inputData.duration} --quality final --resolution ${resolution} --output ${outputPath} 2>&1`,
          { timeout: 300_000 } // 5 minutes for final render
        );

        if (!result.success) {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            resolution,
            message: `Theatre.js final render failed: ${(result.stderr || result.stdout).slice(0, 500)}`,
          };
        }

        // Check if the file was created
        const checkFile = await getSandboxProvider().runCommand(
          sandboxId,
          `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
          { timeout: 5_000 }
        );

        if (checkFile.stdout.trim() !== 'OK') {
          return {
            success: false,
            videoUrl: '',
            thumbnailUrl: '',
            duration: inputData.duration,
            resolution,
            message: 'Video file was not created. Render output: ' + (result.stdout || '').slice(0, 300),
          };
        }

        const nodeId_tf = (context as ToolContext)?.requestContext?.get('nodeId');
        console.log(`[render_final] Theatre render success. nodeId=${nodeId_tf}, sandboxId=${sandboxId}`);

        // Generate a versionId for this render and propagate to RequestContext
        const versionId_tf = `v${Date.now()}`;
        (context as ToolContext)?.requestContext?.set('lastVersionId', versionId_tf);

        // Fire-and-forget: snapshot save (non-critical, only for restoring dead containers)
        if (nodeId_tf && sandboxId) {
          void (async () => {
            try {
              const snapshotBuffer = await getSandboxProvider().exportSnapshot(sandboxId);
              const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
              await getSnapshotProvider().save(nodeId_tf, versionId_tf, snapshotBuffer, { engine });
              console.log(`[render_final] Background: snapshot saved for node ${nodeId_tf}/${versionId_tf}`);
            } catch (err) {
              console.warn(`[render_final] Background: snapshot save failed:`, err);
            }
          })();
        }

        // Permanent save MUST complete before returning — if sandbox dies, video is lost otherwise
        const permanentUrl_tf = await saveVideoToPermanentStorage(sandboxId, 'output/final.mp4', nodeId_tf);
        const videoUrl_tf = permanentUrl_tf || `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/final.mp4`;

        if (permanentUrl_tf && (context as ToolContext)?.requestContext) {
          (context as ToolContext).requestContext!.set('lastVideoUrl', videoUrl_tf);
        }

        return {
          success: true,
          videoUrl: videoUrl_tf,
          thumbnailUrl: '',
          duration: inputData.duration,
          resolution,
          versionId: versionId_tf,
          message: `Video rendered successfully [theatre, final quality, ${resolution}]`,
        };
      }

      // ── Remotion: native renderer ──
      // Map resolution to Remotion scale factor (based on 1920x1080 default)
      const scaleMap: Record<string, string> = {
        '720p': '--scale=0.67',
        '1080p': '',
        '4k': '--scale=2',
      };
      const scaleFlag = scaleMap[resolution] || '';

      // Detect composition ID if not provided
      let compositionId = inputData.compositionId;
      if (!compositionId) {
        // Filter for lines containing "fps" to skip bundling progress noise
        const listResult = await getSandboxProvider().runCommand(
          sandboxId,
          `cd /app && bunx remotion compositions src/index.ts --props='{}' 2>&1 | grep 'fps' | head -1 | awk '{print $1}'`,
          { timeout: 30_000 }
        );
        compositionId = listResult.stdout.trim();

        if (!compositionId) {
          const rootCheck = await getSandboxProvider().runCommand(
            sandboxId,
            `grep -oP 'id="\\K[^"]+' /app/src/Root.tsx 2>/dev/null | head -1 || echo "MainVideo"`,
            { timeout: 5_000 }
          );
          compositionId = rootCheck.stdout.trim() || 'MainVideo';
        }
      }

      console.log(`[render_final] Using composition ID: ${compositionId}`);

      // Use Remotion's built-in renderer with high quality settings
      const result = await getSandboxProvider().runCommand(
        sandboxId,
        `cd /app && bunx remotion render src/index.ts ${compositionId} ${outputPath} --props='{}' ${scaleFlag} 2>&1`,
        { timeout: 300_000 } // 5 minutes for final render
      );

      if (!result.success) {
        return {
          success: false,
          videoUrl: '',
          thumbnailUrl: '',
          duration: inputData.duration,
          resolution,
          message: `Render failed: ${result.stderr || result.stdout}`.slice(0, 500),
        };
      }

      // Check if the file was created
      const checkFile = await getSandboxProvider().runCommand(
        sandboxId,
        `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
        { timeout: 5_000 }
      );

      if (checkFile.stdout.trim() !== 'OK') {
        return {
          success: false,
          videoUrl: '',
          thumbnailUrl: '',
          duration: inputData.duration,
          resolution,
          message: 'Video file was not created',
        };
      }

      const nodeId_rf = (context as ToolContext)?.requestContext?.get('nodeId');
      console.log(`[render_final] Remotion render success. nodeId=${nodeId_rf}, sandboxId=${sandboxId}`);

      // Generate a versionId for this render and propagate to RequestContext
      const versionId_rf = `v${Date.now()}`;
      (context as ToolContext)?.requestContext?.set('lastVersionId', versionId_rf);

      // Fire-and-forget: snapshot save (non-critical, only for restoring dead containers)
      if (nodeId_rf && sandboxId) {
        void (async () => {
          try {
            const snapshotBuffer = await getSandboxProvider().exportSnapshot(sandboxId);
            const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
            await getSnapshotProvider().save(nodeId_rf, versionId_rf, snapshotBuffer, { engine });
            console.log(`[render_final] Background: snapshot saved for node ${nodeId_rf}/${versionId_rf}`);
          } catch (err) {
            console.warn(`[render_final] Background: snapshot save failed:`, err);
          }
        })();
      }

      // Permanent save MUST complete before returning — if sandbox dies, video is lost otherwise
      const permanentUrl_rf = await saveVideoToPermanentStorage(sandboxId, 'output/final.mp4', nodeId_rf);
      const videoUrl_rf = permanentUrl_rf || `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/final.mp4`;

      if (permanentUrl_rf && (context as ToolContext)?.requestContext) {
        (context as ToolContext).requestContext!.set('lastVideoUrl', videoUrl_rf);
      }

      return {
        success: true,
        videoUrl: videoUrl_rf,
        thumbnailUrl: '',
        duration: inputData.duration,
        resolution,
        versionId: versionId_rf,
        message: 'Video rendered successfully',
      };
    } catch (error) {
      return {
        success: false,
        videoUrl: '',
        thumbnailUrl: '',
        duration: inputData.duration,
        resolution,
      };
    }
  },
});
