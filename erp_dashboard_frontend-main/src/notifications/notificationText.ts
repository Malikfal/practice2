import type {
  AppNotification,
  NotificationFieldChange,
  NotificationScope,
} from '../types/notifications';

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
};

const FIELD_NAMES: Record<string, string> = {
  title: 'название',
  description: 'описание',
  deadline: 'дедлайн',
  priority: 'приоритет',
};

// Одно поле — «Изменён дедлайн», несколько — «Изменены описание и дедлайн».
const SINGLE_FIELD_ACTIONS: Record<string, string> = {
  title: 'Изменено название',
  description: 'Изменено описание',
  deadline: 'Изменён дедлайн',
  priority: 'Изменён приоритет',
};

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

export type NotificationText = {
  // Что произошло. Без глаголов в прошедшем времени: пол автора неизвестен.
  action: string;
  // Подробности: текст комментария, файл, новые значения полей.
  detail: string | null;
};

function joinRussian(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
}

/**
 * Причины одной фразой: «Вы автор задачи и следите за задачей», «Вы исполнитель и участник проекта».
 */
export function joinReasons(labels: string[]): string {
  const [first, ...rest] = labels;
  if (!first) return '';
  return joinRussian([first, ...rest.map((label) => label.replace(/^Вы\s+/, ''))]);
}

function updatedAction(fields: string[]): string {
  if (fields.length === 0) return 'Задача изменена';
  if (fields.length === 1) return SINGLE_FIELD_ACTIONS[fields[0]] ?? 'Задача изменена';
  return `Изменены ${joinRussian(fields.map((field) => FIELD_NAMES[field] ?? field))}`;
}

function fieldChange(
  changes: AppNotification['data']['changes'],
  field: string,
): NotificationFieldChange | null {
  const change = changes?.[field];
  return change && !Array.isArray(change) ? change : null;
}

function formatDeadline(value: string | null | undefined): string {
  if (!value) return 'нет';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const withYear =
    date.getFullYear() === new Date().getFullYear()
      ? day
      : `${day} ${date.getFullYear()}`;

  return time === '00:00' ? withYear : `${withYear}, ${time}`;
}

function priorityLabel(value: string | null | undefined): string {
  if (!value) return 'нет';
  return PRIORITY_LABELS[value] ?? value;
}

