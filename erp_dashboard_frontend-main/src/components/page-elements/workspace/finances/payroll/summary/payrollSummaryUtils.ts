import type {
  PayrollSummaryEmployee,
  PayrollSummaryGroup,
  PayrollSummaryGroupBy,
  PayrollSummaryPeriod,
  PayrollSummaryQuery,
} from '../../../../../../types/payrollSummary';
import { monthTitle } from '../payouts/payoutUtils';

export const GROUP_OPTIONS: Array<[PayrollSummaryGroupBy, string]> = [
  ['week', 'Недели'],
  ['month', 'Месяцы'],
  ['quarter', 'Кварталы'],
  ['year', 'Годы'],
];

const QUARTERS = ['I', 'II', 'III', 'IV'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Параметры расчёта в URL общие для вкладок по периодам и по сотрудникам.
export function readSummaryQuery(search: string): PayrollSummaryQuery {
  const params = new URLSearchParams(search);
  const from = params.get('payroll_from') ?? '';
  const to = params.get('payroll_to') ?? '';
  const group = params.get('payroll_group');
  const hasRange = DATE_PATTERN.test(from) && DATE_PATTERN.test(to) && from <= to;

  return {
    from: hasRange ? from : undefined,
    to: hasRange ? to : undefined,
    group_by: GROUP_OPTIONS.some(([value]) => value === group)
      ? (group as PayrollSummaryGroupBy)
      : 'week',
  };
}

export function writeSummaryQuery(search: string, query: PayrollSummaryQuery) {
  const params = new URLSearchParams(search);
  if (query.from && query.to) {
    params.set('payroll_from', query.from);
    params.set('payroll_to', query.to);
  } else {
    params.delete('payroll_from');
    params.delete('payroll_to');
  }
  if (query.group_by && query.group_by !== 'week')
    params.set('payroll_group', query.group_by);
  else params.delete('payroll_group');

  return params;
}

export function formatShortDate(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

export function formatFullDate(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

export function formatRange(from: string, to: string) {
  if (from === to) return formatFullDate(from);
  if (from.slice(0, 4) === to.slice(0, 4))
    return `${formatShortDate(from)}-${formatFullDate(to)}`;

  return `${formatFullDate(from)}-${formatFullDate(to)}`;
}

function parseDate(date: string) {
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function toDateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function shiftDays(date: string, days: number) {
  const result = parseDate(date);
  result.setDate(result.getDate() + days);

  return toDateString(result);
}

// Неделя, разрезанная границей месяца, считается двумя периодами.
export function isSplitWeek(period: { from: string; to: string }) {
  return parseDate(period.from).getDay() !== 1 || parseDate(period.to).getDay() !== 0;
}

export function fullWeekRange(period: { from: string }) {
  const day = parseDate(period.from).getDay();
  const monday = shiftDays(period.from, day === 0 ? -6 : 1 - day);

  return { from: monday, to: shiftDays(monday, 6) };
}

export function groupTitle(
  group: Pick<PayrollSummaryGroup, 'key' | 'from' | 'to'>,
  groupBy: PayrollSummaryGroupBy,
) {
  if (groupBy === 'month') return monthTitle(group.key);
  if (groupBy === 'quarter') {
    return `${QUARTERS[Number(group.key.slice(-1)) - 1] ?? ''} квартал ${group.key.slice(0, 4)}`;
  }
  if (groupBy === 'year') return `${group.key} год`;

  return formatRange(group.from, group.to);
}

export function pluralWeeks(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} неделя`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} недели`;

  return `${count} недель`;
}

export type GroupState = {
  // Текущий период ещё идёт: данные есть только до конца текущей недели.
  isRunning: boolean;
  // В фильтр попала только часть календарного периода.
  isPartial: boolean;
};

export function groupState(group: PayrollSummaryGroup, today: string): GroupState {
  const cutByToday = group.is_current && group.to >= today;

  return {
    isRunning: group.is_current,
    isPartial:
      group.from > group.calendar_from || (group.to < group.calendar_to && !cutByToday),
  };
}

export function employeeName(
  employee: Pick<PayrollSummaryEmployee, 'first_name' | 'last_name' | 'name'>,
) {
  return (
    `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() ||
    employee.name ||
    'Сотрудник'
  );
}

export function periodsOfGroup(periods: PayrollSummaryPeriod[], groupKey: string) {
  return periods.filter((period) => period.group_key === groupKey);
}
