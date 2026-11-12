FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npm install -g pm2 && apk add --no-cache nginx

COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

CMD ["docker-entrypoint.sh"]
