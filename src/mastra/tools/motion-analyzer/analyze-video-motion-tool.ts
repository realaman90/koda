/**
 * analyze_video_motion Tool
 *
 * Deep motion analysis of video using Gemini Flash video understanding.
 * Returns detailed breakdown of camera movements, effects, transitions,
 * easing curves, and timing — everything a motion designer would notice.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { VIDEO_ANALYZER_MODEL } from '../../models';

const MotionEffectSchema = z.object({
  name: z.string().describe('Effect name (e.g., "spring entrance", "parallax scroll")'),
  category: z.enum(['camera', 'transition', 'animation', 'typography', 'compositing', 'timing', 'color', '3d']),
  timestamp: z.number().optional().describe('When the effect occurs (seconds)'),
  duration: z.number().optional().describe('How long the effect lasts (seconds)'),
  description: z.string().describe('Detailed description with technical parameters'),
  parameters: z.string().optional().describe('Technical parameters (e.g., "spring(200, 0.6)", "ease-in-out 400ms")'),
});

const AnalysisSceneSchema = z.object({
  number: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  description: z.string(),
  cameraMovement: z.string().optional(),
  effects: z.array(MotionEffectSchema),
  mood: z.string().optional(),
  colors: z.array(z.string()).optional(),
});

const MotionAnalysisResultSchema = z.object({
  success: z.boolean(),
  summary: z.string().describe('Overall motion design summary'),
  duration: z.number().describe('Video duration in seconds'),
  scenes: z.array(AnalysisSceneSchema),
  effects: z.array(MotionEffectSchema).describe('All detected effects across the video'),
  cameraMovements: z.array(z.string()).describe('List of camera movements detected'),
  transitions: z.array(z.string()).describe('List of transitions between scenes'),
  pacing: z.string().describe('Description of the overall pacing and rhythm'),
  overallStyle: z.string().describe('The dominant motion design style'),
  error: z.string().optional(),
});

const MOTION_ANALYSIS_PROMPT = `You are reverse-engineering this video frame by frame so someone can recreate it EXACTLY in code. Not "the style" — the EXACT video.

Return a JSON object with this EXACT structure:

{
  "summary": "2-3 sentence factual description of what the video shows",
  "duration": <video duration in seconds>,
  "scenes": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 2.5,
      "description": "EXACT description: what elements are on screen, their approximate pixel positions, sizes, colors as hex codes. Example: 'Dark background #0A0A0F. At center, a card container 800x500px, fill #12122A, border 1px rgba(255,255,255,0.06), border-radius 16px. Inside: headline text ~32px bold white, subtext ~16px #8888AA below it. Purple CTA button #6C5CE7, ~140x44px, rounded 8px.'",
      "cameraMovement": "EXACT: 'slow 2% scale increase over 2.5s, ease-in-out' or 'static, no camera movement' — do NOT invent movements that aren't there",
      "effects": [
        {
          "name": "card scale entrance",
          "category": "animation",
          "timestamp": 0.2,
          "duration": 0.6,
          "description": "Card container scales from 0.85 to 1.0, starting at 0.2s, reaching full size at 0.8s",
          "parameters": "scale(0.85→1.0) over 600ms, ease-out or spring — specify which. opacity(0→1) simultaneous"
        }
      ],
      "mood": "dark, premium tech",
      "colors": ["#0A0A0F", "#6C5CE7", "#FFFFFF", "#8888AA"]
    }
  ],
  "effects": [
    // EVERY animation that occurs, in chronological order with EXACT timestamps
    // Each must have: what element, what property changes, from what value to what value, over how long, with what easing
  ],
  "cameraMovements": ["specify exact values: '1.5% scale over 3s ease-in-out' not just 'slow dolly'"],
  "transitions": ["exact: 'crossfade over 0.4s at 2.5s' not just 'crossfade at 2.5s'"],
  "pacing": "Describe the exact rhythm: '0-1s setup, 1-3s main entrance with 50ms stagger, 3-5s hold, 5-7s secondary animations, 7-8s outro fade'",
  "overallStyle": "Factual: 'Dark mode SaaS product showcase with centered UI mockup, spring-based entrances, subtle particle background' — describe what you SEE"
}

CRITICAL — WHAT MAKES A GOOD ANALYSIS vs BAD:
BAD: "spring entrance animation" → GOOD: "scales from 0.88 to 1.0 over 0.5s with ~15% overshoot, suggesting spring(180, 12)"
BAD: "text reveals with typewriter effect" → GOOD: "text 'Get Started' appears character by character, ~60ms per character, left to right, opacity 0→1 per char, total duration ~0.6s for 10 chars"
BAD: "particle background" → GOOD: "~40 small circles (2-4px diameter, #ffffff at 10-20% opacity) drift upward at ~0.3px/frame, scattered across full viewport"
BAD: "staggered grid reveals" → GOOD: "3x4 grid of cards, each ~140x90px, 16px gap, first card appears at 0.5s, each subsequent card delayed 45ms, appears via scale 0.9→1.0 + opacity 0→1 over 0.3s ease-out"

REQUIREMENTS:
1. Describe what you ACTUALLY SEE — do not invent effects that aren't visible
2. Every color as hex code (sample from the video)
3. Every size in approximate pixels
4. Every timing in seconds or milliseconds
5. Every easing as specific curve (ease-out, spring(stiffness, damping), cubic-bezier, linear)
6. Every position as approximate coordinates or relative terms (center, top-left, etc.)
7. Every scene MUST have at least one effect — there's always something happening
8. If text is visible, note the approximate content, font size, weight, and color`;

/**
 * Video Motion Analyzer Agent (Gemini Flash)
 */
