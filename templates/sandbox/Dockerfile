# Animation Sandbox Container
#
# Pre-installed with Node.js 20, Bun, Chromium, FFmpeg, and Theatre.js deps.
# Template files are copied to /template and cloned into /app on sandbox creation.

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
RUN mkdir -p /template /app/output

# Copy template files
COPY template/ /template/

# Install dependencies from template
WORKDIR /template
RUN bun install

# Working directory for the animation project
WORKDIR /app

# Default command (overridden by sandbox provider)
CMD ["tail", "-f", "/dev/null"]
