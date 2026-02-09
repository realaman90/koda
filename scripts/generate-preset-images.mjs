import { fal } from '@fal-ai/client';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config({ path: path.join(__dirname, '..', '.env') });

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

console.log('FAL_KEY loaded:', process.env.FAL_KEY ? '✓ Present' : '✗ Missing');

// Download image from URL and save to file
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

// Generate image using NanoBanana Pro
async function generateImage(prompt) {
  console.log(`  Generating: "${prompt.substring(0, 60)}..."`);

  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro', {
      input: {
        prompt,
        aspect_ratio: '1:1',
        resolution: '1K',
        num_images: 1,
        output_format: 'png',
      },
      logs: false,
    });

    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    return imageUrl;
  } catch (error) {
    console.error(`  Error generating image: ${error.message}`);
    throw error;
  }
}

// All preset definitions with prompts optimized for NanoBanana Pro
const presets = {
  characters: [
    {
      id: 'marcus',
      prompt: 'Professional portrait photograph of Marcus, a confident businessman in his 40s wearing a tailored navy suit and subtle tie, warm studio lighting, neutral gray background, professional headshot, sharp focus on face, friendly confident expression, high quality, detailed',
    },
    {
      id: 'sofia',
      prompt: 'Portrait photograph of Sofia, a young woman in her mid-20s with casual style, wearing a cozy cream sweater, relaxed genuine smile, soft natural window lighting, neutral background, warm tones, friendly approachable expression, high quality, detailed',
    },
    {
      id: 'victoria',
      prompt: 'Elegant portrait of Victoria, a sophisticated woman in her 30s wearing a formal black evening dress with pearl earrings, refined graceful pose, professional studio lighting, dark background, elegant and confident, high quality, detailed',
    },
    {
      id: 'kai',
      prompt: 'Portrait of Kai, a creative male artist in his 30s, wearing modern streetwear with a graphic jacket, expressive confident pose, colorful urban background with graffiti hints, artistic dynamic lighting, high quality, detailed',
    },
    {
      id: 'luna',
      prompt: 'Portrait of Luna, a cheerful 8-year-old girl with bright genuine smile, playful expression, wearing a colorful outfit, warm soft lighting, light pastel background, innocent joyful energy, high quality, detailed',
    },
    {
      id: 'eleanor',
      prompt: 'Portrait of Eleanor, a wise elderly woman in her 70s with beautiful silver gray hair, warm gentle smile, wearing elegant comfortable clothing, soft diffused lighting, distinguished and kind appearance, high quality, detailed',
    },
    {
      id: 'jordan',
      prompt: 'Portrait of Jordan, an athletic person in modern sportswear, confident powerful stance, fit physique, dynamic dramatic lighting, gym or outdoor sports background hints, energetic and determined expression, high quality, detailed',
    },
    {
      id: 'dr-chen',
      prompt: 'Portrait of Dr. Chen, a scientist wearing a clean white lab coat over professional attire, wearing glasses, intelligent thoughtful expression, soft laboratory lighting, intellectual and approachable appearance, high quality, detailed',
    },
  ],

  styles: [
    {
      id: 'cinematic',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and warm morning light streaming through a large window, cinematic lighting, movie still, dramatic shadows, 35mm film grain, shallow depth of field, high quality',
    },
    {
      id: 'anime',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and warm morning light through window, anime style, vibrant saturated colors, clean bold lines, Studio Ghibli inspired, Japanese animation aesthetic, high quality',
    },
    {
      id: 'watercolor',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and morning light, watercolor painting style, soft flowing edges, artistic washes of color, wet on wet technique, delicate brushwork, high quality',
    },
    {
      id: 'oil-painting',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and warm light, oil painting style, visible textured brushstrokes, classical art technique, renaissance inspired, rich deep colors, high quality',
    },
    {
      id: 'pencil-sketch',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and light through window, detailed pencil sketch, graphite drawing, hand-drawn artistic style, cross-hatching shading technique, high quality',
    },
    {
      id: 'cyberpunk',
      prompt: 'A futuristic coffee shop corner with a steaming cup, holographic books, and neon light through window, cyberpunk aesthetic, vibrant neon pink and cyan lights, high-tech futuristic, rain-slicked surfaces, high quality',
    },
    {
      id: 'vintage',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and morning light, vintage 1970s photograph style, faded warm colors, film grain texture, nostalgic retro aesthetic, high quality',
    },
    {
      id: 'minimalist',
      prompt: 'A coffee cup and single book on a clean white surface with soft light, minimalist design, extremely clean simple composition, lots of negative space, modern elegant aesthetic, muted neutral colors, high quality',
    },
    {
      id: 'fantasy',
      prompt: 'A magical coffee shop corner with an enchanted glowing cup, floating books, and ethereal light through stained glass window, fantasy art style, magical sparkles, dreamlike atmosphere, mystical lighting, high quality',
    },
    {
      id: 'photorealistic',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and morning light through window, photorealistic, ultra-detailed 8K photography, professional DSLR shot, perfect focus, high quality',
    },
    {
      id: 'comic-book',
      prompt: 'A coffee shop corner with a steaming cup and books, comic book style, bold black outlines, halftone dot pattern, pop art vibrant colors, dynamic composition, graphic novel aesthetic, high quality',
    },
    {
      id: 'impressionist',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee and books, impressionist painting style like Monet, visible expressive brushstrokes, play of light and color, soft dreamy atmosphere, high quality',
    },
  ],

  'camera-angles': [
    {
      id: 'front',
      prompt: 'A red sports car on an empty desert road, front view, straight on symmetrical composition, car facing directly at camera, dramatic sky background, professional automotive photography, high quality, detailed',
    },
    {
      id: 'three-quarter',
      prompt: 'A red sports car on an empty desert road, three-quarter view at 45 degree angle, showing front and side, dynamic composition, dramatic sky, professional automotive photography, high quality, detailed',
    },
    {
      id: 'side-profile',
      prompt: 'A red sports car on an empty desert road, perfect side profile view, 90 degree angle showing full length of car, dramatic sky background, professional automotive photography, high quality, detailed',
    },
    {
      id: 'overhead',
      prompt: 'A red sports car on an empty desert road, overhead shot looking down at 60 degrees, showing roof and hood, dramatic shadows, aerial perspective, professional automotive photography, high quality, detailed',
    },
    {
      id: 'low-angle',
      prompt: 'A red sports car on an empty desert road, dramatic low angle shot looking up at the car, making it appear powerful and imposing, heroic perspective, dramatic sky, professional automotive photography, high quality, detailed',
    },
    {
      id: 'dutch-angle',
      prompt: 'A red sports car on an empty desert road, dutch angle with frame tilted 20 degrees, dynamic tension, dramatic composition, sense of motion, professional automotive photography, high quality, detailed',
    },
    {
      id: 'birds-eye',
      prompt: 'A red sports car on an empty desert road, extreme birds eye view directly from above, car seen from top, geometric composition, dramatic shadow, aerial drone shot style, high quality, detailed',
    },
    {
      id: 'worms-eye',
      prompt: 'A red sports car on an empty desert road, extreme worms eye view from ground level looking up, car looming large overhead, dramatic perspective distortion, powerful imposing shot, high quality, detailed',
    },
  ],

  // Physical camera lens products
  'camera-lens': [
    {
      id: 'wide-angle',
      prompt: 'Professional product photography of a Canon EF 16-35mm f/2.8L wide angle zoom lens, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'standard',
      prompt: 'Professional product photography of a Canon EF 50mm f/1.8 STM prime lens, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'telephoto',
      prompt: 'Professional product photography of a Canon EF 70-200mm f/2.8L IS telephoto zoom lens, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'macro',
      prompt: 'Professional product photography of a Canon EF 100mm f/2.8L Macro IS USM lens, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'fisheye',
      prompt: 'Professional product photography of a Sigma 8mm f/3.5 EX DG Circular Fisheye lens, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'tilt-shift',
      prompt: 'Professional product photography of a Canon TS-E 24mm f/3.5L II tilt-shift lens, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'portrait',
      prompt: 'Professional product photography of a Canon EF 85mm f/1.4L IS USM portrait lens, front view showing glass element, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'anamorphic',
      prompt: 'Professional product photography of a Sirui 50mm f/1.8 1.33x Anamorphic cinema lens, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
  ],

  // Camera bodies - mixed types
  cameras: [
    {
      id: 'dslr',
      prompt: 'Professional product photography of a Canon EOS 5D Mark IV DSLR camera body, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'mirrorless',
      prompt: 'Professional product photography of a Sony Alpha A7 IV mirrorless camera body, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'film-slr',
      prompt: 'Professional product photography of a Canon AE-1 Program 35mm film SLR camera, vintage classic, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'rangefinder',
      prompt: 'Professional product photography of a Leica M6 rangefinder film camera, classic silver chrome body, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'medium-format',
      prompt: 'Professional product photography of a Hasselblad 500C medium format film camera, classic silver body, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'cinema',
      prompt: 'Professional product photography of a RED Komodo 6K digital cinema camera, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'instant',
      prompt: 'Professional product photography of a Polaroid SX-70 instant camera, classic folding design, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
    {
      id: 'compact',
      prompt: 'Professional product photography of a Fujifilm X100V compact digital camera, silver body, isolated on clean white background, studio lighting, sharp detail, commercial product shot, high quality',
    },
  ],

  // Animation style presets — high-end motion design frame references
  'animation-styles': [
    {
      id: 'minimal',
      prompt: 'Beautiful motion design frame, clean white space with elegant floating glass morphism UI card, subtle shadow, thin rounded corners, soft blue gradient accent element, abstract geometric shapes gently scattered, a sleek toggle switch and progress bar, Apple WWDC keynote aesthetic, premium product reveal style, cinematic depth of field, ultra high quality 3D render',
    },
    {
      id: 'corporate',
      prompt: 'Premium motion design frame for business presentation, dark navy gradient background, floating 3D isometric office building made of glass, holographic data visualization charts orbiting around it, golden accent lines and nodes connecting, executive boardroom presentation style, McKinsey or Deloitte brand video aesthetic, cinematic lighting, ultra high quality 3D render',
    },
    {
      id: 'fashion',
      prompt: 'Cinematic motion design frame for luxury fashion, dramatic studio lighting on elegant fabric draped over geometric shapes, bold serif typography "STYLE" partially visible, film grain texture overlay, warm copper and cream tones on deep black, Prada runway show opening sequence aesthetic, editorial mood, ultra high quality 3D render',
    },
    {
      id: 'marketing',
      prompt: 'Dynamic motion design frame for product launch, vibrant gradient mesh background in purple magenta and orange, floating glassmorphism notification cards with star icons and badges, 3D smartphone mockup with glowing screen, animated light streaks and bokeh particles, Product Hunt launch day energy, ultra high quality 3D render',
    },
  ],
};

// Main function
async function main() {
  const basePath = path.join(__dirname, '..', 'public', 'assets', 'presets');

  console.log('Starting preset image generation...\n');
  console.log('Using Fal API with NanoBanana Pro model\n');

  let totalGenerated = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const [category, items] of Object.entries(presets)) {
    console.log(`\n📁 Category: ${category.toUpperCase()}`);
    console.log('─'.repeat(50));

    const categoryPath = path.join(basePath, category);

    // Ensure directory exists
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }

    for (const item of items) {
      const jpgPath = path.join(categoryPath, `${item.id}.jpg`);

      // Skip if already exists
      if (fs.existsSync(jpgPath)) {
        console.log(`  ⏭️  ${item.id}.jpg already exists, skipping`);
        totalSkipped++;
        continue;
      }

      try {
        const imageUrl = await generateImage(item.prompt);
        await downloadImage(imageUrl, jpgPath);
        console.log(`  ✅ Saved: ${item.id}.jpg`);
        totalGenerated++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Failed: ${item.id}.jpg - ${error.message}`);
        totalFailed++;
      }
    }
  }

  const totalImages = Object.values(presets).flat().length;

  console.log('\n' + '═'.repeat(50));
  console.log(`✨ Generation complete!`);
  console.log(`   Generated: ${totalGenerated} images`);
  console.log(`   Failed: ${totalFailed} images`);
  console.log(`   Skipped: ${totalSkipped} images (already existed)`);
  console.log(`   Total: ${totalImages} images in ${Object.keys(presets).length} categories`);
}

// Run
main().catch(console.error);
