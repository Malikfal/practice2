import type {
  ManagerReportFilters,
  ManagerReportGranularity,
  ManagerReportMetrics,
  ManagerReportShares,
} from '../../../../../types/managerReport';

export type ManagerReportMetricRow = ManagerReportMetrics & ManagerReportShares;
export type ManagerReportSortKey =
  | 'name'
  | 'projects_count'
  | 'developer_seconds'
  | 'supervised_seconds'
  | 'manager_cost'
  | 'supervised_hour_cost'
  | 'total_hour_cost'
  | 'developer_hour_cost'
  | 'hours_share'
  | 'money_share';
export type ManagerReportSort = {
  key: ManagerReportSortKey;
  direction: 'asc' | 'desc';
};

export const defaultManagerReportSort: ManagerReportSort = {
  key: 'supervised_seconds',
  direction: 'desc',
};

/** Одна сортировка для таблицы и карточек. Пустые значения всегда в конце. */
export function sortManagerReportRows<T extends ManagerReportMetricRow>(
  rows: T[],
  sort: ManagerReportSort,
  getName: (_row: T) => string,
): T[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (sort.key === 'name') {
      return getName(left).localeCompare(getName(right), 'ru') * direction;
    }
    const a = left[sort.key];
    const b = right[sort.key];
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    return (a - b) * direction;
  });
}

export const managerReportGranularityOptions: Array<{
  value: ManagerReportGranularity;
  label: string;
}> = [
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
  { value: 'quarter', label: 'Кварталы' },
  { value: 'year', label: 'Годы' },
];

export function formatInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** По умолчанию, как во всех финансах, показывается текущий месяц. */
export function createManagerReportFilters(): ManagerReportFilters {
  const today = new Date();
  return {
    from: formatInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    granularity: 'week',
    manager_ids: [],
  };
}

export function formatReportHours(seconds: number | null | undefined): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(
    Number(seconds ?? 0) / 3600,
  )} ч`;
}

/** Суммы приходят в копейках. */
export function formatReportMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatReportShare(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)}%`;
}

export function formatReportDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}
