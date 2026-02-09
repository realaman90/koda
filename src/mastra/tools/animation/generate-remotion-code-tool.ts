/**
 * generate_remotion_code Tool
 *
 * Subagent-as-tool: Calls the Remotion code generator subagent
 * to produce animation code. Alternative to Theatre.js for A/B testing.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { remotionCodeGeneratorAgent } from '../../agents/remotion-code-generator-agent';
import { getSandboxProvider } from '@/lib/sandbox/sandbox-factory';
import { loadRecipes } from '../../recipes';

type ToolContext = { requestContext?: { get: (key: string) => any; set: (key: string, value: any) => void } };

/** Resolve sandboxId: prefer requestContext (server-set, correct), fallback to input (may be hallucinated by LLM).
 *  If requestContext has no sandboxId and input looks hallucinated (not matching koda-sandbox-* pattern),
 *  poll requestContext briefly — Gemini often fires sandbox_create + generate_remotion_code in parallel. */
async function resolveSandboxId(input: string | undefined, context?: ToolContext): Promise<string | undefined> {
  const fromCtx = context?.requestContext?.get('sandboxId') as string | undefined;
  if (fromCtx) return fromCtx;

  // If input looks like a real sandbox ID (matches Docker naming pattern), use it
  if (input && input.startsWith('koda-sandbox-')) return input;

  // Input is missing or looks hallucinated — wait for sandbox_create to populate requestContext
  // This handles Gemini's parallel tool call pattern where code gen starts before sandbox is ready
  if (context?.requestContext) {
    console.log(`[generate_remotion_code] No valid sandboxId yet (input="${input}") — waiting for sandbox_create...`);
    for (let i = 0; i < 60; i++) { // 60 × 500ms = 30s max wait
      await new Promise(r => setTimeout(r, 500));
      const polled = context.requestContext.get('sandboxId') as string | undefined;
      if (polled) {
        console.log(`[generate_remotion_code] Resolved sandboxId from requestContext after ${(i + 1) * 0.5}s: ${polled}`);
        return polled;
      }
      // Check if stream was closed (abort signal)
      const closed = context.requestContext.get('streamClosed') as boolean | undefined;
      if (closed) {
        console.log(`[generate_remotion_code] Stream closed while waiting for sandboxId — aborting`);
        return undefined;
      }
    }
    console.warn(`[generate_remotion_code] Timed out waiting for sandboxId after 30s`);
  }

  return input || undefined;
}

