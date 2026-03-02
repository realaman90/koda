import type { AnimationSkill, AnimationSkillInput } from './types';

type PlanScene = {
  number: number;
  title: string;
  duration: number;
  description: string;
};

function generateTodos(plan: {
  scenes: PlanScene[];
}, engine: 'remotion' | 'theatre'): Array<{ id: string; label: string; status: 'pending' | 'active' | 'done' }> {
  const setupLabel = engine === 'remotion' ? 'Set up Remotion project' : 'Set up Theatre.js project';
  const todos: Array<{ id: string; label: string; status: 'pending' | 'active' | 'done' }> = [
    { id: 'setup', label: setupLabel, status: 'pending' },
  ];

  for (const scene of plan.scenes) {
    todos.push({
      id: `scene-${scene.number}`,
      label: `Create Scene ${scene.number} (${scene.title})`,
      status: 'pending',
    });
  }

  todos.push(
    { id: 'postprocess', label: 'Add post-processing effects', status: 'pending' },
    { id: 'render', label: 'Render preview', status: 'pending' },
  );

  return todos;
}

function enforceDuration(input: AnimationSkillInput, totalDuration: number, scenes: PlanScene[]) {
  const ctxDuration = (input.requestContext?.get('duration') as number | undefined) ?? input.duration;
  if (!ctxDuration || ctxDuration === totalDuration) {
    return { totalDuration, scenes };
  }

  const scale = ctxDuration / totalDuration;
  const scaledScenes = scenes.map((scene) => ({
    ...scene,
    duration: Math.max(1.5, Math.round(scene.duration * scale * 10) / 10),
  }));

  return {
    totalDuration: ctxDuration,
    scenes: scaledScenes,
  };
}

export const planSkill: AnimationSkill = {
  id: 'plan',
  run: async (input) => {
    const payload = input.payload || {};
    const scenes = Array.isArray(payload.scenes) ? (payload.scenes as PlanScene[]) : [];
    const totalDurationRaw = Number(payload.totalDuration || input.duration || 0);
    const style = String(payload.style || 'smooth');
    const fps = Number(payload.fps || input.fps || (input.requestContext?.get('fps') as number | undefined) || 30);

    if (!scenes.length || !totalDurationRaw) {
      return {
        ok: false,
        fatal: true,
        errorClass: 'ValidationError',
        summary: 'Plan skill requires scenes and totalDuration',
      };
    }

    const adjusted = enforceDuration(input, totalDurationRaw, scenes);
    const engine = (input.engine || (input.requestContext?.get('engine') as 'remotion' | 'theatre' | undefined) || 'remotion');

    return {
      ok: true,
      summary: 'Plan generated',
      updates: {
        plan: {
          scenes: adjusted.scenes,
          totalDuration: adjusted.totalDuration,
          style,
          fps,
          designSpec: payload.designSpec,
          motionSpec: payload.motionSpec,
        },
        todos: generateTodos({ scenes: adjusted.scenes }, engine),
      },
    };
  },
};
