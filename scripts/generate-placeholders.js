const fs = require('fs');
const path = require('path');

// Simple gradient-based SVG placeholder generator
function generatePlaceholder(label, color1, color2, size = 200) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="white" opacity="0.9">${label}</text>
</svg>`;
}

// Color palettes for each category
const colors = {
  characters: [
    ['#6366f1', '#8b5cf6'],  // indigo to purple
    ['#ec4899', '#f43f5e'],  // pink to rose
    ['#14b8a6', '#06b6d4'],  // teal to cyan
    ['#f97316', '#eab308'],  // orange to yellow
    ['#22c55e', '#10b981'],  // green
    ['#3b82f6', '#6366f1'],  // blue to indigo
    ['#a855f7', '#ec4899'],  // purple to pink
    ['#0ea5e9', '#14b8a6'],  // sky to teal
  ],
  styles: [
    ['#1e1e2e', '#45475a'],  // dark dramatic
    ['#f472b6', '#fbbf24'],  // anime vibrant
    ['#a5b4fc', '#c4b5fd'],  // soft watercolor
    ['#854d0e', '#a16207'],  // oil painting warm
    ['#525252', '#737373'],  // pencil grey
    ['#06b6d4', '#a855f7'],  // cyberpunk neon
    ['#d4a574', '#b68d5a'],  // vintage sepia
    ['#f5f5f5', '#e5e5e5'],  // minimalist clean
    ['#7c3aed', '#c084fc'],  // fantasy purple
    ['#18181b', '#3f3f46'],  // photorealistic dark
    ['#facc15', '#fb923c'],  // comic bold
    ['#93c5fd', '#c4b5fd'],  // impressionist soft
  ],
  'camera-angles': [
    ['#3b82f6', '#60a5fa'],
    ['#8b5cf6', '#a78bfa'],
    ['#06b6d4', '#22d3ee'],
    ['#f97316', '#fb923c'],
    ['#10b981', '#34d399'],
    ['#ec4899', '#f472b6'],
    ['#6366f1', '#818cf8'],
    ['#14b8a6', '#2dd4bf'],
  ],
  'camera-lens': [
    ['#0ea5e9', '#38bdf8'],
    ['#84cc16', '#a3e635'],
    ['#f43f5e', '#fb7185'],
    ['#8b5cf6', '#a78bfa'],
    ['#fbbf24', '#fcd34d'],
    ['#06b6d4', '#22d3ee'],
    ['#ec4899', '#f472b6'],
    ['#3b82f6', '#60a5fa'],
  ]
};

// Preset configurations
const presets = {
  characters: [
    'man-business',
    'woman-casual',
    'woman-elegant',
    'man-creative',
    'child-playful',
    'elderly-wise',
    'athlete',
    'scientist',
  ],
  styles: [
    'cinematic',
    'anime',
    'watercolor',
    'oil-painting',
    'pencil-sketch',
    'cyberpunk',
    'vintage',
    'minimalist',
    'fantasy',
    'photorealistic',
    'comic-book',
    'impressionist',
  ],
  'camera-angles': [
    'front',
    'three-quarter',
    'side-profile',
    'overhead',
    'low-angle',
    'dutch-angle',
    'birds-eye',
    'worms-eye',
  ],
  'camera-lens': [
    'wide-angle',
    'standard',
    'telephoto',
    'macro',
    'fisheye',
    'tilt-shift',
    'portrait',
    'anamorphic',
  ],
};

// Generate all placeholders
const basePath = path.join(__dirname, '..', 'public', 'assets', 'presets');

for (const [category, items] of Object.entries(presets)) {
  const categoryColors = colors[category];
  const categoryPath = path.join(basePath, category);

  // Ensure directory exists
  if (!fs.existsSync(categoryPath)) {
    fs.mkdirSync(categoryPath, { recursive: true });
  }

  items.forEach((item, index) => {
    const [color1, color2] = categoryColors[index % categoryColors.length];
    const label = item.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const svg = generatePlaceholder(label, color1, color2);

    // Save as SVG (browsers can display SVG as images)
    const filePath = path.join(categoryPath, `${item}.svg`);
    fs.writeFileSync(filePath, svg);
    console.log(`Created: ${filePath}`);
  });
}

console.log('\nPlaceholder images generated successfully!');
console.log('Note: For production, replace these with AI-generated images.');
