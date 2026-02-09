# Animation Plugin Issues - Feb 2026

## Issue Summary

| # | Issue | Priority | Category | Est. Effort |
|---|-------|----------|----------|-------------|
| 1 | Live Preview always fails (composition ID issue) | P0 | Bug | Medium |
| 2 | Generation time too slow (10+ min → 1-2 min) | P0 | Performance | Large |
| 3 | Output quality feels basic, not premium | P1 | Quality | Medium |
| 4 | Enhance prompt runs even when prompt is detailed | P1 | Logic | Small |
| 5 | Screenshot tool errors | P1 | Bug | Medium |
| 6 | UI: Events not in chronological order | P2 | UI | Medium |
| 7 | UI: "Set up Theatre.js project" hardcoded | P2 | UI | Small |
| 8 | Model cost optimization strategy | P2 | Architecture | Medium |

---

## Issue 1: Live Preview Always Fails

**Priority:** P0 (Critical)
**Category:** Bug
**Component:** Remotion Proxy / Preview

### Problem
Live preview in Remotion shows error:
```
Composition with ID api/plugins/animation/sandbox/koda-sandbox-xxx/proxy not found.
```

Even though:
- Docker container is running
- Remotion dev server is active inside container
- Direct access to container port works

### Root Cause
Remotion Studio uses client-side routing. When iframe loads `/api/plugins/animation/sandbox/.../proxy`, Remotion interprets the URL path as a composition ID instead of using the actual composition "MainVideo".

### Current Fix Attempted
Added `?selected=MainVideo` to proxy URL - but still failing.

### Investigation Needed
1. Check if Remotion has a different URL format for direct composition access
2. Consider using Remotion Player component instead of full Studio
3. May need to rewrite URL handling in Remotion's client-side bundle

### Proposed Solution
Create a dedicated "player-only" page in the sandbox that uses `@remotion/player` instead of the full Remotion Studio interface. This gives us:
- Direct composition rendering without Studio UI
- No URL routing conflicts
- Cleaner preview experience

### Files to Modify
- `templates/remotion-sandbox/template/src/Player.tsx` (NEW)
- `templates/remotion-sandbox/template/src/index.html` (NEW)
- `src/app/api/plugins/animation/sandbox/[sandboxId]/proxy/[[...path]]/route.ts`

---

## Issue 2: Generation Time Too Slow

**Priority:** P0 (Critical)
**Category:** Performance
**Component:** Agent Pipeline

### Problem
Animation generation takes 10+ minutes. Target: 1-2 minutes.

### Current Pipeline Analysis
1. `enhance_animation_prompt` - Sonnet 4.5 call (~5-10s)
2. `analyze_prompt` - Sonnet 4.5 call (~3-5s)
3. `generate_plan` - Sonnet 4.5 call (~5-10s)
4. `sandbox_create` - Docker container creation (~2-3s)
5. `generate_remotion_code` (initial_setup) - Opus/Sonnet call (~30-60s)
6. `generate_remotion_code` (per scene × N) - Opus/Sonnet call (~30-60s each)
7. `sandbox_start_preview` - npm install + dev server (~30-60s)
8. `sandbox_screenshot` - Puppeteer screenshot (~5-10s)

**Total estimated: 3-5 minutes minimum, often 10+ due to retries and errors**

### Bottlenecks Identified
1. **Multiple LLM calls** - Each tool call is a separate API request
2. **Code generation per scene** - N scenes = N LLM calls
3. **npm install every time** - Even though deps are pre-installed in image
4. **Error retries** - Failures add significant time

### Proposed Optimizations

#### A. Parallel Tool Execution
- Run `enhance_prompt` and `analyze_prompt` in parallel
- Generate all scene components in a single LLM call (batch)

#### B. Use Faster Models for Simple Tasks
| Task | Current | Proposed |
|------|---------|----------|
| enhance_prompt | Sonnet 4.5 | Sonnet 4.5 (keep) |
| analyze_prompt | Sonnet 4.5 | Haiku 3.5 |
| generate_plan | Sonnet 4.5 | Sonnet 4.5 (keep) |
| code_generation | Sonnet 4.5 | Sonnet 4.5 (keep) |
| UI tools | Sonnet 4.5 | Haiku 3.5 |

