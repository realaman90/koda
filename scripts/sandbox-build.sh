#!/usr/bin/env bash
#
# Koda — Rebuild Sandbox Image
#
# Rebuilds the Remotion sandbox Docker image. Run this after updating
# the sandbox template or when troubleshooting sandbox issues.
#
# Usage:
#   ./scripts/sandbox-build.sh
#

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Building koda/remotion-sandbox...${NC}"
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
echo -e "${GREEN}Done.${NC}"

# Ensure network exists
docker network create koda-sandbox-net 2>/dev/null || true