function fieldDetails(notification: AppNotification): string | null {
  const { changes } = notification.data;
  const parts: string[] = [];

  const deadline = fieldChange(changes, 'deadline');
  if (deadline) {
    parts.push(
      deadline.new
        ? `Дедлайн: ${deadline.old ? `${formatDeadline(deadline.old)} → ` : ''}${formatDeadline(deadline.new)}`
        : 'Дедлайн снят',
    );
  }

  const priority = fieldChange(changes, 'priority');
  if (priority) {
    parts.push(
      `Приоритет: ${priorityLabel(priority.old)} → ${priorityLabel(priority.new)}`,
    );
  }

  const title = fieldChange(changes, 'title');
  if (title?.new) {
    parts.push(`Новое название: «${title.new}»`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDuration(seconds: number | undefined): string {
  const minutes = Math.round((seconds ?? 0) / 60);
  if (minutes < 1) return 'меньше минуты';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

function formatDay(date: Date): string {
  const day = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear()
    ? day
    : `${day} ${date.getFullYear()}`;
}

function formatInterval(startedAt?: number, endedAt?: number): string | null {
  if (!startedAt || !endedAt) return null;
  const from = new Date(startedAt * 1000);
  const to = new Date(endedAt * 1000);
  const fromTime = `${pad(from.getHours())}:${pad(from.getMinutes())}`;
  const toTime = `${pad(to.getHours())}:${pad(to.getMinutes())}`;

  return from.toDateString() === to.toDateString()
    ? `${formatDay(from)}, ${fromTime}–${toTime}`
    : `${formatDay(from)}, ${fromTime} – ${formatDay(to)}, ${toTime}`;
}

function timeDetail(notification: AppNotification): string | null {
  const { data } = notification;
  const parts: string[] = [];

  // Чьё время показываем, если менял его другой сотрудник.
  if (data.owner && data.owner.id !== notification.actor?.id) {
    parts.push(`Сотрудник: ${data.owner.name}`);
  }
  const interval = formatInterval(data.started_at, data.ended_at);
  if (interval) parts.push(interval);
  if (data.from_task) parts.push(`из «${data.from_task.title}»`);
  if (data.note) parts.push(`«${data.note}»`);

  return parts.length > 0 ? parts.join(' · ') : null;
}

// Сведённые подряд комментарии, сообщения и файлы одного автора: в строке последний.
const COLLAPSED_ACTIONS: Record<string, string> = {
  'task.comment_added': 'Новые комментарии',
  'task.client_message_added': 'Сообщения клиента',
  'task.attachment_added': 'Новые вложения',
};

const COLLAPSED_HINTS: Record<string, string> = {
  'task.comment_added': 'Несколько комментариев подряд, показан последний',
  'task.client_message_added': 'Несколько сообщений подряд, показано последнее',
  'task.client_reply_added': 'Несколько сообщений подряд, показано последнее',
  'task.attachment_added': 'Несколько файлов подряд, показан последний',
};

/**
 * Подсказка к «×N»: что сведено в одно уведомление.
 */
export function collapsedHint(notification: AppNotification): string {
  return (
    COLLAPSED_HINTS[notification.type] ?? 'Несколько изменений сведены в одно уведомление'
  );
}

function quoteDetail(notification: AppNotification): string | null {
  const { excerpt, attachments_count: attachments = 0 } = notification.data;
  if (excerpt) return excerpt;
  return attachments > 0 ? `Файлов: ${attachments}` : null;
}

export function describeNotification(
  notification: AppNotification,
  scope: NotificationScope,
): NotificationText {
  const { data } = notification;
  const isCollapsed = (data.count ?? 1) > 1;

  switch (notification.type) {
    case 'task.assigned':
      return { action: 'Вас назначили исполнителем', detail: null };
    case 'task.created':
      return { action: 'Новая задача', detail: null };
    case 'task.client_created':
      return { action: 'Клиент создал задачу', detail: null };
    case 'task.status_changed': {
      const to = data.to?.name ?? '—';
      return {
        action: data.from?.name ? `Статус: ${data.from.name} → ${to}` : `Статус: ${to}`,
        detail: null,
      };
    }
    case 'task.updated':
      return {
        action: updatedAction(data.fields ?? []),
        detail: fieldDetails(notification),
      };
    case 'task.attachment_added':
      return {
        action: isCollapsed ? COLLAPSED_ACTIONS[notification.type] : 'Новое вложение',
        detail: data.file_name ?? null,
      };
    case 'task.comment_added':
      return {
        action: isCollapsed ? COLLAPSED_ACTIONS[notification.type] : 'Новый комментарий',
        detail: quoteDetail(notification),
      };
    case 'task.mentioned':
      return {
        action: 'Вас упомянули в комментарии',
        detail: quoteDetail(notification),
      };
    case 'task.client_message_added':
      return {
        action: isCollapsed ? COLLAPSED_ACTIONS[notification.type] : 'Сообщение клиента',
        detail: quoteDetail(notification),
      };
    case 'task.client_reply_added':
      if (scope === 'client') {
        return {
          action: isCollapsed ? 'Новые ответы по задаче' : 'Новый ответ по задаче',
          detail: quoteDetail(notification),
        };
      }
      return {
        action: isCollapsed ? 'Ответы клиенту' : 'Ответ клиенту',
        detail: quoteDetail(notification),
      };
    case 'task.client_approved':
      return { action: 'Клиент согласовал задачу', detail: null };
    case 'time.added':
      return {
        action: `Добавлено время вручную: ${formatDuration(data.duration_seconds)}`,
        detail: timeDetail(notification),
      };
    case 'time.deleted':
      return {
        action: `Удалено время: ${formatDuration(data.duration_seconds)}`,
        detail: timeDetail(notification),
      };
    case 'time.moved':
      return {
        action: `Перенесено время: ${formatDuration(data.duration_seconds)}`,
        detail: timeDetail(notification),
      };
    default:
      return { action: 'Изменения в задаче', detail: null };
  }
}

export function notificationActorName(notification: AppNotification): string {
  if (notification.actor?.name) return notification.actor.name;
  if (notification.data.actor_kind === 'public_link') return 'Клиент по ссылке';
  return 'Система';
}

/**
 * Время для ленты: «только что», «5 мин назад», «14:05», «вчера, 14:05», «12 окт, 14:05».
 */
export function formatNotificationTime(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (date.getTime() >= startOfToday) return time;
  if (date.getTime() >= startOfToday - dayMs) return `вчера, ${time}`;

  const day = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear()
    ? `${day}, ${time}`
    : `${day} ${date.getFullYear()}`;
}

/**
 * Куда ведёт уведомление: сотрудника — на страницу задачи, клиента — в задачу кабинета,
 * изменения времени — в «День сотрудника» на дату интервала.
 */
export function notificationTaskPath(
  notification: AppNotification,
  scope: NotificationScope,
): string | null {
  const { owner, started_at: startedAt } = notification.data;
  if (notification.type.startsWith('time.') && owner && startedAt) {
    // День считается по местному времени, как на вкладке «День сотрудника».
    const day = new Date(startedAt * 1000);
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    return `/employees?user_id=${encodeURIComponent(owner.id)}&tab=day&date=${date}`;
  }

  const task = notification.task;
  if (!task) return null;

  return scope === 'client'
    ? `/projects?project_id=${encodeURIComponent(task.project_id)}&task_id=${encodeURIComponent(task.id)}`
    : `/tasks/direct/${encodeURIComponent(task.id)}`;
}
