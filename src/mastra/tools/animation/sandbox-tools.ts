/**
 * Animation Sandbox Tools
 *
 * Tools for interacting with the animation sandbox via Docker containers.
 * Each tool delegates to the Docker sandbox provider.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { dockerProvider } from '@/lib/sandbox/docker-provider';

// ── Token-saving helpers ──────────────────────────────────────────
/** Max chars for command output to keep token usage manageable */
const MAX_OUTPUT_CHARS = 3000;

function truncateOutput(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2) - 30;
  return text.slice(0, half) + `\n\n... [truncated ${text.length - max} chars] ...\n\n` + text.slice(-half);
}

/**
 * sandbox_create - Create a new sandbox container
 */
export const sandboxCreateTool = createTool({
  id: 'sandbox_create',
  description: `Create a new isolated Docker sandbox for animation development.

Choose a template based on the selected framework:
- "theatre" (default): Theatre.js + React Three Fiber for 3D animations
- "remotion": Remotion for 2D motion graphics and text animations

Call this before writing any files or running commands.`,
  inputSchema: z.object({
    projectId: z.string().describe('Unique project identifier for this animation'),
    template: z.enum(['theatre', 'remotion']).default('theatre').describe('Animation framework template to use'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    sandboxId: z.string(),
    status: z.string(),
    previewUrl: z.string(),
    template: z.string(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    try {
      const template = inputData.template || 'theatre';
      const instance = await dockerProvider.create(inputData.projectId, template);
      return {
        success: true,
        sandboxId: instance.id,
        status: instance.status,
        previewUrl: `/api/plugins/animation/sandbox/${instance.id}/proxy`,
        template,
        message: `Sandbox created with ${template} template: ${instance.id}`,
      };
    } catch (error) {
      return {
        success: false,
        sandboxId: '',
        status: 'error',
        previewUrl: '',
        template: inputData.template || 'theatre',
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
  description: 'Destroy a sandbox container and clean up resources.',
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID to destroy'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    try {
      await dockerProvider.destroy(inputData.sandboxId);
      return {
        success: true,
        message: `Sandbox destroyed: ${inputData.sandboxId}`,
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
  description: `Write a file to the animation sandbox.

Common files:
- src/App.tsx - Root component
- src/components/*.tsx - Animation components
- src/theatre/project.ts - Theatre.js config
- src/utils/easing.ts - Easing functions`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    path: z.string().describe('File path relative to project root'),
    content: z.string().describe('File content'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    try {
      await dockerProvider.writeFile(inputData.sandboxId, inputData.path, inputData.content);
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
  description: 'Read a file from the sandbox filesystem.',
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    path: z.string().describe('File path to read'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
  }),
  execute: async (inputData) => {
    try {
      const content = await dockerProvider.readFile(inputData.sandboxId, inputData.path);
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
  description: `Run a shell command in the sandbox.

Common commands:
- bun install - Install dependencies
- bun run dev - Start dev server (use background: true)
- bun run build - Build project`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
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
  execute: async (inputData) => {
    try {
      const result = await dockerProvider.runCommand(inputData.sandboxId, inputData.command, {
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
  description: 'List files in a sandbox directory.',
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
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
  execute: async (inputData) => {
    try {
      const files = await dockerProvider.listFiles(inputData.sandboxId, inputData.path, inputData.recursive);
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
  description: `Upload an image or video to the sandbox for use in animations.

Use this when:
- User provides an image they want to animate (Ken Burns effect, parallax, etc.)
- User provides a video they want to add overlays/effects to
- Animation code needs to reference user-provided media

The media is downloaded directly into the sandbox container.
Common destination paths:
- public/assets/image.png - For images
- public/assets/video.mp4 - For videos

After uploading, reference in code as '/assets/image.png' or '/assets/video.mp4'.`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    mediaUrl: z.string().describe('URL of the media to upload'),
    destPath: z.string().describe('Destination path in sandbox (e.g., public/assets/image.png)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    size: z.number().optional(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    try {
      const result = await dockerProvider.uploadMedia(
        inputData.sandboxId,
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
  description: `Write binary data (images, videos) to the sandbox from base64-encoded content.

Use this when:
- User uploaded a file directly (not a URL) and you need to write it to sandbox
- You need to create binary files from base64 data

For URL-based media, prefer sandbox_upload_media instead (more efficient).`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    path: z.string().describe('Destination path in sandbox (e.g., public/media/image.png)'),
    base64Data: z.string().describe('Base64-encoded binary data'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
    size: z.number().optional(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    try {
      const buffer = Buffer.from(inputData.base64Data, 'base64');
      await dockerProvider.writeBinary(inputData.sandboxId, inputData.path, buffer);
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
    sandboxId: z.string().describe('Sandbox ID'),
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
  execute: async (inputData) => {
    try {
      const videoPath = inputData.videoPath.startsWith('/') ? inputData.videoPath : `/app/${inputData.videoPath}`;
      const framesDir = '/app/public/media/frames';

      // Ensure frames directory exists
      await dockerProvider.runCommand(inputData.sandboxId, `mkdir -p ${framesDir}`, { timeout: 5_000 });

      const frames: Array<{ timestamp: number; path: string; url: string }> = [];

      if (inputData.mode === 'timestamps' && inputData.timestamps && inputData.timestamps.length > 0) {
        // Extract specific timestamps
        for (const ts of inputData.timestamps) {
          const filename = `frame_${ts.toFixed(1)}s.jpg`;
          const outputPath = `${framesDir}/${filename}`;

          const result = await dockerProvider.runCommand(
            inputData.sandboxId,
            `ffmpeg -ss ${ts} -i ${videoPath} -frames:v 1 -q:v 2 -y ${outputPath} 2>&1`,
            { timeout: 15_000 }
          );

          if (result.success) {
            // Verify file exists
            const check = await dockerProvider.runCommand(
              inputData.sandboxId,
              `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
              { timeout: 5_000 }
            );
            if (check.stdout.trim() === 'OK') {
              frames.push({
                timestamp: ts,
                path: `public/media/frames/${filename}`,
                url: `/api/plugins/animation/sandbox/${inputData.sandboxId}/file?path=public/media/frames/${filename}`,
              });
            }
          }
        }
      } else {
        // FPS-based extraction
        const fpsRate = inputData.fps || 1;

        // Get video duration first
        const durationResult = await dockerProvider.runCommand(
          inputData.sandboxId,
          `ffprobe -v error -show_entries format=duration -of csv=p=0 ${videoPath} 2>/dev/null`,
          { timeout: 10_000 }
        );
        const duration = parseFloat(durationResult.stdout.trim()) || 10;

        // Extract frames at the specified fps
        const result = await dockerProvider.runCommand(
          inputData.sandboxId,
          `ffmpeg -i ${videoPath} -vf fps=${fpsRate} -q:v 2 -y ${framesDir}/frame_%03d.jpg 2>&1`,
          { timeout: 30_000 }
        );

        if (result.success) {
          // List extracted frames
          const listResult = await dockerProvider.runCommand(
            inputData.sandboxId,
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
                url: `/api/plugins/animation/sandbox/${inputData.sandboxId}/file?path=public/media/frames/${filename}`,
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

Call this after writing your animation code. The preview URL can be embedded in an iframe.
This tool kills any existing dev server, starts a new one, and waits until it's ready.`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    previewUrl: z.string(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    try {
      // Kill any existing dev server
      await dockerProvider.runCommand(inputData.sandboxId, 'pkill -f "vite" || true', { timeout: 5_000 });
      // Small delay to let the process die
      await new Promise((r) => setTimeout(r, 500));

      // Check that package.json exists
      const pkgCheck = await dockerProvider.runCommand(
        inputData.sandboxId,
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
      const nodeModulesCheck = await dockerProvider.runCommand(
        inputData.sandboxId,
        'test -d /app/node_modules && echo "OK" || echo "MISSING"',
        { timeout: 5_000 }
      );
      if (nodeModulesCheck.stdout.trim() === 'MISSING') {
        // Install deps before starting
        const installResult = await dockerProvider.runCommand(
          inputData.sandboxId,
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

      // Start the Remotion Player dev server (not Remotion Studio) in background.
      // The Player uses vite.player.config.ts and serves player.html which embeds the
      // Remotion Player component. This avoids URL routing issues when embedding in iframes
      // (Remotion Studio interprets the proxy URL path as a composition ID).
      await dockerProvider.runCommand(
        inputData.sandboxId,
        'cd /app && nohup bunx vite --config vite.player.config.ts > /tmp/vite.log 2>&1 &',
        { background: true }
      );

      // Poll until the server is ready (max 20 seconds)
      const maxAttempts = 40;
      let ready = false;
      let lastCheckOutput = '';
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 500));
        // Use wget as fallback if curl isn't available
        const check = await dockerProvider.runCommand(
          inputData.sandboxId,
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
        const viteLog = await dockerProvider.runCommand(
          inputData.sandboxId,
          'tail -30 /tmp/vite.log 2>/dev/null || echo "No log available"',
          { timeout: 5_000 }
        );
        // Also check if any process is listening on 5173
        const portCheck = await dockerProvider.runCommand(
          inputData.sandboxId,
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
        previewUrl: `/api/plugins/animation/sandbox/${inputData.sandboxId}/proxy`,
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
  description: `Capture screenshots of the animation at specific frames using Remotion's native still renderer.

Uses 'bunx remotion still' command - much more reliable than Puppeteer-based approaches.

**Single mode**: Pass \`frame\` for one screenshot.
**Batch mode**: Pass \`frames\` array (e.g. [0, 30, 60, 90]) to capture multiple frames.

To convert seconds to frames: frame = seconds * fps (default 30fps)
Example: 2 seconds at 30fps = frame 60`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    frame: z.number().optional().describe('Single screenshot: capture this frame number'),
    frames: z.array(z.number()).optional().describe('Batch mode: array of frame numbers'),
    fps: z.number().optional().describe('Frames per second for time conversion (default: 30)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    screenshots: z.array(z.object({
      imageUrl: z.string(),
      frame: z.number(),
    })),
    message: z.string(),
  }),
  execute: async (inputData) => {
    const fps = inputData.fps || 30;

    // Determine which frames to capture
    let frames: number[];
    if (inputData.frames && inputData.frames.length > 0) {
      frames = inputData.frames;
    } else {
      frames = [inputData.frame || 0];
    }

    // Cap at 10 screenshots per call (Remotion still is slower than batch render)
    if (frames.length > 10) {
      frames = frames.slice(0, 10);
    }

    try {
      // Ensure output directory
      await dockerProvider.runCommand(inputData.sandboxId, 'mkdir -p /app/output', { timeout: 5_000 });

      const screenshots: { imageUrl: string; frame: number }[] = [];
      const errors: string[] = [];

      // Capture each frame using Remotion's native still command
      for (const frame of frames) {
        const filename = `frame-${frame}.png`;
        const outputPath = `/app/output/${filename}`;

        const result = await dockerProvider.runCommand(
          inputData.sandboxId,
          `cd /app && bunx remotion still src/index.ts MainVideo ${outputPath} --frame=${frame} 2>&1`,
          { timeout: 30_000 }
        );

        if (result.success) {
          // Verify file was created
          const checkFile = await dockerProvider.runCommand(
            inputData.sandboxId,
            `test -f ${outputPath} && echo "OK" || echo "MISSING"`,
            { timeout: 5_000 }
          );

          if (checkFile.stdout.trim() === 'OK') {
            screenshots.push({
              imageUrl: `/api/plugins/animation/sandbox/${inputData.sandboxId}/file?path=output/${filename}`,
              frame,
            });
          } else {
            errors.push(`Frame ${frame}: file not created`);
          }
        } else {
          errors.push(`Frame ${frame}: ${result.stderr || result.stdout}`.slice(0, 100));
        }
      }

      if (screenshots.length === 0) {
        return {
          success: false,
          screenshots: [],
          message: `All screenshots failed. Errors: ${errors.join('; ')}`,
        };
      }

      return {
        success: true,
        screenshots,
        message: screenshots.length === frames.length
          ? `Captured ${screenshots.length} screenshot(s)`
          : `Captured ${screenshots.length}/${frames.length} screenshots. Errors: ${errors.join('; ')}`,
      };
    } catch (error) {
      return {
        success: false,
        screenshots: [],
        message: error instanceof Error ? error.message : 'Screenshot failed',
      };
    }
  },
});

/**
 * render_preview - Generate preview video
 */
export const renderPreviewTool = createTool({
  id: 'render_preview',
  description: `Render a preview video of the animation using Remotion's built-in renderer.

Uses 'bunx remotion render' to create an MP4 video file. Automatically detects the composition ID.`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    duration: z.number().describe('Video duration in seconds'),
    fps: z.number().optional().describe('Frames per second (default: 30)'),
    compositionId: z.string().optional().describe('Composition ID to render (auto-detected if not provided)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    videoUrl: z.string(),
    thumbnailUrl: z.string(),
    duration: z.number(),
    message: z.string().optional(),
  }),
  execute: async (inputData) => {
    const fps = inputData.fps || 30;
    const outputPath = '/app/output/preview.mp4';

    try {
      // Ensure output directory exists
      await dockerProvider.runCommand(inputData.sandboxId, 'mkdir -p /app/output', { timeout: 5_000 });

      // Detect composition ID if not provided
      let compositionId = inputData.compositionId;
      if (!compositionId) {
        // List available compositions and pick the first one.
        // `remotion compositions` outputs bundling progress ("Bundling 6%", "Bundling 100%", "Getting composition")
        // followed by actual composition lines like "MainVideo  30fps  1920x1080  7s".
        // Filter for lines containing "fps" to skip progress noise.
        const listResult = await dockerProvider.runCommand(
          inputData.sandboxId,
          `cd /app && bunx remotion compositions src/index.ts --props='{}' 2>&1 | grep 'fps' | head -1 | awk '{print $1}'`,
          { timeout: 30_000 }
        );
        compositionId = listResult.stdout.trim();

        if (!compositionId) {
          // Fallback: try to extract from Root.tsx
          const rootCheck = await dockerProvider.runCommand(
            inputData.sandboxId,
            `grep -oP 'id="\\K[^"]+' /app/src/Root.tsx 2>/dev/null | head -1 || echo "MainVideo"`,
            { timeout: 5_000 }
          );
          compositionId = rootCheck.stdout.trim() || 'MainVideo';
        }
      }

      console.log(`[render_preview] Using composition ID: ${compositionId}`);

      // Use Remotion's built-in renderer
      // --concurrency=1 for lower memory usage in container
      const result = await dockerProvider.runCommand(
        inputData.sandboxId,
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
      const checkFile = await dockerProvider.runCommand(
        inputData.sandboxId,
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

      return {
        success: true,
        videoUrl: `/api/plugins/animation/sandbox/${inputData.sandboxId}/file?path=output/preview.mp4`,
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
  description: `Render the final high-quality video using Remotion's built-in renderer.

Uses higher quality settings and supports multiple resolutions. Automatically detects the composition ID.`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    duration: z.number().describe('Video duration'),
    resolution: z.enum(['720p', '1080p', '4k']).optional().describe('Output resolution'),
    compositionId: z.string().optional().describe('Composition ID to render (auto-detected if not provided)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    videoUrl: z.string(),
    thumbnailUrl: z.string(),
    duration: z.number(),
    resolution: z.string(),
    message: z.string().optional(),
  }),
  execute: async (inputData) => {
    const resolution = inputData.resolution || '1080p';
    const outputPath = '/app/output/final.mp4';

    // Map resolution to Remotion scale factor (based on 1920x1080 default)
    const scaleMap: Record<string, string> = {
      '720p': '--scale=0.67',
      '1080p': '',
      '4k': '--scale=2',
    };
    const scaleFlag = scaleMap[resolution] || '';

    try {
      // Ensure output directory exists
      await dockerProvider.runCommand(inputData.sandboxId, 'mkdir -p /app/output', { timeout: 5_000 });

      // Detect composition ID if not provided
      let compositionId = inputData.compositionId;
      if (!compositionId) {
        // Filter for lines containing "fps" to skip bundling progress noise
        const listResult = await dockerProvider.runCommand(
          inputData.sandboxId,
          `cd /app && bunx remotion compositions src/index.ts --props='{}' 2>&1 | grep 'fps' | head -1 | awk '{print $1}'`,
          { timeout: 30_000 }
        );
        compositionId = listResult.stdout.trim();

        if (!compositionId) {
          const rootCheck = await dockerProvider.runCommand(
            inputData.sandboxId,
            `grep -oP 'id="\\K[^"]+' /app/src/Root.tsx 2>/dev/null | head -1 || echo "MainVideo"`,
            { timeout: 5_000 }
          );
          compositionId = rootCheck.stdout.trim() || 'MainVideo';
        }
      }

      console.log(`[render_final] Using composition ID: ${compositionId}`);

      // Use Remotion's built-in renderer with high quality settings
      const result = await dockerProvider.runCommand(
        inputData.sandboxId,
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
      const checkFile = await dockerProvider.runCommand(
        inputData.sandboxId,
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

      return {
        success: true,
        videoUrl: `/api/plugins/animation/sandbox/${inputData.sandboxId}/file?path=output/final.mp4`,
        thumbnailUrl: '',
        duration: inputData.duration,
        resolution,
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
