import type {
  EmployeeAbsencePaymentMode,
  EmployeeAbsenceType,
} from '../../../../../../../types/app';

export const ABSENCE_TYPE_LABELS: Record<EmployeeAbsenceType, string> = {
  VACATION: 'Отпуск',
  DAY_OFF: 'Отгул',
  SICK_LEAVE: 'Больничный',
  WEEKEND: 'Выходной',
};

export const ABSENCE_TYPE_OPTIONS = (
  Object.entries(ABSENCE_TYPE_LABELS) as [EmployeeAbsenceType, string][]
).map(([value, label]) => ({ value, label }));

export const PAYMENT_MODE_LABELS: Record<EmployeeAbsencePaymentMode, string> = {
  DEFAULT: 'Без изменений',
  FIXED: 'Фиксированная оплата',
};

export const ABSENCE_TYPE_STYLES: Record<EmployeeAbsenceType, string> = {
  VACATION: 'border-[#b9cdfb] bg-[#e6eeff] text-[#245fd8]',
  DAY_OFF: 'border-[#ffd39a] bg-[#fff0d9] text-[#bc6b00]',
  SICK_LEAVE: 'border-[#bde9c8] bg-[#e5f8e9] text-[#2f884a]',
  WEEKEND: 'border-[#cdd5e3] bg-[#e9edf4] text-[#56657f]',
};

export const WORKED_DAY_BADGE_CLASS = 'bg-[#dff5f1] text-[#0f7f74]';

export const MONTH_OPTIONS = [
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
