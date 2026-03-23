import { Agent } from '@mastra/core/agent';
import { readSandboxFileRaw } from '@/lib/sandbox/sandbox-factory';
import { VIDEO_ANALYZER_MODEL } from '@/mastra/models';
import type { AnimationSkill } from './types';

type VerificationChecks = {
  animationPlaying: { pass: boolean; note: string };
  colorScheme: { pass: boolean; note: string };
  typography: { pass: boolean; note: string };
  effects: { pass: boolean; note: string };
  timing: { pass: boolean; note: string };
  overallQuality: { pass: boolean; note: string };
};

type VerificationResult = {
  success: boolean;
  pass: boolean;
  score: number;
  checks: VerificationChecks;
  summary: string;
  fixInstructions: string;
  videoUrl?: string;
  error?: string;
};

const videoVerifier = new Agent({
  id: 'video-verifier',
  name: 'video-verifier',
  instructions: `You are a quality-assurance expert for rendered animation videos.
You receive a video file and verify it against the user's intent and design specifications.
Always return ONLY valid JSON matching the requested schema. No markdown, no extra text.
Be strict but fair — the goal is to catch real issues, not nitpick.`,
  model: VIDEO_ANALYZER_MODEL,
});

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

const buildChecks = (note: string, pass = false): VerificationChecks => ({
  animationPlaying: { pass, note },
  colorScheme: { pass, note },
  typography: { pass, note },
  effects: { pass, note },
  timing: { pass, note },
  overallQuality: { pass, note },
});

const buildFailure = (summary: string, error: string, videoUrl?: string): VerificationResult => ({
  success: false,
  pass: false,
  score: 0,
  checks: buildChecks('Error'),
  summary,
  fixInstructions: '',
  error,
  videoUrl,
});

export const verifySkill: AnimationSkill = {
  id: 'verify',
  run: async (input) => {
    const action = input.action || 'preflight_verify';
    if (action !== 'verify_video') {
      return {
        ok: true,
        summary: 'Verification skill preflight passed',
      };
    }

    const sandboxId = input.sandboxId || (input.requestContext?.get('sandboxId') as string | undefined);
    const lastVideoUrl = input.requestContext?.get('lastVideoUrl') as string | undefined;
    if (!sandboxId) {
      const verification = buildFailure('No active sandbox.', 'No active sandbox.', lastVideoUrl);
      verification.checks = buildChecks('No sandbox');
      return {
        ok: false,
        retryable: true,
        fatal: false,
        errorClass: 'SandboxUnavailableError',
        summary: verification.summary,
        artifacts: { verification },
      };
    }

    try {
      const videoPathRaw = typeof input.payload?.videoPath === 'string' ? input.payload.videoPath : 'output/final.mp4';
      const videoPath = videoPathRaw.startsWith('/app/') ? videoPathRaw.slice('/app/'.length) : videoPathRaw;
      const videoBuffer = await readSandboxFileRaw(sandboxId, videoPath);

      if (videoBuffer.length < 1000) {
        const verification: VerificationResult = {
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
          videoUrl: lastVideoUrl,
          error: `Video file too small (${videoBuffer.length} bytes)`,
        };
        return {
          ok: false,
          retryable: true,
          fatal: false,
          errorClass: 'ValidationError',
          summary: verification.summary,
          artifacts: { verification },
        };
      }

      const prompt = VERIFICATION_PROMPT
        .replace('{userIntent}', String(input.payload?.userIntent || input.prompt || 'No user intent provided'))
        .replace('{designSpec}', String(input.payload?.designSpec || 'No specific design spec provided'))
        .replace('{duration}', String(input.duration ?? input.payload?.duration ?? 0));

      const result = await videoVerifier.generate([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: videoBuffer.toString('base64'),
              mediaType: 'video/mp4',
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ]);

      const responseText = result.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        const verification = buildFailure(
          'Failed to parse verification response.',
          'Failed to parse structured response from verifier',
          lastVideoUrl,
        );
        verification.checks = buildChecks('Parse error');
        return {
          ok: false,
          retryable: true,
          fatal: false,
          errorClass: 'ValidationError',
          summary: verification.summary,
          artifacts: { verification },
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        const verification = buildFailure(
          'Failed to parse verification response.',
          'Invalid JSON in verifier response',
          lastVideoUrl,
        );
        verification.checks = buildChecks('Parse error');
        return {
          ok: false,
          retryable: true,
          fatal: false,
          errorClass: 'ValidationError',
          summary: verification.summary,
          artifacts: { verification },
        };
      }

      const parsedObj = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {};
      const parsedChecks = (parsedObj.checks && typeof parsedObj.checks === 'object')
        ? parsedObj.checks as Record<string, unknown>
        : {};

      const score = typeof parsedObj.score === 'number' ? parsedObj.score : 0;
      const pass = typeof parsedObj.pass === 'boolean' ? parsedObj.pass : score >= 7;
      const checks: VerificationChecks = {
        animationPlaying: (parsedChecks.animationPlaying as VerificationChecks['animationPlaying']) || { pass: false, note: 'Not evaluated' },
        colorScheme: (parsedChecks.colorScheme as VerificationChecks['colorScheme']) || { pass: false, note: 'Not evaluated' },
        typography: (parsedChecks.typography as VerificationChecks['typography']) || { pass: false, note: 'Not evaluated' },
        effects: (parsedChecks.effects as VerificationChecks['effects']) || { pass: false, note: 'Not evaluated' },
        timing: (parsedChecks.timing as VerificationChecks['timing']) || { pass: false, note: 'Not evaluated' },
        overallQuality: (parsedChecks.overallQuality as VerificationChecks['overallQuality']) || { pass: false, note: 'Not evaluated' },
      };

      const verification: VerificationResult = {
        success: true,
        pass,
        score,
        checks,
        summary: typeof parsedObj.summary === 'string' ? parsedObj.summary : '',
        fixInstructions: typeof parsedObj.fixInstructions === 'string' ? parsedObj.fixInstructions : '',
        videoUrl: lastVideoUrl,
      };

      return {
        ok: true,
        summary: `Verification completed (score=${score}, pass=${pass})`,
        artifacts: { verification },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const verification = buildFailure(`Verification failed: ${errMsg}`, errMsg, lastVideoUrl);
      return {
        ok: false,
        retryable: true,
        fatal: false,
        errorClass: 'ToolContractError',
        summary: verification.summary,
        artifacts: { verification },
      };
    }
  },
};
