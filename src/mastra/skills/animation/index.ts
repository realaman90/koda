import type { AnimationSkillId, AnimationSkillInput, AnimationSkillResult } from './types';
import { clearSkillRegistry, registerSkill, runSkill } from './registry';
import { intentSkill } from './intent-skill';
import { planSkill } from './plan-skill';
import { mediaPrepareSkill } from './media-prepare-skill';
import { sandboxSkill } from './sandbox-skill';
import { codegenSkill } from './codegen-skill';
import { verifySkill } from './verify-skill';
import { renderSkill } from './render-skill';
import { recoverSkill } from './recover-skill';

let initialized = false;

export function registerDefaultAnimationSkills(): void {
  if (initialized) return;
  initialized = true;

  registerSkill(intentSkill);
  registerSkill(planSkill);
  registerSkill(mediaPrepareSkill);
  registerSkill(sandboxSkill);
  registerSkill(codegenSkill);
  registerSkill(verifySkill);
  registerSkill(renderSkill);
  registerSkill(recoverSkill);
}

export async function runAnimationSkill(
  skillId: AnimationSkillId,
  input: AnimationSkillInput,
): Promise<AnimationSkillResult> {
  registerDefaultAnimationSkills();
  return runSkill(skillId, input);
}

export function resetAnimationSkillRegistryForTests(): void {
  initialized = false;
  clearSkillRegistry();
}

export * from './types';
export * from './codegen-skill';
export * from './registry';
