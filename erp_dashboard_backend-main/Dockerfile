FROM php:8.4-cli-alpine

RUN apk add --no-cache \
        bash curl git unzip postgresql-client \
        libpng-dev libxml2-dev libzip-dev oniguruma-dev postgresql-dev \
    && docker-php-ext-install -j"$(nproc)" \
        dom gd mbstring pdo_pgsql simplexml xml xmlreader xmlwriter zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY docker/start.sh /usr/local/bin/start-backend
COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini
RUN chmod +x /usr/local/bin/start-backend

CMD ["start-backend"]
