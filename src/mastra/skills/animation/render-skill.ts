import { getContextValue } from './context';
import type { AnimationSkill } from './types';

export const renderSkill: AnimationSkill = {
  id: 'render',
  run: async (input) => {
    const action = input.action || 'preflight_render';

    if (action === 'prepare_render') {
      const ctx = input.requestContext;
      let active = getContextValue<number>(ctx, 'codeGenActive') || 0;
      if (active > 0 && ctx) {
        console.log(`[render-skill] Code generation in progress (codeGenActive=${active}) — waiting...`);
        for (let i = 0; i < 120; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          active = getContextValue<number>(ctx, 'codeGenActive') || 0;
          if (active === 0) {
            console.log(`[render-skill] Code generation finished after ${(i + 1) * 0.5}s`);
            break;
          }
          if (getContextValue<boolean>(ctx, 'streamClosed')) {
            return {
              ok: false,
              retryable: false,
              fatal: false,
              errorClass: 'ValidationError',
              summary: 'Stream closed during code generation wait.',
            };
          }
          if (i === 119) {
            console.warn(`[render-skill] Timed out waiting for code generation after 60s — proceeding anyway`);
          }
        }
      }

      return {
        ok: true,
        summary: active > 0
          ? 'Render preparation completed (proceeded after wait timeout)'
          : 'Render preparation completed',
        updates: {
          codeGenActive: active,
        },
      };
    }

    const active = getContextValue<number>(input.requestContext, 'codeGenActive') || 0;
    if (active > 0) {
      return {
        ok: false,
        retryable: true,
        fatal: false,
        errorClass: 'ValidationError',
        summary: 'Render blocked while code generation is still active',
      };
    }

    return {
      ok: true,
      summary: 'Render skill preflight passed',
    };
  },
};
