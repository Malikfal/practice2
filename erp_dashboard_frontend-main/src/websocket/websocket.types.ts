import type { AppNotification } from '../types/notifications';

export type WebsocketEventIncoming =
  | 'tracking-users'
  | 'tracking-projects'
  | 'online-users'
  | 'notification'
  | 'notifications-unread-count'
  | 'notifications-refresh'
  | (string & {});

export type WebsocketEvent = 'start-tracking' | 'stop-tracking' | (string & {});

export type WebsocketMessage<T, U extends WebsocketEvent | WebsocketEventIncoming> = {
  data: T;
  event: U;
};

export type TrackingUsersMessage = WebsocketMessage<string[], 'tracking-users'>;
export type TrackingProjectsMessage = WebsocketMessage<string[], 'tracking-projects'>;
// Сотрудники с открытой панелью или приложением, кроме админов.
export type OnlineUsersMessage = WebsocketMessage<string[], 'online-users'>;
export type StartTrackingMessage = WebsocketMessage<
  { projectId: string },
  'start-tracking'
>;
export type StopTrackingMessage = WebsocketMessage<null, 'stop-tracking'>;
export type NotificationMessage = WebsocketMessage<
  { notification: AppNotification; unread_count: number },
  'notification'
>;
export type NotificationsUnreadCountMessage = WebsocketMessage<
  {
    unread_count: number;
    // Что прочитано в другой вкладке или на другом устройстве.
    read_ids?: string[];
    // Событие не поместилось в сообщение: загруженный список нужно перечитать.
    resync?: boolean;
  },
  'notifications-unread-count'
>;
