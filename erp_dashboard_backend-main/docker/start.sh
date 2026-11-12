#!/usr/bin/env sh
set -e

cd /var/www/html

role="${1:-server}"

git config --global --add safe.directory /var/www/html

install_dependencies() {
  if [ -f vendor/autoload.php ]; then
    return
  fi

  if [ "$role" != "server" ]; then
    until [ -f vendor/autoload.php ]; do
      echo "Waiting for backend to install Composer dependencies..."
      sleep 2
    done
    return
  fi

  if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist
  fi
}

install_dependencies

until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME:-erp_admin}" -d "${DB_DATABASE:-erp_admin}"; do
  echo "Waiting for Postgres..."
  sleep 2
done

case "$role" in
  server)
    php artisan migrate --force
    exec php artisan serve --host=0.0.0.0 --port=8000
    ;;
  scheduler)
    exec php artisan schedule:work --no-interaction
    ;;
  queue)
    exec php artisan queue:work "${QUEUE_WORK_CONNECTION:-${QUEUE_CONNECTION:-database}}" \
      --queue="${QUEUE_NAMES:-default}" \
      --sleep="${QUEUE_SLEEP:-3}" \
      --tries="${QUEUE_TRIES:-3}" \
      --timeout="${QUEUE_TIMEOUT:-120}" \
      --max-time="${QUEUE_MAX_TIME:-3600}" \
      --memory="${QUEUE_MEMORY:-512}" \
      --no-interaction
    ;;
  *)
    echo "Unknown container role: $role"
    exit 1
    ;;
esac
