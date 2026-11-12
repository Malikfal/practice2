import type { HoursChartGroupBy, HoursChartRow } from '../../../../../types/app';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = [
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
const SHORT_MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];
const DAY_MS = 86_400_000;

export const HOURS_CHART_GROUP_OPTIONS: Array<{
  value: HoursChartGroupBy;
  label: string;
}> = [
  { value: 'day', label: 'По дням' },
  { value: 'week', label: 'По неделям' },
  { value: 'month', label: 'По месяцам' },
];

/** Состояние периода относительно сегодняшнего дня. */
export type HoursChartPoint = HoursChartRow & {
  // Период ещё не начался: точка не рисуется, строки в таблице нет.
  isFuture: boolean;
  // Период обрезан диапазоном или ещё идёт: точка полая, отрезок к ней пунктиром.
  isIncomplete: boolean;
};

function parts(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month, day];
}

function dayNumber(value: string): number {
  const [year, month, day] = parts(value);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function shortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${day}.${month}`;
}

function fullDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function weekday(value: string): string {
  const [year, month, day] = parts(value);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function toHoursChartPoints(
  rows: HoursChartRow[],
  today: string,
): HoursChartPoint[] {
  return rows.map((row) => ({
    ...row,
    isFuture: row.from > today,
    isIncomplete: row.partial || (row.from <= today && row.to >= today),
  }));
}

export function isWeekend(value: string): boolean {
  const name = weekday(value);
  return name === 'сб' || name === 'вс';
}

/** Подпись на оси: день и неделя — первым днём в выбранном периоде, месяц — коротким названием. */
export function axisLabel(row: HoursChartRow, groupBy: HoursChartGroupBy): string {
  if (groupBy !== 'month') return shortDate(row.from);
  const [year, month] = parts(row.key);
  return `${SHORT_MONTHS[month - 1]} ${String(year).slice(2)}`;
}

/** Подпись периода в таблице и подсказке: «05.10.2026, пн», «05.10 – 11.10.2026», «Октябрь 2026». */
export function periodLabel(row: HoursChartRow, groupBy: HoursChartGroupBy): string {
  if (groupBy === 'day') return `${fullDate(row.from)}, ${weekday(row.from)}`;
  if (groupBy === 'week') return `${shortDate(row.from)} – ${fullDate(row.to)}`;
  const [year, month] = parts(row.key);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Пояснение к неполному периоду: «4 дн. из 7», «идёт сейчас». */
export function incompleteNote(
  point: HoursChartPoint,
  groupBy: HoursChartGroupBy,
): string | null {
  if (!point.isIncomplete) return null;
  if (groupBy === 'day') return 'день ещё не закончился';
  if (!point.partial) return 'период ещё идёт';

  const days = dayNumber(point.to) - dayNumber(point.from) + 1;
  const [year, month] = parts(point.key);
  const fullDays =
    groupBy === 'week' ? 7 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${days} дн. из ${fullDays} в выбранном периоде`;
}

/** Часы с десятыми: «12,5». */
export function formatHoursValue(seconds: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(
    seconds / 3600,
  );
}
