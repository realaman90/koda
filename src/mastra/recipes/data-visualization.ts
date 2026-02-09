/**
 * Recipe: Data Visualization
 *
 * Animated counters, bar/line charts, progress rings, stat reveals.
 * ~1.5K tokens when injected.
 */

export const DATA_VISUALIZATION_RECIPE = `
<recipe name="data-visualization">
<title>Data Visualization</title>
<description>Animated charts, counters, progress rings, and data-driven graphics using d3 + Remotion.</description>

<patterns>
<pattern name="animated-counter">
Number counting up with eased progress.
\`\`\`tsx
const progress = interpolate(frame, [enterFrame, enterFrame + 60], [0, 1], { extrapolateRight: 'clamp' });
const easedProgress = Easing.bezier(0.16, 1, 0.3, 1)(progress);
const value = Math.floor(easedProgress * targetValue);

<span style={{ fontSize: 96, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
  {value.toLocaleString()}
</span>
\`\`\`
</pattern>

<pattern name="animated-bar-chart">
Bars growing with staggered spring animation.
\`\`\`tsx
const data = [
  { label: 'Jan', value: 65 },
  { label: 'Feb', value: 85 },
  { label: 'Mar', value: 45 },
  { label: 'Apr', value: 90 },
];
const maxVal = Math.max(...data.map(d => d.value));

{data.map((d, i) => {
  const barProgress = spring({ frame: frame - enterFrame - i * 8, fps, config: { damping: 12 } });
  const height = (d.value / maxVal) * 300 * barProgress;
  return (
    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 60, height, background: 'linear-gradient(180deg, #818CF8, #6366F1)',
        borderRadius: '8px 8px 0 0',
        alignSelf: 'flex-end',
      }} />
      <span style={{ fontSize: 14, color: '#94A3B8' }}>{d.label}</span>
    </div>
  );
})}
\`\`\`
</pattern>

<pattern name="progress-ring">
SVG circular progress with animated stroke-dashoffset.
\`\`\`tsx
const radius = 80;
const circumference = 2 * Math.PI * radius;
const progress = spring({ frame: frame - enterFrame, fps, config: { damping: 15, mass: 0.8 } });
const offset = circumference * (1 - progress * percentage / 100);

<svg width={200} height={200} viewBox="0 0 200 200">
  <circle cx={100} cy={100} r={radius} fill="none" stroke="#1E293B" strokeWidth={8} />
  <circle cx={100} cy={100} r={radius} fill="none" stroke="url(#gradient)" strokeWidth={8}
    strokeDasharray={circumference} strokeDashoffset={offset}
    strokeLinecap="round" transform="rotate(-90 100 100)" />
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="#818CF8" />
      <stop offset="100%" stopColor="#C084FC" />
    </linearGradient>
  </defs>
</svg>
\`\`\`
</pattern>

<pattern name="line-chart-d3">
Animated line chart using d3 for path generation.
\`\`\`tsx
import * as d3 from 'd3';

const data = [10, 45, 30, 80, 55, 90, 70];
const width = 600, height = 300;
const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, width]);
const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
const line = d3.line<number>().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveCatmullRom);
const pathD = line(data) || '';

const drawProgress = interpolate(frame, [enterFrame, enterFrame + 90], [0, 1], { extrapolateRight: 'clamp' });

<svg width={width} height={height}>
  <path d={pathD} fill="none" stroke="#6366F1" strokeWidth={3}
    strokeDasharray={1000} strokeDashoffset={1000 * (1 - drawProgress)} />
</svg>
\`\`\`
</pattern>
</patterns>

<tips>
- Use fontVariantNumeric: 'tabular-nums' for non-jumping counter digits
- d3 is pre-installed in the sandbox — import * as d3 from 'd3'
- Stagger chart elements by 6-10 frames for visual rhythm
- Add subtle glow behind bars/lines: filter: 'drop-shadow(0 0 10px rgba(99,102,241,0.3))'
- For pie charts: use d3.arc() with animated startAngle/endAngle
</tips>
</recipe>
`;
