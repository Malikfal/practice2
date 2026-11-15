# Производственная практика

## 🛠️ Технологический стек

**Мобильная разработка:**
*   [React Native](https://reactnative.dev/) (фреймворк для кроссплатформенной разработки)
*   [Expo](https://expo.dev/) (SDK и инструменты для сборки)
*   [Expo Router](https://docs.expo.dev/router/introduction/) (файловая навигация)
*   [TypeScript](https://www.typescriptlang.org/) (строгая типизация)
*   [Axios](https://axios-http.com/) (HTTP-клиент для работы с API)
*   [React Context API](https://react.dev/reference/react/useContext) (управление глобальным состоянием пользователя)

**Бэкенд (внешний сервис):**
*   Laravel (PHP), PostgreSQL, Docker (API развернуто отдельно и используется в качестве источника данных).

## 📂 Архитектура проекта

Проект имеет модульную структуру для удобства поддержки:
```text
mobile-app/
├── src/
│   ├── app/           # Экраны и навигация (Expo Router)
│   │   ├── (tabs)/    # Нижняя панель вкладок (Главная, Проекты, Сотрудники, Профиль)
│   │   ├── project/   # Экраны проектов и задач
│   │   └── task/      # Экран деталей задачи и таймера
│   ├── context/       # AuthContext (глобальное состояние пользователя и прав)
│   ├── services/      # api.ts (настроенный экземпляр Axios с интерсепторами)
│   ├── styles/        # Вынесенные файлы стилей (StyleSheet) для каждого экрана
│   └── components/    # Переиспользуемые UI-компоненты
├── package.json
└── tsconfig.json      # Настроены алиасы путей (например, @/services/api)
