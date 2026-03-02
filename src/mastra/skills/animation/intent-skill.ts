import type { AnimationSkill } from './types';

export const intentSkill: AnimationSkill = {
  id: 'intent',
  run: async (input) => {
    const payload = input.payload || {};
    const needsClarification = Boolean(payload.needsClarification);

    return {
      ok: true,
      updates: {
        needsClarification,
        inferredStyle: payload.inferredStyle,
        question: payload.question,
        reason: payload.reason,
      },
      summary: needsClarification ? 'Clarification required' : 'Intent resolved',
    };
  },
};
