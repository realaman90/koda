/**
 * Animation Planning Tools
 *
 * Lightweight tools for analyzing prompts and structuring animation plans.
 * The agent's own reasoning drives the planning — these tools just
 * validate input and structure the output into the expected schema.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { runAnimationSkill } from '@/mastra/skills/animation';

// Schemas
export const StyleOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const QuestionSchema = z.object({
  text: z.string(),
  options: z.array(StyleOptionSchema),
  customInput: z.boolean().optional(),
});

export const SceneSchema = z.object({
  number: z.number(),
  title: z.string(),
  duration: z.number(),
  description: z.string(),
  animationNotes: z.string().optional(),
});

export const PlanSchema = z.object({
  scenes: z.array(SceneSchema),
  totalDuration: z.number(),
  style: z.string(),
  fps: z.number().default(30),
  designSpec: z.string().optional().describe('Full design specification with exact colors, typography, spring configs, and effects'),
  motionSpec: z.object({
    chips: z.object({
      energy: z.enum(['calm', 'medium', 'energetic']),
      feel: z.enum(['smooth', 'snappy', 'bouncy']),
      camera: z.enum(['static', 'subtle', 'dynamic']),
      transitions: z.enum(['minimal', 'cinematic']),
    }),
    sliders: z.object({
      speed: z.number(),
      intensity: z.number(),
      smoothness: z.number(),
      cameraActivity: z.number(),
      transitionAggressiveness: z.number(),
    }),
    variant: z.enum(['safe', 'balanced', 'dramatic']),
    source: z.string().optional(),
    followUp: z.string().optional(),
    holdFinalFrameSeconds: z.number().optional(),
  }).optional().describe('Structured motion profile from guided chips/variants/sliders'),
});

export const TodoSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['pending', 'active', 'done']),
});

// Default style question presented when clarification is needed
export const DEFAULT_STYLE_QUESTION = {
  text: 'What animation style would you like?',
  options: [
    { id: 'playful', label: 'Playful & bouncy', description: 'Fast, snappy with overshoot' },
    { id: 'smooth', label: 'Smooth & minimal', description: 'Subtle, flowing movements' },
    { id: 'cinematic', label: 'Cinematic & dramatic', description: 'Building tension, camera moves' },
  ],
  customInput: true,
};

/**
 * analyze_prompt — The agent decides whether clarification is needed.
 * This tool structures the agent's decision into a format the frontend expects.
 */
export const analyzePromptTool = createTool({
  id: 'analyze_prompt',
  description: `Analyze the user's animation prompt. Use this tool to communicate your analysis back to the frontend.

If clarification is needed, set needsClarification=true and provide a question with options.
If the style is clear, set needsClarification=false and provide the inferred style.

The frontend uses this structured output to show the right UI (question phase vs plan phase).`,
  inputSchema: z.object({
    prompt: z.string().describe('User animation prompt'),
    needsClarification: z.boolean().describe('Whether the user needs to clarify their request'),
    inferredStyle: z.string().optional().describe('The style you inferred (if needsClarification is false)'),
    question: QuestionSchema.optional().describe('Question to ask the user (if needsClarification is true)'),
    reason: z.string().describe('Brief explanation of your analysis'),
  }),
  outputSchema: z.object({
    needsClarification: z.boolean(),
    reason: z.string(),
    question: QuestionSchema.optional(),
    inferredStyle: z.string().optional(),
  }),
  execute: async (inputData) => {
    const skillResult = await runAnimationSkill('intent', {
      action: 'analyze_prompt',
      payload: inputData as unknown as Record<string, unknown>,
    });

    const updates = skillResult.updates || {};
    return {
      needsClarification: Boolean(updates.needsClarification ?? inputData.needsClarification),
      reason: String(updates.reason ?? inputData.reason),
      question: (updates.needsClarification ?? inputData.needsClarification)
        ? ((updates.question as z.infer<typeof QuestionSchema> | undefined) || inputData.question || {
          text: DEFAULT_STYLE_QUESTION.text,
          options: DEFAULT_STYLE_QUESTION.options,
          customInput: true,
        })
        : undefined,
      inferredStyle: (updates.inferredStyle as string | undefined) ?? inputData.inferredStyle,
    };
  },
});

