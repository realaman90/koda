/**
 * Recipe: Kinetic Typography
 *
 * Word-by-word reveals, letter stagger, bounce, mask wipes.
 * ~1.5K tokens when injected.
 */

export const KINETIC_TYPOGRAPHY_RECIPE = `
<recipe name="kinetic-typography">
<title>Kinetic Typography</title>
<description>Animated text effects: word-by-word reveals, letter stagger, bounce, mask wipes, and text morphing.</description>

<patterns>
<pattern name="word-by-word-reveal">
Split text into words, stagger each with spring-based opacity + translateY.
\`\`\`tsx
const words = text.split(' ');
{words.map((word, i) => {
  const delay = i * 4; // frames between each word
  const progress = spring({ frame: frame - delay, fps, config: { damping: 12 } });
  return (
    <span key={i} style={{
      opacity: progress,
      transform: \`translateY(\${interpolate(progress, [0, 1], [20, 0])}px)\`,
      display: 'inline-block',
      marginRight: '0.3em',
    }}>{word}</span>
  );
})}
\`\`\`
</pattern>

<pattern name="letter-stagger">
Character-level animation with per-letter spring delay.
\`\`\`tsx
const letters = text.split('');
{letters.map((char, i) => {
  const delay = i * 2;
  const s = spring({ frame: frame - delay, fps, config: { damping: 10, mass: 0.5 } });
  return (
    <span key={i} style={{
      opacity: s,
      transform: \`translateY(\${interpolate(s, [0, 1], [30, 0])}px) scale(\${interpolate(s, [0, 1], [0.5, 1])})\`,
      display: 'inline-block',
    }}>{char === ' ' ? '\\u00A0' : char}</span>
  );
})}
\`\`\`
</pattern>

<pattern name="mask-wipe-reveal">
Clip-path based text reveal (left-to-right wipe).
\`\`\`tsx
const wipe = interpolate(frame, [startFrame, startFrame + 30], [0, 100], { extrapolateRight: 'clamp' });
<div style={{
  clipPath: \`inset(0 \${100 - wipe}% 0 0)\`,
  fontSize: 72,
  fontWeight: 800,
}}>{text}</div>
\`\`\`
</pattern>

<pattern name="bounce-text">
Spring-based bounce with overshoot.
\`\`\`tsx
const scale = spring({ frame: frame - enterFrame, fps, config: { damping: 8, stiffness: 200 } });
<div style={{
  transform: \`scale(\${scale})\`,
  transformOrigin: 'center',
  fontSize: 96,
  fontWeight: 900,
}}>{text}</div>
\`\`\`
</pattern>
</patterns>

<tips>
- Use @remotion/google-fonts for premium typography: \`import { loadFont } from '@remotion/google-fonts/Inter'\`
- Gradient text: \`background: linear-gradient(...); -webkit-background-clip: text; color: transparent\`
- Text shadow for glow: \`textShadow: '0 0 40px rgba(99,102,241,0.5)'\`
- Combine word reveal + scale for "typewriter with impact" effect
- Use Sequence components to chain multiple text animations
</tips>
</recipe>
`;
