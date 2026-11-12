import type { FinanceSource } from '../../../../types/app';
import type {
  FinancialResultsFilters,
  FinancialResultsGranularity,
  FinancialResultsPerson,
} from '../../../../types/financialResults';

const granularities: FinancialResultsGranularity[] = ['day', 'week', 'month', 'quarter'];
const sources: FinanceSource[] = [
  'PAYROLL_DAILY',
  'PAYROLL_RECALCULATION',
  'MANUAL',
  'IMPORT',
];
const arrayKeys = [
  'project_ids',
  'client_ids',
  'manager_ids',
  'finance_article_ids',
  'sources',
  'employee_ids',
] as const;

export function createDefaultFinancialResultsFilters(): FinancialResultsFilters {
  const today = new Date();
  return {
    from: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    granularity: 'day',
    project_ids: [],
    client_ids: [],
    manager_ids: [],
    finance_article_ids: [],
    sources: [],
    employee_ids: [],
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isInputDate(value: string): boolean {
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

function dateParam(
  params: URLSearchParams,
  key: 'from' | 'to',
  fallback: string,
): string {
  if (!params.has(key)) return fallback;
  const value = params.get(key) ?? '';
  return value === '' || isInputDate(value) ? value : fallback;
}

function arrayParam(params: URLSearchParams, key: string): string[] {
  return [...params.getAll(key), ...params.getAll(`${key}[]`)]
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

export function parseFinancialResultsFilters(
  params: URLSearchParams,
): FinancialResultsFilters {
  const fallback = createDefaultFinancialResultsFilters();
  const granularity = params.get('granularity') as FinancialResultsGranularity | null;
  return {
    ...fallback,
    from: dateParam(params, 'from', fallback.from),
    to: dateParam(params, 'to', fallback.to),
    granularity:
      granularity && granularities.includes(granularity)
        ? granularity
        : fallback.granularity,
    project_ids: arrayParam(params, 'project_ids'),
    client_ids: arrayParam(params, 'client_ids'),
    manager_ids: arrayParam(params, 'manager_ids'),
    finance_article_ids: arrayParam(params, 'finance_article_ids'),
    employee_ids: arrayParam(params, 'employee_ids'),
    sources: arrayParam(params, 'sources').filter((value): value is FinanceSource =>
      sources.includes(value as FinanceSource),
    ),
  };
}

export function writeFinancialResultsFilters(
  params: URLSearchParams,
  filters: FinancialResultsFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('from', filters.from);
  next.set('to', filters.to);
  next.set('granularity', filters.granularity);
  arrayKeys.forEach((key) => {
    next.delete(key);
    next.delete(`${key}[]`);
    filters[key].forEach((value) => next.append(key, value));
  });
  return next;
}

export function areFinancialResultsFiltersEqual(
  left: FinancialResultsFilters,
  right: FinancialResultsFilters,
): boolean {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.granularity === right.granularity &&
    arrayKeys.every((key) => left[key].join('|') === right[key].join('|'))
  );
}

export function formatFinancialResultsPerson(person: FinancialResultsPerson): string {
  return (
    person.name?.trim() ||
    [person.last_name, person.first_name].filter(Boolean).join(' ').trim() ||
    person.email ||
    'Без имени'
  );
}
