/**
 * generate_animation_prompt Tool
 *
 * Takes the motion analysis results and user preferences,
 * generates a detailed animation prompt suitable for the Animation Generator plugin.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const generateAnimationPromptTool = createTool({
  id: 'generate_animation_prompt',
  description: `Generate a precise, chronological animation prompt based on the video analysis.

Use this tool when:
- The user has seen the analysis and wants a prompt for the Animation Generator
- The user asks to "make something like this" or "create a similar animation"
- The user wants to replicate or adapt specific effects from the analyzed video

CRITICAL — The prompt MUST be a second-by-second SHOT LIST, not a style summary:
- WRONG: "Spring physics for all UI elements, staggered grid reveals, typewriter text"
- RIGHT: "0.0s: Black background #0A0A0F. 0.3s: 12 cards appear in 3x4 grid, each 140x90px, fill #14142B, border 1px #ffffff12, rounded 10px. Stagger: 45ms between cards, left→right top→bottom. Each card: scale 0.88→1.0, opacity 0→1, duration 0.35s, spring(180, 14). Card positions start at (60, 120), gap 16px."

Every visual element. Every timestamp. Every color hex. Every pixel value. Every easing curve.
The Animation Generator agent reads this like code — vague descriptions produce vague animations.`,

  inputSchema: z.object({
    analysisContext: z.string().describe('Chronological, second-by-second breakdown of what happens in the video. NOT a style summary — a timeline: "0.0s: X happens. 0.5s: Y appears at position (a,b) with color #hex..."'),
    userRequest: z.string().describe('The full prompt to pass to the Animation Generator — a shot list with exact timings, positions, colors, sizes, and easing for every element'),
    focusArea: z.string().optional().describe('Specific aspect to focus on (e.g., "typography", "transitions", "camera movement")'),
    duration: z.number().optional().describe('Target duration in seconds'),
    adaptations: z.string().optional().describe('How to adapt the style (e.g., "use my brand colors #2563EB and #10B981")'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    prompt: z.string().describe('The generated animation prompt'),
    focusArea: z.string().optional(),
    techniqueSuggestions: z.array(z.string()).optional().describe('Suggested technique presets to enable'),
    error: z.string().optional(),
  }),

  execute: async (input) => {
    // This tool is a "structured output" tool — the agent itself writes the prompt
    // based on its analysis context and the user's request. The tool just validates
    // and structures the output.

    const { analysisContext, userRequest, focusArea, duration, adaptations } = input;

    if (!analysisContext || !userRequest) {
      return {
        success: false,
        prompt: '',
        error: 'Both analysisContext and userRequest are required',
      };
    }

    // Build the prompt from the agent's inputs
    const parts: string[] = [];

    parts.push(userRequest);

    if (analysisContext) {
      parts.push(`\nMotion reference analysis:\n${analysisContext}`);
    }

    if (adaptations) {
      parts.push(`\nAdaptations: ${adaptations}`);
    }

    if (duration) {
      parts.push(`\nTarget duration: ${duration}s`);
    }

    if (focusArea) {
      parts.push(`\nFocus: ${focusArea}`);
    }

    // Suggest technique presets based on the focus area and analysis
    const suggestions: string[] = [];
    const lowerContext = analysisContext.toLowerCase();
    if (lowerContext.includes('kinetic') || lowerContext.includes('typography') || lowerContext.includes('text animation')) {
      suggestions.push('kinetic-typography');
    }
    if (lowerContext.includes('particle') || lowerContext.includes('dust') || lowerContext.includes('confetti')) {
      suggestions.push('particles');
    }
    if (lowerContext.includes('3d') || lowerContext.includes('rotate') || lowerContext.includes('perspective')) {
      suggestions.push('3d-scenes');
    }
    if (lowerContext.includes('parallax') || lowerContext.includes('depth') || lowerContext.includes('layers')) {
      suggestions.push('parallax');
    }
    if (lowerContext.includes('morph') || lowerContext.includes('transform') || lowerContext.includes('shape')) {
      suggestions.push('morph');
    }
    if (lowerContext.includes('glitch') || lowerContext.includes('distortion') || lowerContext.includes('noise')) {
      suggestions.push('glitch');
    }
    if (lowerContext.includes('camera') || lowerContext.includes('dolly') || lowerContext.includes('zoom') || lowerContext.includes('pan')) {
      suggestions.push('camera');
    }
    if (lowerContext.includes('logo') || lowerContext.includes('reveal') || lowerContext.includes('brand')) {
      suggestions.push('logo-reveals');
    }

    return {
      success: true,
      prompt: parts.join('\n'),
      focusArea,
      techniqueSuggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  },
});
