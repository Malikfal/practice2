# ERP Backend

Backend-сервис на Fastify + Prisma + PostgreSQL для учета пользователей, проектов, задач и рабочих сессий.

## Что есть в проекте

- Аутентификация по JWT
- Роли пользователей: `ADMIN`, `MANAGER`, `WORKER`
- Управление проектами и назначением сотрудников
- Задачи внутри проектов
- Учет рабочих сессий и сегментов времени
- Swagger-документация
- WebSocket endpoint

## Стек

- Node.js `24+`
- Fastify
- Prisma
- PostgreSQL
- TypeScript

## Требования

- `nvm` или установленный Node.js `24+`
- `npm`
- Docker + Docker Compose

## Переменные окружения

Проект использует файл `.env`.

Минимально нужны:

```env
ENV=dev
PORT=3000

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"

JWT_SECRET=secret
```

## Быстрый старт

1. Переключить Node.js на нужную версию:

```bash
nvm install
nvm use
```

2. Установить зависимости:

```bash
npm install
```

3. Поднять PostgreSQL:

```bash
docker compose up -d
```

4. Применить миграции:

```bash
npx prisma migrate deploy
```

5. Запустить проект в dev-режиме:

```bash
npm run dev
```

После запуска API будет доступно на:

- `http://localhost:3000`
- Swagger UI: `http://localhost:3000/swagger`

## Миграции Prisma

Применить существующие миграции:

```bash
npx prisma migrate deploy
```

Prisma создает миграцию и применяет её:

```bash
npx prisma migrate dev --name MIGRATION_NAME
```

Prisma просто создает миграцию:

```bash
npx prisma migrate dev --create-only --name MIGRATION_NAME
```

Сгенерировать Prisma Client вручную:

```bash
npx prisma generate
```

## Seed-данные

Заполнить базу тестовыми данными:

```bash
npm run seed
```

После сидирования будут созданы пользователи:

- `admin@gmail.com`
- `manager@gmail.com`
- `worker@gmail.com`

Пароль для всех:

```text
123456
```

## Скрипты

- `npm run dev` - запуск в режиме разработки
- `npm run build` - сборка TypeScript в `dist`
- `npm start` - запуск собранного приложения
- `npm run typecheck` - проверка типов
- `npm run seed` - заполнение базы тестовыми данными

## Основные эндпоинты

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

### Users

- `GET /users/me`
- `GET /users`
- `PATCH /users/:id/role`
- `POST /users/info`

### Projects

- `POST /projects`
- `GET /projects`
- `GET /projects/:projectId`
- `POST /projects/assign-worker`

### Tasks

- `GET /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/project/:projectId`
- `POST /tasks`

### Work Session

- `POST /work-session/start`
- `POST /work-session/end`
- `GET /work-session/active`
- `POST /work-session/segment`

## WebSocket

WebSocket endpoint:

```text
GET /ws
```

Подключение защищено авторизацией и требует JWT (cookie `erp_access_token` или query `token`). Компания и роль берутся из базы при подключении; заблокированный пользователь получает закрытие сокета с кодом `4401`.

Сообщения — JSON `{ "event": "...", "data": ... }`.

- Клиент → сервер (только сотрудники): `start-tracking { projectId }`, `stop-tracking`.
- Сервер → сотрудник: `tracking-users`, `tracking-projects` — кто трекает и в каких проектах, только внутри своей компании.
- Сервер → сотрудник и клиент: `notification` (`{ notification, unread_count }`), `notifications-unread-count` (`{ unread_count, read_ids?, resync? }`: `read_ids` — что прочитано в другой вкладке, `resync` — перечитать загруженный список), `notifications-refresh` (без данных: перечитать счётчик).

Клиентские аккаунты подключаются только за уведомлениями: трекинг им не отправляется, их сообщения о трекинге игнорируются.

Уведомления создаёт панель (Laravel): после сохранения она вызывает `pg_notify('erp_notifications', { user_ids, event, data })`. Каждый процесс Node держит отдельное соединение `LISTEN erp_notifications` (`src/modules/notifications/notification-listener.ts`) и пересылает событие открытым сокетам этих пользователей. Разрешены только события `notification` и `notifications-unread-count`. После обрыва соединения с базой слушатель переподключается и рассылает `notifications-refresh`.

Сервер пингует сокеты каждые 30 секунд: прокси не закрывает простаивающие соединения, а оборванные убираются из «онлайн».

## Docker

Docker-конфиги находятся в папке `docker/`.

Запуск:

```bash
docker compose up -d
```

Остановка:

```bash
docker compose down
```

Остановка с удалением данных PostgreSQL из папки `docker/data/postgres`:

```bash
docker compose down
```

## Прод-сценарий

## Обновление на проде

Текущий продовый сценарий использует:

- один Docker-контейнер `app`
- `nginx` внутри контейнера на внешнем порту `3000`
- два backend-процесса под `pm2` на `3001` и `3002`
- PostgreSQL только во внутренней Docker-сети, без публикации `5432` наружу

Первый запуск или обновление образа:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Обычное обновление кода без ребилда образа:

```bash
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
docker compose exec app ./docker/pm2-rolling-restart.sh
```

Обновление если поменялись библиотеки

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate -V
```

Проверить состояние после обновления:

```bash
docker compose ps
docker compose logs --tail=100 app
```

Если один из процессов `pm2` оказался в битом состоянии, его можно пересоздать из `ecosystem.config.cjs`:

```bash
docker compose exec app pm2 delete erp-backend-a || true
docker compose exec app pm2 delete erp-backend-b || true
docker compose exec app pm2 start /app/docker/ecosystem.config.cjs
docker compose exec app pm2 save
```

Важно:

- для этой схемы не использовать `pm2 reload ecosystem.config.cjs`
- для rolling update использовать только `./docker/pm2-rolling-restart.sh`
- не использовать `pm2 restart ... --update-env`, потому что он может перетереть порты `3001` и `3002`

## Полезная последовательность для первого запуска

```bash
nvm install
nvm use
npm install
docker compose up -d
npx prisma migrate deploy
npm run seed
npm run dev
```

## При выполнении npx prisma migrate deploy с ошибкой

```bash
(Error: P1000: Authentication failed against database server, the provided database credentials for `(not available)` are not valid.)
```
Помогли команды:

```bash
# Применить миграции
docker run --rm -it --network erp_erp-network -v ${PWD}:/app -w /app -e DATABASE_URL="postgresql://postgres:postgres@erp-postgres-1:5432/postgres?schema=public" node:24-alpine sh -c "npx prisma migrate deploy"

# Если migrate deploy не работает — синхронизируй схему через db push
docker run --rm -it --network erp_erp-network -v ${PWD}:/app -w /app -e DATABASE_URL="postgresql://postgres:postgres@erp-postgres-1:5432/postgres?schema=public" node:24-alpine sh -c "npx prisma db push"

# Заполнить тестовыми данными
docker run --rm -it --network erp_erp-network -v ${PWD}:/app -w /app -e DATABASE_URL="postgresql://postgres:postgres@erp-postgres-1:5432/postgres?schema=public" node:24-alpine sh -c "npm run seed"
```


## npm run dev ошибка You installed esbuild for another platform

```bash
npm uninstall esbuild
npm install esbuild
npm run dev
```