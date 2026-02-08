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
import { loadRecipes } from '../../recipes';

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

  // Full design specification from the enhance_animation_prompt tool
  designSpec: z.string().optional().describe('Full enhanced prompt / design specification. The code generator MUST use exact hex colors, pixel dimensions, spring configs, and typography from this.'),

  // For modify_existing
  file: z.string().optional().describe('File path to modify'),
  currentContent: z.string().optional().describe('Current file content'),
  change: z.string().optional().describe('Description of what to change'),

  // Technique presets — recipe patterns injected into code gen prompt
  techniques: z.array(z.string()).optional().describe('Selected technique preset IDs (e.g. "3d-scenes", "particles"). Passes recipe patterns to the code generator.'),

  // Media files already uploaded to the sandbox — tells the code generator what's available
  mediaFiles: z.array(z.object({
    path: z.string().describe('File path relative to /app/ (e.g. "public/media/photo.jpg")'),
    type: z.enum(['image', 'video']).describe('Media type'),
    description: z.string().optional().describe('What this media shows / how it should be used'),
  })).optional().describe('Media files already uploaded to the sandbox. The code generator MUST reference these using staticFile("media/filename") for images or <OffthreadVideo> for videos. ALWAYS pass this when user-provided media was uploaded.'),
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
This avoids passing large file contents through the conversation and saves tokens.

CRITICAL: If you uploaded media files to the sandbox (via sandbox_upload_media or sandbox_write_binary),
you MUST pass them via the mediaFiles parameter. The code generator cannot see the sandbox filesystem —
it only knows about media files you explicitly tell it about. Without mediaFiles, user images will be ignored.

If the user selected technique presets (available in your context), pass their IDs via the techniques parameter.
This injects recipe patterns (tested code snippets) directly into the code generator for higher quality output.`,

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

    // For modify_existing: auto-read current file content if not provided
    if (inputData.task === 'modify_existing' && !inputData.currentContent && inputData.file && inputData.sandboxId) {
      try {
        const filePath = inputData.file.startsWith('/') ? inputData.file : `/app/${inputData.file}`;
        const fileContent = await dockerProvider.readFile(inputData.sandboxId, filePath);
        if (fileContent) {
          inputData = { ...inputData, currentContent: fileContent };
          console.log(`[generate_remotion_code] Auto-read ${inputData.file} (${fileContent.length} chars) for modify_existing`);
        }
      } catch (err) {
        console.warn(`[generate_remotion_code] Could not auto-read ${inputData.file}:`, err);
      }
    }

    // For modify_existing without a specific file: read ALL src files so the subagent has full context
    if (inputData.task === 'modify_existing' && !inputData.file && inputData.sandboxId) {
      try {
        const listResult = await dockerProvider.runCommand(
          inputData.sandboxId,
          `find /app/src -name '*.tsx' -o -name '*.ts' | head -20`,
          { timeout: 5_000 }
        );
        const srcFiles = listResult.stdout.trim().split('\n').filter(Boolean);
        const fileContents: string[] = [];
        for (const f of srcFiles) {
          try {
            const content = await dockerProvider.readFile(inputData.sandboxId, f);
            if (content) {
              const relativePath = f.replace('/app/', '');
              fileContents.push(`--- ${relativePath} ---\n${content}`);
            }
          } catch { /* skip unreadable files */ }
        }
        if (fileContents.length > 0) {
          inputData = {
            ...inputData,
            currentContent: fileContents.join('\n\n'),
            file: 'multiple files (see currentContent)',
          };
          console.log(`[generate_remotion_code] Auto-read ${srcFiles.length} source files for modify_existing`);
        }
      } catch (err) {
        console.warn(`[generate_remotion_code] Could not auto-read source files:`, err);
      }
    }

    // Format the request for the code generator subagent
    const prompt = formatRemotionCodeGenerationPrompt(inputData);

    try {
      // Call the subagent (non-streaming for tool result)
      // Enable thinking/reasoning — each provider ignores keys meant for others
      const result = await remotionCodeGeneratorAgent.generate([
        { role: 'user', content: prompt },
      ], {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 24576, thinkingLevel: 'high' } },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
        },
      });

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
  const parts: string[] = [];

  // Prepend design spec at the TOP if provided
  if (params.designSpec) {
    parts.push(`═══════════════════════════════════════════════`);
    parts.push(`DESIGN SPECIFICATION — USE THESE EXACT VALUES`);
    parts.push(`═══════════════════════════════════════════════`);
    parts.push(``);
    parts.push(params.designSpec);
    parts.push(``);
    parts.push(`═══════════════════════════════════════════════`);
    parts.push(``);
  }

  parts.push(`Generate Remotion animation code for the following task:`);
  parts.push(``);
  parts.push(`Task Type: ${params.task}`);

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
      parts.push(`Change requested: ${params.change || 'unspecified'}`);
      if (params.currentContent) {
        parts.push(``);
        parts.push(`CURRENT FILE CONTENT (you MUST modify THIS code — do NOT generate from scratch):`);
        parts.push('```tsx');
        parts.push(params.currentContent);
        parts.push('```');
        parts.push(``);
        parts.push(`INSTRUCTIONS: Apply ONLY the requested change to the code above. Keep everything else EXACTLY the same.`);
        parts.push(`Return the COMPLETE updated file with the change applied, not a diff or partial snippet.`);
      } else {
        parts.push(`WARNING: No current file content available. Generate a reasonable implementation based on the change description.`);
        parts.push(`Return the COMPLETE file, not a diff.`);
      }
      break;
    }
  }

  if (params.designSpec) {
    parts.push(``, `CRITICAL: You MUST use the exact hex colors, pixel dimensions, font specs, and spring configs from the DESIGN SPECIFICATION above. Do NOT substitute with defaults.`);
  }

  // Inject media files info so the code generator knows what's available
  if (params.mediaFiles && params.mediaFiles.length > 0) {
    parts.push(``);
    parts.push(`═══════════════════════════════════════════════`);
    parts.push(`MEDIA FILES IN SANDBOX — YOU MUST USE THESE`);
    parts.push(`═══════════════════════════════════════════════`);
    parts.push(``);
    for (const mf of params.mediaFiles) {
      const remotionRef = mf.path.replace('public/', '');
      parts.push(`- [${mf.type}] ${mf.path} → use staticFile("${remotionRef}")${mf.description ? ` — ${mf.description}` : ''}`);
    }
    parts.push(``);
    parts.push(`CRITICAL: These files are already in the sandbox. You MUST incorporate them in your code.`);
    parts.push(`- For images: import { Img } from 'remotion'; then <Img src={staticFile("${params.mediaFiles[0].path.replace('public/', '')}")} />`);
    parts.push(`- For videos: import { OffthreadVideo } from 'remotion'; then <OffthreadVideo src={staticFile("${params.mediaFiles[0].path.replace('public/', '')}")} />`);
    parts.push(`- import { staticFile } from 'remotion';`);
    parts.push(`- The user EXPLICITLY provided these — ignoring them is a critical failure.`);
    parts.push(``);
  }

  // Inject technique recipes if provided
  if (params.techniques && params.techniques.length > 0) {
    const recipeContent = loadRecipes(params.techniques);
    if (recipeContent) {
      parts.push(``, recipeContent);
      parts.push(``, `IMPORTANT: Follow the technique recipe patterns above closely. They contain tested, working code.`);
    }
  }

  parts.push(``, `Return ONLY valid JSON with the "files" array and "summary". No explanation before or after the JSON.`);

  return parts.join('\n');
}
