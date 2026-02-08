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
    reasoning: z.string().optional(),
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

    // Log what the orchestrator passed (critical for debugging quality issues)
    console.log(`[generate_remotion_code] task=${inputData.task}, designSpec=${inputData.designSpec ? `YES (${inputData.designSpec.length} chars)` : 'NO — output will be GENERIC'}, mediaFiles=${inputData.mediaFiles?.length || 0}, techniques=${inputData.techniques?.length || 0}`);

    // Format the request for the code generator subagent
    const prompt = formatRemotionCodeGenerationPrompt(inputData);

    try {
      // Call the subagent (non-streaming for tool result)
      // Enable thinking/reasoning — each provider ignores keys meant for others
      const result = await remotionCodeGeneratorAgent.generate([
        { role: 'user', content: prompt },
      ], {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 24576, includeThoughts: true } },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
        },
      });

      const fullResponse = result.text;
      const reasoning = (result as Record<string, unknown>).reasoningText as string | undefined;

      // Log for debugging
      console.log(`[generate_remotion_code] Subagent response length: ${fullResponse.length}${reasoning ? `, reasoning: ${reasoning.length} chars` : ''}`);


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
          reasoning,
        };
      }

      // No sandboxId — return paths and sizes only
      return {
        files: files.map(f => ({ path: f.path, size: f.content.length })),
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Remotion code generated (no sandbox — files not written)',
        writtenToSandbox: false,
        reasoning,
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

  // ── Header ──
  parts.push(`# REMOTION CODE GENERATION`);
  parts.push(`Task: ${params.task}`);
  parts.push(``);

  // ── Design Specification (if provided) ──
  if (params.designSpec) {
    parts.push(`## DESIGN SPECIFICATION — FOLLOW EXACTLY`);
    parts.push(`Every color, dimension, font, spring config, and effect below was carefully chosen.`);
    parts.push(`Use these EXACT values. Do NOT substitute with generic defaults.`);
    parts.push(``);
    parts.push(params.designSpec);
    parts.push(``);
  }

  // ── Task-specific details ──
  switch (params.task) {
    case 'initial_setup': {
      parts.push(`## SCENES TO IMPLEMENT`);
      parts.push(`Style: ${params.style || 'smooth'}`);
      if (params.plan) {
        parts.push(`Duration: ${params.plan.duration}s at ${params.plan.fps}fps (${params.plan.duration * params.plan.fps} total frames)`);
        parts.push(``);
        for (const scene of params.plan.scenes) {
          const startFrame = Math.floor(scene.start * params.plan.fps);
          const endFrame = Math.floor(scene.end * params.plan.fps);
          parts.push(`### Scene: "${scene.title}" (frames ${startFrame}–${endFrame})`);
          parts.push(`${scene.description}`);
          if (params.designSpec) {
            parts.push(`→ Apply the matching scene section from the DESIGN SPECIFICATION above.`);
            parts.push(`→ Use its exact colors, typography, spring configs, and effects for this scene.`);
          }
          parts.push(``);
        }
      }
      parts.push(`Create: Root.tsx, Video.tsx, sequences/MainSequence.tsx (and component files as needed).`);
      break;
    }

    case 'create_component': {
      parts.push(`## COMPONENT TO CREATE`);
      parts.push(`Name: ${params.name || 'AnimatedElement'}`);
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
      parts.push(`## SCENE TO CREATE`);
      if (params.scenes?.length) {
        for (const scene of params.scenes) {
          parts.push(`- ${scene.start}s–${scene.end}s: ${scene.description}`);
        }
      }
      if (params.components?.length) {
        parts.push(`Components to include: ${params.components.join(', ')}`);
      }
      if (params.designSpec) {
        parts.push(``);
        parts.push(`→ Use the colors, typography, and effects from the DESIGN SPECIFICATION above.`);
      }
      break;
    }

    case 'modify_existing': {
      parts.push(`## FILE TO MODIFY`);
      parts.push(`File: ${params.file || 'unknown'}`);
      parts.push(`Change: ${params.change || 'unspecified'}`);
      if (params.currentContent) {
        parts.push(``);
        parts.push(`CURRENT FILE (modify THIS — do NOT generate from scratch):`);
        parts.push('```tsx');
        parts.push(params.currentContent);
        parts.push('```');
        parts.push(``);
        parts.push(`Apply ONLY the requested change. Keep everything else EXACTLY the same.`);
        parts.push(`Return the COMPLETE updated file.`);
      } else {
        parts.push(`No current content — generate a reasonable implementation.`);
      }
      break;
    }
  }

  // ── Media files ──
  if (params.mediaFiles && params.mediaFiles.length > 0) {
    parts.push(``);
    parts.push(`## MEDIA FILES — MUST USE`);
    for (const mf of params.mediaFiles) {
      const remotionRef = mf.path.replace('public/', '');
      parts.push(`- [${mf.type}] staticFile("${remotionRef}")${mf.description ? ` — ${mf.description}` : ''}`);
    }
    parts.push(`Import: { Img, OffthreadVideo, staticFile } from 'remotion'`);
    parts.push(`Feature these prominently — the user provided them for a reason.`);
    parts.push(``);
  }

  // ── Technique recipes ──
  if (params.techniques && params.techniques.length > 0) {
    const recipeContent = loadRecipes(params.techniques);
    if (recipeContent) {
      parts.push(``);
      parts.push(`## TECHNIQUE RECIPES — FOLLOW PATTERNS`);
      parts.push(recipeContent);
      parts.push(``);
    }
  }

  // ── Output format + quality checklist ──
  parts.push(``);
  parts.push(`## OUTPUT`);
  parts.push(`Return ONLY valid JSON: { "files": [{ "path": "...", "content": "..." }], "summary": "..." }`);
  parts.push(``);

  // Quality checklist at the END (recency bias — model reads this last)
  if (params.task !== 'modify_existing') {
    parts.push(`## QUALITY CHECKLIST — verify before returning`);
    if (params.designSpec) {
      parts.push(`□ Background uses the exact gradient/colors from the design spec`);
      parts.push(`□ Typography sizes match the spec (hero text 80-120px, not default small)`);
      parts.push(`□ Spring configs use the spec values, not generic { damping: 10, stiffness: 100 }`);
      parts.push(`□ All colors from the spec — NOT generic indigo/purple defaults`);
    } else {
      parts.push(`□ Background is a gradient (not a flat solid color)`);
      parts.push(`□ Hero text is large (80-120px), not default small`);
    }
    parts.push(`□ At least 2 premium effects (gradient text, glow, glass, particles, animated border)`);
    parts.push(`□ Staggered timing — elements enter one by one, NOT all at once`);
    parts.push(`□ Visual hierarchy — ONE dominant element per scene, rest supporting`);
    parts.push(`□ Generous whitespace (padding 48-80px)`);
    parts.push(`If ANY fail, your output will look amateur. Fix before returning.`);
  }

  return parts.join('\n');
}
