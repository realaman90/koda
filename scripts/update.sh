#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"
SQLITE_PATH="./data/koda.db"
SKIP_INSTALL="false"
SKIP_SANDBOX="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --sqlite-path)
      SQLITE_PATH="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL="true"
      shift
      ;;
    --skip-sandbox)
      SKIP_SANDBOX="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/update.sh [--env-file <path>] [--sqlite-path <path>] [--skip-install] [--skip-sandbox]"
      exit 1
      ;;
  esac
done

echo "[update] Pulling latest changes"
git pull --ff-only

ARGS=(--env-file "$ENV_FILE" --sqlite-path "$SQLITE_PATH" --skip-network)
if [[ "$SKIP_INSTALL" == "true" ]]; then
  ARGS+=(--skip-install)
fi
if [[ "$SKIP_SANDBOX" == "true" ]]; then
  ARGS+=(--skip-sandbox)
fi

echo "[update] Re-running setup automation"
./scripts/setup.sh "${ARGS[@]}"

echo "[update] Update complete"
