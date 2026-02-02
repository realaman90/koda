/**
 * Video Export Script
 *
 * Captures the Vite dev server output using Puppeteer and encodes
 * frames into a video with FFmpeg.
 *
 * Usage:
 *   node export-video.cjs --duration 7 --quality preview --output output/preview.mp4
 *   node export-video.cjs --duration 7 --quality final --resolution 1080p --output output/final.mp4
 */

const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const duration = parseFloat(getArg('duration', '7'));
const quality = getArg('quality', 'preview');
const resolution = getArg('resolution', '1080p');
const outputPath = getArg('output', 'output/preview.mp4');

const RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

const FPS = quality === 'preview' ? 30 : 60;
const res = RESOLUTIONS[resolution] || RESOLUTIONS['1080p'];

async function exportVideo() {
  console.log(`Exporting ${quality} video: ${duration}s @ ${FPS}fps (${resolution})`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Launch browser
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${res.width},${res.height}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: res.width, height: res.height });

  // Navigate to dev server
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for animation to be ready
  await page.waitForSelector('#root', { timeout: 10000 });

  // Enable export mode — this tells useCurrentFrame to stop its own RAF loop
  // and only respond to theatre-seek events from us
  await page.evaluate(() => {
    window.__EXPORT_MODE__ = true;
  });

  // Give the app a moment to initialize and apply export mode
  await new Promise((r) => setTimeout(r, 1000));

  // Signal that the exporter is ready (for any waiting code)
  await page.evaluate(() => {
    window.__exportReady = true;
  });

  const totalFrames = Math.ceil(duration * FPS);
  const frameDir = path.join(outputDir, '_frames');
  if (!fs.existsSync(frameDir)) {
    fs.mkdirSync(frameDir, { recursive: true });
  }

  console.log(`Capturing ${totalFrames} frames...`);

  // Capture frames
  for (let i = 0; i < totalFrames; i++) {
    const frameNum = String(i).padStart(6, '0');
    const framePath = path.join(frameDir, `frame_${frameNum}.png`);

    // Seek the animation via the theatre-seek custom event
    // This matches what useCurrentFrame() listens for
    await page.evaluate((frame) => {
      window.dispatchEvent(new CustomEvent('theatre-seek', { detail: { frame } }));
    }, i);

    // Wait for React to re-render at the new frame
    await new Promise((r) => setTimeout(r, quality === 'preview' ? 16 : 33));

    await page.screenshot({ path: framePath, type: 'png' });

    if (i % 30 === 0) {
      console.log(`  Frame ${i}/${totalFrames} (${Math.round((i / totalFrames) * 100)}%)`);
    }
  }

  await browser.close();

  // Encode with FFmpeg
  console.log('Encoding video with FFmpeg...');
  const ffmpegArgs = [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(frameDir, 'frame_%06d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    ...(quality === 'preview'
      ? ['-crf', '28', '-preset', 'ultrafast']
      : ['-crf', '18', '-preset', 'medium']),
    outputPath,
  ];

  execSync(`ffmpeg ${ffmpegArgs.join(' ')}`, { stdio: 'inherit' });

  // Generate thumbnail
  const thumbPath = outputPath.replace(/\.mp4$/, '-thumb.jpg');
  execSync(
    `ffmpeg -y -i ${outputPath} -vframes 1 -ss 0.5 -q:v 3 ${thumbPath}`,
    { stdio: 'inherit' }
  );

  // Clean up frames
  fs.rmSync(frameDir, { recursive: true, force: true });

  console.log(`Done! Output: ${outputPath}`);
  console.log(`Thumbnail: ${thumbPath}`);
}

exportVideo().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
