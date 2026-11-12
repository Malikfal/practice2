import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import 'sonner/dist/styles.css';
import './index.css';
import App from './App';

const isEditableElement = (element: Element | null) =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement ||
  element?.getAttribute('contenteditable') === 'true';

const syncAppViewportHeight = () => {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty(
    '--app-viewport-height',
    `${Math.round(viewportHeight)}px`,
  );
};

const scheduleViewportSync = (resetWindowScroll = false) => {
  window.requestAnimationFrame(() => {
    syncAppViewportHeight();

    if (resetWindowScroll && !isEditableElement(document.activeElement)) {
      window.scrollTo(0, 0);
    }
  });
};

// После деплоя старых чанков на сервере нет: открытая вкладка перезагружается на новую версию.
// Метка в sessionStorage не даёт уйти в цикл, если чанк недоступен по другой причине.
const CHUNK_RELOAD_KEY = 'chunk-reload-at';
window.addEventListener('vite:preloadError', () => {
  const lastReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
  if (Date.now() - lastReloadAt < 10_000) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

syncAppViewportHeight();
window.visualViewport?.addEventListener('resize', () => scheduleViewportSync());
window.addEventListener('resize', () => scheduleViewportSync());
window.addEventListener('orientationchange', () => scheduleViewportSync());
document.addEventListener('focusout', () => {
  window.setTimeout(() => scheduleViewportSync(true), 100);
  window.setTimeout(() => scheduleViewportSync(true), 350);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
