// Вид задач "Гант": полоски от старта выполнения до дедлайна на шкале дней, недель или месяцев.

export type GanttScale = 'day' | 'week' | 'month';

export const GANTT_SCALES: ReadonlyArray<{ key: GanttScale; name: string }> = [
  { key: 'day', name: 'Дни' },
  { key: 'week', name: 'Недели' },
  { key: 'month', name: 'Месяцы' },
];

// Ширина одного дня на шкале, px.
export const GANTT_DAY_WIDTH: Record<GanttScale, number> = {
  day: 36,
  week: 16,
  month: 5,
};

// Шкала не короче этого числа делений, чтобы заполнять экран при паре задач.
const MIN_UNITS: Record<GanttScale, number> = { day: 42, week: 16, month: 12 };

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const MONTH_SHORT_NAMES = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

type DatedTask = {
  start_at?: string | null;
  deadline?: string | null;
};

/**
 * range — есть старт и дедлайн; start / deadline — заполнена одна дата, задача рисуется отметкой.
 */
export type GanttItemKind = 'range' | 'start' | 'deadline';

export type GanttItem<T> = {
  task: T;
  kind: GanttItemKind;
  // Первый и последний день задачи (начало суток), включительно.
  startDay: Date;
  endDay: Date;
};

export type GanttRange = {
  start: Date;
  // Не включительно.
  end: Date;
  days: number;
};

export type GanttCell = {
  key: string;
  label: string;
  // Смещение от начала шкалы и длина в днях.
  offset: number;
  days: number;
  isWeekend?: boolean;
  isCurrent?: boolean;
};

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

/** Число суток между началами дней; Math.round гасит сдвиг на час при переходе на летнее время. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function startOfUnit(date: Date, scale: GanttScale): Date {
  if (scale === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
  if (scale === 'week') {
    // getDay(): 0 — воскресенье, неделя начинается с понедельника.
    return addDays(date, -((date.getDay() + 6) % 7));
  }
  return startOfDay(date);
}

function addUnits(date: Date, scale: GanttScale, count: number): Date {
  if (scale === 'month') return new Date(date.getFullYear(), date.getMonth() + count, 1);
  return addDays(date, scale === 'week' ? count * 7 : count);
}

export function getGanttItem<T extends DatedTask>(task: T): GanttItem<T> | null {
  const startAt = parseDate(task.start_at);
  const deadline = parseDate(task.deadline);
  if (startAt && deadline) {
    const [first, last] = startAt <= deadline ? [startAt, deadline] : [deadline, startAt];
    return { task, kind: 'range', startDay: startOfDay(first), endDay: startOfDay(last) };
  }
  const single = startAt ?? deadline;
  if (!single) return null;
  return {
    task,
    kind: startAt ? 'start' : 'deadline',
    startDay: startOfDay(single),
    endDay: startOfDay(single),
  };
}

/**
 * Шкала охватывает все задачи и сегодняшний день с запасом в одно деление слева и два справа.
 */
export function buildGanttRange(
  items: Array<GanttItem<unknown>>,
  scale: GanttScale,
  now: Date = new Date(),
): GanttRange {
  const today = startOfDay(now);
  let min = today;
  let max = today;
  for (const item of items) {
    if (item.startDay < min) min = item.startDay;
    if (item.endDay > max) max = item.endDay;
  }

  const start = addUnits(startOfUnit(min, scale), scale, -1);
  let end = addUnits(startOfUnit(max, scale), scale, 2);
  const minEnd = addUnits(start, scale, MIN_UNITS[scale]);
  if (end < minEnd) end = minEnd;

  return { start, end, days: daysBetween(start, end) };
}

/** Нижняя строка шапки: дни, недели или месяцы. */
export function buildGanttCells(
  range: GanttRange,
  scale: GanttScale,
  now: Date = new Date(),
): GanttCell[] {
  const cells: GanttCell[] = [];
  for (let unit = range.start; unit < range.end; unit = addUnits(unit, scale, 1)) {
    const next = addUnits(unit, scale, 1);
    const isCurrent = unit <= now && now < next;
    const offset = daysBetween(range.start, unit);
    const days = daysBetween(unit, next);

    if (scale === 'day') {
      const weekday = unit.getDay();
      cells.push({
        key: unit.toISOString(),
        label: String(unit.getDate()),
        offset,
        days,
        isWeekend: weekday === 0 || weekday === 6,
        isCurrent,
      });
    } else if (scale === 'week') {
      const sunday = addDays(unit, 6);
      cells.push({
        key: unit.toISOString(),
        label: `${pad(unit.getDate())}–${pad(sunday.getDate())}`,
        offset,
        days,
        isCurrent,
      });
    } else {
      cells.push({
        key: unit.toISOString(),
        label: MONTH_SHORT_NAMES[unit.getMonth()],
        offset,
        days,
        isCurrent,
      });
    }
  }
  return cells;
}

/** Верхняя строка шапки: месяцы для дней и недель, годы для месяцев. */
export function buildGanttGroups(range: GanttRange, scale: GanttScale): GanttCell[] {
  const groups: GanttCell[] = [];
  let groupStart = range.start;
  while (groupStart < range.end) {
    const nextGroup =
      scale === 'month'
        ? new Date(groupStart.getFullYear() + 1, 0, 1)
        : new Date(groupStart.getFullYear(), groupStart.getMonth() + 1, 1);
    const groupEnd = nextGroup < range.end ? nextGroup : range.end;
    groups.push({
      key: groupStart.toISOString(),
      label:
        scale === 'month'
          ? String(groupStart.getFullYear())
          : `${MONTH_NAMES[groupStart.getMonth()]} ${groupStart.getFullYear()}`,
      offset: daysBetween(range.start, groupStart),
      days: daysBetween(groupStart, groupEnd),
    });
    groupStart = groupEnd;
  }
  return groups;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatShortDay(date: Date, now: Date): string {
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
  return date.getFullYear() === now.getFullYear()
    ? day
    : `${day}.${String(date.getFullYear()).slice(-2)}`;
}

/** Короткая подпись сроков для строки и полоски: "15.10 – 28.10", "старт 23.10", "до 20.10". */
export function formatGanttDates(
  item: GanttItem<unknown>,
  now: Date = new Date(),
): string {
  const start = formatShortDay(item.startDay, now);
  if (item.kind === 'start') return `старт ${start}`;
  if (item.kind === 'deadline') return `до ${start}`;
  const end = formatShortDay(item.endDay, now);
  return start === end ? start : `${start} – ${end}`;
}
