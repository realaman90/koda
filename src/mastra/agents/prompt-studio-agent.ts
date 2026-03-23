/**
 * Prompt Studio Agent
 *
 * Mastra agent for creative direction and prompt engineering.
 * Generates production-quality prompts for image/video generation models.
 * No sandbox needed — pure creative intelligence + text generation.
 */

import { Agent } from '@mastra/core/agent';
import { PROMPT_STUDIO_INSTRUCTIONS } from './instructions/prompt-studio';
import { PROMPT_STUDIO_MODEL } from '../models';
import {
  setThinkingTool,
  generatePromptTool,
  askQuestionsTool,
  webSearchTool,
} from '../tools/prompt-studio';

export const promptStudioAgent = new Agent({
  id: 'prompt-studio',
  name: 'Prompt Studio',
  instructions: PROMPT_STUDIO_INSTRUCTIONS,
  model: PROMPT_STUDIO_MODEL,
  tools: {
    set_thinking: setThinkingTool,
    generate_prompt: generatePromptTool,
    ask_questions: askQuestionsTool,
    search_web: webSearchTool,
  },
});
