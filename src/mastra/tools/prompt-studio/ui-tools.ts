/**
 * UI Tools for Prompt Studio
 *
 * Lightweight "no-op" tools — the real work happens in the frontend
 * when it processes the tool-call SSE events.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * set_thinking - Update the thinking/status message
 */
export const setThinkingTool = createTool({
  id: 'set_thinking',
  description: 'Set the thinking/status message shown to the user. Use this to show your creative process.',
  inputSchema: z.object({
    message: z.string().describe('The thinking/status message'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async () => {
    return { success: true };
  },
});

/**
 * generate_prompt - Generate a production-quality prompt
 *
 * This is the primary output tool. The frontend reads the tool-call args
 * to display the prompt card and propagate through the output handle.
 */
export const generatePromptTool = createTool({
  id: 'generate_prompt',
  description: 'Generate a polished, production-quality prompt for image or video generation. Always use this tool to output prompts — it makes them copyable and sends them to connected nodes.',
  inputSchema: z.object({
    prompt: z.string().describe('The full optimized prompt text'),
    targetModel: z.string().describe('Target model label shown in UI. Default to "Auto (Image)" or "Auto (Video)" unless user explicitly requests a specific model. Auto maps to Nano Banana 2 for images and Seedance 2.0 Fast for video.'),
    label: z.string().optional().describe('Short label for the prompt card (e.g. "Main Shot", "Variation A", "Close-up")'),
    negativePrompt: z.string().optional().describe('Negative prompt (for models that support it like SD/SDXL)'),
    parameters: z.record(z.string(), z.string()).optional().describe('Model-specific parameters (e.g. {"--ar": "16:9", "--style": "raw"} for Midjourney)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    promptId: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      promptId: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  },
});

/**
 * ask_questions - Ask the user clarifying questions with suggested options
 *
 * Renders as interactive clickable chips in the chat UI.
 * User taps options → auto-sends response. Much better than plain text questions.
 */
export const askQuestionsTool = createTool({
  id: 'ask_questions',
  description: 'Ask the user clarifying questions with clickable suggested options. Use this instead of writing questions as plain text. The UI renders interactive chips the user can click. Keep questions about creative direction (subject, mood, lighting, composition, style). Do not ask about model choice unless the user explicitly requests model control. IMPORTANT: After calling this tool, STOP. Do not call generate_prompt in the same turn — wait for user answers.',
  inputSchema: z.object({
    questions: z.array(z.object({
      id: z.string().describe('Unique ID for the question (e.g. "subject", "mood", "lighting")'),
      question: z.string().describe('The question text'),
      suggestions: z.array(z.string()).describe('Clickable option chips (3-6 options). Keep labels short (1-4 words).'),
    })).min(1).max(5).describe('Array of questions to ask'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    questionSetId: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      questionSetId: `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  },
});
