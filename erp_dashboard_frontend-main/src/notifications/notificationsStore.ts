import { useSyncExternalStore } from 'react';

import { api } from '../api/api';
import type { AppNotification, NotificationScope } from '../types/notifications';

export type NotificationsSnapshot = {
  // null — пользователь не вошёл, ленты нет.
  scope: NotificationScope | null;
  unreadCount: number;
  items: AppNotification[];
  nextCursor: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  onlyUnread: boolean;
  // Вкладка "Упоминания": только уведомления, где пользователя упомянули через @.
  onlyMentions: boolean;
  isSettingsOpen: boolean;
};

const EMPTY_SNAPSHOT: NotificationsSnapshot = {
  scope: null,
  unreadCount: 0,
  items: [],
  nextCursor: null,
  isLoaded: false,
  isLoading: false,
  onlyUnread: false,
  onlyMentions: false,
  isSettingsOpen: false,
};

const MENTION_TYPE = 'task.mentioned';

export type NotificationsTab = 'all' | 'unread' | 'mentions';

const PAGE_SIZE = 20;
// Задача открыта, а по ней пришло уведомление: отмечаем прочитанным с небольшой задержкой, пачкой.
const ACTIVE_TASK_READ_DELAY_MS = 400;

type NotificationListener = (_notification: AppNotification) => void;
type TaskListener = (_taskId: string) => void;

/**
 * Лента уведомлений текущего пользователя. Одна на приложение: колокольчик, окно задачи и сокет
 * работают с ней напрямую. Источник истины — REST, сокет только сообщает о новом.
 */
class NotificationsStore {
  private snapshot: NotificationsSnapshot = EMPTY_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly notificationListeners = new Set<NotificationListener>();
  private readonly ownCommentListeners = new Set<TaskListener>();
  // Открытые сейчас задачи (окно задачи может быть открыто в двух местах сразу).
  private readonly activeTasks = new Map<string, number>();
  private readonly pendingTaskReads = new Map<string, number>();
  private requestVersion = 0;
  // Счётчик уже пришёл из REST: до этого его 0 ничего не значит.
  private isCountLoaded = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  start(scope: NotificationScope) {
    if (this.snapshot.scope === scope) return;
    this.requestVersion += 1;
    this.isCountLoaded = false;
    this.publish({ ...EMPTY_SNAPSHOT, scope });
    void this.refreshUnreadCount();
  }

  stop() {
    if (this.snapshot.scope === null) return;
    this.requestVersion += 1;
    this.isCountLoaded = false;
    this.pendingTaskReads.forEach((timer) => window.clearTimeout(timer));
    this.pendingTaskReads.clear();
    this.publish(EMPTY_SNAPSHOT);
  }

  async refreshUnreadCount() {
    const { scope } = this.snapshot;
    if (!scope) return;
    const version = this.requestVersion;

    try {
      const { unread_count } = await api.notifications.unreadCount(scope);
      if (version !== this.requestVersion) return;
      this.publish({ unreadCount: unread_count });
      this.countLoaded(unread_count);
    } catch {
      // Счётчик обновится при следующем событии сокета или открытии списка.
    }
  }

  /**
   * Сокет переподключился или сообщил, что события могли потеряться: обновляем счётчик и загруженный список.
   */
  resync() {
    void this.refreshUnreadCount();
    if (this.snapshot.isLoaded) void this.loadFirstPage().catch(() => undefined);
  }

  async loadFirstPage() {
    const { scope, onlyUnread, onlyMentions } = this.snapshot;
    if (!scope) return;
    const version = ++this.requestVersion;
    this.publish({ isLoading: true });

    try {
      const page = await api.notifications.list(scope, {
        unread: onlyUnread,
        limit: PAGE_SIZE,
        type: onlyMentions ? MENTION_TYPE : undefined,
      });
      if (version !== this.requestVersion) return;
      this.publish({
        items: page.data,
        nextCursor: page.next_cursor,
        unreadCount: page.unread_count,
        isLoaded: true,
        isLoading: false,
      });
      this.countLoaded(page.unread_count);
    } catch (error) {
      if (version === this.requestVersion) this.publish({ isLoading: false });
      throw error;
    }
  }

