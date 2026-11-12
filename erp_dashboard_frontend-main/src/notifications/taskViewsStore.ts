import { useSyncExternalStore } from 'react';

import { api } from '../api/api';

type TaskWithChanges = {
  id: string;
  has_changes?: boolean;
  last_activity_at?: string | null;
};

/**
 * Метка "Есть изменения" на досках. Сервер считает её при загрузке доски, а открытие задачи
 * снимает метку сразу, не дожидаясь перезагрузки: здесь хранится, когда задача открывалась в этой вкладке.
 */
class TaskViewsStore {
  private viewedAt = new Map<string, number>();
  private listeners = new Set<() => void>();
  private version = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  /**
   * Вызывается при открытии и закрытии задачи: изменения, пришедшие пока она была открыта, тоже просмотрены.
   */
  markViewed(taskId: string) {
    if (!taskId) return;
    this.viewedAt.set(taskId, Date.now());
    this.version += 1;
    this.listeners.forEach((listener) => listener());
    void api.notifications.markTaskViewed(taskId).catch(() => undefined);
  }

  /**
   * Открывает задачу: возвращает функцию для закрытия.
   */
  openTask(taskId: string) {
    this.markViewed(taskId);
    return () => this.markViewed(taskId);
  }

  hasChanges(task: TaskWithChanges) {
    if (!task.has_changes) return false;
    const viewedAt = this.viewedAt.get(task.id);
    if (viewedAt === undefined) return true;
    const changedAt = task.last_activity_at ? Date.parse(task.last_activity_at) : NaN;
    return Number.isNaN(changedAt) ? false : changedAt > viewedAt;
  }
}

export const taskViewsStore = new TaskViewsStore();

/**
 * Перерисовывает доску, когда задачу открыли.
 */
export function useTaskViews() {
  useSyncExternalStore(taskViewsStore.subscribe, taskViewsStore.getVersion);
  return taskViewsStore;
}
