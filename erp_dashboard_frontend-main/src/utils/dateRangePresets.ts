import { createStaticRanges } from 'react-date-range';
import type { StaticRange } from 'react-date-range';

export type DateRangePreset = { label: string; startDate: Date; endDate: Date };

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

/** Единый набор периодов для всех выборов дат: дни, недели, месяцы, кварталы, годы. */
export function createDateRangePresets(): DateRangePreset[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const yesterday = new Date(year, month, today.getDate() - 1);
  const currentWeekStart = startOfWeek(today);
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(currentWeekEnd);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);
  const quarterStartMonth = Math.floor(month / 3) * 3;

  return [
    { label: 'Сегодня', startDate: today, endDate: today },
    { label: 'Вчера', startDate: yesterday, endDate: yesterday },
    { label: 'Эта неделя', startDate: currentWeekStart, endDate: currentWeekEnd },
    { label: 'Прошлая неделя', startDate: previousWeekStart, endDate: previousWeekEnd },
    {
      label: 'Этот месяц',
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month + 1, 0),
    },
    {
      label: 'Прошлый месяц',
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month, 0),
    },
    {
      label: 'Этот квартал',
      startDate: new Date(year, quarterStartMonth, 1),
      endDate: new Date(year, quarterStartMonth + 3, 0),
    },
    {
      label: 'Прошлый квартал',
      startDate: new Date(year, quarterStartMonth - 3, 1),
      endDate: new Date(year, quarterStartMonth, 0),
    },
    {
      label: 'Этот год',
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
    },
    {
      label: 'Прошлый год',
      startDate: new Date(year - 1, 0, 1),
      endDate: new Date(year - 1, 11, 31),
    },
  ];
}

export function toStaticRanges(presets: DateRangePreset[]): StaticRange[] {
  return createStaticRanges(
    presets.map(({ label, startDate, endDate }) => ({
      label,
      range: () => ({ startDate, endDate }),
    })),
  );
}
