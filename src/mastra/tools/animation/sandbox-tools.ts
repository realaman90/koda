/**
 * Animation Sandbox Tools
 *
 * Tools for interacting with the animation sandbox via Docker containers.
 * Each tool delegates to the Docker sandbox provider.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { dockerProvider } from '@/lib/sandbox/docker-provider';

/**
 * sandbox_create - Create a new sandbox container
 */
export const sandboxCreateTool = createTool({
  id: 'sandbox_create',
  description: `Create a new isolated Docker sandbox for animation development.

The sandbox comes pre-installed with Node.js, Bun, Theatre.js, React, Vite, Chromium, and FFmpeg.
Call this before writing any files or running commands.`,
  inputSchema: z.object({
    projectId: z.string().describe('Unique project identifier for this animation'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    sandboxId: z.string(),
    status: z.string(),
    previewUrl: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      const instance = await dockerProvider.create(context.projectId);
      return {
        success: true,
        sandboxId: instance.id,
        status: instance.status,
        previewUrl: `/api/plugins/animation/sandbox/${instance.id}/proxy`,
        message: `Sandbox created: ${instance.id}`,
      };
    } catch (error) {
      return {
        success: false,
        sandboxId: '',
        status: 'error',
        previewUrl: '',
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
  execute: async ({ context }) => {
    try {
      await dockerProvider.destroy(context.sandboxId);
      return {
        success: true,
        message: `Sandbox destroyed: ${context.sandboxId}`,
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
  execute: async ({ context }) => {
    try {
      await dockerProvider.writeFile(context.sandboxId, context.path, context.content);
      return {
        success: true,
        path: context.path,
        message: `File written: ${context.path}`,
      };
    } catch (error) {
      return {
        success: false,
        path: context.path,
        message: error instanceof Error ? error.message : `Failed to write: ${context.path}`,
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
  execute: async ({ context }) => {
    try {
      const content = await dockerProvider.readFile(context.sandboxId, context.path);
      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        content: error instanceof Error ? error.message : `Failed to read: ${context.path}`,
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
  execute: async ({ context }) => {
    try {
      return await dockerProvider.runCommand(context.sandboxId, context.command, {
        background: context.background,
        timeout: context.timeout,
      });
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
  execute: async ({ context }) => {
    try {
      const files = await dockerProvider.listFiles(context.sandboxId, context.path, context.recursive);
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
  execute: async ({ context }) => {
    try {
      // Kill any existing dev server
      await dockerProvider.runCommand(context.sandboxId, 'pkill -f "vite" || true', { timeout: 5_000 });
      // Small delay to let the process die
      await new Promise((r) => setTimeout(r, 500));

      // Check that package.json exists
      const pkgCheck = await dockerProvider.runCommand(
        context.sandboxId,
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
        context.sandboxId,
        'test -d /app/node_modules && echo "OK" || echo "MISSING"',
        { timeout: 5_000 }
      );
      if (nodeModulesCheck.stdout.trim() === 'MISSING') {
        // Install deps before starting
        const installResult = await dockerProvider.runCommand(
          context.sandboxId,
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

      // Start dev server in background, redirect output to a log file for debugging
      await dockerProvider.runCommand(
        context.sandboxId,
        'cd /app && nohup bun run dev > /tmp/vite.log 2>&1 &',
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
          context.sandboxId,
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
          context.sandboxId,
          'tail -30 /tmp/vite.log 2>/dev/null || echo "No log available"',
          { timeout: 5_000 }
        );
        // Also check if any process is listening on 5173
        const portCheck = await dockerProvider.runCommand(
          context.sandboxId,
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
        previewUrl: `/api/plugins/animation/sandbox/${context.sandboxId}/proxy`,
        message: 'Dev server running — preview ready',
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
  description: `Capture a screenshot of the animation at a specific point in time.

Uses Puppeteer inside the sandbox to navigate to the dev server, seek to the specified time, and capture a screenshot.
Useful for debugging, progress verification, and thumbnail generation.`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    seekTo: z.number().optional().describe('Seek animation to this time (seconds) before capture'),
    width: z.number().optional().describe('Screenshot width (default: 1920)'),
    height: z.number().optional().describe('Screenshot height (default: 1080)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    imageUrl: z.string(),
    timestamp: z.number(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const width = context.width || 1920;
    const height = context.height || 1080;
    const seekTo = context.seekTo || 0;

    // Write a Puppeteer script that uses the same seek API as useCurrentFrame
    const fps = 60;
    const seekFrame = Math.round(seekTo * fps);
    const screenshotScript = `
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: ${width}, height: ${height} });

  // Set export mode before page loads so useCurrentFrame doesn't start RAF
  await page.evaluateOnNewDocument(() => {
    window.__EXPORT_MODE__ = true;
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('#root', { timeout: 10000 });

  // Wait for React to mount
  await new Promise(r => setTimeout(r, 500));

  // Seek via theatre-seek event (matches useCurrentFrame hook)
  await page.evaluate((frame) => {
    window.dispatchEvent(new CustomEvent('theatre-seek', { detail: { frame } }));
  }, ${seekFrame});

  // Wait for React to re-render
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  await page.screenshot({ path: '/app/output/screenshot.png', type: 'png' });
  await browser.close();
  console.log('OK');
})();
`;

    try {
      // Ensure output directory
      await dockerProvider.runCommand(context.sandboxId, 'mkdir -p /app/output');

      // Write the screenshot script
      await dockerProvider.writeFile(context.sandboxId, 'screenshot.cjs', screenshotScript);

      // Run it
      const result = await dockerProvider.runCommand(
        context.sandboxId,
        'node screenshot.cjs',
        { timeout: 30_000 }
      );

      if (!result.success) {
        return {
          success: false,
          imageUrl: '',
          timestamp: seekTo,
          message: `Screenshot failed: ${result.stderr}`,
        };
      }

      return {
        success: true,
        imageUrl: `/api/plugins/animation/sandbox/${context.sandboxId}/file?path=output/screenshot.png`,
        timestamp: seekTo,
        message: `Screenshot captured at t=${seekTo}s`,
      };
    } catch (error) {
      return {
        success: false,
        imageUrl: '',
        timestamp: seekTo,
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
  description: `Render a low-quality preview video of the animation.

This runs the export-video script inside the sandbox container,
which uses Puppeteer + FFmpeg to capture the animation.`,
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    duration: z.number().describe('Video duration in seconds'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    videoUrl: z.string(),
    thumbnailUrl: z.string(),
    duration: z.number(),
  }),
  execute: async ({ context }) => {
    try {
      // Run the export script in the container
      const result = await dockerProvider.runCommand(
        context.sandboxId,
        `node export-video.cjs --duration ${context.duration} --quality preview --output /app/output/preview.mp4`,
        { timeout: 120_000 }
      );

      if (!result.success) {
        return {
          success: false,
          videoUrl: '',
          thumbnailUrl: '',
          duration: context.duration,
        };
      }

      // Copy the video out of the container
      // TODO: Upload to storage and return a real URL
      return {
        success: true,
        videoUrl: `/api/plugins/animation/sandbox/${context.sandboxId}/file?path=output/preview.mp4`,
        thumbnailUrl: `/api/plugins/animation/sandbox/${context.sandboxId}/file?path=output/preview-thumb.jpg`,
        duration: context.duration,
      };
    } catch (error) {
      return {
        success: false,
        videoUrl: '',
        thumbnailUrl: '',
        duration: context.duration,
      };
    }
  },
});

/**
 * render_final - Generate final high-quality video
 */
export const renderFinalTool = createTool({
  id: 'render_final',
  description: 'Render the final high-quality video.',
  inputSchema: z.object({
    sandboxId: z.string().describe('Sandbox ID'),
    duration: z.number().describe('Video duration'),
    resolution: z.enum(['720p', '1080p', '4k']).optional().describe('Output resolution'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    videoUrl: z.string(),
    thumbnailUrl: z.string(),
    duration: z.number(),
    resolution: z.string(),
  }),
  execute: async ({ context }) => {
    const resolution = context.resolution || '1080p';

    try {
      const result = await dockerProvider.runCommand(
        context.sandboxId,
        `node export-video.cjs --duration ${context.duration} --quality final --resolution ${resolution} --output /app/output/final.mp4`,
        { timeout: 300_000 }
      );

      if (!result.success) {
        return {
          success: false,
          videoUrl: '',
          thumbnailUrl: '',
          duration: context.duration,
          resolution,
        };
      }

      return {
        success: true,
        videoUrl: `/api/plugins/animation/sandbox/${context.sandboxId}/file?path=output/final.mp4`,
        thumbnailUrl: `/api/plugins/animation/sandbox/${context.sandboxId}/file?path=output/final-thumb.jpg`,
        duration: context.duration,
        resolution,
      };
    } catch (error) {
      return {
        success: false,
        videoUrl: '',
        thumbnailUrl: '',
        duration: context.duration,
        resolution,
      };
    }
  },
});
