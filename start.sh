#!/usr/bin/env bash
#
# EmThaoJP — one-command launcher.
# First run: installs everything (Node deps for both workspaces + Playwright Chromium + .env files).
# Subsequent runs: starts the backend on :8787 and the frontend on :5173 concurrently.
#
# Requirements: Node 20+, npm, ~1 GB free disk (Playwright Chromium is ~300 MB).
#
# Usage:
#   ./start.sh
#
set -euo pipefail
cd "$(dirname "$0")"

green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[1;36m%s\033[0m\n' "$*"; }

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (https://nodejs.org/). Install Node 20+ and re-run."
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node 20+ required (you have $(node -v)). Upgrade and re-run."
  exit 1
fi

# Root deps (concurrently) — install if missing.
if [ ! -d node_modules ]; then
  green "==> Installing root dependencies (one-time)…"
  npm install --silent
fi

# Backend deps + Playwright Chromium.
if [ ! -d backend/node_modules ]; then
  green "==> Installing backend dependencies (one-time)…"
  (cd backend && npm install --silent)
  green "==> Downloading Playwright Chromium (one-time, ~300 MB)…"
  (cd backend && npx playwright install chromium)
fi

# Frontend deps.
if [ ! -d frontend/node_modules ]; then
  green "==> Installing frontend dependencies (one-time)…"
  (cd frontend && npm install --silent)
fi

# .env files — copied from .env.example only if missing.
for dir in backend frontend; do
  if [ ! -f "$dir/.env" ] && [ -f "$dir/.env.example" ]; then
    cp "$dir/.env.example" "$dir/.env"
    cyan "==> Created $dir/.env from $dir/.env.example"
  fi
done

green "==> Starting backend on http://localhost:8787 and frontend on http://localhost:5173"
echo "    (Ctrl+C to stop both)"
exec npx concurrently --kill-others-on-fail \
  --names BACK,FRONT --prefix-colors green,cyan \
  "npm --prefix backend run dev" \
  "npm --prefix frontend run dev"
