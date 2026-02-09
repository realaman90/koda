/**
 * Recipe: Morph / Transitions
 *
 * Shape morphing (SVG path interpolation), liquid effects, crossfades.
 * ~1.5K tokens when injected.
 */

export const MORPH_TRANSITIONS_RECIPE = `
<recipe name="morph-transitions">
<title>Morph & Transitions</title>
<description>Shape morphing, SVG path interpolation, liquid transitions, crossfades between scenes.</description>

<patterns>
<pattern name="svg-path-morph">
Interpolate between two SVG paths using d3-interpolate.
\`\`\`tsx
import { interpolatePath } from 'd3-interpolate';
import { interpolate } from 'remotion';

const pathA = "M10,80 C40,10 65,10 95,80 S150,150 180,80"; // wave
const pathB = "M10,80 L95,10 L180,80 L95,150 Z";           // diamond

const morphProgress = interpolate(frame, [startFrame, startFrame + 60], [0, 1], { extrapolateRight: 'clamp' });
const morphedPath = interpolatePath(pathA, pathB)(morphProgress);

<svg viewBox="0 0 200 200" width={400} height={400}>
  <path d={morphedPath} fill="none" stroke="#818CF8" strokeWidth={3} />
</svg>
\`\`\`
Note: d3-interpolate is included with d3. Import: \`import { interpolatePath } from 'd3-interpolate'\`
</pattern>

<pattern name="liquid-blob-transition">
Organic blob transition using animated border-radius.
\`\`\`tsx
const t = interpolate(frame, [startFrame, startFrame + 45], [0, 1], { extrapolateRight: 'clamp' });
const r1 = interpolate(t, [0, 1], [30, 70]);
const r2 = interpolate(t, [0, 1], [70, 30]);
const r3 = interpolate(t, [0, 1], [50, 80]);
const r4 = interpolate(t, [0, 1], [80, 40]);

<div style={{
  width: 300, height: 300,
  background: 'linear-gradient(135deg, #6366F1, #EC4899)',
  borderRadius: \`\${r1}% \${r2}% \${r3}% \${r4}% / \${r2}% \${r4}% \${r1}% \${r3}%\`,
  transition: 'none',
}} />
\`\`\`
</pattern>

<pattern name="crossfade">
Smooth crossfade between two scenes using Remotion Sequence + opacity.
\`\`\`tsx
import { Sequence, interpolate, useCurrentFrame } from 'remotion';

const FADE_DURATION = 15; // frames of overlap

<Sequence from={0} durationInFrames={90 + FADE_DURATION}>
  <SceneA opacity={interpolate(frame, [75, 90], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
</Sequence>
<Sequence from={75} durationInFrames={90}>
  <SceneB opacity={interpolate(frame - 75, [0, FADE_DURATION], [0, 1], { extrapolateRight: 'clamp' })} />
</Sequence>
\`\`\`
</pattern>
</patterns>

<tips>
- For smooth SVG morphs, both paths must have the same number of commands
- Use d3.interpolatePath for automatic path normalization
- Liquid blobs: animate 8-value border-radius with different frequencies
- For @remotion/transitions: \`import { TransitionSeries, slide, fade } from '@remotion/transitions'\`
- Remotion built-in transitions: slide(), fade(), wipe(), flip() — use TransitionSeries
</tips>
</recipe>
`;
