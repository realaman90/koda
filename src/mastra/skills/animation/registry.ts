import type { AnimationSkill, AnimationSkillId, AnimationSkillInput, AnimationSkillResult } from './types';
import { assertAllowedTransition, assertPrerequisites, SkillGuardError } from './guards';
import { withSkillMetrics } from './metrics';

const registry = new Map<AnimationSkillId, AnimationSkill>();

export function registerSkill(skill: AnimationSkill): void {
  registry.set(skill.id, skill);
}

export function getSkill(skillId: AnimationSkillId): AnimationSkill | undefined {
  return registry.get(skillId);
}

export function clearSkillRegistry(): void {
  registry.clear();
}

export async function runSkill(skillId: AnimationSkillId, input: AnimationSkillInput): Promise<AnimationSkillResult> {
  const skill = registry.get(skillId);
  if (!skill) {
    return {
      ok: false,
      fatal: true,
      summary: `Animation skill not registered: ${skillId}`,
      errorClass: 'ToolContractError',
    };
  }

  return withSkillMetrics(skillId, async () => {
    try {
      assertAllowedTransition(input.phase, skillId);
      assertPrerequisites(skillId, input);
      return await skill.run(input);
    } catch (error) {
      if (error instanceof SkillGuardError) {
        return {
          ok: false,
          fatal: error.errorClass !== 'ValidationError',
          retryable: error.errorClass === 'ValidationError',
          summary: error.message,
          errorClass: error.errorClass,
        };
      }

      return {
        ok: false,
        fatal: true,
        summary: error instanceof Error ? error.message : String(error),
        errorClass: 'ToolContractError',
      };
    }
  });
}
