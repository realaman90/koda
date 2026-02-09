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
import { getSandboxProvider } from '@/lib/sandbox/sandbox-factory';
import { loadRecipes } from '../../recipes';

type ToolContext = { requestContext?: { get: (key: string) => any; set: (key: string, value: any) => void } };

/** Resolve sandboxId: prefer requestContext (server-set, correct), fallback to input (may be hallucinated by LLM).
 *  If requestContext has no sandboxId and input looks hallucinated (not matching koda-sandbox-* pattern),
 *  poll requestContext briefly — Gemini often fires sandbox_create + generate_code in parallel. */
async function resolveSandboxId(input: string | undefined, context?: ToolContext): Promise<string | undefined> {
  const fromCtx = context?.requestContext?.get('sandboxId') as string | undefined;
  if (fromCtx) return fromCtx;

  // If input looks like a real sandbox ID (matches Docker naming pattern), use it
  if (input && input.startsWith('koda-sandbox-')) return input;

  // Input is missing or looks hallucinated — wait for sandbox_create to populate requestContext
  if (context?.requestContext) {
    console.log(`[generate_code] No valid sandboxId yet (input="${input}") — waiting for sandbox_create...`);
    for (let i = 0; i < 60; i++) { // 60 × 500ms = 30s max wait
      await new Promise(r => setTimeout(r, 500));
      const polled = context.requestContext.get('sandboxId') as string | undefined;
      if (polled) {
        console.log(`[generate_code] Resolved sandboxId from requestContext after ${(i + 1) * 0.5}s: ${polled}`);
        return polled;
      }
      const closed = context.requestContext.get('streamClosed') as boolean | undefined;
      if (closed) {
        console.log(`[generate_code] Stream closed while waiting for sandboxId — aborting`);
        return undefined;
      }
    }
    console.warn(`[generate_code] Timed out waiting for sandboxId after 30s`);
  }

  return input || undefined;
}

const GenerateCodeInputSchema = z.object({
  task: z.enum(['initial_setup', 'create_component', 'create_scene', 'modify_existing'])
    .describe('Type of code generation task'),

  // Sandbox ID — when provided, files are written directly to the sandbox
  // and ONLY paths/sizes are returned (saves tokens)
  sandboxId: z.string().optional().describe('Override sandbox ID (auto-resolved from context if omitted)'),

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

  // Media files (auto-resolved from RequestContext if omitted)
  mediaFiles: z.array(z.object({
    path: z.string().describe('File path relative to /app/ (e.g. "public/media/photo.jpg")'),
    type: z.enum(['image', 'video']).describe('Media type'),
    description: z.string().optional().describe('What this media shows / how it should be used'),
  })).optional().describe('Media files uploaded to the sandbox. Pass ALL user-provided media here.'),

  // Design spec (auto-resolved from RequestContext if omitted)
  designSpec: z.string().optional().describe('Design specification from the plan (auto-resolved from context if omitted)'),

  // Technique recipe IDs
  techniques: z.array(z.string()).optional().describe('Technique recipe IDs to inject patterns (auto-resolved from context if omitted)'),
});

