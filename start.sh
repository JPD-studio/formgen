#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")/web" && pwd)"
PORT=3200

kill_processes() {
  lsof -ti tcp:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
  pkill -9 -f "next dev" 2>/dev/null || true
  pkill -9 -f "next-server" 2>/dev/null || true
  pkill -9 -f "next start" 2>/dev/null || true
}

echo "--- プロセス終了 (1/3) ---"
kill_processes
sleep 1

echo "--- プロセス終了 (2/3) ---"
kill_processes
sleep 1

echo "--- プロセス終了 (3/3) ---"
kill_processes
sleep 1

echo "--- 起動: http://localhost:$PORT ---"
cd "$APP_DIR"
npm install --silent
npm run dev
