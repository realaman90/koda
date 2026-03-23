#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKIP_INSTALL="false"
SKIP_SANDBOX="false"
SKIP_NETWORK="false"
SKIP_MIGRATE="false"
ENV_FILE=".env"
SQLITE_PATH="./data/koda.db"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL="true"
      shift
      ;;
    --skip-sandbox)
      SKIP_SANDBOX="true"
      shift
      ;;
    --skip-network)
      SKIP_NETWORK="true"
      shift
      ;;
    --skip-migrate)
      SKIP_MIGRATE="true"
      shift
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --sqlite-path)
      SQLITE_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/setup.sh [--skip-install] [--skip-sandbox] [--skip-network] [--skip-migrate] [--env-file <path>] [--sqlite-path <path>]"
      exit 1
      ;;
  esac
done

echo "[setup] Starting Koda setup"

echo "[setup] Ensuring env file exists: $ENV_FILE"
mkdir -p "$(dirname "$ENV_FILE")"
if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example "$ENV_FILE"
  echo "[setup] Created $ENV_FILE from .env.example"
fi

if ! grep -q '^NEXT_PUBLIC_STORAGE_BACKEND=' "$ENV_FILE"; then
  echo 'NEXT_PUBLIC_STORAGE_BACKEND=sqlite' >> "$ENV_FILE"
fi
if ! grep -q '^SQLITE_PATH=' "$ENV_FILE"; then
  echo "SQLITE_PATH=$SQLITE_PATH" >> "$ENV_FILE"
fi
if ! grep -q '^ASSET_STORAGE=' "$ENV_FILE"; then
  echo 'ASSET_STORAGE=local' >> "$ENV_FILE"
fi
if ! grep -q '^ASSET_LOCAL_PATH=' "$ENV_FILE"; then
  echo 'ASSET_LOCAL_PATH=./data/generations' >> "$ENV_FILE"
fi

mkdir -p ./data/generations
mkdir -p "$(dirname "$SQLITE_PATH")"

if [[ "$SKIP_INSTALL" != "true" ]]; then
  echo "[setup] Installing npm dependencies"
  npm install
else
  echo "[setup] Skipping npm install"
fi

if [[ "$SKIP_SANDBOX" != "true" ]]; then
  if command -v docker >/dev/null 2>&1; then
    echo "[setup] Building sandbox image: koda/remotion-sandbox"
    docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
  else
    echo "[setup] docker command not found (skipping sandbox image build)"
  fi
else
  echo "[setup] Skipping sandbox image build"
fi

if [[ "$SKIP_NETWORK" != "true" ]]; then
  if command -v docker >/dev/null 2>&1; then
    echo "[setup] Ensuring Docker network exists: koda-sandbox-net"
    docker network create koda-sandbox-net >/dev/null 2>&1 || true
  else
    echo "[setup] docker command not found (skipping network creation)"
  fi
else
  echo "[setup] Skipping Docker network setup"
fi

if [[ "$SKIP_MIGRATE" != "true" ]]; then
  echo "[setup] Running database migration"
  DOTENV_CONFIG_PATH="$ENV_FILE" SQLITE_PATH="$SQLITE_PATH" npm run db:migrate
else
  echo "[setup] Skipping database migration"
fi

echo "[setup] Setup complete"
