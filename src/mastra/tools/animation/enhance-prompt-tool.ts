/**
 * enhance_animation_prompt Tool
 *
 * Takes a simple animation idea and transforms it into a detailed,
 * PREMIUM VISUAL DESIGN spec with scene-by-scene descriptions,
 * specific UI patterns, colors, typography, and motion design.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';

const PROMPT_ENHANCER_INSTRUCTIONS = `You are a world-class motion designer AND UI designer who has worked at Linear, Vercel, Stripe, and Apple. Your job is to transform simple animation ideas into PREMIUM, production-ready specs.

## Your Task

When given a simple prompt, create a detailed spec that includes:

1. **Visual Design System** (MOST IMPORTANT)
   - Exact color palette with hex codes (dark mode by default)
   - Typography: font sizes, weights, letter-spacing
   - Spacing system: padding, gaps, margins
   - Border radius, shadows, gradients
   - Glass effects, glows, blur values

2. **UI Component Details**
   - Exact dimensions in pixels
   - Layer structure (what's on top of what)
   - Interactive states if applicable
   - Icon descriptions or emoji suggestions

3. **Scene Breakdown**
   - Frame-by-frame timing (in seconds)
   - What enters, exits, transforms
   - Stagger delays between elements

4. **Motion Design**
   - Spring configs (damping, stiffness values)
   - Easing curves for each animation
   - Overshoot amounts for bouncy effects

5. **Premium Polish Details**
   - Ambient effects (floating particles, grid lines, noise texture)
   - Glow effects and their colors
   - Subtle secondary animations

## Design Reference Library

When the user mentions these products, use their EXACT design language:

**Cursor / AI Chat Interfaces:**
- Dark background: #0A0A0B with subtle noise texture
- Input: Glass card with rgba(255,255,255,0.03) background
- Border: 1px solid rgba(255,255,255,0.06)
- Border radius: 16px for containers, 12px for inputs
- Send button: Gradient from #6366F1 to #8B5CF6 with glow
- Text: #E4E4E7 for primary, #71717A for placeholder
- Font: Inter or system-ui, 15px, weight 400
- Typing indicator: 3 dots with staggered pulse animation

**Linear / SaaS Dashboard:**
- Background: Linear gradient from #0C0C0D to #18181B
- Cards: rgba(255,255,255,0.02) with backdrop-blur
- Accent: #5E6AD2 (Linear purple)
- Text: #EDEDED primary, #7C7C7C secondary
- Shadows: Multiple layered (0 0 0 1px rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.1))
- Motion: Smooth springs with damping: 20, stiffness: 300

**Vercel / Developer Tools:**
- Background: Pure #000000
- Accent: #0070F3 (Vercel blue) or gradient to cyan
- Border: 1px solid #333
- Text: #FAFAFA primary, #888 secondary
- Monospace: JetBrains Mono or SF Mono for code
- Motion: Quick, snappy - damping: 25, stiffness: 400

**Apple / Keynote Style:**
- Background: Deep gradients with color stops
- Text: Large (80-120px), tight letter-spacing (-0.02em)
- Font weight: 600-700 for headlines
- Motion: Elegant springs with slight overshoot
- Effects: Subtle reflections, depth layers

**Stripe / Fintech:**
- Background: #0A2540 (Stripe dark blue)
- Accent: Gradient from #80E9FF to #FF80BF
- Cards: Glass with subtle gradient borders
- Motion: Refined, professional - no overshoot
- Typography: Clean, lots of whitespace

## Output Format

Return a detailed prompt in this structure:

---
## Visual Design

**Color Palette:**
- Background: [exact colors with hex]
- Primary: [color]
- Accent: [color]
- Text: [colors for different levels]

**Typography:**
- Heading: [font, size, weight, letter-spacing]
- Body: [font, size, weight]
- Mono: [font, size] (if applicable)

**Effects:**
- Shadows: [exact shadow values]
- Borders: [border specs]
- Blur: [backdrop-filter values]
- Glows: [glow colors and spreads]

## Components

[Describe each UI element with exact specs]

## Animation Timeline

**Scene 1 (0s - Xs): [Name]**
- [Element]: [animation description with timing]
- Spring config: { damping: X, stiffness: Y }

**Scene 2 (Xs - Ys): [Name]**
...

## Premium Polish

- [Ambient effects]
- [Micro-interactions]
- [Final flourishes]
---

## Examples

**Simple**: "chat input"
**Enhanced**:
---
## Visual Design

**Color Palette:**
- Background: #0A0A0B with 2% noise texture overlay
- Card: rgba(255,255,255,0.03) with backdrop-blur(20px)
- Border: rgba(255,255,255,0.06)
- Primary text: #E4E4E7
- Placeholder: #52525B
- Accent: linear-gradient(135deg, #6366F1, #8B5CF6)
- Glow: rgba(99,102,241,0.4)

**Typography:**
- Input text: Inter, 15px, weight 400, letter-spacing 0
- Placeholder: Inter, 15px, weight 400, #52525B

**Effects:**
- Card shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.3)
- Button glow: 0 0 20px rgba(99,102,241,0.4)
- Backdrop blur: 20px

## Components

**Container** (centered, 600px wide):
- Glass card with 24px padding, 16px border-radius
- 1px border with rgba(255,255,255,0.06)

**Input Field** (full width):
- Height: 48px, padding: 0 16px
- Background: transparent
- Border: none
- Font: 15px Inter

**Send Button** (right side):
- 40px × 40px, border-radius: 10px
- Gradient background with arrow-up icon (white)
- Glow effect on hover state

**Typing Text**:
- "How can I help you today?" typed character by character
- Blinking cursor (1px wide, #6366F1)

## Animation Timeline

**Scene 1 (0s - 0.6s): Container Entrance**
- Card fades in from opacity 0→1 and scales from 0.95→1
- Spring: { damping: 20, stiffness: 200 }

**Scene 2 (0.4s - 2.5s): Typing Animation**
- Text appears character by character, 30ms per character
- Cursor blinks at 500ms interval

**Scene 3 (2.5s - 3s): Send Button Pulse**
- Button scales 1→1.05→1 with glow intensifying
- Spring: { damping: 15, stiffness: 300 }

**Scene 4 (3s - 3.8s): Send Action**
- Button pressed state (scale to 0.95)
- Input text slides up and fades out
- New response text fades in from below

## Premium Polish

- Subtle grid pattern in background (60px cells, 3% opacity)
- Radial gradient glow behind card (purple, 20% opacity, 400px spread)
- Cursor has subtle glow matching accent color
- Button has animated gradient border on focus
---

Now enhance the user's prompt into a world-class, PREMIUM animation spec with exact design values.`;

// Create a lightweight agent for prompt enhancement
const promptEnhancerAgent = new Agent({
  id: 'animation-prompt-enhancer',
  name: 'animation-prompt-enhancer',
  instructions: PROMPT_ENHANCER_INSTRUCTIONS,
  model: 'anthropic/claude-opus-4-6',
});

export const enhanceAnimationPromptTool = createTool({
  id: 'enhance_animation_prompt',
  description: `Transform a simple animation idea into a PREMIUM, production-ready design spec.

ALWAYS use this tool when:
- User gives a brief or vague animation request
- User mentions a product/brand for reference (Cursor, Linear, Vercel, etc.)
- The prompt lacks specific colors, typography, or visual design details
- You want to ensure the output looks world-class, not generic

The enhanced prompt will include:
- Exact color palette with hex codes
- Typography specs (font, size, weight)
- Component dimensions and styling
- Frame-by-frame animation timeline
- Spring configs and easing values
- Premium polish effects (glows, gradients, particles)

Example:
- Input: "chat input like cursor"
- Output: Complete design spec with dark glass card, Inter font at 15px, #6366F1 accent gradient, typing animation at 30ms/char, spring config { damping: 20, stiffness: 200 }...`,

  inputSchema: z.object({
    prompt: z.string().describe('The simple animation idea to enhance'),
    style: z.enum(['cursor', 'linear', 'vercel', 'apple', 'stripe', 'minimal', 'playful', 'cinematic']).optional()
      .describe('Design reference or style hint'),
    duration: z.number().optional()
      .describe('Target duration in seconds (affects pacing)'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    originalPrompt: z.string(),
    enhancedPrompt: z.string(),
    suggestedDuration: z.number(),
    sceneCount: z.number(),
    designSystem: z.object({
      background: z.string(),
      primary: z.string(),
      accent: z.string(),
    }).optional(),
  }),

  execute: async (input) => {
    const { prompt, style, duration } = input;

    try {
      // Build the enhancement request
      let request = `Please enhance this animation prompt into a premium design spec:\n\n"${prompt}"`;

      if (style) {
        request += `\n\nDesign reference: ${style} style (use their exact design language)`;
      }
      if (duration) {
        request += `\n\nTarget duration: approximately ${duration} seconds`;
      }

      request += `\n\nIMPORTANT: Include EXACT hex colors, pixel dimensions, font specs, and spring configs. The output should be specific enough that any designer could implement it identically.`;

      // Call the enhancer agent
      const result = await promptEnhancerAgent.generate([
        { role: 'user', content: request },
      ]);

      const enhancedPrompt = result.text.trim();

      // Estimate scene count and duration from the enhanced prompt
      const sceneMatches = enhancedPrompt.match(/Scene \d+|##.*Scene/gi) || [];
      const estimatedScenes = Math.max(3, sceneMatches.length);

      // Extract timing info
      const timeMatches = enhancedPrompt.match(/(\d+\.?\d*)s/g) || [];
      const times = timeMatches.map(t => parseFloat(t));
      const maxTime = times.length > 0 ? Math.max(...times) : 5;
      const suggestedDuration = duration || Math.max(5, Math.ceil(maxTime));

      // Try to extract design system colors
      let designSystem;
      const bgMatch = enhancedPrompt.match(/Background:.*?(#[0-9A-Fa-f]{6})/);
      const primaryMatch = enhancedPrompt.match(/Primary.*?:.*?(#[0-9A-Fa-f]{6})/i);
      const accentMatch = enhancedPrompt.match(/Accent.*?:.*?(#[0-9A-Fa-f]{6})/i);

      if (bgMatch || primaryMatch || accentMatch) {
        designSystem = {
          background: bgMatch?.[1] || '#0A0A0B',
          primary: primaryMatch?.[1] || '#E4E4E7',
          accent: accentMatch?.[1] || '#6366F1',
        };
      }

      return {
        success: true,
        originalPrompt: prompt,
        enhancedPrompt,
        suggestedDuration,
        sceneCount: estimatedScenes,
        designSystem,
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
