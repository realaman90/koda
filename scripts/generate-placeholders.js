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

// Preset configurations with named characters
const presets = {
  characters: [
    { id: 'marcus', label: 'Marcus' },
    { id: 'sofia', label: 'Sofia' },
    { id: 'victoria', label: 'Victoria' },
    { id: 'kai', label: 'Kai' },
    { id: 'luna', label: 'Luna' },
    { id: 'eleanor', label: 'Eleanor' },
    { id: 'jordan', label: 'Jordan' },
    { id: 'dr-chen', label: 'Dr. Chen' },
  ],
  styles: [
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'anime', label: 'Anime' },
    { id: 'watercolor', label: 'Watercolor' },
    { id: 'oil-painting', label: 'Oil Painting' },
    { id: 'pencil-sketch', label: 'Pencil' },
    { id: 'cyberpunk', label: 'Cyberpunk' },
    { id: 'vintage', label: 'Vintage' },
    { id: 'minimalist', label: 'Minimalist' },
    { id: 'fantasy', label: 'Fantasy' },
    { id: 'photorealistic', label: 'Photo' },
    { id: 'comic-book', label: 'Comic' },
    { id: 'impressionist', label: 'Impressionist' },
  ],
  'camera-angles': [
    { id: 'front', label: 'Front' },
    { id: 'three-quarter', label: '3/4 View' },
    { id: 'side-profile', label: 'Side' },
    { id: 'overhead', label: 'Overhead' },
    { id: 'low-angle', label: 'Low Angle' },
    { id: 'dutch-angle', label: 'Dutch' },
    { id: 'birds-eye', label: "Bird's Eye" },
    { id: 'worms-eye', label: "Worm's Eye" },
  ],
  'camera-lens': [
    { id: 'wide-angle', label: 'Wide' },
    { id: 'standard', label: '50mm' },
    { id: 'telephoto', label: 'Telephoto' },
    { id: 'macro', label: 'Macro' },
    { id: 'fisheye', label: 'Fisheye' },
    { id: 'tilt-shift', label: 'Tilt-Shift' },
    { id: 'portrait', label: '85mm' },
    { id: 'anamorphic', label: 'Anamorphic' },
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
    const svg = generatePlaceholder(item.label, color1, color2);

    // Save as SVG
    const filePath = path.join(categoryPath, `${item.id}.svg`);
    fs.writeFileSync(filePath, svg);
    console.log(`Created: ${filePath}`);
  });
}

console.log('\nPlaceholder images generated successfully!');
