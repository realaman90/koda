/**
 * verify_animation Tool
 *
 * Subagent-as-tool: uses Gemini Flash to analyze a rendered video against
 * user intent and design spec. Returns structured pass/fail with fix instructions.
 *
 * Replaces the old screenshot-based verification workflow:
 * - Old: code gen → bundle → 10 screenshots → visual comparison
 * - New: code gen → render_final → verify_animation (video analysis) → fix if needed
 *
 * Token cost: ~1,000-2,000 tokens for a 10s video (vs ~10,000+ for 10 images)
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { readSandboxFileRaw } from '@/lib/sandbox/sandbox-factory';
import { VIDEO_ANALYZER_MODEL } from '../../models';

// ── RequestContext helpers ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolContext = { requestContext?: { get: (key: string) => any; set: (key: string, value: any) => void } };

function resolveSandboxId(input: string | undefined, context?: ToolContext): string | undefined {
  return context?.requestContext?.get('sandboxId') || input || undefined;
}

// ── Verification subagent ────────────────────────────────────────
// No tools — pure generation. Gemini Flash with native video understanding.
const videoVerifier = new Agent({
  id: 'video-verifier',
  name: 'video-verifier',
  instructions: `You are a quality-assurance expert for rendered animation videos.
You receive a video file and verify it against the user's intent and design specifications.
Always return ONLY valid JSON matching the requested schema. No markdown, no extra text.
Be strict but fair — the goal is to catch real issues, not nitpick.`,
  model: VIDEO_ANALYZER_MODEL,
});

// ── Verification prompt ──────────────────────────────────────────
const VERIFICATION_PROMPT = `Analyze this rendered animation video against the user's intent and design spec.

USER INTENT:
{userIntent}

DESIGN SPEC:
{designSpec}

EXPECTED DURATION: {duration} seconds

Score each check from the rubric below and return a JSON object.
A check "passes" if it meets reasonable expectations — not perfection.

RUBRIC:
1. animationPlaying — Is there visible motion/animation? (Static = fail)
2. colorScheme — Do the colors approximately match the spec? (Wrong palette = fail)
3. typography — Is text readable and appropriately sized? (Tiny/unreadable = fail)
4. effects — Are premium effects present? (Flat/generic = fail for specs requesting effects)
5. timing — Does the animation fill the expected duration? (Way too short/long = fail)
6. overallQuality — Does it look polished and professional? (Broken layout = fail)

Return ONLY this JSON (no markdown fences):
{
  "pass": true/false,
  "score": 1-10,
  "checks": {
    "animationPlaying": { "pass": true/false, "note": "brief explanation" },
    "colorScheme": { "pass": true/false, "note": "brief explanation" },
    "typography": { "pass": true/false, "note": "brief explanation" },
    "effects": { "pass": true/false, "note": "brief explanation" },
    "timing": { "pass": true/false, "note": "brief explanation" },
    "overallQuality": { "pass": true/false, "note": "brief explanation" }
  },
  "summary": "1-2 sentence overall summary",
  "fixInstructions": "if fail: specific instructions for the code generator to fix issues. if pass: empty string"
}`;

// ── Output schema ────────────────────────────────────────────────
const CheckSchema = z.object({
  pass: z.boolean(),
  note: z.string(),
});

const VerificationResultSchema = z.object({
  success: z.boolean(),
  pass: z.boolean(),
  score: z.number(),
  checks: z.object({
    animationPlaying: CheckSchema,
    colorScheme: CheckSchema,
    typography: CheckSchema,
    effects: CheckSchema,
    timing: CheckSchema,
    overallQuality: CheckSchema,
  }),
  summary: z.string(),
  fixInstructions: z.string(),
  videoUrl: z.string().optional().describe('Permanent video URL if available'),
  error: z.string().optional(),
});

// ── Tool definition ──────────────────────────────────────────────
export const verifyAnimationTool = createTool({
  id: 'verify_animation',
  description: `Verify a rendered animation video against user intent and design spec using Gemini Flash.
Call this AFTER render_final. The tool reads output/final.mp4 from the sandbox automatically.
Returns pass/fail, quality score (1-10), per-check results, and fix instructions if needed.

Pass threshold: score >= 7. Below 7, use fixInstructions to call generate_remotion_code with task="modify_existing", then re-render and re-verify. Max 2 fix iterations.`,
  inputSchema: z.object({
    userIntent: z.string().describe('What the user asked for (original prompt summary)'),
    designSpec: z.string().optional().describe('Full design spec from the plan'),
    duration: z.number().describe('Expected video duration in seconds'),
    sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),
  }),
  outputSchema: VerificationResultSchema,
  execute: async (input, context) => {
    const ctx = context as ToolContext;
    const sandboxId = resolveSandboxId(input.sandboxId, ctx);

    if (!sandboxId) {
      return {
        success: false,
        pass: false,
        score: 0,
        checks: {
          animationPlaying: { pass: false, note: 'No sandbox' },
          colorScheme: { pass: false, note: 'No sandbox' },
          typography: { pass: false, note: 'No sandbox' },
          effects: { pass: false, note: 'No sandbox' },
          timing: { pass: false, note: 'No sandbox' },
          overallQuality: { pass: false, note: 'No sandbox' },
        },
        summary: 'No active sandbox.',
        fixInstructions: '',
        error: 'No active sandbox. Create one first with sandbox_create.',
      };
    }

    try {
      // Step 1: Read rendered video from sandbox (hardcoded path — no LLM hallucination)
      console.log(`[verify_animation] Reading output/final.mp4 from sandbox ${sandboxId}...`);
      const videoBuffer = await readSandboxFileRaw(sandboxId, 'output/final.mp4');
      console.log(`[verify_animation] Video size: ${Math.round(videoBuffer.length / 1024)}KB`);

      if (videoBuffer.length < 1000) {
        return {
          success: false,
          pass: false,
          score: 0,
          checks: {
            animationPlaying: { pass: false, note: 'Video file is empty or corrupted' },
            colorScheme: { pass: false, note: 'Cannot analyze' },
            typography: { pass: false, note: 'Cannot analyze' },
            effects: { pass: false, note: 'Cannot analyze' },
            timing: { pass: false, note: 'Cannot analyze' },
            overallQuality: { pass: false, note: 'Cannot analyze' },
          },
          summary: 'Video file is empty or corrupted.',
          fixInstructions: 'The render produced an empty/corrupted video. Check for render errors and re-render.',
          error: `Video file too small (${videoBuffer.length} bytes)`,
        };
      }

      // Step 2: Build multimodal content for Gemini Flash
      const base64Video = videoBuffer.toString('base64');
      const prompt = VERIFICATION_PROMPT
        .replace('{userIntent}', input.userIntent)
        .replace('{designSpec}', input.designSpec || 'No specific design spec provided')
        .replace('{duration}', String(input.duration));

      // AI SDK v5 format — Mastra's memory pipeline requires `data` + `mediaType` (not `file.base64`)
      const videoContent: Array<{ type: 'file'; data: string; mediaType: string } | { type: 'text'; text: string }> = [
        {
          type: 'file',
          data: base64Video,
          mediaType: 'video/mp4',
        },
        {
          type: 'text',
          text: prompt,
        },
      ];

      // Step 3: Call Gemini Flash for video analysis
      console.log(`[verify_animation] Sending ${Math.round(base64Video.length / 1024)}KB video to Gemini Flash...`);
      const result = await videoVerifier.generate([
        {
          role: 'user',
          content: videoContent,
        },
      ]);

      const responseText = result.text || '';
      console.log(`[verify_animation] Response: ${responseText.slice(0, 200)}...`);

      // Step 4: Parse structured JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[verify_animation] Failed to parse JSON from response`);
        return {
          success: false,
          pass: false,
          score: 0,
          checks: {
            animationPlaying: { pass: false, note: 'Parse error' },
            colorScheme: { pass: false, note: 'Parse error' },
            typography: { pass: false, note: 'Parse error' },
            effects: { pass: false, note: 'Parse error' },
            timing: { pass: false, note: 'Parse error' },
            overallQuality: { pass: false, note: 'Parse error' },
          },
          summary: 'Failed to parse verification response.',
          fixInstructions: '',
          error: 'Failed to parse structured response from Gemini',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Derive pass from score if not explicitly set
      const score = typeof parsed.score === 'number' ? parsed.score : 0;
      const pass = typeof parsed.pass === 'boolean' ? parsed.pass : score >= 7;

      // Get permanent video URL from RequestContext
      const lastVideoUrl = ctx?.requestContext?.get('lastVideoUrl') as string | undefined;

      const checks = {
        animationPlaying: parsed.checks?.animationPlaying || { pass: false, note: 'Not evaluated' },
        colorScheme: parsed.checks?.colorScheme || { pass: false, note: 'Not evaluated' },
        typography: parsed.checks?.typography || { pass: false, note: 'Not evaluated' },
        effects: parsed.checks?.effects || { pass: false, note: 'Not evaluated' },
        timing: parsed.checks?.timing || { pass: false, note: 'Not evaluated' },
        overallQuality: parsed.checks?.overallQuality || { pass: false, note: 'Not evaluated' },
      };

      console.log(`[verify_animation] Result: pass=${pass}, score=${score}, summary="${parsed.summary?.slice(0, 80)}"`);

      return {
        success: true,
        pass,
        score,
        checks,
        summary: parsed.summary || '',
        fixInstructions: parsed.fixInstructions || '',
        videoUrl: lastVideoUrl,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[verify_animation] Error: ${errMsg}`);
      return {
        success: false,
        pass: false,
        score: 0,
        checks: {
          animationPlaying: { pass: false, note: 'Error' },
          colorScheme: { pass: false, note: 'Error' },
          typography: { pass: false, note: 'Error' },
          effects: { pass: false, note: 'Error' },
          timing: { pass: false, note: 'Error' },
          overallQuality: { pass: false, note: 'Error' },
        },
        summary: `Verification failed: ${errMsg}`,
        fixInstructions: '',
        error: errMsg,
      };
    }
  },
});
