// Вид задач "По срокам": колонки по старту выполнения и дедлайну.

export type TaskDueBucketKey =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'later'
  | 'none';

type DatedTask = {
  start_at?: string | null;
  deadline?: string | null;
};

export const TASK_DUE_BUCKETS: ReadonlyArray<{
  key: TaskDueBucketKey;
  name: string;
  color: string;
}> = [
  { key: 'overdue', name: 'Просрочено', color: '#ef2d2d' },
  { key: 'today', name: 'Сегодня', color: '#0ea04a' },
  { key: 'tomorrow', name: 'Завтра', color: '#2d6ff7' },
  { key: 'week', name: 'На неделе', color: '#7c5cff' },
  { key: 'later', name: 'Далее', color: '#f29a3f' },
  { key: 'none', name: 'Не установлено', color: '#7e8fb4' },
];

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Правила Алексея Суворова (15.10.2026):
 * - нет ни старта, ни дедлайна: "Не установлено";
 * - дедлайн прошёл: "Просрочено";
 * - старт в прошлом: "Сегодня", если дедлайн ещё не наступил, и "Просрочено", если дедлайна нет;
 * - иначе колонка по старту, а без старта по дедлайну.
 * "На неделе" — до конца текущей недели (воскресенье включительно).
 */
export function getTaskDueBucket(
  task: DatedTask,
  now: Date = new Date(),
): TaskDueBucketKey {
  const startAt = parseDate(task.start_at);
  const deadline = parseDate(task.deadline);
  if (!startAt && !deadline) return 'none';
  if (deadline && deadline < now) return 'overdue';

  const today = startOfDay(now);
  if (startAt && startAt < today) return deadline ? 'today' : 'overdue';

  const day = startOfDay((startAt ?? deadline) as Date);
  if (day <= today) return 'today';

  const tomorrow = addDays(today, 1);
  if (day.getTime() === tomorrow.getTime()) return 'tomorrow';

  // getDay(): 0 — воскресенье.
  const daysToSunday = (7 - today.getDay()) % 7;
  if (day <= addDays(today, daysToSunday)) return 'week';

  return 'later';
}

function dueSortTime(task: DatedTask): number {
  const date = parseDate(task.start_at) ?? parseDate(task.deadline);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Раскладывает задачи по колонкам "По срокам". Выполненные задачи в этот вид не попадают.
 */
export function groupTasksByDue<T extends DatedTask>(
  tasks: T[],
  isDone: (_task: T) => boolean,
  now: Date = new Date(),
): Array<{ key: TaskDueBucketKey; name: string; color: string; tasks: T[] }> {
  const byKey = new Map(
    TASK_DUE_BUCKETS.map((bucket) => [bucket.key, { ...bucket, tasks: [] as T[] }]),
  );

  for (const task of tasks) {
    if (isDone(task)) continue;
    byKey.get(getTaskDueBucket(task, now))?.tasks.push(task);
  }

  return Array.from(byKey.values()).map((bucket) => ({
    ...bucket,
    tasks: [...bucket.tasks].sort(
      (left, right) => dueSortTime(left) - dueSortTime(right),
    ),
  }));
}

function formatDueDate(date: Date, now: Date): string {
  const day = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
  const withYear =
    date.getFullYear() === now.getFullYear() ? day : `${day}.${date.getFullYear()}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return time === '00:00' ? withYear : `${withYear} ${time}`;
}

/**
 * Подпись сроков для карточки: "Старт 17.10 · Дедлайн 18.10 12:00".
 */
export function formatTaskDueDates(
  task: DatedTask,
  now: Date = new Date(),
): string | null {
  const startAt = parseDate(task.start_at);
  const deadline = parseDate(task.deadline);
  const parts = [
    startAt ? `Старт ${formatDueDate(startAt, now)}` : null,
    deadline ? `Дедлайн ${formatDueDate(deadline, now)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
