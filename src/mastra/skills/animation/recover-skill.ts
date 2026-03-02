import type { AnimationSkill } from './types';
import { isUpstreamTransportError } from './codegen-skill';

export const recoverSkill: AnimationSkill = {
  id: 'recover',
  run: async (input) => {
    const errorMessage = String(input.payload?.errorMessage || input.metadata?.error || 'Unknown error');

    if (isUpstreamTransportError(errorMessage)) {
      return {
        ok: false,
        retryable: true,
        fatal: false,
        errorClass: 'UpstreamTransportError',
        summary: 'Detected upstream transport failure. Retry once, then stop and ask user to retry.',
        nextHints: ['retry_once', 'stop_after_second_failure'],
      };
    }

    if (/sandbox|no active sandbox|not running/i.test(errorMessage)) {
      return {
        ok: false,
        retryable: true,
        fatal: false,
        errorClass: 'SandboxUnavailableError',
        summary: 'Sandbox is unavailable. Recreate sandbox and retry.',
        nextHints: ['sandbox_create', 'retry_step'],
      };
    }

    return {
      ok: false,
      retryable: false,
      fatal: true,
      errorClass: 'ToolContractError',
      summary: 'Unclassified failure. Stop and request user guidance.',
      nextHints: ['ask_user_guidance'],
    };
  },
};
