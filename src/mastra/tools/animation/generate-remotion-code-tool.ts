/**
 * generate_remotion_code Tool
 *
 * Subagent-as-tool: Calls the Remotion code generator subagent
 * to produce animation code. Alternative to Theatre.js for A/B testing.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { remotionCodeGeneratorAgent } from '../../agents/remotion-code-generator-agent';
import { dockerProvider } from '@/lib/sandbox/docker-provider';

const GenerateRemotionCodeInputSchema = z.object({
  task: z.enum(['initial_setup', 'create_component', 'create_scene', 'modify_existing'])
    .describe('Type of code generation task'),

  // Sandbox ID — when provided, files are written directly to the sandbox
  sandboxId: z.string().optional().describe('Sandbox ID to write generated files directly (recommended — saves tokens)'),

  // For initial_setup
  style: z.string().optional().describe('Animation style (e.g. playful, smooth, cinematic)'),
  plan: z.object({
    scenes: z.array(z.object({
      title: z.string(),
      start: z.number(),
      end: z.number(),
      description: z.string(),
    })),
    duration: z.number(),
    fps: z.number(),
  }).optional().describe('Animation plan (for initial_setup)'),

  // For create_component
  name: z.string().optional().describe('Component name (e.g. BouncingBall)'),
  description: z.string().optional().describe('What the component does'),
  animations: z.array(z.object({
    property: z.string(),
    from: z.any(),
    to: z.any(),
    easing: z.string(),
  })).optional().describe('Animation keyframes'),
  timing: z.object({
    start: z.number(),
    duration: z.number(),
  }).optional().describe('When this animation plays'),

  // For create_scene
  scenes: z.array(z.object({
    start: z.number(),
    end: z.number(),
    description: z.string(),
  })).optional().describe('Scene segments for the compositor'),
  components: z.array(z.string()).optional().describe('Component names used in the scene'),

  // For modify_existing
  file: z.string().optional().describe('File path to modify'),
  currentContent: z.string().optional().describe('Current file content'),
  change: z.string().optional().describe('Description of what to change'),
});

export const generateRemotionCodeTool = createTool({
  id: 'generate_remotion_code',
  description: `Generate Remotion animation code using a specialized code generation agent.

Use this for ALL Remotion code generation tasks:
- initial_setup: Create foundational project files (Root.tsx, Video.tsx, MainSequence.tsx)
- create_component: Create an animated component (e.g. Title.tsx)
- create_scene: Create/update a sequence (e.g. IntroSequence.tsx)
- modify_existing: Modify an existing file based on feedback

IMPORTANT: Always pass sandboxId so files are written directly to the sandbox.
This avoids passing large file contents through the conversation and saves tokens.`,

  inputSchema: GenerateRemotionCodeInputSchema,
  outputSchema: z.object({
    files: z.array(z.object({
      path: z.string(),
      size: z.number(),
    })),
    summary: z.string(),
    writtenToSandbox: z.boolean(),
  }),

  execute: async (inputData) => {
    // Validate sandboxId is provided (critical for writing files)
    if (!inputData.sandboxId) {
      return {
        files: [],
        summary: 'ERROR: No sandboxId provided. You MUST create a sandbox first with sandbox_create(template="remotion"), then pass the returned sandboxId to this tool.',
        writtenToSandbox: false,
      };
    }

    // Format the request for the code generator subagent
    const prompt = formatRemotionCodeGenerationPrompt(inputData);

    try {
      // Call the subagent (non-streaming for tool result)
      const result = await remotionCodeGeneratorAgent.generate([
        { role: 'user', content: prompt },
      ]);

      const fullResponse = result.text;

      // Log for debugging
      console.log(`[generate_remotion_code] Subagent response length: ${fullResponse.length}`);

      // Parse the JSON response from the subagent
      const parsed = extractJSON(fullResponse);

      if (!parsed || !parsed.files || !Array.isArray(parsed.files)) {
        console.error(`[generate_remotion_code] Invalid response:`, fullResponse.slice(0, 500));
        return {
          files: [],
          summary: `ERROR: Code generator returned invalid format. Expected JSON with "files" array. Raw output (first 200 chars): ${fullResponse.slice(0, 200)}`,
          writtenToSandbox: false,
        };
      }

      // Validate each file has path and content
      const files = parsed.files as Array<{ path: string; content: string }>;
      for (const file of files) {
        if (!file.path || typeof file.content !== 'string') {
          throw new Error(`Invalid file entry: ${JSON.stringify(file).slice(0, 100)}`);
        }
        // Security: reject paths with directory traversal or absolute paths
        if (file.path.includes('..') || file.path.startsWith('/') || file.path.includes('\0')) {
          throw new Error(`Invalid file path: ${file.path}`);
        }
        // Size limit: 100KB per file
        if (file.content.length > 100_000) {
          throw new Error(`File too large (${file.content.length} chars): ${file.path}`);
        }
      }

      // If sandboxId is provided, write files directly to the sandbox
      if (inputData.sandboxId) {
        const writeResults: Array<{ path: string; size: number }> = [];
        for (const file of files) {
          await dockerProvider.writeFile(inputData.sandboxId, file.path, file.content);
          writeResults.push({ path: file.path, size: file.content.length });
        }
        return {
          files: writeResults,
          summary: typeof parsed.summary === 'string' ? parsed.summary : 'Remotion code generated and written to sandbox',
          writtenToSandbox: true,
        };
      }

      // No sandboxId — return paths and sizes only
      return {
        files: files.map(f => ({ path: f.path, size: f.content.length })),
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Remotion code generated (no sandbox — files not written)',
        writtenToSandbox: false,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[generate_remotion_code] Error:`, errorMsg);
      return {
        files: [],
        summary: `ERROR: Code generation failed: ${errorMsg}. Check that sandboxId is valid and the sandbox is running.`,
        writtenToSandbox: false,
      };
    }
  },
});

/**
 * Extract JSON from an LLM response.
 */
