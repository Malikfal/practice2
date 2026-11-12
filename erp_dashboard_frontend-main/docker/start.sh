#!/usr/bin/env sh
set -e

cd /app

if [ -f package-lock.json ]; then
  CURRENT_LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
  INSTALLED_LOCK_HASH="$(cat node_modules/.package-lock.sha256 2>/dev/null || true)"
  HAS_VITE_BIN="false"
  if [ -x node_modules/.bin/vite ]; then
    HAS_VITE_BIN="true"
  fi

  if [ ! -d node_modules ] || [ "$CURRENT_LOCK_HASH" != "$INSTALLED_LOCK_HASH" ] || [ "$HAS_VITE_BIN" != "true" ]; then
    npm ci --include=dev
    mkdir -p node_modules
    echo "$CURRENT_LOCK_HASH" > node_modules/.package-lock.sha256
  fi
elif [ ! -d node_modules ]; then
  npm install --include=dev
fi

npm run dev -- --host 0.0.0.0 --port 4000
