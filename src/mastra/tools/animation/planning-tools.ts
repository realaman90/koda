/**
 * Animation Planning Tools
 *
 * Lightweight tools for analyzing prompts and structuring animation plans.
 * The agent's own reasoning drives the planning — these tools just
 * validate input and structure the output into the expected schema.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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
  fps: z.number().default(60),
  designSpec: z.string().optional().describe('Full design specification with exact colors, typography, spring configs, and effects'),
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
    // Pass through the agent's analysis — the agent does the reasoning,
    // this tool just structures it for the frontend.
    return {
      needsClarification: inputData.needsClarification,
      reason: inputData.reason,
      question: inputData.needsClarification ? (inputData.question || {
        text: DEFAULT_STYLE_QUESTION.text,
        options: DEFAULT_STYLE_QUESTION.options,
        customInput: true,
      }) : undefined,
      inferredStyle: inputData.inferredStyle,
    };
  },
});

/**
 * Helper: Generate todos from plan
 */
export function generateTodosFromPlan(plan: z.infer<typeof PlanSchema>): z.infer<typeof TodoSchema>[] {
  const todos: z.infer<typeof TodoSchema>[] = [
    { id: 'setup', label: 'Set up Theatre.js project', status: 'pending' },
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
- Total duration: 5-10s for simple animations, 10-30s for complex
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
    fps: z.number().optional().describe('Frames per second (default 60)'),
    designSpec: z.string().optional().describe('Complete design specification with colors, typography, motion design, and effects'),
  }),
  outputSchema: z.object({
    plan: PlanSchema,
    todos: z.array(TodoSchema),
  }),
  execute: async (inputData) => {
    const plan = {
      scenes: inputData.scenes,
      totalDuration: inputData.totalDuration,
      style: inputData.style,
      fps: inputData.fps || 60,
      designSpec: inputData.designSpec,
    };

    return { plan, todos: generateTodosFromPlan(plan) };
  },
});
