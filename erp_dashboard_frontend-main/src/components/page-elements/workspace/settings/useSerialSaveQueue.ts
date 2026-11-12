import { useCallback, useRef, useState } from 'react';

export type SerialSaveTask<T> = {
  // Состояние до правки: точка отката, если по ключу ещё ничего не сохраняется.
  previous: T;
  next: T;
  // Отправляет состояние целиком и возвращает то, что подтвердил сервер.
  send: (_value: T) => Promise<T>;
  // Записывает состояние в UI (оптимистично, после ответа или при откате).
  apply: (_value: T) => void;
  onError: (_error: unknown) => void;
};

// Мгновенное сохранение по клику: по одному ключу запросы идут строго по очереди,
// а пока запрос в пути, копится только последнее состояние. Так быстрые клики
// не теряются и старый ответ не перетирает более новую правку.
export function useSerialSaveQueue<T>() {
  const pendingRef = useRef(new Map<string, SerialSaveTask<T>>());
  const activeRef = useRef(new Set<string>());
  const confirmedRef = useRef(new Map<string, T>());
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());

  const run = useCallback(async (key: string) => {
    activeRef.current.add(key);
    setSavingKeys((prev) => new Set(prev).add(key));

    try {
      let task = pendingRef.current.get(key);

      while (task) {
        pendingRef.current.delete(key);

        try {
          const saved = await task.send(task.next);
          confirmedRef.current.set(key, saved);
          if (!pendingRef.current.has(key)) task.apply(saved);
        } catch (error) {
          // Более новые правки построены поверх неудачной, поэтому откатываем всё
          // к последнему подтверждённому сервером состоянию.
          const latestTask = pendingRef.current.get(key) ?? task;
          pendingRef.current.delete(key);
          const confirmed = confirmedRef.current.get(key);
          if (confirmed !== undefined) latestTask.apply(confirmed);
          latestTask.onError(error);
          break;
        }

        task = pendingRef.current.get(key);
      }
    } finally {
      activeRef.current.delete(key);
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const enqueue = useCallback(
    (key: string, task: SerialSaveTask<T>) => {
      const isBusy = activeRef.current.has(key) || pendingRef.current.has(key);
      if (!isBusy) confirmedRef.current.set(key, task.previous);

      task.apply(task.next);
      pendingRef.current.set(key, task);
      if (!activeRef.current.has(key)) void run(key);
    },
    [run],
  );

  return { enqueue, savingKeys };
}
