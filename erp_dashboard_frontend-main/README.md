# Frontend (Vite)

## Переменные окружения

Создайте `.env`:

```env
VITE_API_URL=http://localhost:8221/api
VITE_WS_URL=ws://localhost:3000/ws
```

## Скрипты

- `npm run dev` — запуск в режиме разработки
- `npm run build` — production-сборка
- `npm run start` — предпросмотр production-сборки
- `npm run lint` — проверка ESLint (предупреждения тоже считаются ошибкой)
- `npm run typecheck` — проверка типов TypeScript
- `npm run format` / `npm run format:check` — форматирование Prettier / только проверка
- `npm run check` — все три проверки; перед коммитом должна проходить без замечаний
