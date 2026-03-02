import type { AnimationPhase, AnimationSkillId, AnimationSkillInput, SkillErrorClass } from './types';

const ALLOWED_PHASES: Record<AnimationSkillId, AnimationPhase[]> = {
  intent: ['idle', 'question', 'plan', 'executing'],
  plan: ['idle', 'question', 'plan'],
  media_prepare: ['idle', 'plan', 'executing'],
  sandbox: ['executing', 'preview'],
  codegen: ['executing'],
  verify: ['preview', 'executing'],
  render: ['executing', 'preview'],
  recover: ['executing', 'preview', 'error'],
};

export class SkillGuardError extends Error {
  errorClass: SkillErrorClass;

  constructor(message: string, errorClass: SkillErrorClass = 'ValidationError') {
    super(message);
    this.name = 'SkillGuardError';
    this.errorClass = errorClass;
  }
}

export function assertAllowedTransition(currentPhase: AnimationPhase | undefined, skillId: AnimationSkillId): void {
  if (!currentPhase) return;
  const allowed = ALLOWED_PHASES[skillId] || [];
  if (!allowed.includes(currentPhase)) {
    throw new SkillGuardError(
      `Skill "${skillId}" is not allowed in phase "${currentPhase}"`,
      'ValidationError'
    );
  }
}

export function assertPrerequisites(skillId: AnimationSkillId, input: AnimationSkillInput): void {
  if (skillId === 'sandbox' || skillId === 'codegen' || skillId === 'render') {
    if (input.planAccepted === false) {
      throw new SkillGuardError(
        `Skill "${skillId}" requires an approved plan before execution`,
        'ValidationError'
      );
    }
  }

  const skipSandboxRequirement = skillId === 'codegen'
    && (input.action === 'preflight' || input.action === 'transport_error' || input.action === 'success');
  if (!skipSandboxRequirement && (skillId === 'codegen' || skillId === 'render' || skillId === 'verify')) {
    const sandboxId = input.sandboxId || (input.requestContext?.get('sandboxId') as string | undefined);
    if (!sandboxId) {
      throw new SkillGuardError(
        `Skill "${skillId}" requires an active sandbox`,
        'SandboxUnavailableError'
      );
    }
  }

  const skipRenderActiveCheck = skillId === 'render'
    && (input.action === 'prepare_render');
  if (skillId === 'render' && !skipRenderActiveCheck) {
    const active = (input.requestContext?.get('codeGenActive') as number | undefined) || 0;
    if (active > 0) {
      throw new SkillGuardError('Render blocked while code generation is in progress', 'ValidationError');
    }
  }
}
