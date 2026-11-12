import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig([
  globalIgnores(['.next', '.vite', 'dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      eslintPluginPrettierRecommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        process: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Базовое правило не понимает TypeScript (параметры в типах) и дублирует
      // @typescript-eslint/no-unused-vars, поэтому настройки перенесены в него.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/components/ui/table/**'],
    rules: {
      // Таблицы собираются из src/components/ui/table: общий вид, выравнивание
      // по типу данных, закреплённые шапки и строки состояний.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='table']",
          message: 'Используйте Table из src/components/ui/table.',
        },
      ],
    },
  },
]);
