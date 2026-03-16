import { NextResponse } from 'next/server';
import { Agent } from '@mastra/core/agent';
import { mastra } from '@/mastra';
import { PROMPT_ENHANCER_MODEL } from '@/mastra/models';

export const maxDuration = 60;

const SVG_ENHANCER_INSTRUCTIONS = `You are an expert prompt engineer for AI SVG generation.
Your job is to take a user's basic prompt and enhance it to produce better vector SVG results.

Guidelines:
1. Keep the core concept/subject from the original prompt
2. Add specific details about:
   - Visual style (flat design, line art, geometric, isometric, minimalist, duotone, etc.)
   - Color palette (specific colors, gradients, monochrome, vibrant, muted)
   - Composition (centered icon, full scene, symmetrical, layered)
   - Shape language (rounded, angular, organic curves, geometric primitives)
   - Detail level (simple icon, detailed illustration, complex scene)
3. Keep the enhanced prompt concise (under 150 words)
4. Don't add elements that contradict the original intent
5. Focus on vector-friendly descriptions (clean shapes, clear outlines, solid fills)
6. Avoid photorealistic descriptors (8k, photograph, etc.) — this is for SVG

Output ONLY the enhanced prompt, nothing else.`;

const VECGLYPHER_ENHANCER_INSTRUCTIONS = `You are an expert prompt engineer for VecGlypher, a vector text/glyph rendering model.
VecGlypher renders TEXT as styled SVG vector glyphs. It takes two inputs:
- "prompt": the literal text to render (e.g., "KODA", "Hello", "A")
- "style_description": typography style (e.g., "bold, sans-serif, modern, geometric")

The user's input to you is their raw prompt. Your job is to rewrite it in this format:
"TEXT" STYLE_DESCRIPTION

Rules:
1. If the user provides a word/text to render, keep it as-is and add typography styling
   - Example: "KODA" → "KODA" bold, geometric sans-serif, modern tech style, clean edges
   - Example: "Hello World" → "Hello World" elegant serif, italic style, 300 weight, flowing
2. If the user describes a style without specific text, keep the description as style terms
   - Example: "modern logo text" → "Logo" bold, sans-serif, modern, minimalist, 700 weight
3. Style terms should use typography language: weight (100-900, bold, light), style (italic, regular), category (serif, sans-serif, display, monospace), characteristics (elegant, geometric, rounded, angular, condensed)
4. Keep it concise — under 50 words total

Output ONLY the enhanced prompt, nothing else.`;

export async function POST(request: Request) {
  try {
    const { prompt, type, model } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    let response;

    if (type === 'glyph') {
      const glyphEnhancer = new Agent({
        id: 'vecglypher-prompt-enhancer',
        name: 'VecGlypher Prompt Enhancer',
        instructions: VECGLYPHER_ENHANCER_INSTRUCTIONS,
        model: PROMPT_ENHANCER_MODEL,
      });
      response = await glyphEnhancer.generate(prompt);
    } else if (type === 'svg') {
      const svgEnhancer = new Agent({
        id: 'svg-prompt-enhancer',
        name: 'SVG Prompt Enhancer',
        instructions: SVG_ENHANCER_INSTRUCTIONS,
        model: PROMPT_ENHANCER_MODEL,
      });
      response = await svgEnhancer.generate(prompt);
    } else {
      const agent = mastra.getAgent('promptEnhancer');
      response = await agent.generate(prompt);
    }

    return NextResponse.json({
      success: true,
      originalPrompt: prompt,
      enhancedPrompt: response.text,
    });
  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent failed' },
      { status: 500 }
    );
  }
}
