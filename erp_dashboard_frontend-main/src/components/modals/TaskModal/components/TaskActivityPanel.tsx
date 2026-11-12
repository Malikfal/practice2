import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { TaskActivity } from '../../../../types/app';
import { formatSecondsToHoursMinutes } from '../shared';
import { mentionsToPlainText } from '../../../../utils/commentMentions';

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
};

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const EMPTY = '—';
const COMMENT_LIMIT = 80;
const ATTACHMENT_NAME_LIMIT = 80;

type TimelineItem = {
  key: string;
  author: string;
  predicate: string;
  createdAt?: string;
};

type TimelineGroup = {
  dayKey: string;
  dayLabel: string;
  items: TimelineItem[];
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function quote(value: string): string {
  return value === EMPTY ? value : `«${value}»`;
}

function priorityLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  return PRIORITY_LABELS[String(value)] ?? String(value);
}

function estimationLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(seconds) ? String(value) : formatSecondsToHoursMinutes(seconds);
}

function deadlineLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const day = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return time === '00:00' ? day : `${day}, ${time}`;
}

function textLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  return String(value);
}

function toNameList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function buildItems(activity: TaskActivity): TimelineItem[] {
  let author = activity.user?.name?.trim() || 'Система';
  const attrs = (activity.changes?.attributes ?? {}) as Record<string, unknown>;
  const old = (activity.changes?.old ?? {}) as Record<string, unknown>;
  const predicates: string[] = [];

  switch (activity.event) {
    case 'created':
      predicates.push('создал(-а) задачу');
      break;

    case 'comment_added': {
      const text = stripHtml(mentionsToPlainText(String(attrs.comment ?? ''))).trim();
      const count = Number(attrs.attachments_count ?? 0);
      if (text) {
        predicates.push(
          `добавил(-а) комментарий ${quote(truncate(text, COMMENT_LIMIT))}`,
        );
      } else if (count > 0) {
        predicates.push(`прикрепил(-а) файлов: ${count}`);
      } else {
        predicates.push('добавил(-а) комментарий');
      }
      break;
    }

    case 'status_updated':
      predicates.push(
        `изменил(-а) статус с ${quote(textLabel(old.task_status_column_name))} ` +
          `на ${quote(textLabel(attrs.task_status_column_name))}`,
      );
      break;
    case 'attachment_upload':
      predicates.push(
        `добавил(-а) новое вложение ${quote(truncate(textLabel(attrs.original_name), ATTACHMENT_NAME_LIMIT))}`,
      );
      break;
    case 'attachment_delete':
      predicates.push(
        `удалил(-а) вложение ${quote(truncate(textLabel(attrs.original_name), ATTACHMENT_NAME_LIMIT))}`,
      );
      break;

    case 'public_link_created':
      predicates.push('создал(-а) публичную ссылку для клиента');
      break;

    case 'public_link_deleted':
      predicates.push('отключил(-а) публичную ссылку для клиента');
      break;

    case 'client_status_updated': {
      const getStatusLabel = (status: unknown) => {
        if (status === 'approved') return 'Согласовано';
        if (status === 'pending') return 'Ожидает согласования';
        return textLabel(status);
      };

      if (!activity.user?.name) {
        author = 'Клиент';
      }

      const newLabel = getStatusLabel(attrs.client_approval_status);

      predicates.push(`установил(-а) статус согласования клиентом «${newLabel}»`);

      break;
    }

    case 'client_message_added': {
      const isClient = !activity.user?.name;
      if (isClient) {
        author = 'Клиент';
      }
      const text = stripHtml(String(attrs.comment ?? '')).trim();
      const count = Number(attrs.attachments_count ?? 0);

      if (text) {
        predicates.push(
          `${isClient ? 'оставил' : 'ответил(-а) клиенту'} сообщение: ${quote(truncate(text, COMMENT_LIMIT))}`,
        );
      } else if (count > 0) {
        predicates.push(`прикрепил(-а) файлов: ${count}`);
      } else {
        predicates.push(isClient ? 'оставил сообщение' : 'ответил(-а) клиенту');
      }
      break;
    }

    default: {
      if ('title' in attrs) {
        predicates.push(
          `изменил(-а) название задачи с ${quote(textLabel(old.title))} ` +
            `на ${quote(textLabel(attrs.title))}`,
        );
      }
      if ('description' in attrs) {
        predicates.push('изменил(-а) описание задачи');
      }
      if ('priority' in attrs) {
        predicates.push(
          `изменил(-а) приоритет с ${quote(priorityLabel(old.priority))} ` +
            `на ${quote(priorityLabel(attrs.priority))}`,
        );
      }
      if ('deadline' in attrs) {
        predicates.push(
          attrs.deadline
            ? `изменил(-а) дедлайн с ${quote(deadlineLabel(old.deadline))} ` +
                `на ${quote(deadlineLabel(attrs.deadline))}`
            : 'снял(-а) дедлайн',
        );
      }
      if ('start_at' in attrs) {
        predicates.push(
          attrs.start_at
            ? `изменил(-а) старт выполнения с ${quote(deadlineLabel(old.start_at))} ` +
                `на ${quote(deadlineLabel(attrs.start_at))}`
            : 'снял(-а) старт выполнения',
        );
      }
      if ('estimation' in attrs) {
        predicates.push(
          `изменил(-а) оценку с ${quote(estimationLabel(old.estimation))} ` +
            `на ${quote(estimationLabel(attrs.estimation))}`,
        );
      }
      if ('task_status_column_name' in attrs) {
        predicates.push(
          `изменил(-а) статус с ${quote(textLabel(old.task_status_column_name))} ` +
            `на ${quote(textLabel(attrs.task_status_column_name))}`,
        );
      }
      if ('assignees' in attrs) {
        const next = toNameList(attrs.assignees);
        const prev = toNameList(old.assignees);
        for (const name of next.filter((item) => !prev.includes(item))) {
          predicates.push(`добавил(-а) исполнителя ${name}`);
        }
        for (const name of prev.filter((item) => !next.includes(item))) {
          predicates.push(`убрал(-а) исполнителя ${name}`);
        }
      }
      break;
    }
  }

  if (predicates.length === 0 && activity.description) {
    predicates.push(String(activity.description).toLowerCase());
  }

  return predicates.map((predicate, index) => ({
    key: `${activity.id}-${index}`,
    author,
    predicate,
    createdAt: activity.created_at,
  }));
}

