# Animation Sandbox Container
#
# Pre-installed with Node.js 20, Bun, Chromium, FFmpeg, and Theatre.js deps.
# Dependencies are pre-installed in /app so sandbox creation is instant.

FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    ca-certificates \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create project directories
RUN mkdir -p /app/output /app/src/utils

# Copy template files directly to /app (working directory)
COPY template/package.json /app/
COPY template/tsconfig.json /app/
COPY template/vite.config.ts /app/
COPY template/index.html /app/
COPY template/export-video.cjs /app/
COPY template/src/ /app/src/

# Install dependencies in /app - this is cached in the Docker image
WORKDIR /app
RUN bun install

# Pre-warm Vite by running a build check (caches internal deps)
RUN bun run build 2>/dev/null || true

# Default command (overridden by sandbox provider)
CMD ["tail", "-f", "/dev/null"]
