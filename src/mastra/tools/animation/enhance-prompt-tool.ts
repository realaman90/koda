/**
 * enhance_animation_prompt Tool
 *
 * Takes a simple animation idea and transforms it into a detailed,
 * cinematic prompt with scene-by-scene descriptions, camera movements,
 * transitions, and timing cues.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';

const PROMPT_ENHANCER_INSTRUCTIONS = `You are a world-class animation director and motion designer. Your job is to take simple animation ideas and transform them into detailed, cinematic animation descriptions.

## Your Task

When given a simple prompt, expand it into a rich, detailed animation description that includes:

1. **Scene Breakdown**: Split the animation into clear scenes/acts
2. **Visual Elements**: Describe specific UI components, objects, colors, and styling
3. **Camera Work**: Include camera movements (zoom, pan, dolly, tracking shots)
4. **Motion Design**: Describe how elements move, enter, and exit
5. **Transitions**: How scenes flow into each other (fade, slide, morph, etc.)
6. **Timing Cues**: Pacing, pauses, acceleration/deceleration
7. **Polish Details**: Subtle effects that make it feel premium (easing, shadows, glows, particles)

## Style Guidelines

- Think like a Pixar or Apple commercial director
- Every movement should have purpose and feel intentional
- Use cinematic language: "the camera slowly dollies in", "elements gracefully fade"
- Include micro-interactions and subtle details
- Consider depth, layers, and 3D space even for 2D animations
- Add emotional beats - moments of anticipation, surprise, satisfaction

## Output Format

Return a detailed prompt that the animation agent can use directly. Write it as a cohesive narrative description, not bullet points. The description should paint a vivid picture of every moment.

## Examples

**Simple**: "loading animation"
**Enhanced**: "A minimalist loading sequence opens with a single glowing dot at the center of a deep navy background. The dot pulses gently, then splits into three dots that orbit each other in a mesmerizing dance. As loading completes, the dots converge back into one, which then bursts outward into a ring that expands and fades, revealing the loaded content beneath with a subtle scale-up effect."

**Simple**: "login form"
**Enhanced**: "The scene opens on a frosted glass card floating in a gradient void of deep purple to midnight blue. The card casts a soft shadow that breathes subtly. An email field materializes first, its placeholder text typing itself out letter by letter. A beat later, the password field fades in below. As the user types, each keystroke creates a ripple effect. The login button starts muted, then glows to life when both fields are valid. On click, the button morphs into a spinning circle, then explodes into confetti particles as the card gracefully scales down and fades, giving way to the dashboard rising from below."

Now enhance the user's prompt into a world-class animation description.`;

// Create a lightweight agent for prompt enhancement
const promptEnhancerAgent = new Agent({
  id: 'animation-prompt-enhancer',
  name: 'animation-prompt-enhancer',
  instructions: PROMPT_ENHANCER_INSTRUCTIONS,
  model: 'anthropic/claude-sonnet-4', // Fast and creative
});

export const enhanceAnimationPromptTool = createTool({
  id: 'enhance_animation_prompt',
  description: `Transform a simple animation idea into a detailed, cinematic description.

Use this tool when:
- User gives a brief or vague animation request
- You want to add professional polish and detail to an idea
- The prompt lacks specific camera work, transitions, or timing

The enhanced prompt will include:
- Scene-by-scene breakdown
- Camera movements and angles
- Motion design details
- Transitions and timing
- Premium polish effects

Example:
- Input: "bouncing ball"
- Output: A detailed description with entrance animation, squash/stretch physics, shadow dynamics, camera tracking, and satisfying exit.`,

  inputSchema: z.object({
    prompt: z.string().describe('The simple animation idea to enhance'),
    style: z.enum(['cinematic', 'playful', 'minimal', 'dramatic', 'techy']).optional()
      .describe('Optional style hint to guide the enhancement'),
    duration: z.number().optional()
      .describe('Target duration in seconds (affects pacing)'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    originalPrompt: z.string(),
    enhancedPrompt: z.string(),
    suggestedDuration: z.number(),
    sceneCount: z.number(),
  }),

  execute: async (input) => {
    const { prompt, style, duration } = input;

    try {
      // Build the enhancement request
      let request = `Please enhance this animation prompt:\n\n"${prompt}"`;

      if (style) {
        request += `\n\nStyle preference: ${style}`;
      }
      if (duration) {
        request += `\n\nTarget duration: approximately ${duration} seconds`;
      }

      // Call the enhancer agent
      const result = await promptEnhancerAgent.generate([
        { role: 'user', content: request },
      ]);

      const enhancedPrompt = result.text.trim();

      // Estimate scene count and duration from the enhanced prompt
      const sceneIndicators = enhancedPrompt.match(/\b(then|next|finally|after|following|scene|act|moment|beat)\b/gi) || [];
      const estimatedScenes = Math.max(3, Math.min(7, Math.ceil(sceneIndicators.length / 2) + 2));

      // Suggest duration based on complexity
      const wordCount = enhancedPrompt.split(/\s+/).length;
      const suggestedDuration = duration || Math.max(5, Math.min(30, Math.ceil(wordCount / 30)));

      return {
        success: true,
        originalPrompt: prompt,
        enhancedPrompt,
        suggestedDuration,
        sceneCount: estimatedScenes,
      };
    } catch (error) {
      return {
        success: false,
        originalPrompt: prompt,
        enhancedPrompt: prompt, // Fall back to original
        suggestedDuration: 5,
        sceneCount: 3,
      };
    }
  },
});
