import { Template } from 'e2b'

// Build the Remotion sandbox template using the E2B Template SDK.
// This mirrors our Dockerfile but uses E2B's programmatic builder.
// IMPORTANT: Run from templates/remotion-sandbox/ (parent dir), not koda-remotion/
export const template = Template()
  .fromNodeImage('20')

  // System deps for Remotion (Chromium, FFmpeg, fonts)
  .aptInstall([
    'chromium',
    'ffmpeg',
    'fonts-noto-color-emoji',
    'fonts-freefont-ttf',
    'ca-certificates',
    'curl',
    'unzip',
    'libnss3',
    'libatk-bridge2.0-0',
    'libdrm2',
    'libxkbcommon0',
    'libgbm1',
    'libasound2',
  ])

  // Install Bun
  .runCmd('curl -fsSL https://bun.sh/install | bash')
  .setEnvs({
    PATH: '/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true',
    PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
    REMOTION_CHROME_EXECUTABLE: '/usr/bin/chromium',
  })

  // Create project directories
  .runCmd('mkdir -p /app/output /app/src/utils /app/src/components /app/src/sequences /app/src/examples /app/public')

  // Copy template files (relative to CWD = templates/remotion-sandbox/)
  .copy('template/package.json', '/app/package.json')
  .copy('template/tsconfig.json', '/app/tsconfig.json')
  .copy('template/remotion.config.ts', '/app/remotion.config.ts')
  .copy('template/postcss.config.mjs', '/app/postcss.config.mjs')
  .copy('template/vite.player.config.ts', '/app/vite.player.config.ts')
  .copy('template/index.html', '/app/index.html')
  .copy('template/src', '/app/src')
  .copy('template/public', '/app/public')

  // Install dependencies
  .setWorkdir('/app')
  .runCmd('/root/.bun/bin/bun install')

  // Pre-warm Remotion
  .runCmd('/root/.bun/bin/bunx remotion compositions 2>/dev/null || true')

  // Start command
  .setStartCmd('tail -f /dev/null')
  .setReadyCmd('node -e "process.exit(0)"')
