/**
 * fetch_docs Tool
 *
 * Fetches documentation from Context7 for animation libraries.
 * Used for self-healing when code generation fails or when the agent
 * needs API reference for specific features.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Library mappings to Context7 library IDs
const LIBRARY_IDS: Record<string, string> = {
  'theatre': '/theatre-js/theatre',
  'remotion': '/remotion/remotion',
  'react-three-fiber': '/pmndrs/react-three-fiber',
  'drei': '/pmndrs/drei',
  'three': '/mrdoob/three.js',
  'framer-motion': '/framer/motion',
};

// Common queries for each library (fallback context)
const LIBRARY_HINTS: Record<string, string[]> = {
  'theatre': [
    'getProject and sheet setup',
    'sequence and keyframes',
    'useVal hook for reactive values',
  ],
  'remotion': [
    'useCurrentFrame and useVideoConfig',
    'interpolate function',
    'spring animation',
    'Sequence component for timing',
    'AbsoluteFill for layouts',
  ],
  'react-three-fiber': [
    'Canvas component',
    'useFrame hook for animation loop',
    'useThree hook for scene access',
  ],
  'drei': [
    'Text component for 3D text',
    'OrbitControls',
    'Environment and lighting',
    'useTexture and useGLTF',
  ],
};

const FetchDocsInputSchema = z.object({
  library: z.enum(['theatre', 'remotion', 'react-three-fiber', 'drei', 'three', 'framer-motion'])
    .describe('The animation library to fetch docs for'),
  query: z.string()
    .describe('What to look up (e.g., "useCurrentFrame hook", "spring animation config", "Sequence component")'),
});

export const fetchDocsTool = createTool({
  id: 'fetch_docs',
  description: `Fetch documentation for animation libraries when you encounter errors or need API reference.

Use this tool when:
- Code generation produces errors and you need to check the correct API
- You're unsure about a specific function or component's usage
- The preview shows unexpected behavior and you need to verify the approach

Available libraries:
- theatre: Theatre.js for timeline-based 3D animations
- remotion: Remotion for 2D motion graphics and video
- react-three-fiber: React renderer for Three.js
- drei: Useful helpers for react-three-fiber
- three: Three.js core library
- framer-motion: Framer Motion for React animations`,

  inputSchema: FetchDocsInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    library: z.string(),
    query: z.string(),
    documentation: z.string(),
    hints: z.array(z.string()).optional(),
    error: z.string().optional(),
  }),

  execute: async (input) => {
    const { library, query } = input;
    const libraryId = LIBRARY_IDS[library];

    if (!libraryId) {
      return {
        success: false,
        library,
        query,
        documentation: '',
        error: `Unknown library: ${library}`,
      };
    }

    try {
      // Call Context7 API to query documentation
      const response = await fetch('https://context7.com/api/v1/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          libraryId,
          query,
          maxTokens: 4000, // Keep response focused
        }),
      });

      if (!response.ok) {
        // If Context7 API fails, return library hints as fallback
        const hints = LIBRARY_HINTS[library] || [];
        return {
          success: false,
          library,
          query,
          documentation: `Context7 API unavailable. Here are common patterns for ${library}:\n\n${hints.map(h => `- ${h}`).join('\n')}`,
          hints,
          error: `Context7 API returned ${response.status}`,
        };
      }

      const data = await response.json();

      // Extract the documentation content
      const documentation = data.content || data.text || data.result || '';

      if (!documentation) {
        const hints = LIBRARY_HINTS[library] || [];
        return {
          success: true,
          library,
          query,
          documentation: `No specific docs found for "${query}". Common ${library} patterns:\n\n${hints.map(h => `- ${h}`).join('\n')}`,
          hints,
        };
      }

      return {
        success: true,
        library,
        query,
        documentation: truncateDocumentation(documentation, 6000),
        hints: LIBRARY_HINTS[library],
      };
    } catch (error) {
      // Network error - return fallback hints
      const hints = LIBRARY_HINTS[library] || [];
      return {
        success: false,
        library,
        query,
        documentation: `Failed to fetch docs. Common ${library} patterns:\n\n${hints.map(h => `- ${h}`).join('\n')}`,
        hints,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },
});

/**
 * Truncate documentation to stay within token limits
 */
function truncateDocumentation(doc: string, maxChars: number): string {
  if (doc.length <= maxChars) return doc;

  // Try to cut at a paragraph boundary
  const truncated = doc.slice(0, maxChars);
  const lastParagraph = truncated.lastIndexOf('\n\n');

  if (lastParagraph > maxChars * 0.7) {
    return truncated.slice(0, lastParagraph) + '\n\n... [truncated]';
  }

  return truncated + '\n\n... [truncated]';
}
