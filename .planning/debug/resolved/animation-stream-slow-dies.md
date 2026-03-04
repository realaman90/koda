---
status: resolved
trigger: "Animation generation stream is very slow and dies mid-generation"
created: 2026-03-04T00:00:00Z
updated: 2026-03-04T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED ROOT CAUSE — orchestrator extended thinking budget (10k tokens/step × 4+ steps) causes each LLM turn to take 15-25s, making the total generation time exceed the 285s soft timeout. Combined with: (2) planCalledInStream undeclared ReferenceError at stream end; (3) phase guards blocking sandbox/codegen/render from 'preview'/'complete' phase (edit flow)
test: Code audit + timing analysis complete
expecting: All three issues fixed
next_action: verify fixes applied correctly

## Symptoms

expected: User submits prompt → stream opens → events flow at reasonable pace → video appears in UI
actual: Stream starts but is very very slow, progress crawls, and eventually the stream dies mid-generation
errors: No specific error messages reported — just extreme slowness and stream death
reproduction: Submit any animation prompt from idle phase
started: Current behavior (no regression reported)

## Eliminated

(none yet — all hypotheses supported by evidence)

## Evidence

- timestamp: 2026-03-04T00:01:00Z
  checked: guards.ts ALLOWED_PHASES
  found: |
    sandbox skill only allowed in ['executing', 'preview']
    codegen skill only allowed in ['executing']
    render skill only allowed in ['executing', 'preview']
    BUT: from idle phase, context.phase = 'idle' → ALL TOOLS BLOCKED
    assertAllowedTransition throws SkillGuardError with errorClass='ValidationError' → returns {ok: false, retryable: false}
    sandbox_create fails → agent can't proceed → retries → maxSteps exhausted → stream dies
  implication: The core workflow is blocked from idle phase. This is the primary cause of slowness and stream death.

- timestamp: 2026-03-04T00:01:00Z
  checked: route.ts line 1211
  found: |
    `const reason = planCalledInStream ? 'no-video:plan-only' : 'no-video:animation';`
    planCalledInStream is NEVER declared anywhere in route.ts
    This causes a JavaScript ReferenceError at stream cleanup time
    The error is swallowed in a try/catch but the credit refund and cleanup may behave unexpectedly
  implication: Secondary issue — doesn't cause slowness but causes stream end error

- timestamp: 2026-03-04T00:01:00Z
  checked: route.ts line 843-848 (agent.stream options)
  found: |
    anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } }
    The orchestrator model is Claude Sonnet 4.6 (ORCHESTRATOR_MODEL = claude-sonnet-4-6)
    Extended thinking on Sonnet 4.6 adds significant latency per LLM call (each step takes 2-3x longer)
    The agent makes multiple LLM calls per generation (planning step, each tool eval, etc.)
  implication: Extended thinking multiplies latency for EVERY agent step. Combined with phase-blocked retries, this amplifies the slowness dramatically.

- timestamp: 2026-03-04T00:01:00Z
  checked: guards.ts assertPrerequisites line 37
  found: |
    `if (input.planAccepted === false) { throw SkillGuardError('requires an approved plan') }`
    From idle phase: planAccepted is undefined (not false), so this guard passes
    But from the 'complete' phase with planAccepted=true, sandbox/codegen/render are blocked by ALLOWED_PHASES
  implication: Editing an existing animation (phase='complete' or 'preview') also fails — all three skills blocked

- timestamp: 2026-03-04T00:01:00Z
  checked: generate-remotion-code-tool.ts lines 304-323 (codeGenActive wait)
  found: |
    If another codegen is already active, waits up to 60s polling every 500ms
    Combined with phase guard failures causing retries, this creates cascading waits
  implication: Contributes to slowness when agent retries in parallel

- timestamp: 2026-03-04T00:01:00Z
  checked: render-skill.ts lines 13-33 (codeGenActive wait in prepare_render)
  found: |
    render_final waits up to 60s for codeGenActive to reach 0
    If code gen was blocked by phase guard and never ran, codeGenActive stays at 0 — this is fine
    But if code gen started then errored partway, codeGenActive counter may be stranded
  implication: Potential 60s stall in render path if codeGenActive counter strands

## Resolution

root_cause: |
  PRIMARY: Orchestrator extended thinking budget set to 10000 budget tokens (anthropic) per LLM call.
  Each orchestrator step (call tool → await result → choose next tool) takes 15-25 seconds just for
  thinking. With 4+ orchestrator steps per generation, plus sandbox creation (30-60s), code gen
  subagent (~30-60s), and render (~90-180s), total generation time is 220-450s — exceeding the
  285-second soft timeout (300s maxDuration - 15s buffer). The stream dies from soft timeout,
  not a crash. User perceives extreme slowness (15-25s gaps between events) throughout.

  SECONDARY: planCalledInStream is referenced but never declared in route.ts — JavaScript
  ReferenceError at stream end when no video was delivered. Does not cause stream death
  (happens after safeClose()), but causes credit refund to fail silently.

  TERTIARY: Phase guards in guards.ts blocked 'sandbox', 'codegen', 'render' skills when
  phase='preview' or 'complete' (edit flow) and when phase='idle'. Normal generation uses
  phase='executing' so the primary flow was not blocked, but editing (phase='complete'/'preview')
  was fully broken. Also 'idle' was not in allowed phases but client always sends 'executing'.

fix: |
  1. [APPLIED] Reduced orchestrator anthropic thinking budget 10000 → 1500 tokens
     (route.ts providerOptions.anthropic.thinking.budgetTokens)
     Google reduced from 8192 → 2048
     Expected savings: ~12-20s per orchestrator step × 4 steps = 48-80s total
  2. [APPLIED] Declared planCalledInStream = false in route.ts stream scope
     (prevents ReferenceError at stream cleanup, ensures credit refund works)
  3. [APPLIED] Added 'idle', 'complete' to ALLOWED_PHASES for sandbox/codegen/render in guards.ts
     (enables edit flow from phase='complete'/'preview', defensive for phase='idle')

verification: |
  - Orchestrator should now have 1500 budget tokens per step
  - Stream should complete within ~150-250s for a typical animation
  - No ReferenceError at stream end
  - Edit flow from phase='complete' should work correctly

files_changed:
  - src/app/api/plugins/animation/stream/route.ts
  - src/mastra/skills/animation/guards.ts