function extractJSON(text: string): Record<string, unknown> | null {
  // Strategy 1: JSON markdown code block
  const jsonBlockMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1]);
    } catch { /* try next strategy */ }
  }

  // Strategy 2: Generic code block
  const codeBlockMatch = text.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch { /* try next strategy */ }
  }

  // Strategy 3: Find the outermost balanced JSON object
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Format the code generation prompt for the Remotion subagent
 */
function formatRemotionCodeGenerationPrompt(params: z.infer<typeof GenerateRemotionCodeInputSchema>): string {
  const parts: string[] = [
    `Generate Remotion animation code for the following task:`,
    ``,
    `Task Type: ${params.task}`,
  ];

  switch (params.task) {
    case 'initial_setup': {
      parts.push(`Style: ${params.style || 'smooth'}`);
      if (params.plan) {
        parts.push(`Duration: ${params.plan.duration}s at ${params.plan.fps}fps`);
        parts.push(`Total frames: ${params.plan.duration * params.plan.fps}`);
        parts.push(`Scenes:`);
        for (const scene of params.plan.scenes) {
          const startFrame = Math.floor(scene.start * params.plan.fps);
          const endFrame = Math.floor(scene.end * params.plan.fps);
          parts.push(`  - "${scene.title}" (frames ${startFrame}–${endFrame}): ${scene.description}`);
        }
      }
      parts.push(``, `Create all foundational files: Root.tsx, Video.tsx, and sequences/MainSequence.tsx.`);
      break;
    }

    case 'create_component': {
      parts.push(`Component Name: ${params.name || 'AnimatedElement'}`);
      parts.push(`Description: ${params.description || 'An animated component'}`);
      if (params.animations?.length) {
        parts.push(`Animations:`);
        for (const anim of params.animations) {
          parts.push(`  - ${anim.property}: ${JSON.stringify(anim.from)} → ${JSON.stringify(anim.to)} (${anim.easing})`);
        }
      }
      if (params.timing) {
        parts.push(`Timing: starts at ${params.timing.start}s, duration ${params.timing.duration}s`);
      }
      break;
    }

    case 'create_scene': {
      if (params.scenes?.length) {
        parts.push(`Scene Segments:`);
        for (const scene of params.scenes) {
          parts.push(`  - ${scene.start}s–${scene.end}s: ${scene.description}`);
        }
      }
      if (params.components?.length) {
        parts.push(`Components to include: ${params.components.join(', ')}`);
      }
      break;
    }

    case 'modify_existing': {
      parts.push(`File: ${params.file || 'unknown'}`);
      parts.push(`Change: ${params.change || 'unspecified'}`);
      if (params.currentContent) {
        parts.push(``, `Current file content:`, '```', params.currentContent, '```');
      }
      parts.push(``, `Return the COMPLETE updated file, not a diff.`);
      break;
    }
  }

  parts.push(``, `Return ONLY valid JSON with the "files" array and "summary". No explanation before or after the JSON.`);

  return parts.join('\n');
}
