/**
 * Mastra AI Service Provider
 *
 * Implementation of AIService using Mastra's Agent class.
 * Creates a lightweight agent for each request with the provided configuration.
 */

import { Agent } from '@mastra/core/agent';
import type { z } from 'zod';
import type { AIService, AIServiceOptions } from './types';

/** Default model for plugin AI calls */
const DEFAULT_MODEL = 'google/gemini-3-pro-preview';

/**
 * Mastra-based AI Service implementation
 *
 * Uses Mastra's Agent class with structuredOutput support.
 * Creates a temporary agent for each request - no registration needed.
 */
export class MastraAIService implements AIService {
  async generateStructured<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: AIServiceOptions
  ): Promise<z.infer<T>> {
    // Create a lightweight agent for this request
    const agent = new Agent({
      id: `plugin-ai-service-${Date.now()}`,
      name: 'plugin-ai-service',
      instructions: options?.systemPrompt ?? 'You are a helpful assistant.',
      model: options?.model ?? DEFAULT_MODEL,
    });

    // Generate with structured output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await agent.generate(prompt, {
      structuredOutput: {
        schema: schema as any,
      },
      modelSettings: {
        temperature: options?.temperature,
      },
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 10000,
            includeThoughts: true,
          },
        },
      },
    });

    // Return the structured object
    if (result.object === undefined) {
      throw new Error('AI service failed to generate structured output');
    }

    return result.object as z.infer<T>;
  }
}
