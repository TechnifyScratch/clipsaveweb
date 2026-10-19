#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
missing=0
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js 22+ is required. Install it from https://nodejs.org or run: brew install node'
  missing=1
elif ! node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'; then
  echo 'Please update to Node.js 22 or newer: brew install node'
  missing=1
fi
for tool in yt-dlp ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then echo "Missing: $tool"; missing=1; fi
done
if [ "$missing" -ne 0 ]; then
  echo ''
  echo 'Install the video tools with Homebrew: brew install yt-dlp ffmpeg'
  echo 'Homebrew installation instructions: https://brew.sh'
  echo 'Then run this script again. No dependencies are installed automatically.'
  exit 1
fi
# Refuse an occupied port before building or opening a browser.
node -e 'const net=require("net");const server=net.createServer();server.once("error",()=>{console.error("Port 3000 is in use. Stop the other app and try again.");process.exit(1)});server.listen(3000,"127.0.0.1",()=>server.close());'
if [ ! -d node_modules ]; then npm ci; fi
# Build before launching so startup failures remain visible in this terminal.
npm run build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in $(seq 1 60); do
  if ! kill -0 "$server_pid" 2>/dev/null; then wait "$server_pid"; exit 1; fi
  if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null; then
    if [ "$(uname)" = Darwin ]; then open http://localhost:3000; fi
    echo 'ClipSave is ready at http://localhost:3000. Press Control-C to stop.'
    wait "$server_pid"
    exit $?
  fi
  sleep 1
done
echo 'ClipSave did not start. Check whether port 3000 is already in use.'
exit 1
