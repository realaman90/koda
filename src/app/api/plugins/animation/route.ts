/**
 * Animation Generator Plugin API Route
 *
 * Non-streaming actions for the animation workflow.
 * Most workflow actions (analyze, plan, execute) are handled by the streaming
 * endpoint at /api/plugins/animation/stream. This route only handles:
 * - finalize: Finalize output after preview is accepted
 * - GET: Status check for polling
 */

import { NextResponse } from 'next/server';
import type {
  AnimationAPIRequest,
  AnimationAPIResponse,
} from '@/lib/plugins/official/agents/animation-generator/types';
import { dockerProvider, getSandboxInstance } from '@/lib/sandbox/docker-provider';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body: AnimationAPIRequest = await request.json();
    const { nodeId, action, previewUrl, sandboxId, duration, resolution } = body;

    if (!nodeId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: nodeId and action' },
        { status: 400 }
      );
    }

    let response: AnimationAPIResponse;

    switch (action) {
      case 'finalize': {
        // If we have a sandboxId, render final quality in the container
        if (sandboxId) {
          const instance = await getSandboxInstance(sandboxId);
          if (!instance || instance.status === 'destroyed' || instance.status === 'error') {
            return NextResponse.json(
              { success: false, error: 'Sandbox not found or not running' },
              { status: 404 }
            );
          }

          const videoDuration = duration || 5;
          const videoResolution = resolution || '1080p';

          const renderResult = await dockerProvider.runCommand(
            sandboxId,
            `node export-video.cjs --duration ${videoDuration} --quality final --resolution ${videoResolution} --output /app/output/final.mp4`,
            { timeout: 300_000 }
          );

          if (!renderResult.success) {
            // Fall back to preview URL if render fails
            response = {
              success: true,
              phase: 'complete',
              outputUrl: previewUrl || `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/preview.mp4`,
              thumbnailUrl: `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/preview-thumb.jpg`,
            };
          } else {
            response = {
              success: true,
              phase: 'complete',
              outputUrl: `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/final.mp4`,
              thumbnailUrl: `/api/plugins/animation/sandbox/${sandboxId}/file?path=output/final-thumb.jpg`,
            };
          }
        } else if (previewUrl) {
          // No sandbox — just promote preview URL as final output
          response = {
            success: true,
            phase: 'complete',
            outputUrl: previewUrl,
            thumbnailUrl: previewUrl.replace('.mp4', '-thumb.jpg'),
          };
        } else {
          return NextResponse.json(
            { success: false, error: 'Missing sandboxId or previewUrl for finalize action' },
            { status: 400 }
          );
        }
        break;
      }

      case 'cleanup': {
        // Destroy sandbox container — used on node unmount or manual cleanup
        if (sandboxId) {
          try {
            await dockerProvider.destroy(sandboxId);
          } catch {
            // Ignore cleanup errors
          }
        }
        response = { success: true, phase: 'idle' };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Use /api/plugins/animation/stream for agent interactions.` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Animation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('nodeId');
  const sandboxId = searchParams.get('sandboxId');

  if (!nodeId) {
    return NextResponse.json(
      { success: false, error: 'Missing nodeId parameter' },
      { status: 400 }
    );
  }

  // If a sandboxId is provided, check actual container status
  if (sandboxId) {
    const instance = await getSandboxInstance(sandboxId);
    if (instance) {
      return NextResponse.json({
        success: true,
        nodeId,
        sandboxId,
        status: instance.status,
        port: instance.port,
        createdAt: instance.createdAt,
        lastActivityAt: instance.lastActivityAt,
      });
    }
    return NextResponse.json({
      success: true,
      nodeId,
      sandboxId,
      status: 'not_found',
      message: 'Sandbox not found',
    });
  }

  return NextResponse.json({
    success: true,
    nodeId,
    status: 'idle',
    message: 'No active operations',
  });
}
