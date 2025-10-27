#!/bin/bash
set -euo pipefail

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DIST_DIR="$PROJECT_ROOT/dist"
SOCKET_PATH="/tmp/desktop-menu.sock"
GTK_BINARY="$PROJECT_ROOT/gtk/gtk_desktop"

cleanup() {
  if [[ -n "${NODE_PID:-}" ]]; then
    kill "$NODE_PID" >/dev/null 2>&1 || true
    wait "$NODE_PID" 2>/dev/null || true
  fi
  if [[ -S "$SOCKET_PATH" ]]; then
    rm -f "$SOCKET_PATH"
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -f "$DIST_DIR/server.js" || ! -f "$DIST_DIR/public/index.html" ]]; then
  echo "🔧 Building TypeScript backend and React frontend..."
  npm run build
fi

if [[ ! -x "$GTK_BINARY" ]]; then
  echo "🔧 Building GTK frontend (requires gtk4, json-c, gio-2.0)..."
  make -C "$PROJECT_ROOT/gtk"
fi

echo "🚀 Starting Node backend..."
node "$DIST_DIR/server.js" &
NODE_PID=$!

for attempt in {1..40}; do
  if [[ -S "$SOCKET_PATH" ]]; then
    break
  fi
  sleep 0.25
  if (( attempt == 40 )); then
    echo "❌ IPC socket did not appear at $SOCKET_PATH"
    exit 1
  fi
done

echo "🖥️ Launching GTK frontend..."
"$GTK_BINARY"
