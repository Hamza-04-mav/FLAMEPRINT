#!/usr/bin/env bash
# FLAMEPRINT one-command launcher (macOS / Linux / Git Bash)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "Creating Python venv + installing backend deps..."
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/python" -m pip install -q -r "$ROOT/backend/requirements.txt"
fi
[ -f "$ROOT/backend/.env" ] || cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
[ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm install)

PY="$ROOT/backend/.venv/bin/python"; [ -x "$PY" ] || PY="$ROOT/backend/.venv/Scripts/python.exe"
(cd "$ROOT/backend" && "$PY" -m uvicorn app.main:app --port 8000 --reload) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT
cd "$ROOT/frontend" && npm run dev