export const generateCodeTool = createTool({
  id: 'generate_code',
  description: `Generate Theatre.js animation code using a specialized code generation agent.

Use this for ALL code generation tasks:
- initial_setup: Create foundational project files (project.ts, useCurrentFrame.ts, App.tsx, MainScene.tsx)
- create_component: Create an animated component (e.g. BouncingBall.tsx)
- create_scene: Create/update the scene compositor (MainScene.tsx)
- modify_existing: Modify an existing file based on feedback

sandboxId is auto-resolved from server context — you do NOT need to pass it.
Files are written directly to the sandbox (saves tokens).
You do NOT need to call sandbox_write_file after this tool.`,

  inputSchema: GenerateCodeInputSchema,
  outputSchema: z.object({
    files: z.array(z.object({
      path: z.string(),
      size: z.number(),
    })),
    summary: z.string(),
    writtenToSandbox: z.boolean(),
    reasoning: z.string().optional(),
  }),

  execute: async (inputData, context) => {
    const sandboxId = await resolveSandboxId(inputData.sandboxId, context as ToolContext);

    // Auto-resolve designSpec from RequestContext if not passed as input arg
    let designSpec = inputData.designSpec;
    if (!designSpec) {
      designSpec = (context as ToolContext)?.requestContext?.get('designSpec') as string | undefined;
      if (designSpec) {
        console.log(`[generate_code] Auto-resolved designSpec from requestContext (${designSpec.length} chars)`);
      }
    }

    // Auto-resolve mediaFiles from RequestContext if not passed as input arg
    let mediaFiles = inputData.mediaFiles;
    if (!mediaFiles || mediaFiles.length === 0) {
      const ctxMediaFiles = (context as ToolContext)?.requestContext?.get('mediaFiles') as
        Array<{ path: string; type: 'image' | 'video'; description?: string }> | undefined;
      if (ctxMediaFiles && ctxMediaFiles.length > 0) {
        mediaFiles = ctxMediaFiles;
        console.log(`[generate_code] Auto-resolved ${mediaFiles.length} mediaFiles from requestContext`);
      }
    }

    // Log what the orchestrator passed (critical for debugging quality issues)
    console.log(`[generate_code] task=${inputData.task}, sandboxId=${sandboxId || 'NONE'}, designSpec=${designSpec ? `YES (${designSpec.length} chars)` : 'NO'}, mediaFiles=${mediaFiles?.length || 0}, techniques=${inputData.techniques?.length || 0}`);

    // Format the request for the code generator subagent (use resolved designSpec + mediaFiles)
    const prompt = formatCodeGenerationPrompt({ ...inputData, designSpec, mediaFiles });

    try {
      // Call the subagent (non-streaming for tool result)
      // Enable thinking/reasoning — each provider ignores keys meant for others
      const result = await codeGeneratorAgent.generate([
        { role: 'user', content: prompt },
      ], {
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 24576, includeThoughts: true } },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
        },
      });

      const fullResponse = result.text;
      const reasoning = (result as Record<string, unknown>).reasoningText as string | undefined;

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

      // Write files directly to the sandbox (saves massive token usage)
      if (sandboxId) {
        const writeResults: Array<{ path: string; size: number }> = [];
        for (const file of files) {
          await getSandboxProvider().writeFile(sandboxId, file.path, file.content);
          writeResults.push({ path: file.path, size: file.content.length });
        }
        return {
          files: writeResults,
          summary: typeof parsed.summary === 'string' ? parsed.summary : 'Code generated and written to sandbox',
          writtenToSandbox: true,
          reasoning,
        };
      }

      // No sandboxId — return paths and sizes only (content is too large for conversation)
      return {
        files: files.map(f => ({ path: f.path, size: f.content.length })),
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Code generated (no sandbox — files not written)',
        writtenToSandbox: false,
        reasoning,
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

  // ── Design spec ──
  if (params.designSpec) {
    parts.push(``);
    parts.push(`## DESIGN SPECIFICATION — FOLLOW EXACTLY`);
    parts.push(params.designSpec);
    parts.push(``);
  }

  // ── Media files ──
  if (params.mediaFiles && params.mediaFiles.length > 0) {
    parts.push(``);
    parts.push(`## MEDIA FILES — MUST USE`);
    for (const mf of params.mediaFiles) {
      // Theatre.js uses public/ relative paths with useGLTF or HTML <img>
      const publicRef = mf.path.replace('public/', '/');
      parts.push(`- [${mf.type}] "${publicRef}"${mf.description ? ` — ${mf.description}` : ''}`);
    }
    parts.push(`Reference images using: <img src="${'{'}publicRef${'}'}" /> or as texture in R3F.`);
    parts.push(`Feature ALL of these prominently — the user provided them for a reason.`);
    parts.push(`ROLE HINTS: Check descriptions and the design spec for assigned roles:`);
    parts.push(`- Logo/brand → centered placement, scale-in animation, subtle glow, use in intro/outro`);
    parts.push(`- Product/hero → full-screen showcase, smooth entrance, highlight effects`);
    parts.push(`- Portrait → circular crop or framed, parallax motion`);
    parts.push(`- Background → full-bleed behind content, slow pan/zoom/parallax`);
    parts.push(`If the design spec assigns specific roles to files, follow those assignments exactly.`);
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

  if (params.task !== 'modify_existing') {
    parts.push(``);
    parts.push(`## QUALITY CHECKLIST — verify before returning`);
    if (params.designSpec) {
      parts.push(`□ Background uses the exact gradient/colors from the design spec`);
      parts.push(`□ Typography sizes match the spec (hero text 80-120px, not default small)`);
      parts.push(`□ All colors from the spec — NOT generic indigo/purple defaults`);
    } else {
      parts.push(`□ Background uses a gradient, not a flat solid color`);
      parts.push(`□ Hero text is large (80-120px), not default small`);
    }
    parts.push(`□ Spring configs use specific values, not generic defaults`);
    parts.push(`□ At least 2 premium effects (gradient text, glow, glass, particles)`);
    parts.push(`□ Staggered timing — elements enter one by one, NOT all at once`);
    parts.push(`□ Visual hierarchy — ONE dominant element, rest supporting`);
    parts.push(`If ANY fail, fix before returning.`);
  }

  return parts.join('\n');
}
