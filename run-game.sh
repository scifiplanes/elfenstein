#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/web"

if [[ ! -d "$WEB_DIR" ]]; then
  echo "Expected web app folder at: $WEB_DIR" >&2
  exit 1
fi

cd "$WEB_DIR"

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies…"
  npm install
fi

echo "Starting game dev server…"
echo "Then open: http://localhost:5173/"
echo

exec npm run dev -- --host
