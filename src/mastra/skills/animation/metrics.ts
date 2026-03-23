import type { AnimationSkillId, AnimationSkillResult } from './types';

export async function withSkillMetrics(
  skillId: AnimationSkillId,
  fn: () => Promise<AnimationSkillResult>
): Promise<AnimationSkillResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      ...result,
      metrics: {
        skillId,
        durationMs: Date.now() - start,
        ok: result.ok,
        retryable: result.retryable,
        fatal: result.fatal,
        errorClass: result.errorClass,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      fatal: true,
      summary: message,
      errorClass: 'ToolContractError',
      metrics: {
        skillId,
        durationMs: Date.now() - start,
        ok: false,
        fatal: true,
        errorClass: 'ToolContractError',
      },
    };
  }
}
