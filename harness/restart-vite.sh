#!/usr/bin/env bash
# Restart the product's dev server. Lives in its own file so the pkill patterns
# cannot match the shell that invokes it — an inline `pkill -f "yarn start"`
# matches its own command line and kills the caller.
set -u
REPO="${PROFOLIO_REPO:-/home/user/profolio-reactjs-copy}"
LOG="$(dirname "$0")/vite.log"
pkill -f "vite --host" 2>/dev/null
pkill -f "yarn start" 2>/dev/null
sleep 1
cd "$REPO" || exit 1
( BROWSER=none FORCE_COLOR=0 yarn start --host 127.0.0.1 --port 3000 --strictPort > "$LOG" 2>&1 & )
for i in $(seq 1 40); do
  sleep 1
  if curl -s -o /dev/null --max-time 2 http://127.0.0.1:3000/; then echo "vite up after ${i}s"; exit 0; fi
done
echo "vite did not come up:"; tail -20 "$LOG"; exit 1
