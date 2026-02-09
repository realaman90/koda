#!/usr/bin/env bash
#
# Koda — Cleanup Sandbox Containers
#
# Stops and removes all running Koda sandbox containers.
# Useful when containers are stuck or you want a clean slate.
#
# Usage:
#   ./scripts/sandbox-cleanup.sh
#

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Finding Koda sandbox containers...${NC}"

CONTAINERS=$(docker ps -a -q --filter name=koda-sandbox 2>/dev/null)

if [ -z "$CONTAINERS" ]; then
  echo -e "${GREEN}No sandbox containers found.${NC}"
  exit 0
fi

COUNT=$(echo "$CONTAINERS" | wc -l | tr -d ' ')
echo -e "${YELLOW}Found $COUNT sandbox container(s). Removing...${NC}"

docker rm -f $CONTAINERS 2>/dev/null

echo -e "${GREEN}All sandbox containers removed.${NC}"
