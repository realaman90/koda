/**
 * Web Search Tool for Prompt Studio
 *
 * Uses Exa API to search for prompt engineering guides,
 * model-specific techniques, and visual reference material.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import Exa from 'exa-js';

let exaClient: Exa | null | undefined;
let warnedMissingKey = false;

function getExaClient(): Exa | null {
  if (exaClient !== undefined) return exaClient;

  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn('[search_web] EXA_API_KEY is not configured; returning empty web search results.');
    }
    exaClient = null;
    return exaClient;
  }

  try {
    exaClient = new Exa(apiKey);
  } catch (err) {
    console.error('[search_web] Failed to initialize Exa client:', err);
    exaClient = null;
  }

  return exaClient;
}

export const webSearchTool = createTool({
  id: 'search_web',
  description:
    'Search the web for prompt engineering guides, model-specific techniques, visual styles, and creative references. Use this to research best practices for a specific model or visual style before generating prompts.',
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        'Search query — be specific (e.g. "Midjourney v6 cinematic lighting prompt techniques", "Flux text rendering prompt guide", "DALL-E 3 photorealism tips")',
      ),
    numResults: z
      .number()
      .min(1)
      .max(5)
      .optional()
      .describe('Number of results to return (1-5, default 3)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    searchId: z.string(),
    query: z.string(),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        summary: z.string().optional(),
        highlights: z.array(z.string()).optional(),
      }),
    ),
  }),
  execute: async (input) => {
    try {
      const exa = getExaClient();
      if (!exa) {
        return {
          success: false,
          searchId: `search_${Date.now()}`,
          query: input.query,
          results: [],
        };
      }

      const response = await exa.searchAndContents(input.query, {
        type: 'auto',
        numResults: input.numResults || 3,
        highlights: {
          query: input.query,
          numSentences: 3,
        },
        summary: {
          query: `Key prompt engineering techniques and tips related to: ${input.query}`,
        },
      });

      const results = (response.results || []).map((r) => ({
        title: r.title || 'Untitled',
        url: r.url,
        summary: r.summary || undefined,
        highlights: r.highlights || undefined,
      }));

      return {
        success: true,
        searchId: `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        query: input.query,
        results,
      };
    } catch (err) {
      console.error('[search_web] Exa search failed:', err);
      return {
        success: false,
        searchId: `search_${Date.now()}`,
        query: input.query,
        results: [],
      };
    }
  },
});
