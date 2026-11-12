import type {
  CompanyNotificationSettings,
  NotificationPage,
  NotificationScope,
  PersonalNotificationSettings,
  TaskSubscriptionMode,
  TaskSubscriptionState,
} from '../../types/notifications';
import { buildQuery } from '../core/query';

// Клиентские запросы идут под /client: по префиксу httpClient выбирает, какой сессией обновлять токен.
const feedPrefix = (scope: NotificationScope) =>
  scope === 'client' ? '/client/notifications' : '/notifications';
const tasksPrefix = (scope: NotificationScope) =>
  scope === 'client' ? '/client/tasks' : '/tasks';

type UnreadCountResponse = { unread_count: number };

export function createNotificationsApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  return {
    notifications: {
      list: (
        scope: NotificationScope,
        params: {
          cursor?: string | null;
          unread?: boolean;
          limit?: number;
          type?: string;
        } = {},
      ) =>
        request<NotificationPage>(
          `${feedPrefix(scope)}${buildQuery({
            cursor: params.cursor ?? undefined,
            unread: params.unread ? 1 : undefined,
            limit: params.limit,
            type: params.type,
          })}`,
        ),

      unreadCount: (scope: NotificationScope) =>
        request<UnreadCountResponse>(`${feedPrefix(scope)}/unread-count`),

      markRead: (scope: NotificationScope, notificationId: string) =>
        request<UnreadCountResponse>(`${feedPrefix(scope)}/${notificationId}/read`, {
          method: 'POST',
        }),

      markAllRead: (scope: NotificationScope) =>
        request<UnreadCountResponse>(`${feedPrefix(scope)}/read-all`, { method: 'POST' }),

      markTaskRead: (scope: NotificationScope, taskId: string) =>
        request<UnreadCountResponse>(
          `${tasksPrefix(scope)}/${taskId}/notifications/read`,
          {
            method: 'POST',
          },
        ),

      // Метка "Есть изменения" снимается: только для сотрудников.
      markTaskViewed: (taskId: string) =>
        request<{ viewed: boolean }>(`/tasks/${taskId}/viewed`, { method: 'POST' }),

      getSettings: (scope: NotificationScope) =>
        request<{ data: PersonalNotificationSettings }>(
          `${feedPrefix(scope)}/settings`,
        ).then((response) => response.data),

      updateSettings: (
        scope: NotificationScope,
        payload: {
          events: { key: string; enabled: boolean }[];
          auto_watch?: boolean | null;
        },
      ) =>
        request<{ data: PersonalNotificationSettings }>(`${feedPrefix(scope)}/settings`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }).then((response) => response.data),

      getCompanySettings: () =>
        request<{ data: CompanyNotificationSettings }>('/settings/notifications').then(
          (response) => response.data,
        ),

      updateCompanySettings: (
        rules: { event: string; relation: string; enabled: boolean }[],
      ) =>
        request<{ data: CompanyNotificationSettings }>('/settings/notifications', {
          method: 'PUT',
          body: JSON.stringify({ rules }),
        }).then((response) => response.data),

      getTaskSubscription: (taskId: string) =>
        request<{ data: TaskSubscriptionState }>(`/tasks/${taskId}/subscription`).then(
          (response) => response.data,
        ),

      updateTaskSubscription: (taskId: string, mode: TaskSubscriptionMode | null) =>
        request<{ data: TaskSubscriptionState }>(`/tasks/${taskId}/subscription`, {
          method: 'PUT',
          body: JSON.stringify({ mode }),
        }).then((response) => response.data),
    },
  };
}