#### C. Reduce LLM Round-Trips
- Combine `enhance_prompt` + `analyze_prompt` + `generate_plan` into single call
- Generate ALL code in one `generate_remotion_code` call instead of per-scene

#### D. Pre-warm Containers
- Keep a pool of ready containers
- Skip npm install (already in image)

### Target Timeline
| Phase | Target Time |
|-------|-------------|
| Planning (enhance + analyze + plan) | 15-20s |
| Sandbox creation | 2-3s |
| Code generation (all at once) | 45-60s |
| Preview startup | 10-15s |
| Verification screenshot | 5-10s |
| **Total** | **~90 seconds** |

---

## Issue 3: Output Quality Feels Basic

**Priority:** P1
**Category:** Quality
**Component:** Code Generation

### Problem
Generated Remotion animations look generic/basic, not premium like Cursor/Linear/Vercel.

### Symptoms
- Default colors instead of specified hex codes
- Generic spring animations instead of specified configs
- Missing polish effects (glows, gradients, particles)
- Basic typography instead of specified fonts

### Root Cause Analysis
1. **Enhanced prompt not being passed through** - Code generator may not be receiving the full design spec
2. **Code generator ignoring specs** - Even when specs are provided, generator uses defaults
3. **Missing examples in instructions** - Generator doesn't have enough reference for "premium"

### Proposed Solutions

#### A. Verify Prompt Chain
Add logging to verify enhanced prompt reaches code generator with full design spec.

#### B. Strengthen Code Generator Instructions
Add explicit "MUST USE" section with examples:
```
WRONG: background: '#000'
RIGHT: background: '#0A0A0B' (from spec)

WRONG: spring({ damping: 10 })
RIGHT: spring({ damping: 20, stiffness: 200 }) (from spec)
```

#### C. Add Premium Component Library
Create pre-built premium components:
- `GlassCard` - Backdrop blur, gradient border
- `GlowButton` - Gradient fill, glow effect
- `TypeWriter` - Character-by-character with cursor
- `AnimatedNumber` - Count-up with easing
- `ParticleField` - Ambient floating particles

#### D. Use Opus for Code Generation
Test if Opus 4.5 produces significantly better quality code.

---

## Issue 4: Enhance Prompt Runs Unnecessarily

**Priority:** P1
**Category:** Logic
**Component:** Animation Agent

### Problem
`enhance_animation_prompt` runs even when user provides a detailed prompt with exact specs.

### Current Behavior
Agent always calls enhance tool first, regardless of prompt detail level.

### Proposed Solution
Add heuristic check before enhancement:

```typescript
function shouldEnhancePrompt(prompt: string): boolean {
  // Check for presence of specific design values
  const hasHexColors = /#[0-9A-Fa-f]{6}/.test(prompt);
  const hasPixelValues = /\d+px/.test(prompt);
  const hasSpringConfig = /damping|stiffness|mass/.test(prompt);
  const hasFontSpecs = /font.*\d+px|Inter|SF Pro|JetBrains/.test(prompt);

  // If prompt has 3+ specific values, skip enhancement
  const specificityScore = [hasHexColors, hasPixelValues, hasSpringConfig, hasFontSpecs]
    .filter(Boolean).length;

  return specificityScore < 3;
}
```

### Files to Modify
- `src/mastra/agents/instructions/animation.ts`
- `src/mastra/tools/animation/planning-tools.ts` (add check in analyze_prompt)

---

## Issue 5: Screenshot Tool Errors

**Priority:** P1
**Category:** Bug
**Component:** Sandbox Tools

### Problem
Screenshot tool fails with errors.

### Investigation Needed
- Check Puppeteer installation in Docker image
- Verify Chromium is accessible
- Check if composition is ready before screenshot

### Common Failure Modes
1. Puppeteer can't find Chromium
2. Page not fully loaded when screenshot taken
3. Remotion composition not rendered

### Proposed Solution
Add retry logic and wait for composition ready state:

```typescript
// Wait for Remotion to be ready
await page.waitForFunction(() => {
  return window.__REMOTION_COMPONENT_READY__ === true;
}, { timeout: 30000 });
```

