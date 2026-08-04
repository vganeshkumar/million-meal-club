#!/usr/bin/env bash
# Starts the Million Meal Club dev servers, each in its own Terminal.app
# window: FastAPI backend on :8001, Next.js frontend on :3000. Safe to
# re-run — skips a server whose port is already listening rather than
# opening a duplicate.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ADMIN_EMAILS="${ADMIN_EMAILS:-vganeshkumar@gmail.com}"
# Geoapify Static Maps API key (see
# specs/features/023-event-location-time-and-sharing/design.md) — export
# GEOAPIFY_API_KEY before running this script to enable the donation-event
# map image locally. Empty is fine: the app degrades to address-only.
GEOAPIFY_API_KEY="${GEOAPIFY_API_KEY:-}"

is_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

open_terminal_tab() {
  local dir="$1" cmd="$2"
  osascript -e "tell application \"Terminal\" to do script \"cd '$dir' && $cmd\"" >/dev/null
}

if is_listening 8001; then
  echo "Backend: something is already listening on :8001 — skipping start."
else
  echo "Backend: opening a Terminal window on :8001..."
  open_terminal_tab "$REPO_ROOT/backend" \
    "ENV=dev DATA_BACKEND=local API_PUBLIC_BASE_URL=http://localhost:8001/api ADMIN_EMAILS=$ADMIN_EMAILS ENABLE_DUMMY_LOGIN=true GEOAPIFY_API_KEY=$GEOAPIFY_API_KEY SITE_BASE_URL=http://localhost:3000 uv run uvicorn app.main:app --reload --port 8001"
fi

if is_listening 3000; then
  echo "Frontend: something is already listening on :3000 — skipping start."
else
  if [ ! -f "$REPO_ROOT/frontend/.env.local" ]; then
    cp "$REPO_ROOT/frontend/.env.example" "$REPO_ROOT/frontend/.env.local"
  fi
  echo "Frontend: opening a Terminal window on :3000..."
  open_terminal_tab "$REPO_ROOT/frontend" "npm run dev"
fi

echo "Waiting for both servers to respond..."
for _ in $(seq 1 30); do
  backend_ok=false
  frontend_ok=false
  curl -sf http://localhost:8001/api/health >/dev/null 2>&1 && backend_ok=true
  curl -sf http://localhost:3000 >/dev/null 2>&1 && frontend_ok=true
  if $backend_ok && $frontend_ok; then
    echo "Backend:  http://localhost:8001 (docs: http://localhost:8001/docs)"
    echo "Frontend: http://localhost:3000"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for one or both servers — check their Terminal windows for errors (e.g. 'uv sync' / 'npm install' not run yet)."
exit 1
