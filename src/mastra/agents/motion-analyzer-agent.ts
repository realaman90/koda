/**
 * Motion Analyzer Agent
 *
 * Mastra agent for analyzing video motion design and generating animation prompts.
 * Uses Gemini Flash for video understanding, plus conversational tools for chat.
 * No sandbox needed — pure analysis + text generation.
 */

import { Agent } from '@mastra/core/agent';
import { MOTION_ANALYZER_INSTRUCTIONS } from './instructions/motion-analyzer';
import { ORCHESTRATOR_MODEL } from '../models';
import {
  // UI Tools
  setThinkingTool,
  addMessageTool,
  // Analysis
  analyzeVideoMotionTool,
  // Prompt Generation
  generateAnimationPromptTool,
} from '../tools/motion-analyzer';

// Reuse the media analysis tool from animation plugin
import { analyzeMediaTool } from '../tools/animation';

export const motionAnalyzerAgent = new Agent({
  id: 'motion-analyzer',
  name: 'Motion Analyzer',
  instructions: MOTION_ANALYZER_INSTRUCTIONS,
  model: ORCHESTRATOR_MODEL,
  tools: {
    // UI Tools
    set_thinking: setThinkingTool,
    add_message: addMessageTool,
    // Video Analysis (deep motion breakdown)
    analyze_video_motion: analyzeVideoMotionTool,
    // Media Analysis (reused — content understanding)
    analyze_media: analyzeMediaTool,
    // Prompt Generation
    generate_animation_prompt: generateAnimationPromptTool,
  },
});
