import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { runAnimationSkill } from '@/mastra/skills/animation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
 type ToolContext = { requestContext?: { get: (key: string) => any; set: (key: string, value: any) => void } };

export const skillRecoverTool = createTool({
  id: 'skill_recover',
  description: 'Classify a failure and return the safest next action (single-step recovery).',
  inputSchema: z.object({
    errorMessage: z.string().describe('Raw error message to classify'),
    sandboxId: z.string().optional(),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    summary: z.string(),
    retryable: z.boolean().optional(),
    fatal: z.boolean().optional(),
    nextHints: z.array(z.string()).optional(),
    errorClass: z.string().optional(),
  }),
  execute: async (input, context) => {
    const ctx = context as ToolContext;
    const result = await runAnimationSkill('recover', {
      action: 'classify_error',
      sandboxId: input.sandboxId || (ctx?.requestContext?.get('sandboxId') as string | undefined),
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
      requestContext: ctx?.requestContext,
      payload: { errorMessage: input.errorMessage },
    });

    return {
      ok: result.ok,
      summary: result.summary || 'Recovery classification completed',
      retryable: result.retryable,
      fatal: result.fatal,
      nextHints: result.nextHints,
      errorClass: result.errorClass,
    };
  },
});

export const skillMediaPrepareTool = createTool({
  id: 'skill_media_prepare',
  description: 'Normalize and deduplicate media references for code generation.',
  inputSchema: z.object({
    mediaFiles: z.array(
      z.object({
        path: z.string(),
        type: z.enum(['image', 'video']),
        description: z.string().optional(),
        name: z.string().optional(),
      })
    ),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    summary: z.string(),
    mediaFiles: z.array(
      z.object({
        path: z.string(),
        type: z.enum(['image', 'video']),
        description: z.string().optional(),
      })
    ),
  }),
  execute: async (input, context) => {
    const ctx = context as ToolContext;
    const result = await runAnimationSkill('media_prepare', {
      action: 'build_media_files',
      requestContext: ctx?.requestContext,
      payload: { mediaFiles: input.mediaFiles },
    });

    const mediaFiles = (Array.isArray(result.artifacts?.mediaFiles)
      ? result.artifacts?.mediaFiles
      : input.mediaFiles) as Array<{ path: string; type: 'image' | 'video'; description?: string }>;

    return {
      ok: result.ok,
      summary: result.summary || `Prepared ${mediaFiles.length} media file(s)`,
      mediaFiles,
    };
  },
});
