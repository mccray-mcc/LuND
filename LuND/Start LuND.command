#!/bin/bash
# Double-click to run LuND: starts a local server in this folder and opens the site.
cd "$(dirname "$0")" || exit 1

PORT=3457
while lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done

echo ""
echo "  LuND — London Urban Noise Distribution"
echo "  Running at http://127.0.0.1:$PORT"
echo "  Close this window (or press Ctrl+C) to stop."
echo ""

(sleep 1; open "http://127.0.0.1:$PORT") &
python3 -m http.server "$PORT" --bind 127.0.0.1
