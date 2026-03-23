/**
 * Condensed runtime guidance derived from remotion-dev/remotion's Codex skill.
 *
 * Koda cannot depend on an external SKILL.md directory at runtime, so we keep a
 * compact, stable adapter here and inject it into the Remotion codegen prompt.
 */
export const REMOTION_BEST_PRACTICES = `<remotion-best-practices source="remotion-dev/remotion/packages/skills/skills/remotion">
Use these Remotion-specific runtime rules when generating code.

<rule id="frame-driven-motion">
Drive animation from Remotion's frame model: use useCurrentFrame() and useVideoConfig().fps, then convert seconds into frames.
Do not rely on CSS transitions, CSS keyframes, Web Animations, or Tailwind animation utility classes for primary motion.
</rule>

<rule id="timeline-structure">
Register renderable compositions in Root.tsx with <Composition>.
Use Video.tsx and sequence components to orchestrate scenes with <Sequence> or <Series>.
Remember that useCurrentFrame() inside a Sequence is local to that sequence.
</rule>

<rule id="timing-and-easing">
Use interpolate() for value mapping and clamp both sides unless overflow is intentional.
Use spring() for natural entrances and exits, and use delay / durationInFrames when exact timing is required.
For scene changes, prefer explicit Remotion sequencing or @remotion/transitions instead of CSS fade tricks.
</rule>

<rule id="asset-handling">
For sandbox assets in public/, use staticFile().
Images should render through <Img>, video through <OffthreadVideo>, and audio through <Audio>.
If user media was uploaded into the sandbox, prefer those local assets over remote URLs.
</rule>

<rule id="font-loading">
Load fonts through @remotion/google-fonts or @remotion/fonts before use.
Keep font loading deterministic and set weight/style in CSS instead of inventing browser-only font workflows during render.
</rule>

<rule id="render-safety">
Prefer deterministic, render-safe React.
Avoid hover-only states, scroll observers, requestAnimationFrame loops, and browser-only effects that behave differently in render than in preview.
</rule>

<rule id="fps-aware-editability">
Keep durations, overlaps, and delays in named fps-aware constants so later edits stay predictable.
</rule>
</remotion-best-practices>`;

export function loadRemotionBestPractices(): string {
  return REMOTION_BEST_PRACTICES.trim();
}