const GenerateRemotionCodeInputSchema = z.object({
  task: z.enum(['initial_setup', 'create_component', 'create_scene', 'modify_existing'])
    .describe('Type of code generation task'),

  // Sandbox ID — when provided, files are written directly to the sandbox
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

sandboxId is auto-resolved from server context — you do NOT need to pass it.
Files are written directly to the sandbox (saves tokens).

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

  execute: async (inputData, context) => {
    const ctx = context as ToolContext;

    // Serialize code generation — wait if another code gen is already in progress.
    // Models often call multiple generate_*_code tools in parallel, causing conflicting
    // file writes to the sandbox. This ensures they run sequentially.
    const currentActive = (ctx?.requestContext?.get('codeGenActive') as number) || 0;
    if (currentActive > 0 && ctx?.requestContext) {
      console.log(`[generate_remotion_code] Another code gen in progress (codeGenActive=${currentActive}) — waiting...`);
      for (let i = 0; i < 120; i++) { // 120 × 500ms = 60s max wait
        await new Promise(r => setTimeout(r, 500));
        const c = (ctx.requestContext.get('codeGenActive') as number) || 0;
        if (c === 0) {
          console.log(`[generate_remotion_code] Previous code gen finished after ${(i + 1) * 0.5}s — proceeding`);
          break;
        }
        const closed = ctx.requestContext.get('streamClosed') as boolean | undefined;
        if (closed) {
          console.log(`[generate_remotion_code] Stream closed while waiting — aborting`);
          return { files: [], summary: 'Stream closed', writtenToSandbox: false };
        }
        if (i === 119) {
          console.warn(`[generate_remotion_code] Timed out waiting for previous code gen after 60s — proceeding anyway`);
        }
      }
    }

    // Signal that code generation is in progress — render_final will wait for this
    const activeCount = (ctx?.requestContext?.get('codeGenActive') as number) || 0;
    ctx?.requestContext?.set('codeGenActive', activeCount + 1);
    console.log(`[generate_remotion_code] codeGenActive incremented to ${activeCount + 1}`);

    try {
    const sandboxId = await resolveSandboxId(inputData.sandboxId, context as ToolContext);

    // Validate sandboxId is available (critical for writing files)
    if (!sandboxId) {
      return {
        files: [],
        summary: 'ERROR: No sandboxId available. You MUST create a sandbox first with sandbox_create(template="remotion").',
        writtenToSandbox: false,
      };
    }

    // For modify_existing: auto-read current file content if not provided
    if (inputData.task === 'modify_existing' && !inputData.currentContent && inputData.file) {
      try {
        const filePath = inputData.file.startsWith('/') ? inputData.file : `/app/${inputData.file}`;
        const fileContent = await getSandboxProvider().readFile(sandboxId, filePath);
        if (fileContent) {
          inputData = { ...inputData, currentContent: fileContent };
          console.log(`[generate_remotion_code] Auto-read ${inputData.file} (${fileContent.length} chars) for modify_existing`);
        }
      } catch (err) {
        console.warn(`[generate_remotion_code] Could not auto-read ${inputData.file}:`, err);
      }
    }

    // For modify_existing without a specific file: read ALL src files so the subagent has full context
    if (inputData.task === 'modify_existing' && !inputData.file) {
      try {
        const listResult = await getSandboxProvider().runCommand(
          sandboxId,
          `find /app/src -name '*.tsx' -o -name '*.ts' | head -20`,
          { timeout: 5_000 }
        );
        const srcFiles = listResult.stdout.trim().split('\n').filter(Boolean);
        const fileContents: string[] = [];
        for (const f of srcFiles) {
          try {
            const content = await getSandboxProvider().readFile(sandboxId, f);
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

    // Auto-resolve designSpec from RequestContext if not passed as input arg
    let designSpec = inputData.designSpec;
    if (!designSpec) {
      designSpec = (context as ToolContext)?.requestContext?.get('designSpec') as string | undefined;
      if (designSpec) {
        console.log(`[generate_remotion_code] Auto-resolved designSpec from requestContext (${designSpec.length} chars)`);
      }
    }

    // Auto-resolve mediaFiles from RequestContext if not passed as input arg.
    // route.ts stores the full list of uploaded/pending media files so the code generator
    // knows about user-provided images without the LLM having to pass them explicitly.
    let mediaFiles = inputData.mediaFiles;
    if (!mediaFiles || mediaFiles.length === 0) {
      const ctxMediaFiles = (context as ToolContext)?.requestContext?.get('mediaFiles') as
        Array<{ path: string; type: 'image' | 'video'; description?: string }> | undefined;
      if (ctxMediaFiles && ctxMediaFiles.length > 0) {
        mediaFiles = ctxMediaFiles;
        console.log(`[generate_remotion_code] Auto-resolved ${mediaFiles.length} mediaFiles from requestContext`);
      }
    }

    // Log what the orchestrator passed (critical for debugging quality issues)
    console.log(`[generate_remotion_code] task=${inputData.task}, sandboxId=${sandboxId}, designSpec=${designSpec ? `YES (${designSpec.length} chars)` : 'NO — output will be GENERIC'}, mediaFiles=${mediaFiles?.length || 0}, techniques=${inputData.techniques?.length || 0}`);

    // Format the request for the code generator subagent (use resolved designSpec + mediaFiles)
    const prompt = formatRemotionCodeGenerationPrompt({ ...inputData, designSpec, mediaFiles });

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

        // Post-processing: auto-fix localhost URLs → staticFile() calls.
        // Code gen models sometimes generate http://localhost:3000/public/media/... URLs
        // which FAIL during bunx remotion render (no dev server running).
        const localhostPattern = /(?:["'`])https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/public\/(media\/[^"'`\s]+)(?:["'`])/g;
        let match;
        let fixedContent = file.content;
        let fixCount = 0;
        while ((match = localhostPattern.exec(file.content)) !== null) {
          const fullMatch = match[0];
          const mediaPath = match[1]; // e.g. "media/logo.png"
          const quote = fullMatch[0]; // the opening quote character
          // Replace with {staticFile("media/...")} — the JSX expression form
          const replacement = `{staticFile("${mediaPath}")}`;
          fixedContent = fixedContent.replace(fullMatch, replacement);
          fixCount++;
        }
        if (fixCount > 0) {
          console.warn(`[generate_remotion_code] ⚠️ Auto-fixed ${fixCount} localhost URL(s) → staticFile() in ${file.path}`);
          // Also ensure staticFile is imported if not already
          if (!fixedContent.includes('staticFile') || !fixedContent.match(/import\s*{[^}]*staticFile[^}]*}\s*from\s*['"]remotion['"]/)) {
            // Try to add staticFile to existing remotion import
            const remotionImportRegex = /import\s*{([^}]*)}\s*from\s*['"]remotion['"]/;
            const importMatch = fixedContent.match(remotionImportRegex);
            if (importMatch && !importMatch[1].includes('staticFile')) {
              fixedContent = fixedContent.replace(remotionImportRegex, `import {${importMatch[1]}, staticFile} from 'remotion'`);
            }
          }
          file.content = fixedContent;
        }
      }

      // Write files directly to the sandbox
      if (sandboxId) {
        const writeResults: Array<{ path: string; size: number }> = [];
        for (const file of files) {
          await getSandboxProvider().writeFile(sandboxId, file.path, file.content);
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
    } finally {
      // Signal code generation complete — render_final can proceed
      const current = (ctx?.requestContext?.get('codeGenActive') as number) || 1;
      ctx?.requestContext?.set('codeGenActive', Math.max(0, current - 1));
      console.log(`[generate_remotion_code] codeGenActive decremented to ${Math.max(0, current - 1)}`);
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
    parts.push(`Feature ALL of these prominently — the user provided them for a reason.`);
    parts.push(`ROLE HINTS: Check descriptions and the design spec for assigned roles:`);
    parts.push(`- Logo/brand → centered placement, scale-in animation, optional subtle pulse or glow, use in intro/outro`);
    parts.push(`- Product/hero → full-screen or large showcase, smooth entrance, highlight effects`);
    parts.push(`- Portrait → circular crop or framed, parallax motion, name/title overlay if appropriate`);
    parts.push(`- Background → full-bleed behind content, slow pan/zoom/parallax layers`);
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

  // ── Font loading guidance ──
  parts.push(``);
  parts.push(`## FONTS`);
  parts.push(`Use @remotion/google-fonts for custom typography. Import pattern:`);
  parts.push(`\`\`\``);
  parts.push(`import { loadFont } from "@remotion/google-fonts/Inter";`);
  parts.push(`const { fontFamily } = loadFont();`);
  parts.push(`// Then use: style={{ fontFamily }}`);
  parts.push(`\`\`\``);
  parts.push(`Font module names: remove spaces from Google Font name → PascalCase.`);
  parts.push(`Example: "Playfair Display" → PlayfairDisplay, "Space Grotesk" → SpaceGrotesk`);
  parts.push(`SAFE fonts (guaranteed available): Inter, Roboto, Lato, Montserrat, Oswald, Raleway, Poppins, Ubuntu, Nunito, PlayfairDisplay, SpaceGrotesk, DMSans, Manrope, Sora`);
  parts.push(`If you need a font NOT in this list, it may still work — but prefer these for reliability.`);
  parts.push(``);

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
      parts.push(`□ Background matches the CONTENT theme — NOT default dark/indigo`);
      parts.push(`□ If content is product/lifestyle/corporate → use LIGHT background (#FAFAFA, white gradients)`);
      parts.push(`□ If content is tech/developer → dark is OK but use specific brand colors, NOT generic #0A0A0B`);
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
