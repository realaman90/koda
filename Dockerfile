# Koda — Production Dockerfile
#
# Multi-stage build for the Next.js app.
# The sandbox Docker image is built separately (see templates/remotion-sandbox/).

# ── Stage 1: Install dependencies ────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --loglevel=warn

# ── Stage 2: Build the Next.js app ──────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production image ────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

# Install Docker CLI (needed to create sandbox containers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && \
    curl -fsSL https://get.docker.com | sh && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/templates ./templates

# Create data directory
RUN mkdir -p /app/data/generations

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
