import { NextResponse } from 'next/server';
import { xskillQueryTask } from '@/lib/xskill';
import { saveGeneratedVideo } from '@/lib/video-storage';

export async function POST(request: Request) {
  try {
    const { taskId, model, prompt, canvasId, nodeId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const result = await xskillQueryTask(taskId);

    if (result.status === 'completed' && result.videoUrl) {
      // Save video to configured asset storage
      const savedUrl = await saveGeneratedVideo(result.videoUrl, {
        prompt: prompt || '',
        model: model || 'xskill',
        canvasId,
        nodeId,
      });

      return NextResponse.json({
        status: 'completed',
        videoUrl: savedUrl,
        originalUrl: result.videoUrl,
      });
    }

    if (result.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: result.error || 'Video generation failed',
      });
    }

    // pending or processing
    return NextResponse.json({ status: result.status });
  } catch (error) {
    console.error('Poll error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Poll failed' },
      { status: 500 }
    );
  }
}
