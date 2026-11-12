import type {
  FinanceAnalyticsExpenseBreakdown,
  FinanceAnalyticsFilters,
  FinanceAnalyticsGranularity,
  FinanceAnalyticsPerson,
} from '../../../../types/financeAnalytics';

const analyticsGranularities: FinanceAnalyticsGranularity[] = [
  'day',
  'week',
  'month',
  'quarter',
];

const analyticsArrayFilterKeys = ['project_ids', 'client_ids', 'manager_ids'] as const;

export function formatAnalyticsMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0) / 100);
}

function formatPeriodDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export function formatAnalyticsPeriod(from: string, to: string): string {
  if (!from && !to) return 'За всё время';
  if (!from) return `До ${formatPeriodDate(to)}`;
  if (!to) return `С ${formatPeriodDate(from)}`;
  if (from === to) return formatPeriodDate(from);
  return `${formatPeriodDate(from)} - ${formatPeriodDate(to)}`;
}

export function getProfitTone(value: number | null | undefined): {
  color: string;
  label: 'Прибыль' | 'Убыток';
} {
  return Number(value ?? 0) < 0
    ? { color: '#e83f4b', label: 'Убыток' }
    : { color: '#20b85a', label: 'Прибыль' };
}

export function formatAnalyticsNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
    Number(value ?? 0) / 100,
  );
}

export function formatAnalyticsPerson(person: FinanceAnalyticsPerson): string {
  if (!person) return 'Без имени';

  return (
    person.name?.trim() ||
    [person.last_name, person.first_name].filter(Boolean).join(' ').trim() ||
    person.email ||
    'Без имени'
  );
}

export function getBreakdownAmount(item: FinanceAnalyticsExpenseBreakdown): number {
  return Number(item.expenses ?? item.amount ?? item.article?.amount ?? 0);
}

export function getBreakdownName(item: FinanceAnalyticsExpenseBreakdown): string {
  if (item.employee) return formatAnalyticsPerson(item.employee);
  return item.name ?? item.article?.name ?? 'Без статьи';
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createCurrentWeekFilters(): FinanceAnalyticsFilters {
  const today = new Date();
  const from = new Date(today);
  const day = from.getDay();
  from.setDate(from.getDate() + (day === 0 ? -6 : 1 - day));

  const to = new Date(from);
  to.setDate(to.getDate() + 6);

  return {
    from: formatDate(from),
    to: formatDate(to),
    granularity: 'day',
    project_ids: [],
    client_ids: [],
    manager_ids: [],
  };
}

export function createCurrentMonthFilters(): FinanceAnalyticsFilters {
  const today = new Date();
  return {
    from: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    granularity: 'day',
    project_ids: [],
    client_ids: [],
    manager_ids: [],
  };
}

function isInputDate(value: string | null): value is string {
  if (!value) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

function isAnalyticsGranularity(
  value: string | null,
): value is FinanceAnalyticsGranularity {
  return Boolean(
    value && analyticsGranularities.includes(value as FinanceAnalyticsGranularity),
  );
}

function getDateParam(
  searchParams: URLSearchParams,
  key: 'from' | 'to',
  fallback: string,
): string {
  if (!searchParams.has(key)) return fallback;
  const value = searchParams.get(key) ?? '';
  return value === '' || isInputDate(value) ? value : fallback;
}

function getArrayParam(searchParams: URLSearchParams, key: string): string[] {
  return [...searchParams.getAll(key), ...searchParams.getAll(`${key}[]`)]
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

export function parseAnalyticsFiltersFromSearch(
  searchParams: URLSearchParams,
): FinanceAnalyticsFilters {
  const fallback = createCurrentMonthFilters();
  const granularity = searchParams.get('granularity');

  return {
    ...fallback,
    from: getDateParam(searchParams, 'from', fallback.from),
    to: getDateParam(searchParams, 'to', fallback.to),
    granularity: isAnalyticsGranularity(granularity) ? granularity : fallback.granularity,
    project_ids: getArrayParam(searchParams, 'project_ids'),
    client_ids: getArrayParam(searchParams, 'client_ids'),
    manager_ids: getArrayParam(searchParams, 'manager_ids'),
  };
}

export function writeAnalyticsFiltersToSearch(
  searchParams: URLSearchParams,
  filters: FinanceAnalyticsFilters,
): URLSearchParams {
  const nextParams = new URLSearchParams(searchParams);

  nextParams.set('from', filters.from);
  nextParams.set('to', filters.to);
  nextParams.set('granularity', filters.granularity);

  analyticsArrayFilterKeys.forEach((key) => {
    nextParams.delete(key);
    nextParams.delete(`${key}[]`);
    filters[key].forEach((value) => nextParams.append(key, value));
  });

  return nextParams;
}

export function formatAnalyticsHours(seconds: number | null | undefined): string {
  const totalMinutes = Math.round(Number(seconds ?? 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
