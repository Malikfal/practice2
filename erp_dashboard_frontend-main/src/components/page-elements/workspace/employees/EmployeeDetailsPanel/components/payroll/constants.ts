import type {
  EmployeeRateType,
  PayrollHoursScope,
  PayrollProjectHoursType,
  PayrollRangeCalculationMethod,
} from '../../../../../../../types/app';

export const PAYROLL_ROWS_PER_PAGE = 20;

export const RATE_TYPES: Array<{
  value: EmployeeRateType;
  label: string;
  inputLabel: string;
}> = [
  {
    value: 'WEEKLY_SALARY',
    label: 'Оклад (неделя)',
    inputLabel: 'Оклад (неделя), руб.',
  },
  {
    value: 'HOURLY',
    label: 'Ставка за час',
    inputLabel: 'Ставка за собственные часы, руб./час',
  },
  {
    value: 'SUPERVISED_HOURLY',
    label: 'Ставка за часы под контролем',
    inputLabel: 'Ставка за часы под контролем, руб./час',
  },
  {
    value: 'COMPANY_HOURLY',
    label: 'Ставка за часы всей компании',
    inputLabel: 'Ставка за часы всей компании, руб./час',
  },
];

export const HOURS_SCOPE_LABELS: Record<PayrollHoursScope, string> = {
  OWN: 'Свои часы',
  SUPERVISED: 'Часы под контролем',
  COMPANY: 'Часы всей компании',
};

export const PROJECT_HOURS_TYPE_LABELS: Record<PayrollProjectHoursType, string> = {
  ALL: 'Все часы',
  COMMERCIAL: 'Коммерческие',
  INTERNAL: 'Внутренние',
};

export const RANGE_METHOD_LABELS: Record<PayrollRangeCalculationMethod, string> = {
  THRESHOLD: 'Пересчитывать все часы по ставке достигнутого диапазона',
  PROGRESSIVE: 'Часы в каждом диапазоне считаются отдельными ставками',
};

export const DEFAULT_RANGE_METHOD_LABEL = 'Расчет по базовой ставке';
