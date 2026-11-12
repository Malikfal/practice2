import type {
  PayrollPayoutEmployee,
  PayrollPayoutKind,
  PayrollPayoutStatus,
} from '../../../../../../types/payrollPayouts';
import { formatMoney } from '../../../employees/EmployeeDetailsPanel/components/payroll/payrollUtils';

export { formatMoney };

const MONTH_NAMES = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export const KIND_LABELS: Record<PayrollPayoutKind, string> = {
  ADVANCE: 'Аванс',
  SETTLEMENT: 'Расчёт',
};

export const STATUS_LABELS: Record<PayrollPayoutStatus, string> = {
  zero: 'Нет суммы',
  none: 'Не выплачено',
  part: 'Частично',
  full: 'Выплачено',
  over: 'Переплата',
};

export const STATUS_PILL_CLASSES: Record<PayrollPayoutStatus, string> = {
  zero: 'border-transparent bg-slate-100 text-slate-500',
  none: 'border-transparent bg-slate-100 text-slate-600',
  part: 'border-amber-300 bg-white text-amber-700',
  full: 'border-emerald-300 bg-white text-emerald-700',
  over: 'border-blue-300 bg-white text-blue-700',
};

export const STATUS_CELL_CLASSES: Record<PayrollPayoutStatus, string> = {
  zero: '',
  none: '',
  part: 'bg-amber-50',
  full: 'bg-emerald-50',
  over: 'bg-blue-50',
};

// Месяц приходит строкой ГГГГ-ММ.
export function monthName(month: string) {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

export function monthTitle(month: string) {
  const name = monthName(month);

  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}

export function shiftMonth(month: string, delta: number) {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;

  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  for (let month = from; month <= to; month = shiftMonth(month, 1)) months.push(month);

  return months;
}

export function lastDayOfMonth(month: string) {
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
}

export function monthStartLabel(month: string) {
  return `01.${month.slice(5, 7)}.${month.slice(0, 4)}`;
}

export function formatDate(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

export function formatDayMonth(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

export function formatSigned(value: number) {
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

export function employeeLabel(employee: PayrollPayoutEmployee) {
  return (
    `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() ||
    employee.name ||
    'Сотрудник'
  );
}

// Возвращает сумму в копейках или null, если ввод не похож на деньги.
export function parseMoneyInput(value: string, allowNegative = false) {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Math.round(Number(normalized) * 100);

  return amount < 0 && !allowNegative ? null : amount;
}

export function moneyInputValue(amount: number) {
  return (amount / 100).toFixed(2).replace('.', ',');
}