/**
 * Helper: Generate todos from plan
 */
export function generateTodosFromPlan(
  plan: z.infer<typeof PlanSchema>,
  engine: 'remotion' | 'theatre' = 'remotion'
): z.infer<typeof TodoSchema>[] {
  const setupLabel = engine === 'remotion' ? 'Set up Remotion project' : 'Set up Theatre.js project';
  const todos: z.infer<typeof TodoSchema>[] = [
    { id: 'setup', label: setupLabel, status: 'pending' },
  ];

  plan.scenes.forEach((scene) => {
    todos.push({
      id: `scene-${scene.number}`,
      label: `Create Scene ${scene.number} (${scene.title})`,
      status: 'pending',
    });
  });

  todos.push(
    { id: 'postprocess', label: 'Add post-processing effects', status: 'pending' },
    { id: 'render', label: 'Render preview', status: 'pending' }
  );

  return todos;
}

/**
 * generate_plan — The agent creates the plan content.
 * This tool validates and structures it into the expected schema,
 * and auto-generates the todo list from the plan's scenes.
 */
export const generatePlanTool = createTool({
  id: 'generate_plan',
  description: `Generate a detailed animation plan with scene breakdown AND a complete design specification.

Provide the full plan with scenes. Each scene needs: number, title, duration (min 1.5s), description.
Rules:
- 3-7 scenes total
- CRITICAL: Use the target duration from the user's context. The user explicitly set this value.
- Scene structure: Intro (enter) → Main (action) → Outro (exit)

The designSpec should include:
- Color palette with exact hex codes (background, primary, accent, text colors)
- Typography specs (font family, sizes, weights)
- Motion design (spring configs, easing curves, timing)
- Effects (gradients, glows, shadows, particles)

This designSpec will be passed directly to the code generator — be specific with exact values.
This tool validates your plan and generates the todo list for execution.`,
  inputSchema: z.object({
    scenes: z.array(SceneSchema).describe('Array of animation scenes'),
    totalDuration: z.number().describe('Total animation duration in seconds'),
    style: z.string().describe('Animation style (e.g. playful, smooth, cinematic)'),
    fps: z.number().optional().describe('Frames per second (default 30)'),
    designSpec: z.string().optional().describe('Complete design specification with colors, typography, motion design, and effects'),
    motionSpec: PlanSchema.shape.motionSpec.optional(),
  }),
  outputSchema: z.object({
    plan: PlanSchema,
    todos: z.array(TodoSchema),
  }),
  execute: async (inputData, context) => {
    const rc = (context as { requestContext?: { get: (key: string) => unknown; set: (key: string, value: unknown) => void } })?.requestContext;
    const engine = ((rc?.get('engine') as string | undefined) === 'theatre' ? 'theatre' : 'remotion') as 'remotion' | 'theatre';
    const phase = (rc?.get('phase') as 'idle' | 'question' | 'plan' | 'executing' | 'preview' | 'complete' | 'error' | undefined) || 'plan';
    const planAccepted = (rc?.get('planAccepted') as boolean | undefined);

    const skillResult = await runAnimationSkill('plan', {
      action: 'generate_plan',
      engine,
      phase,
      planAccepted,
      duration: inputData.totalDuration,
      fps: inputData.fps,
      requestContext: rc,
      payload: inputData as unknown as Record<string, unknown>,
    });

    if (!skillResult.ok || !skillResult.updates?.plan) {
      const fallbackPlan = {
        scenes: inputData.scenes,
        totalDuration: inputData.totalDuration,
        style: inputData.style,
        fps: inputData.fps || ((rc?.get('fps') as number | undefined) || 30),
        designSpec: inputData.designSpec,
        motionSpec: inputData.motionSpec,
      };
      return { plan: fallbackPlan, todos: generateTodosFromPlan(fallbackPlan, engine) };
    }

    const skillPlan = skillResult.updates.plan as z.infer<typeof PlanSchema>;
    const skillTodos = skillResult.updates.todos as z.infer<typeof TodoSchema>[] | undefined;
    return { plan: skillPlan, todos: skillTodos || generateTodosFromPlan(skillPlan, engine) };
  },
});