  async loadMore() {
    const { scope, onlyUnread, onlyMentions, nextCursor, isLoading } = this.snapshot;
    if (!scope || !nextCursor || isLoading) return;
    const version = this.requestVersion;
    this.publish({ isLoading: true });

    try {
      const page = await api.notifications.list(scope, {
        unread: onlyUnread,
        limit: PAGE_SIZE,
        cursor: nextCursor,
        type: onlyMentions ? MENTION_TYPE : undefined,
      });
      if (version !== this.requestVersion) return;
      const knownIds = new Set(this.snapshot.items.map((item) => item.id));
      this.publish({
        items: [
          ...this.snapshot.items,
          ...page.data.filter((item) => !knownIds.has(item.id)),
        ],
        nextCursor: page.next_cursor,
        unreadCount: page.unread_count,
        isLoading: false,
      });
    } catch (error) {
      if (version === this.requestVersion) this.publish({ isLoading: false });
      throw error;
    }
  }

  setTab(tab: NotificationsTab) {
    const onlyUnread = tab === 'unread';
    const onlyMentions = tab === 'mentions';
    if (
      this.snapshot.onlyUnread === onlyUnread &&
      this.snapshot.onlyMentions === onlyMentions
    ) {
      return;
    }
    this.publish({
      onlyUnread,
      onlyMentions,
      items: [],
      nextCursor: null,
      isLoaded: false,
    });
    void this.loadFirstPage().catch(() => undefined);
  }

  /**
   * Новое или сведённое (с тем же id) уведомление из сокета.
   */
  receive(notification: AppNotification, unreadCount: number) {
    if (!this.snapshot.scope) return;

    const taskId = notification.task?.id ?? '';
    const isActiveTask = taskId !== '' && this.activeTasks.has(taskId);
    const item =
      isActiveTask && !notification.read_at
        ? { ...notification, read_at: new Date().toISOString() }
        : notification;

    // На вкладке "Упоминания" в список попадают только упоминания, счётчик считается как обычно.
    const fitsTab = !this.snapshot.onlyMentions || notification.type === MENTION_TYPE;
    const items =
      this.snapshot.isLoaded && fitsTab
        ? [
            item,
            ...this.snapshot.items
              .filter((existing) => existing.id !== item.id)
              // Задачу могли переименовать: во всех её строках показываем актуальное название.
              .map((existing) =>
                item.task &&
                existing.task?.id === item.task.id &&
                existing.task.title !== item.task.title
                  ? { ...existing, task: item.task }
                  : existing,
              ),
          ]
        : this.snapshot.items;
    // Пользователь уже смотрит задачу: счётчик не растёт, сервер отметит прочтение.
    const wasUnread = this.snapshot.items.some(
      (existing) => existing.id === item.id && !existing.read_at,
    );
    const nextCount =
      isActiveTask && !wasUnread ? Math.max(0, unreadCount - 1) : unreadCount;

    this.publish({ items, unreadCount: nextCount });
    if (isActiveTask && !notification.read_at) this.scheduleTaskRead(taskId);

    this.notificationListeners.forEach((listener) => listener(notification));
  }

  /**
   * Счётчик из сокета. readIds — что прочитано в другой вкладке или на другом устройстве: снимаем отметки
   * и здесь. resync — событие не поместилось в сообщение, загруженный список нужно перечитать.
   */
  syncUnreadCount(unreadCount: number, readIds: string[] = [], resync = false) {
    if (!this.snapshot.scope) return;

    const ids = new Set(readIds);
    this.patchItems((item) => ids.has(item.id), unreadCount);
    if (resync && this.snapshot.isLoaded)
      void this.loadFirstPage().catch(() => undefined);
  }

  async markRead(notificationId: string) {
    const { scope } = this.snapshot;
    const target = this.snapshot.items.find((item) => item.id === notificationId);
    if (!scope || !target || target.read_at) return;

    this.patchItems((item) => item.id === notificationId);
    const { unread_count } = await api.notifications.markRead(scope, notificationId);
    this.publish({ unreadCount: unread_count });
  }

