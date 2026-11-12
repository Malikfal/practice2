import type {
  Finance,
  FinanceDistributionPeriod,
  FinancePayload,
  FinanceType,
} from '../../../../types/app';
import type { FinanceForm } from './types';

export const FINANCE_TYPE_LABELS: Record<FinanceType, string> = {
  ENTRANCE: 'Поступление',
  EXPENDITURE: 'Расход',
};

export const FINANCE_TYPE_NEW_TITLES: Record<FinanceType, string> = {
  ENTRANCE: 'Новое поступление',
  EXPENDITURE: 'Новый расход',
};

function parseInputDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function inputDateValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export const todayValue = () => inputDateValue(new Date());

export function financeDistributionRange(
  paymentDateValue: string,
  period: FinanceDistributionPeriod,
): { from: string; to: string } {
  const paymentDate = parseInputDate(paymentDateValue);

  if (!paymentDate) return { from: '', to: '' };

  const year = paymentDate.getFullYear();
  const month = paymentDate.getMonth();
  let from = new Date(year, month, paymentDate.getDate());
  let to = new Date(from);

  if (period === 'WEEK' || period === 'TWO_WEEKS') {
    const daysSinceMonday = (paymentDate.getDay() + 6) % 7;
    from.setDate(from.getDate() - daysSinceMonday);
    to = new Date(from);
    to.setDate(to.getDate() + (period === 'WEEK' ? 6 : 13));
  } else if (period === 'MONTH') {
    from = new Date(year, month, 1);
    to = new Date(year, month + 1, 0);
  } else if (period === 'QUARTER') {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    from = new Date(year, quarterStartMonth, 1);
    to = new Date(year, quarterStartMonth + 3, 0);
  } else if (period === 'HALF_YEAR') {
    const halfYearStartMonth = month < 6 ? 0 : 6;
    from = new Date(year, halfYearStartMonth, 1);
    to = new Date(year, halfYearStartMonth + 6, 0);
  } else if (period === 'CURRENT_YEAR') {
    from = new Date(year, 0, 1);
    to = new Date(year, 12, 0);
  } else if (period === 'PREVIOUS_YEAR') {
    from = new Date(year - 1, 0, 1);
    to = new Date(year - 1, 12, 0);
  }

  return { from: inputDateValue(from), to: inputDateValue(to) };
}

export const emptyFinanceForm = (type: FinanceType = 'ENTRANCE'): FinanceForm => {
  const dateOfPayment = todayValue();

  return {
    type,
    amount: '',
    dateOfPayment,
    distribution_from: dateOfPayment,
    distribution_to: dateOfPayment,
    distribution_method: 'BY_TERM',
    distribution_project_mode: 'ALL',
    distribution_project_ids: [],
    finance_article_id: '',
    project_id: '',
    employee_id: '',
    comment: '',
  };
};

function toInputDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// Период по умолчанию во всех разделах финансов: текущий месяц целиком.
export function currentMonthRange(): { from: string; to: string } {
  const today = new Date();

  return {
    from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

export function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function formatFinanceCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0) / 100);
}

export function formatFinanceEmployeeName(employee: Finance['employee']) {
  if (!employee) return '—';
  return `${employee.name ?? ''} ${employee.last_name ?? ''}`.trim() || employee.email;
}

export function parseFinanceAmountInput(value: string): number {
  return Number(
    value
      .trim()
      .replace(/[\s\u00A0\u202F]/g, '')
      .replace(',', '.'),
  );
}

export function financeToForm(finance: Finance): FinanceForm {
  return {
    type: finance.type,
    amount: String((Number(finance.amount ?? 0) / 100).toFixed(2)).replace('.', ','),
    dateOfPayment: finance.dateOfPayment ?? todayValue(),
    distribution_from: finance.distribution_from ?? finance.dateOfPayment ?? todayValue(),
    distribution_to: finance.distribution_to ?? finance.dateOfPayment ?? todayValue(),
    distribution_method: finance.distribution_method ?? 'BY_TERM',
    distribution_project_mode: finance.distribution_project_mode,
    distribution_project_ids: finance.distribution_project_ids ?? [],
    finance_article_id: finance.article?.id ?? '',
    project_id: finance.project?.id ?? '',
    employee_id: finance.employee?.id ?? '',
    comment: finance.comment ?? '',
  };
}

export function financeFormToPayload(form: FinanceForm): FinancePayload {
  const amount = parseFinanceAmountInput(form.amount);

  return {
    type: form.type,
    amount: Math.round(amount * 100),
    dateOfPayment: form.dateOfPayment,
    distribution_from: form.distribution_from,
    distribution_to: form.distribution_to,
    distribution_method: form.distribution_method,
    ...(form.distribution_project_mode
      ? {
          distribution_project_mode: form.distribution_project_mode,
          distribution_project_ids:
            form.distribution_project_mode === 'SELECTED'
              ? form.distribution_project_ids
              : [],
        }
      : {}),
    finance_article_id: form.finance_article_id || null,
    project_id: form.project_id || null,
    employee_id: form.employee_id || null,
    comment: form.comment.trim() || null,
  };
}
