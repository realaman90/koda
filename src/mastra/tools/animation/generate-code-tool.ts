/**
 * generate_code Tool
 *
 * Subagent-as-tool: Calls the Theatre.js code generator subagent
 * to produce animation code. The orchestrator agent uses this tool
 * for ALL code generation — it never writes code directly.
 *
 * Based on ANIMATION_PLUGIN.md Part 10.4
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { codeGeneratorAgent } from '../../agents/code-generator-agent';
import { dockerProvider } from '@/lib/sandbox/docker-provider';

const GenerateCodeInputSchema = z.object({
  task: z.enum(['initial_setup', 'create_component', 'create_scene', 'modify_existing'])
    .describe('Type of code generation task'),

  // Sandbox ID — when provided, files are written directly to the sandbox
  // and ONLY paths/sizes are returned (saves tokens)
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

export const generateCodeTool = createTool({
  id: 'generate_code',
  description: `Generate Theatre.js animation code using a specialized code generation agent.

Use this for ALL code generation tasks:
- initial_setup: Create foundational project files (project.ts, useCurrentFrame.ts, App.tsx, MainScene.tsx)
- create_component: Create an animated component (e.g. BouncingBall.tsx)
- create_scene: Create/update the scene compositor (MainScene.tsx)
- modify_existing: Modify an existing file based on feedback

IMPORTANT: Always pass sandboxId so files are written directly to the sandbox.
This avoids passing large file contents through the conversation and saves tokens.
You do NOT need to call sandbox_write_file after generate_code when sandboxId is provided.`,

  inputSchema: GenerateCodeInputSchema,
  outputSchema: z.object({
    files: z.array(z.object({
      path: z.string(),
      size: z.number(),
    })),
    summary: z.string(),
    writtenToSandbox: z.boolean(),
  }),

  execute: async (inputData) => {
    // Format the request for the code generator subagent
    const prompt = formatCodeGenerationPrompt(inputData);

    try {
      // Call the subagent (non-streaming for tool result)
      // Enable thinking/reasoning — each provider ignores keys meant for others
      const result = await codeGeneratorAgent.generate([
        { role: 'user', content: prompt },
      ], {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 24576, thinkingLevel: 'high' } },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
        },
      });

      const fullResponse = result.text;

      // Parse the JSON response from the subagent
      // Try multiple extraction strategies: markdown code blocks first, then raw JSON
      const parsed = extractJSON(fullResponse);

      if (!parsed || !parsed.files || !Array.isArray(parsed.files)) {
        throw new Error('Code generator returned invalid structure: missing files array. Raw output: ' + fullResponse.slice(0, 300));
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
      // and return only paths/sizes (saves massive token usage)
      if (inputData.sandboxId) {
        const writeResults: Array<{ path: string; size: number }> = [];
        for (const file of files) {
          await dockerProvider.writeFile(inputData.sandboxId, file.path, file.content);
          writeResults.push({ path: file.path, size: file.content.length });
        }
        return {
          files: writeResults,
          summary: typeof parsed.summary === 'string' ? parsed.summary : 'Code generated and written to sandbox',
          writtenToSandbox: true,
        };
      }

      // No sandboxId — return paths and sizes only (content is too large for conversation)
      return {
        files: files.map(f => ({ path: f.path, size: f.content.length })),
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Code generated (no sandbox — files not written)',
        writtenToSandbox: false,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Code generator returned invalid JSON: ${error.message}`);
      }
      throw error;
    }
  },
});

/**
 * Extract JSON from an LLM response.
 * Tries multiple strategies in order:
 * 1. ```json ... ``` markdown code block
 * 2. ``` ... ``` generic code block
 * 3. First { to matching } with brace counting
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

  // Strategy 3: Find the outermost balanced JSON object using brace counting
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
 * Format the code generation prompt for the subagent
 */
function formatCodeGenerationPrompt(params: z.infer<typeof GenerateCodeInputSchema>): string {
  const parts: string[] = [
    `Generate Theatre.js code for the following task:`,
    ``,
    `Task Type: ${params.task}`,
  ];

  switch (params.task) {
    case 'initial_setup': {
      parts.push(`Style: ${params.style || 'smooth'}`);
      if (params.plan) {
        parts.push(`Duration: ${params.plan.duration}s at ${params.plan.fps}fps`);
        parts.push(`Scenes:`);
        for (const scene of params.plan.scenes) {
          parts.push(`  - "${scene.title}" (${scene.start}s–${scene.end}s): ${scene.description}`);
        }
      }
      parts.push(``, `Create all foundational files: main.tsx (with @theatre/studio import FIRST), project.ts, useCurrentFrame.ts, App.tsx, and MainScene.tsx.`);
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