---

## Issue 6: UI Events Not in Chronological Order

**Priority:** P2
**Category:** UI
**Component:** AnimationNode

### Problem
Tool calls, thinking messages, and text streams appear out of order in the UI.

### Expected Behavior
Events should appear in exact order of occurrence:
1. Tool call starts → show "Running X..."
2. Thinking message → show thinking
3. Text stream → show text as it comes
4. Tool result → show result
5. Next tool call → show next

### Current Behavior
Events may appear grouped or out of order due to:
- Batched state updates
- Separate state arrays for different event types
- Race conditions in SSE processing

### Proposed Solution
Use a single unified timeline with timestamps:

```typescript
type TimelineEvent = {
  id: string;
  timestamp: number;  // Used for ordering
  kind: 'tool_call' | 'tool_result' | 'thinking' | 'text' | 'error';
  data: ToolCallData | ToolResultData | string;
};

// Single array, always sorted by timestamp
const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

// When adding event:
setTimeline(prev => [...prev, newEvent].sort((a, b) => a.timestamp - b.timestamp));
```

### Files to Modify
- `src/lib/plugins/official/agents/animation-generator/AnimationNode.tsx`
- `src/lib/plugins/official/agents/animation-generator/types.ts`

---

## Issue 7: "Set up Theatre.js project" Hardcoded

**Priority:** P2
**Category:** UI
**Component:** Task Display

### Problem
Task list shows "Set up Theatre.js project" even when using Remotion framework.

### Expected Behavior
Should show "Set up Remotion project" or "Setting up workspace" (generic).

### Root Cause
Hardcoded task names in either:
- Agent instructions (update_todo calls)
- Frontend display logic

### Proposed Solution
1. Use generic task names: "Set up animation project"
2. Or: Agent should know which framework and use correct name

### Files to Modify
- `src/mastra/agents/instructions/animation.ts` (update task name examples)
- `src/lib/plugins/official/agents/animation-generator/AnimationNode.tsx` (if hardcoded there)

---

## Issue 8: Model Cost Optimization

**Priority:** P2
**Category:** Architecture
**Component:** Agent Configuration

### Problem
Using Opus 4.5 everywhere is expensive. Need strategy for when to use which model.

### Proposed Model Strategy

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| **Prompt Enhancement** | Sonnet 4.5 | Creative task, needs quality |
| **Prompt Analysis** | Haiku 3.5 | Simple classification |
| **Plan Generation** | Sonnet 4.5 | Structural thinking needed |
| **Code Generation** | Sonnet 4.5 or Opus 4.5 | Quality critical |
| **UI Updates (todos, thinking)** | Haiku 3.5 | Simple string generation |
| **Screenshot Analysis** | Sonnet 4.5 | Vision task |
| **Error Recovery** | Haiku 3.5 | Simple decision |

### Cost Comparison (per animation)
| Strategy | Est. Cost |
|----------|-----------|
| All Opus 4.5 | ~$2-5 |
| All Sonnet 4.5 | ~$0.50-1 |
| Mixed (proposed) | ~$0.30-0.60 |

### Implementation
Create model configuration in agent:
```typescript
const MODEL_CONFIG = {
  enhance_prompt: 'anthropic/claude-sonnet-4-5',
  analyze_prompt: 'anthropic/claude-3-5-haiku',
  generate_plan: 'anthropic/claude-sonnet-4-5',
  generate_code: 'anthropic/claude-sonnet-4-5',
  update_ui: 'anthropic/claude-3-5-haiku',
};
```

---

## Implementation Priority

### Sprint 1: Critical Bugs (P0)
1. Fix Live Preview (Issue 1)
2. Optimize Generation Time (Issue 2)

### Sprint 2: Quality & Logic (P1)
3. Improve Output Quality (Issue 3)
4. Smart Enhancement Check (Issue 4)
5. Fix Screenshot Tool (Issue 5)

### Sprint 3: Polish (P2)
6. Chronological Event Order (Issue 6)
7. Dynamic Task Names (Issue 7)
8. Model Cost Optimization (Issue 8)
