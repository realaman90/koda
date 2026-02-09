#!/usr/bin/env bash
#
# Koda — Local Setup Script
#
# Installs dependencies, builds the sandbox Docker image,
# configures environment, and runs the database migration.
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[info]${NC}  $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
fail()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Koda — Local Setup           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 0. Pre-flight checks ────────────────────────────────────────────

info "Checking prerequisites..."

# Node.js
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node.js 20+ from https://nodejs.org"
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  fail "Node.js 20+ required (found $(node -v)). Update at https://nodejs.org"
fi
ok "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm is not installed"
fi
ok "npm $(npm -v)"

# Docker
if ! command -v docker &>/dev/null; then
  fail "Docker is not installed. Install Docker from https://docs.docker.com/get-docker/"
fi
if ! docker info &>/dev/null; then
  fail "Docker daemon is not running. Start Docker Desktop or run: sudo systemctl start docker"
fi
ok "Docker $(docker -v | grep -oP '[\d.]+'| head -1)"

echo ""

# ── 1. Install dependencies ─────────────────────────────────────────

info "Installing Node.js dependencies..."
npm install --loglevel=warn
ok "Dependencies installed"

# ── 2. Build sandbox Docker image ────────────────────────────────────

info "Building Remotion sandbox Docker image (this takes 2-5 min on first run)..."
if docker image inspect koda/remotion-sandbox &>/dev/null; then
  warn "Image koda/remotion-sandbox already exists — rebuilding..."
fi
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
ok "Docker image koda/remotion-sandbox built"

# ── 3. Create Docker network ────────────────────────────────────────

info "Creating Docker bridge network..."
docker network create koda-sandbox-net 2>/dev/null && ok "Network koda-sandbox-net created" || ok "Network koda-sandbox-net already exists"

# ── 4. Environment file ─────────────────────────────────────────────

if [ ! -f .env ]; then
  info "Creating .env from .env.example..."
  cp .env.example .env
  # Enable self-hosted defaults
  sed -i.bak 's/^# \?NEXT_PUBLIC_STORAGE_BACKEND=sqlite/NEXT_PUBLIC_STORAGE_BACKEND=sqlite/' .env 2>/dev/null || true
  sed -i.bak 's/^# \?ASSET_STORAGE=local/ASSET_STORAGE=local/' .env 2>/dev/null || true
  rm -f .env.bak
  ok ".env created — edit it to add your API keys"
else
  ok ".env already exists — skipping"
fi

# ── 5. Data directories ─────────────────────────────────────────────

info "Creating data directories..."
mkdir -p ./data/generations
ok "Data directory ready (./data/)"

# ── 6. Database migration ───────────────────────────────────────────

info "Running database migration..."
npm run db:migrate 2>&1 | tail -3
ok "Database migrated"

# ── Done ─────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup Complete!               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo ""
echo -e "  1. Add your API keys to ${BLUE}.env${NC}:"
echo -e "     ${BLUE}ANTHROPIC_API_KEY${NC}=sk-ant-...  ${YELLOW}(required)${NC}"
echo -e "     ${BLUE}FAL_KEY${NC}=...                   ${YELLOW}(optional — for image/video gen)${NC}"
echo ""
echo -e "  2. Start Koda:"
echo -e "     ${GREEN}npm run dev${NC}"
echo ""
echo -e "  3. Open ${BLUE}http://localhost:3000${NC}"
echo ""
