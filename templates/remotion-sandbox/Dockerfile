# Remotion Animation Sandbox Container
#
# Pre-installed with Node.js 20, Bun, Chromium, FFmpeg, and Remotion deps.
# Dependencies are pre-installed in /app so sandbox creation is instant.

FROM node:20-slim

# Install system dependencies for Remotion
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    ca-certificates \
    curl \
    unzip \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Set Puppeteer/Chromium paths for Remotion
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium

# Create project directories
RUN mkdir -p /app/output /app/src/utils /app/src/components /app/src/sequences /app/src/examples /app/public

# Copy template files directly to /app
COPY template/package.json /app/
COPY template/tsconfig.json /app/
COPY template/remotion.config.ts /app/
COPY template/postcss.config.mjs /app/
COPY template/vite.player.config.ts /app/
COPY template/index.html /app/
COPY template/src/ /app/src/
COPY template/public/ /app/public/

# Install dependencies in /app - this is cached in the Docker image
WORKDIR /app
RUN bun install

# Pre-warm by running a build check
RUN bunx remotion compositions 2>/dev/null || true

# Default command (overridden by sandbox provider)
CMD ["tail", "-f", "/dev/null"]
