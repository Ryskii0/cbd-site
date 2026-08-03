#!/bin/sh
cd "$(dirname "$0")"
export PORT=4173
export HOST=0.0.0.0
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required. Install it from https://nodejs.org/"
  read -r _
  exit 1
fi
echo "CBD Share is running at http://localhost:${PORT}"
node server.mjs
