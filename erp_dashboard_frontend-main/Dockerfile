FROM node:24-alpine

WORKDIR /app

COPY docker/start.sh /usr/local/bin/start-frontend
RUN chmod +x /usr/local/bin/start-frontend

CMD ["start-frontend"]
