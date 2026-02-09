import { Template } from 'e2b'
import path from 'path'

// Build the Theatre.js sandbox template using the E2B Template SDK.
// This mirrors our Dockerfile but uses E2B's programmatic builder.
// E2B runs as 'user' by default, so Bun installs to /home/user/.bun/bin/
// fileContextPath points to the parent dir (templates/sandbox/) where template/ lives.
export const template = Template({ fileContextPath: path.resolve(__dirname, '..') })
  .fromNodeImage('20')

  // System deps (Chromium for Puppeteer screenshots, FFmpeg for video export)
  .aptInstall([
    'chromium',
    'ffmpeg',
    'fonts-noto-color-emoji',
    'fonts-freefont-ttf',
    'ca-certificates',
    'curl',
    'unzip',
  ])

  // Install Bun (installs to ~/.bun/bin/ = /home/user/.bun/bin/)
  .runCmd('curl -fsSL https://bun.sh/install | bash')
  .setEnvs({
    PATH: '/home/user/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true',
    PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
  })

  // Create project directories (need sudo since /app is root-owned)
  .runCmd('sudo mkdir -p /app/output /app/src/utils && sudo chown -R user:user /app')

  // Copy template files (relative to fileContextPath = templates/sandbox/)
  .copy('template/package.json', '/app/package.json')
  .copy('template/tsconfig.json', '/app/tsconfig.json')
  .copy('template/vite.config.ts', '/app/vite.config.ts')
  .copy('template/index.html', '/app/index.html')
  .copy('template/export-video.cjs', '/app/export-video.cjs')
  .copy('template/src', '/app/src')

  // Install dependencies
  .setWorkdir('/app')
  .runCmd('/home/user/.bun/bin/bun install')

  // Pre-warm Vite
  .runCmd('/home/user/.bun/bin/bun run build 2>/dev/null || true')

  // Start command
  .setStartCmd('tail -f /dev/null')
  .setReadyCmd('node -e "process.exit(0)"')
