#!/bin/sh
set -eu

nginx -c /app/docker/nginx.conf
exec pm2-runtime /app/docker/ecosystem.config.cjs
