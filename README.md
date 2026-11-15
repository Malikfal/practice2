# Производственная практика

## 🛠️ Технологический стек

**Мобильная разработка:**
*   [React Native](https://reactnative.dev/)
*   [Expo](https://expo.dev/)
*   [Expo Router](https://docs.expo.dev/router/introduction/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Axios](https://axios-http.com/)
*   [React Context API](https://react.dev/reference/react/useContext)

**Бэкенд (внешний сервис компании):**

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
