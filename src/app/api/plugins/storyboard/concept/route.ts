/**
 * Storyboard Concept Generator API Route
 *
 * POST /api/plugins/storyboard/concept
 * Uses a fast Claude model to generate a creative concept from form fields.
 */

import { NextResponse } from 'next/server';
import { Agent } from '@mastra/core/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONCEPT_MODEL = 'google/gemini-3-flash-preview';

const CONCEPT_SYSTEM_PROMPT = `You are a creative director generating short, compelling video storyboard concepts.

Given a product/subject, optional character, visual style, and video model, generate ONE creative concept for a video storyboard (2-4 sentences).

Rules:
- Be specific and visual — describe a narrative arc, not generic marketing language
- Include a hook (opening), development (middle), and payoff (ending)
- Match the visual style requested
- Keep it under 80 words
- Output ONLY the concept text, no labels or formatting`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product, character, style, targetVideoModel, connectedNodes } = body;

    if (!product?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product/subject is required' },
        { status: 400 }
      );
    }

    const parts: string[] = [`Product/Subject: ${product.trim()}`];
    if (character?.trim()) parts.push(`Character: ${character.trim()}`);
    if (style) parts.push(`Visual Style: ${style}`);
    if (targetVideoModel) parts.push(`Target Video Model: ${targetVideoModel}`);
    if (connectedNodes?.trim()) parts.push(`Connected reference nodes: ${connectedNodes.trim()}`);

    const prompt = `Generate a creative video storyboard concept for:\n\n${parts.join('\n')}`;

    const agent = new Agent({
      id: `storyboard-concept-${Date.now()}`,
      name: 'storyboard-concept',
      instructions: CONCEPT_SYSTEM_PROMPT,
      model: CONCEPT_MODEL,
    });

    const result = await agent.generate(prompt, {
      modelSettings: { temperature: 0.8 },
    });

    const concept = result.text?.trim();
    if (!concept) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate concept' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, concept });
  } catch (error) {
    console.error('[Concept] Generation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
