#!/usr/bin/env bash
#
# Koda — Update Script
#
# Pulls latest code, reinstalls dependencies, rebuilds sandbox image,
# and runs database migrations.
#
# Usage:
#   ./scripts/update.sh
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Koda — Update                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Pull latest
info "Pulling latest changes..."
git pull
ok "Code updated"

# Dependencies
info "Installing dependencies..."
npm install --loglevel=warn
ok "Dependencies installed"

# Rebuild sandbox image
info "Rebuilding sandbox Docker image..."
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
ok "Docker image rebuilt"

# Database migration
info "Running database migration..."
npm run db:migrate 2>&1 | tail -3
ok "Database migrated"

echo ""
echo -e "${GREEN}Update complete.${NC} Run ${BLUE}npm run dev${NC} to start."
echo ""
