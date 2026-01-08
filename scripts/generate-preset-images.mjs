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

// Generate image using Fal API
async function generateImage(prompt, size = 'square') {
  console.log(`  Generating: "${prompt.substring(0, 60)}..."`);

  try {
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: size,
        num_images: 1,
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

// All preset definitions with prompts
const presets = {
  characters: [
    {
      id: 'marcus',
      prompt: 'Professional portrait photograph of Marcus, a confident businessman in his 40s wearing a tailored navy suit and subtle tie, warm studio lighting, neutral gray background, professional headshot, sharp focus on face, friendly confident expression',
    },
    {
      id: 'sofia',
      prompt: 'Portrait photograph of Sofia, a young woman in her mid-20s with casual style, wearing a cozy cream sweater, relaxed genuine smile, soft natural window lighting, neutral background, warm tones, friendly approachable expression',
    },
    {
      id: 'victoria',
      prompt: 'Elegant portrait of Victoria, a sophisticated woman in her 30s wearing a formal black evening dress with pearl earrings, refined graceful pose, professional studio lighting, dark background, elegant and confident',
    },
    {
      id: 'kai',
      prompt: 'Portrait of Kai, a creative male artist in his 30s, wearing modern streetwear with a graphic jacket, expressive confident pose, colorful urban background with graffiti hints, artistic dynamic lighting',
    },
    {
      id: 'luna',
      prompt: 'Portrait of Luna, a cheerful 8-year-old girl with bright genuine smile, playful expression, wearing a colorful outfit, warm soft lighting, light pastel background, innocent joyful energy',
    },
    {
      id: 'eleanor',
      prompt: 'Portrait of Eleanor, a wise elderly woman in her 70s with beautiful silver gray hair, warm gentle smile, wearing elegant comfortable clothing, soft diffused lighting, distinguished and kind appearance',
    },
    {
      id: 'jordan',
      prompt: 'Portrait of Jordan, an athletic person in modern sportswear, confident powerful stance, fit physique, dynamic dramatic lighting, gym or outdoor sports background hints, energetic and determined expression',
    },
    {
      id: 'dr-chen',
      prompt: 'Portrait of Dr. Chen, a scientist wearing a clean white lab coat over professional attire, wearing glasses, intelligent thoughtful expression, soft laboratory lighting, intellectual and approachable appearance',
    },
  ],

  styles: [
    {
      id: 'cinematic',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and warm morning light streaming through a large window, cinematic lighting, movie still, dramatic shadows, 35mm film grain, shallow depth of field',
    },
    {
      id: 'anime',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and warm morning light through window, anime style, vibrant saturated colors, clean bold lines, Studio Ghibli inspired, Japanese animation aesthetic',
    },
    {
      id: 'watercolor',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and morning light, watercolor painting style, soft flowing edges, artistic washes of color, wet on wet technique, delicate brushwork',
    },
    {
      id: 'oil-painting',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and warm light, oil painting style, visible textured brushstrokes, classical art technique, renaissance inspired, rich deep colors',
    },
    {
      id: 'pencil-sketch',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and light through window, detailed pencil sketch, graphite drawing, hand-drawn artistic style, cross-hatching shading technique',
    },
    {
      id: 'cyberpunk',
      prompt: 'A futuristic coffee shop corner with a steaming cup, holographic books, and neon light through window, cyberpunk aesthetic, vibrant neon pink and cyan lights, high-tech futuristic, rain-slicked surfaces',
    },
    {
      id: 'vintage',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and morning light, vintage 1970s photograph style, faded warm colors, film grain texture, nostalgic retro aesthetic',
    },
    {
      id: 'minimalist',
      prompt: 'A coffee cup and single book on a clean white surface with soft light, minimalist design, extremely clean simple composition, lots of negative space, modern elegant aesthetic, muted neutral colors',
    },
    {
      id: 'fantasy',
      prompt: 'A magical coffee shop corner with an enchanted glowing cup, floating books, and ethereal light through stained glass window, fantasy art style, magical sparkles, dreamlike atmosphere, mystical lighting',
    },
    {
      id: 'photorealistic',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee, scattered books, and morning light through window, photorealistic, ultra-detailed 8K photography, professional DSLR shot, perfect focus',
    },
    {
      id: 'comic-book',
      prompt: 'A coffee shop corner with a steaming cup and books, comic book style, bold black outlines, halftone dot pattern, pop art vibrant colors, dynamic composition, graphic novel aesthetic',
    },
    {
      id: 'impressionist',
      prompt: 'A cozy coffee shop corner with a steaming cup of coffee and books, impressionist painting style like Monet, visible expressive brushstrokes, play of light and color, soft dreamy atmosphere',
    },
  ],

  'camera-angles': [
    {
      id: 'front',
      prompt: 'A red sports car on an empty desert road, front view, straight on symmetrical composition, car facing directly at camera, dramatic sky background, professional automotive photography',
    },
    {
      id: 'three-quarter',
      prompt: 'A red sports car on an empty desert road, three-quarter view at 45 degree angle, showing front and side, dynamic composition, dramatic sky, professional automotive photography',
    },
    {
      id: 'side-profile',
      prompt: 'A red sports car on an empty desert road, perfect side profile view, 90 degree angle showing full length of car, dramatic sky background, professional automotive photography',
    },
    {
      id: 'overhead',
      prompt: 'A red sports car on an empty desert road, overhead shot looking down at 60 degrees, showing roof and hood, dramatic shadows, aerial perspective, professional automotive photography',
    },
    {
      id: 'low-angle',
      prompt: 'A red sports car on an empty desert road, dramatic low angle shot looking up at the car, making it appear powerful and imposing, heroic perspective, dramatic sky, professional automotive photography',
    },
    {
      id: 'dutch-angle',
      prompt: 'A red sports car on an empty desert road, dutch angle with frame tilted 20 degrees, dynamic tension, dramatic composition, sense of motion, professional automotive photography',
    },
    {
      id: 'birds-eye',
      prompt: 'A red sports car on an empty desert road, extreme birds eye view directly from above, car seen from top, geometric composition, dramatic shadow, aerial drone shot style',
    },
    {
      id: 'worms-eye',
      prompt: 'A red sports car on an empty desert road, extreme worms eye view from ground level looking up, car looming large overhead, dramatic perspective distortion, powerful imposing shot',
    },
  ],

  'camera-lens': [
    {
      id: 'wide-angle',
      prompt: 'Portrait of a person standing in a city street with tall buildings, shot with wide angle 24mm lens, expansive view showing full environment, visible barrel distortion at edges, dramatic perspective',
    },
    {
      id: 'standard',
      prompt: 'Portrait of a person standing in a city street with buildings, shot with standard 50mm lens, natural perspective matching human eye, no distortion, balanced composition, classic street photography',
    },
    {
      id: 'telephoto',
      prompt: 'Portrait of a person standing in a city street, shot with telephoto 200mm lens, heavily compressed background, buildings appear stacked, very shallow depth of field, subject isolated from background',
    },
    {
      id: 'macro',
      prompt: 'Extreme close-up macro shot of a persons eye and partial face, macro lens photography, incredible fine detail visible, very shallow depth of field, artistic portrait detail shot',
    },
    {
      id: 'fisheye',
      prompt: 'Portrait of a person in a city street, shot with fisheye lens, extreme 180 degree barrel distortion, curved horizon line, circular vignette effect, dramatic ultra-wide perspective',
    },
    {
      id: 'tilt-shift',
      prompt: 'Person standing in a city street with buildings, shot with tilt-shift lens, miniature model effect, selective focus band across middle, blurred top and bottom, toy-like appearance',
    },
    {
      id: 'portrait',
      prompt: 'Beautiful portrait of a person with city background, shot with 85mm portrait lens, creamy smooth bokeh in background, subject perfectly sharp and isolated, flattering compression, professional portrait',
    },
    {
      id: 'anamorphic',
      prompt: 'Cinematic portrait of a person in city street, shot with anamorphic lens, horizontal blue lens flares, oval shaped bokeh lights, 2.39:1 widescreen aspect feel, movie-like quality',
    },
  ],
};

// Main function
async function main() {
  const basePath = path.join(__dirname, '..', 'public', 'assets', 'presets');

  console.log('Starting preset image generation...\n');
  console.log('Using Fal API with flux-schnell model\n');

  let totalGenerated = 0;
  let totalFailed = 0;

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

  console.log('\n' + '═'.repeat(50));
  console.log(`✨ Generation complete!`);
  console.log(`   Generated: ${totalGenerated} images`);
  console.log(`   Failed: ${totalFailed} images`);
  console.log(`   Skipped: ${36 - totalGenerated - totalFailed} images (already existed)`);
}

// Run
main().catch(console.error);