function dayKey(value?: string): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value?: string): string {
  if (!value) return 'Без даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Без даты';
  const base = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear()
    ? base
    : `${base} ${date.getFullYear()}`;
}

function timeLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function TaskActivityPanel({
  taskId,
  canViewClientTab = false,
  canViewClientComments = false,
  canUpdateClientStatus = false,
  canManageClientLink = false,
}: {
  taskId: string;
  canViewClientTab?: boolean;
  canViewClientComments?: boolean;
  canUpdateClientStatus?: boolean;
  canManageClientLink?: boolean;
}) {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setActivities([]);
      return;
    }
    try {
      setIsLoading(true);
      const list = await api.workspace.taskActivity.getForTask(taskId);
      setActivities(list);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить историю изменений.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo<TimelineGroup[]>(() => {
    const result: TimelineGroup[] = [];
    const filteredActivities = activities.filter((activity) => {
      if (
        activity.event === 'public_link_created' ||
        activity.event === 'public_link_deleted'
      ) {
        return canManageClientLink;
      }
      if (activity.event === 'client_message_added') {
        return canViewClientTab && canViewClientComments;
      }
      if (activity.event === 'client_status_updated') {
        return canViewClientTab && canUpdateClientStatus;
      }
      return true;
    });

    filteredActivities.forEach((activity) => {
      const key = dayKey(activity.created_at);
      let group = result[result.length - 1];
      if (!group || group.dayKey !== key) {
        group = {
          dayKey: key,
          dayLabel: dayLabel(activity.created_at),
          items: [],
        };
        result.push(group);
      }
      group.items.push(...buildItems(activity));
    });
    return result;
  }, [
    activities,
    canManageClientLink,
    canViewClientTab,
    canViewClientComments,
    canUpdateClientStatus,
  ]);

  if (!taskId) {
    return (
      <div className='flex min-h-60 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500'>
        Сначала сохраните задачу, чтобы увидеть историю изменений.
      </div>
    );
  }

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white'>
      <div className='min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3'>
        {isLoading ? (
          <div className='py-6 text-center text-[12px] text-slate-500'>
            Загрузка истории…
          </div>
        ) : groups.length === 0 ? (
          <div className='py-6 text-center text-[12px] text-slate-500'>
            Пока нет изменений.
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            {groups.map((group) => (
              <div key={group.dayKey} className='flex flex-col gap-2 min-w-0'>
                <div className='sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-0.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase'>
                  {group.dayLabel}
                </div>
                <ul className='flex flex-col gap-2 min-w-0'>
                  {group.items.map((item) => (
                    <li key={item.key} className='flex items-start gap-2 min-w-0'>
                      <span className='mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-400' />
                      <div className='min-w-0 flex-1'>
                        <p className='text-[12px] leading-snug break-all text-slate-700'>
                          <span className='font-semibold text-slate-900'>
                            {item.author}
                          </span>{' '}
                          {item.predicate}
                        </p>
                        <span className='text-[11px] text-slate-400'>
                          {timeLabel(item.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
