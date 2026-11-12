import { useEffect } from 'react';

import { notificationsStore } from './notificationsStore';

/**
 * Лента принадлежит вошедшему пользователю: при входе загружаем счётчик, при выходе всё сбрасываем.
 */
export function useNotificationsLifecycle(userId: string | null, isClient: boolean) {
  useEffect(() => {
    if (!userId) {
      notificationsStore.stop();
      return;
    }

    notificationsStore.start(isClient ? 'client' : 'employee');
    return () => notificationsStore.stop();
  }, [userId, isClient]);
}