const videoMotionAnalyzer = new Agent({
  id: 'video-motion-analyzer',
  name: 'video-motion-analyzer',
  instructions: `You are the world's most detailed motion design analyst. You notice every spring curve, every stagger delay, every parallax ratio. You speak in precise technical terms with exact parameters. Always return valid JSON matching the requested schema.`,
  model: VIDEO_ANALYZER_MODEL,
});

export const analyzeVideoMotionTool = createTool({
  id: 'analyze_video_motion',
  description: `Perform deep motion design analysis on a video. Identifies every camera movement, transition, animation effect, easing curve, and timing detail.

Use this when:
- User uploads a video they want to understand/replicate
- User provides a YouTube URL for motion reference
- You need to break down the motion design techniques used

Returns a comprehensive analysis with:
- Scene-by-scene breakdown with timestamps
- All detected effects with technical parameters (spring configs, bezier curves)
- Camera movements, transitions, pacing
- Overall style characterization`,

  inputSchema: z.object({
    videoUrl: z.string().optional().describe('URL of the video to analyze'),
    videoBase64: z.string().optional().describe('Base64-encoded video data'),
    mimeType: z.string().optional().describe('MIME type (e.g., video/mp4)'),
    trimStart: z.number().optional().describe('Start time in seconds for analysis window (for videos > 20s)'),
    trimEnd: z.number().optional().describe('End time in seconds for analysis window (for videos > 20s)'),
  }),

  outputSchema: MotionAnalysisResultSchema,

  execute: async (input, context) => {
    // Resolve video data from RequestContext (set by route.ts) — prefer over LLM-provided input
    const ctx = context as { requestContext?: { get: (key: string) => unknown } };
    const rcBase64 = ctx?.requestContext?.get('videoBase64') as string | undefined;
    const rcMimeType = ctx?.requestContext?.get('videoMimeType') as string | undefined;
    const rcTrimStart = ctx?.requestContext?.get('trimStart') as number | undefined;
    const rcTrimEnd = ctx?.requestContext?.get('trimEnd') as number | undefined;

    const videoBase64 = rcBase64 || input.videoBase64;
    const mimeType = rcMimeType || input.mimeType;
    const videoUrl = input.videoUrl;
    const trimStart = rcTrimStart ?? input.trimStart;
    const trimEnd = rcTrimEnd ?? input.trimEnd;

    if (!videoUrl && !videoBase64) {
      return {
        success: false,
        summary: '',
        duration: 0,
        scenes: [],
        effects: [],
        cameraMovements: [],
        transitions: [],
        pacing: '',
        overallStyle: '',
        error: 'No video provided. Pass either videoUrl or videoBase64.',
      };
    }

    const hasTrim = trimStart !== undefined && trimEnd !== undefined;
    console.log(`[analyze_video_motion] Analyzing video: ${videoBase64 ? `base64 (${Math.round(videoBase64.length * 0.75 / 1024)}KB)` : videoUrl?.slice(0, 60)} (${mimeType || 'unknown'})${hasTrim ? ` [trim: ${trimStart}s-${trimEnd}s]` : ''}${rcBase64 ? ' [from RequestContext]' : ''}`);

    try {
      // Build multimodal content for Gemini (AI SDK v5 format)
      const videoContent: Array<{ type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string }> = [];

      if (videoBase64 && mimeType) {
        videoContent.push({
          type: 'file',
          data: videoBase64,
          mediaType: mimeType,
        });
      } else if (videoUrl) {
        videoContent.push({
          type: 'file',
          data: videoUrl,
          mediaType: mimeType || 'video/mp4',
        });
      }

      // Add trim-specific instruction if needed
      const trimInstruction = hasTrim
        ? `\n\nCRITICAL: This video has been trimmed by the user. ONLY analyze the segment from ${trimStart}s to ${trimEnd}s (${(trimEnd! - trimStart!).toFixed(1)}s). Ignore everything outside this window. Use absolute timestamps (relative to the full video start) in your response.`
        : '';

      videoContent.push({
        type: 'text',
        text: MOTION_ANALYSIS_PROMPT + trimInstruction,
      });

      const result = await videoMotionAnalyzer.generate([
        { role: 'user', content: videoContent },
      ]);

      const responseText = result.text || '';

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          summary: responseText,
          duration: 0,
          scenes: [],
          effects: [],
          cameraMovements: [],
          transitions: [],
          pacing: '',
          overallStyle: '',
          error: 'Failed to parse structured response from video analyzer',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        summary: parsed.summary || '',
        duration: parsed.duration || 0,
        scenes: parsed.scenes || [],
        effects: parsed.effects || [],
        cameraMovements: parsed.cameraMovements || [],
        transitions: parsed.transitions || [],
        pacing: parsed.pacing || '',
        overallStyle: parsed.overallStyle || '',
      };
    } catch (error) {
      return {
        success: false,
        summary: '',
        duration: 0,
        scenes: [],
        effects: [],
        cameraMovements: [],
        transitions: [],
        pacing: '',
        overallStyle: '',
        error: `Video analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

export { MotionAnalysisResultSchema };
