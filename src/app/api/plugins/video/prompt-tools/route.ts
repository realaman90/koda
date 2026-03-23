/**
 * Video Prompt Tools Streaming API Route
 *
 * POST /api/plugins/video/prompt-tools
 * Streams improved or translated prompts token-by-token via SSE.
 *
 * Actions:
 * - "improve": Optimizes prompt for Seedance 2.0 cinematic formula
 * - "translate": Translates English prompt to Chinese for Jimeng/Doubao
 */

import { Agent } from '@mastra/core/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'anthropic/claude-sonnet-4-6';

const IMPROVE_SYSTEM_PROMPT = `You are a video prompt engineer specializing in AI video generation models like Seedance 2.0, Kling, Wan, and Hailuo.

Your task: Rewrite the user's prompt into an optimized, cinematic video generation prompt.

Rules:
- Output ONLY the improved prompt text. No explanations, no labels, no markdown.
- Keep the core intent and subject of the original prompt.
- Structure: [Camera movement] + [Subject action] + [Scene/environment] + [Lighting/mood] + [Style qualifiers]
- Use specific cinematic language: "tracking shot", "dolly zoom", "shallow depth of field", "golden hour lighting", "anamorphic lens flare", etc.
- Add motion descriptors: "slowly", "gracefully", "dynamically", "sweeping"
- Include atmosphere: fog, particles, volumetric light, bokeh, reflections
- Keep it 2-4 sentences. Don't over-stuff.
- Avoid content that triggers safety filters: no violence, weapons, gore, nudity, political figures, or controversial content.
- Replace vague words ("nice", "cool", "beautiful") with specific visual descriptors.
- If the prompt mentions @image1, @image2, @video1 etc., preserve those references exactly as-is.`;

const TRANSLATE_SYSTEM_PROMPT = `You are a professional translator specializing in AI video generation prompts.

Your task: Translate the user's English video prompt into natural Chinese (Simplified) optimized for Chinese AI video platforms like Jimeng (即梦) and Doubao.

Rules:
- Output ONLY the translated Chinese prompt. No explanations, no labels, no markdown.
- Use natural, fluent Chinese — not word-for-word translation.
- Preserve cinematic terminology in appropriate Chinese equivalents:
  - "tracking shot" → "跟踪镜头"
  - "slow motion" → "慢动作"
  - "depth of field" → "景深"
  - "golden hour" → "黄金时刻"
  - "aerial view" → "航拍视角"
  - "close-up" → "特写镜头"
- Keep technical style qualifiers: "8K", "HDR", "cinematic" → "电影级"
- If the prompt contains @image1, @image2, @video1 etc., preserve those references exactly as-is.
- If the input is already in Chinese, refine it for clarity but keep it in Chinese.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, action } = body as { prompt?: string; action?: string };

    if (!prompt || !action || (action !== 'improve' && action !== 'translate')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "prompt" or "action" (improve | translate)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const systemPrompt = action === 'improve' ? IMPROVE_SYSTEM_PROMPT : TRANSLATE_SYSTEM_PROMPT;

    const agent = new Agent({
      id: `video-prompt-${action}-${Date.now()}`,
      name: `video-prompt-${action}`,
      instructions: systemPrompt,
      model: MODEL,
    });

    const result = await agent.stream(prompt);

    const encoder = new TextEncoder();
    let closed = false;

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

        request.signal.addEventListener('abort', () => {
          closed = true;
          safeClose();
        });

        let fullText = '';

        try {
          const reader = result.fullStream.getReader();

          while (!closed) {
            const { done, value: chunk } = await reader.read();
            if (done || closed) break;

            if (chunk.type === 'text-delta') {
              fullText += chunk.payload.text;
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text-delta', text: chunk.payload.text })}\n\n`),
              );
            } else if (chunk.type === 'error') {
              const errorMsg = chunk.payload instanceof Error ? chunk.payload.message : String(chunk.payload);
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`),
              );
            }
          }

          // Send done event with full accumulated text
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', text: fullText })}\n\n`),
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`),
          );
        } finally {
          safeClose();
        }
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
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
