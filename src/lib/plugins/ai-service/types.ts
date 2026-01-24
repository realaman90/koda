/**
 * AI Service Types
 *
 * Provider-agnostic interface for structured LLM output.
 * Plugins use this interface to get structured output from an LLM.
 * The underlying implementation can be swapped without changing plugin code.
 */

import type { z } from 'zod';

/**
 * Options for AI service calls
 * These options work across all providers (Mastra, Vercel AI SDK, direct APIs)
 */
export interface AIServiceOptions {
  /** System prompt / instructions for the LLM */
  systemPrompt?: string;
  /** Model override (e.g., 'anthropic/claude-sonnet-4-20250514') */
  model?: string;
  /** Temperature (0-1), controls randomness */
  temperature?: number;
}

/**
 * AI Service Interface - Provider-agnostic LLM interaction
 *
 * Plugins bring their own prompts and Zod schemas.
 * AIService is just the execution layer that can be swapped.
 *
 * Current implementation: Mastra Agent
 * Future options: Vercel AI SDK (generateObject), Direct Anthropic/OpenAI API
 */
export interface AIService {
  /**
   * Generate structured output from the LLM
   *
   * @param prompt - User prompt describing what to generate
   * @param schema - Zod schema defining the expected output structure
   * @param options - Optional configuration (system prompt, model, temperature)
   * @returns Promise resolving to the structured output matching the schema
   */
  generateStructured<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: AIServiceOptions
  ): Promise<z.infer<T>>;
}
