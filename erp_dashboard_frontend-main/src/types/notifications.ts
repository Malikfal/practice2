// Уведомления по задачам: формат ленты (REST и WebSocket одинаковые) и настроек.

export type NotificationScope = 'employee' | 'client';

export type NotificationType =
  | 'task.assigned'
  | 'task.created'
  | 'task.client_created'
  | 'task.status_changed'
  | 'task.updated'
  | 'task.attachment_added'
  | 'task.comment_added'
  | 'task.mentioned'
  | 'task.client_message_added'
  | 'task.client_reply_added'
  | 'task.client_approved'
  | 'time.added'
  | 'time.deleted'
  | 'time.moved'
  | (string & {});

export type NotificationStatusRef = {
  id: string;
  name: string;
  color: string | null;
};

export type NotificationFieldChange = {
  old?: string | null;
  new?: string | null;
};

export type NotificationData = {
  from?: NotificationStatusRef | null;
  to?: NotificationStatusRef | null;
  // Изменённые поля одного сохранения: title, description, deadline, priority.
  fields?: string[];
  changes?: Record<string, NotificationFieldChange | unknown[]>;
  excerpt?: string | null;
  attachments_count?: number;
  file_name?: string;
  // Сколько изменений сведено в одно уведомление.
  count?: number;
  // public_link — действие клиента по публичной ссылке, без входа.
  actor_kind?: string;
  // Учёт времени: чьё время, интервал (Unix, секунды), откуда перенесли, комментарий к ручному времени.
  owner?: { id: string; name: string } | null;
  started_at?: number;
  ended_at?: number;
  duration_seconds?: number;
  from_task?: { id: string; title: string } | null;
  note?: string | null;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  task: { id: string; title: string; project_id: string } | null;
  project: { id: string; name: string } | null;
  actor: { id: string | null; name: string } | null;
  data: NotificationData;
  reasons: { key: string; label: string }[];
  read_at: string | null;
  created_at: string;
};

export type NotificationPage = {
  data: AppNotification[];
  next_cursor: string | null;
  unread_count: number;
};

export type NotificationGroup = {
  key: string;
  label: string;
  // task — события задач (связи с задачей), time — учёт времени (роли).
  scope?: 'task' | 'time';
};

export type NotificationEventSetting = {
  key: string;
  label: string;
  hint: string | null;
  group: string;
  enabled: boolean;
  // false — компания выключила событие для всех связей пользователя, личный выключатель ни на что не влияет.
  available: boolean;
};

export type PersonalNotificationSettings = {
  // null у клиента: автоподписки на задачи у него нет.
  auto_watch: boolean | null;
  groups: NotificationGroup[];
  events: NotificationEventSetting[];
};

export type NotificationRelationCell = {
  allowed: boolean;
  enabled: boolean;
  default: boolean;
};

export type CompanyNotificationEvent = {
  key: string;
  label: string;
  hint: string;
  group: string;
  relations: Record<string, NotificationRelationCell>;
};

export type CompanyNotificationSettings = {
  relations: { key: string; label: string }[];
  groups: NotificationGroup[];
  events: CompanyNotificationEvent[];
};

export type TaskSubscriptionMode = 'watch' | 'mute';

export type TaskSubscriptionState = {
  mode: TaskSubscriptionMode | null;
  source: 'manual' | 'auto' | null;
  relations: { key: string; label: string }[];
  // Придёт ли наблюдателю переписка с клиентом (нужно право её видеть).
  includes_client_messages: boolean;
  watchers: { id: string; name: string }[];
};
