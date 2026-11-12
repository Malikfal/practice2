#!/bin/sh
set -eu

wait_for_health() {
  port="$1"
  attempts=30

  while [ "$attempts" -gt 0 ]; do
    if node -e "fetch('http://127.0.0.1:${port}/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"; then
      return 0
    fi

    attempts=$((attempts - 1))
    sleep 1
  done

  echo "Health check failed for port ${port}" >&2
  return 1
}

pm2 delete erp-backend-a || true
pm2 start /app/docker/ecosystem.config.cjs --only erp-backend-a
wait_for_health 3001

pm2 delete erp-backend-b || true
pm2 start /app/docker/ecosystem.config.cjs --only erp-backend-b
wait_for_health 3002
