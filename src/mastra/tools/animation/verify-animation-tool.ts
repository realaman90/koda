/**
 * verify_animation Tool
 *
 * Thin adapter: delegates verification execution to verify-skill.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { runAnimationSkill } from '@/mastra/skills/animation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolContext = { requestContext?: { get: (key: string) => any; set: (key: string, value: any) => void } };

function resolveSandboxId(input: string | undefined, context?: ToolContext): string | undefined {
  return context?.requestContext?.get('sandboxId') || input || undefined;
}

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

const fallbackChecks = (note: string) => ({
  animationPlaying: { pass: false, note },
  colorScheme: { pass: false, note },
  typography: { pass: false, note },
  effects: { pass: false, note },
  timing: { pass: false, note },
  overallQuality: { pass: false, note },
});

export const verifyAnimationTool = createTool({
  id: 'verify_animation',
  description: `Verify a rendered animation video against user intent and design spec.
Call this AFTER render_final. The tool reads output/final.mp4 from the sandbox automatically.
Returns pass/fail, quality score (1-10), per-check results, and fix instructions if needed.`,
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

    const result = await runAnimationSkill('verify', {
      action: 'verify_video',
      prompt: input.userIntent,
      duration: input.duration,
      phase: (ctx?.requestContext?.get('phase') as
        | 'idle'
        | 'question'
        | 'plan'
        | 'executing'
        | 'preview'
        | 'complete'
        | 'error'
        | undefined),
      planAccepted: (ctx?.requestContext?.get('planAccepted') as boolean | undefined),
      sandboxId,
      requestContext: ctx?.requestContext,
      payload: {
        userIntent: input.userIntent,
        designSpec: input.designSpec,
        duration: input.duration,
        videoPath: 'output/final.mp4',
      },
      metadata: { toolName: 'verify_animation' },
    });

    const verification = result.artifacts?.verification as
      | {
        success?: boolean;
        pass?: boolean;
        score?: number;
        checks?: ReturnType<typeof fallbackChecks>;
        summary?: string;
        fixInstructions?: string;
        videoUrl?: string;
        error?: string;
      }
      | undefined;

    if (verification) {
      return {
        success: !!verification.success,
        pass: !!verification.pass,
        score: verification.score ?? 0,
        checks: verification.checks || fallbackChecks('Not evaluated'),
        summary: verification.summary || (result.summary || 'Verification completed'),
        fixInstructions: verification.fixInstructions || '',
        videoUrl: verification.videoUrl,
        error: verification.error,
      };
    }

    return {
      success: false,
      pass: false,
      score: 0,
      checks: fallbackChecks('Error'),
      summary: result.summary || 'Verification failed.',
      fixInstructions: '',
      videoUrl: (ctx?.requestContext?.get('lastVideoUrl') as string | undefined),
      error: result.summary || 'Verification failed',
    };
  },
});
