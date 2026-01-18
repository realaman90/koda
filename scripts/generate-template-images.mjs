/**
 * Script to generate template thumbnail images using Fal AI
 * Run with: node scripts/generate-template-images.mjs
 */

import { fal } from '@fal-ai/client';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configure Fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

// Template prompts - designed for 16:9 thumbnail cards
const templates = [
  {
    id: 'blank',
    prompt: 'Minimalist clean empty canvas interface, subtle grid pattern, soft gradient background, modern design tool aesthetic, professional UI mockup, light and airy, 16:9 aspect ratio',
  },
  {
    id: 'image-workflow',
    prompt: 'Beautiful AI-generated fantasy landscape artwork, vibrant colors, digital art creation process, magical scenery with mountains and aurora, professional artwork showcase, 16:9 cinematic',
  },
  {
    id: 'video-production',
    prompt: 'Cinematic film production scene, movie camera on set, dramatic lighting, professional video equipment, film frames and clapperboard, Hollywood style production, 16:9 widescreen',
  },
  {
    id: 'storyboard',
    prompt: 'Professional film storyboard panels layout, hand-drawn sketches for movie scenes, visual narrative sequence, cinema pre-production art, director vision board, 16:9 format',
  },
  {
    id: 'mood-board',
    prompt: 'Creative mood board collage, color swatches and fabric samples, design inspiration pinboard, aesthetic arrangement of photos and textures, interior design concept, 16:9 layout',
  },
  {
    id: 'product-variations',
    prompt: 'Professional product photography setup, sleek modern product on clean white background, studio lighting, commercial advertising style, multiple angle showcase, 16:9 commercial',
  },
  {
    id: 'brand-identity',
    prompt: 'Modern brand identity design mockup, minimalist logo on business cards and stationery, professional branding presentation, corporate identity kit, clean typography, 16:9 showcase',
  },
  {
    id: 'model-swap',
    prompt: 'High fashion editorial photography, professional model portrait, studio glamour lighting, magazine cover style, elegant pose, beauty and fashion campaign, 16:9 editorial',
  },
];

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
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

async function generateImage(template) {
  console.log(`Generating image for: ${template.id}...`);

  try {
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: template.prompt,
        image_size: 'landscape_16_9',
        num_images: 1,
      },
      logs: false,
    });

    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    // Download and save the image
    const outputPath = path.join(__dirname, '..', 'public', 'templates', `${template.id}.jpg`);
    await downloadImage(imageUrl, outputPath);

    console.log(`  Saved: ${template.id}.jpg`);
    return true;
  } catch (error) {
    console.error(`  Error generating ${template.id}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Starting template image generation...\n');

  // Ensure output directory exists
  const outputDir = path.join(__dirname, '..', 'public', 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let successCount = 0;

  for (const template of templates) {
    const success = await generateImage(template);
    if (success) successCount++;
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone! Generated ${successCount}/${templates.length} images.`);
  console.log('Images saved to: public/templates/');
}

main().catch(console.error);
