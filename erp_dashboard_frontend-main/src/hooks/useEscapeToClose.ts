import { useEffect, useRef } from 'react';

type Handler = { current: () => void };

// Открытые окна в порядке открытия: Esc закрывает только верхнее.
const openDialogs: Handler[] = [];

function handleKeyDown(event: KeyboardEvent) {
  // defaultPrevented: Esc уже обработал выпадающий список или поле внутри окна.
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  const top = openDialogs[openDialogs.length - 1];
  if (!top) return;
  event.preventDefault();
  top.current();
}

/**
 * Закрытие модального окна по Esc. Если открыто несколько окон, закрывается верхнее.
 * Пока идёт сохранение, onClose должен ничего не делать: окно остаётся верхним,
 * и Esc игнорируется, а не закрывает окно под ним.
 */
export function useEscapeToClose(onClose: () => void, enabled = true) {
  const handlerRef = useRef(onClose);

  useEffect(() => {
    handlerRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!enabled) return;
    const entry: Handler = { current: () => handlerRef.current() };
    openDialogs.push(entry);
    if (openDialogs.length === 1) document.addEventListener('keydown', handleKeyDown);

    return () => {
      const index = openDialogs.indexOf(entry);
      if (index !== -1) openDialogs.splice(index, 1);
      if (openDialogs.length === 0) {
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [enabled]);
}