  async markAllRead() {
    const { scope } = this.snapshot;
    if (!scope) return;

    this.patchItems(() => true);
    this.publish({ unreadCount: 0 });
    const { unread_count } = await api.notifications.markAllRead(scope);
    this.publish({ unreadCount: unread_count });
  }

  /**
   * force — точно есть что отмечать: по открытой задаче только что пришло уведомление.
   */
  async markTaskRead(taskId: string, force = false) {
    const { scope, unreadCount } = this.snapshot;
    if (!scope || !taskId) return;
    // Нечего отмечать: лишний запрос при каждом открытии задачи не нужен. Пока счётчик
    // не загружен, открытые задачи отметит countLoaded().
    if (!force && (!this.isCountLoaded || unreadCount === 0)) return;

    this.patchItems((item) => item.task?.id === taskId);
    try {
      const { unread_count } = await api.notifications.markTaskRead(scope, taskId);
      this.publish({ unreadCount: unread_count });
    } catch {
      void this.refreshUnreadCount();
    }
  }

  /**
   * Окно задачи открыто: её уведомления прочитаны, новые по ней не увеличивают счётчик.
   * Возвращает функцию, которую нужно вызвать при закрытии.
   */
  openTask(taskId: string) {
    if (!taskId) return () => undefined;

    this.activeTasks.set(taskId, (this.activeTasks.get(taskId) ?? 0) + 1);
    void this.markTaskRead(taskId);

    return () => {
      const count = (this.activeTasks.get(taskId) ?? 1) - 1;
      if (count > 0) this.activeTasks.set(taskId, count);
      else this.activeTasks.delete(taskId);
    };
  }

  /**
   * Подписка страниц на новые уведомления, например чтобы обновить переписку открытой задачи.
   */
  onNotification(listener: NotificationListener) {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  /**
   * Пользователь написал комментарий или ответ клиенту: сервер мог подписать его на задачу (автоподписка).
   */
  ownCommentAdded(taskId: string) {
    this.ownCommentListeners.forEach((listener) => listener(taskId));
  }

  onOwnCommentAdded(listener: TaskListener) {
    this.ownCommentListeners.add(listener);
    return () => {
      this.ownCommentListeners.delete(listener);
    };
  }

  openSettings() {
    this.publish({ isSettingsOpen: true });
  }

  closeSettings() {
    this.publish({ isSettingsOpen: false });
  }

  private scheduleTaskRead(taskId: string) {
    if (this.pendingTaskReads.has(taskId)) return;

    const timer = window.setTimeout(() => {
      this.pendingTaskReads.delete(taskId);
      void this.markTaskRead(taskId, true);
    }, ACTIVE_TASK_READ_DELAY_MS);
    this.pendingTaskReads.set(taskId, timer);
  }

  /**
   * Счётчик пришёл из REST. Если непрочитанные есть, уведомления открытых задач прочитаны: например,
   * пришли, пока страница загружалась или сокет был отключён.
   */
  private countLoaded(unreadCount: number) {
    this.isCountLoaded = true;
    if (unreadCount === 0) return;
    this.activeTasks.forEach((_count, taskId) => void this.markTaskRead(taskId));
  }

  /**
   * Отмечает строки прочитанными. unreadCount — счётчик с сервера; без него вычитаем отмеченные из текущего.
   */
  private patchItems(
    predicate: (_item: AppNotification) => boolean,
    unreadCount?: number,
  ) {
    const readAt = new Date().toISOString();
    let changed = 0;
    const items = this.snapshot.items.map((item) => {
      if (item.read_at || !predicate(item)) return item;
      changed += 1;
      return { ...item, read_at: readAt };
    });

    if (changed === 0 && unreadCount === undefined) return;
    this.publish({
      ...(changed > 0 ? { items } : {}),
      unreadCount: unreadCount ?? Math.max(0, this.snapshot.unreadCount - changed),
    });
  }

  private publish(patch: Partial<NotificationsSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}

export const notificationsStore = new NotificationsStore();

export function useNotifications(): NotificationsSnapshot {
  return useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.getSnapshot,
    () => EMPTY_SNAPSHOT,
  );
}
