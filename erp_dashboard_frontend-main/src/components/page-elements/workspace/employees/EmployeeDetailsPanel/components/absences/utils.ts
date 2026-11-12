import type {
  EmployeeAbsence,
  EmployeeAbsenceCalendarDay,
  EmployeeAbsenceForm,
  EmployeeAbsenceType,
} from '../../../../../../../types/app';

import type { AbsenceModalState, CalendarGridDay } from './types';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayInputValue() {
  return dateInputValue(new Date());
}

export function parseInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: string, amount: number) {
  const date = parseInputDate(value);
  date.setDate(date.getDate() + amount);
  return dateInputValue(date);
}

export function monthBounds(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  return {
    from: dateInputValue(first),
    to: dateInputValue(last),
  };
}

export function yearBounds(year: number) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

export function formatDate(value?: string | null) {
  if (!value) return 'Не указано';

  const date = parseInputDate(value);
  if (Number.isNaN(date.getTime())) return 'Не указано';

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Не указано';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatPeriod(from: string, to: string) {
  return `${formatDate(from)} - ${formatDate(to)}`;
}

export function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function moneyToInput(value?: number | null) {
  if (value === null || value === undefined) return '';

  return String(value / 100);
}

export function numberFromInput(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function coefficientFromInput(value: string) {
  return numberFromInput(value) ?? 1;
}

export function applyFixedPaymentCoefficient(
  fixedDailyAmount: number | null | undefined,
  coefficient: number | null | undefined,
) {
  if (fixedDailyAmount === null || fixedDailyAmount === undefined) return null;

  return Math.round(fixedDailyAmount * (coefficient ?? 1));
}

export function formatCoefficient(value: number | null | undefined) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 4,
  }).format(value ?? 1);
}

export function inclusiveDays(from: string, to: string) {
  const start = parseInputDate(from).getTime();
  const end = parseInputDate(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;

  return Math.floor((end - start) / 86_400_000) + 1;
}

export function actorName(actor: EmployeeAbsence['created_by']) {
  if (!actor) return 'Не указано';

  const fullName = `${actor.name ?? ''} ${actor.last_name ?? ''}`.trim();
  return fullName || actor.email || 'Не указано';
}

export function absenceFromForm(form: EmployeeAbsenceForm, id = ''): EmployeeAbsence {
  return {
    id,
    company_id: '',
    employee_id: '',
    type: form.type,
    date_from: form.date_from,
    date_to: form.date_to,
    payment_mode: form.payment_mode,
    fixed_daily_amount:
      form.payment_mode === 'FIXED'
        ? Math.round((numberFromInput(form.fixed_daily_amount) ?? 0) * 100)
        : null,
    coefficient: coefficientFromInput(form.coefficient),
    amount_kopecks: null,
    comment: form.comment || null,
    created_by: null,
    updated_by: null,
    created_at: '',
    updated_at: '',
  };
}

export function formFromAbsence(absence: EmployeeAbsence): EmployeeAbsenceForm {
  return {
    type: absence.type,
    date_from: absence.date_from,
    date_to: absence.date_to,
    payment_mode: absence.payment_mode,
    fixed_daily_amount: moneyToInput(absence.fixed_daily_amount),
    coefficient: String(absence.coefficient ?? 1),
    comment: absence.comment ?? '',
  };
}

export function isStarted(absence: EmployeeAbsence, today = todayInputValue()) {
  return absence.date_from < today;
}

export function isFullyPast(absence: EmployeeAbsence, today = todayInputValue()) {
  return absence.date_to < today;
}

export function canDeleteAbsence(absence: EmployeeAbsence, today = todayInputValue()) {
  return absence.date_from >= today;
}

export function absenceOverlaps(
  form: EmployeeAbsenceForm,
  absences: EmployeeAbsence[],
  editedId?: string,
) {
  return absences.some((absence) => {
    if (absence.id === editedId) return false;
    return form.date_from <= absence.date_to && form.date_to >= absence.date_from;
  });
}

export function validateAbsenceForm(
  form: EmployeeAbsenceForm,
  absences: EmployeeAbsence[],
  mode: AbsenceModalState['mode'],
  original: EmployeeAbsence | null,
  canChangePast = false,
) {
  const today = todayInputValue();

  if (!form.type) return 'Выберите тип отсутствия.';
  if (!form.date_from) return 'Укажите дату начала.';
  if (!form.date_to) return 'Укажите дату окончания.';
  if (form.date_to < form.date_from) {
    return 'Дата окончания должна быть не раньше даты начала.';
  }
  if (
    !canChangePast &&
    form.date_from < today &&
    !(original && isStarted(original, today))
  ) {
    return mode === 'create'
      ? 'Нельзя создать отсутствие задним числом.'
      : 'Нельзя перенести дату начала в прошлое.';
  }
  if (form.payment_mode === 'FIXED') {
    const amount = numberFromInput(form.fixed_daily_amount);
    if (amount === null || amount < 0 || !Number.isInteger(Math.round(amount * 100))) {
      return 'Укажите фиксированную оплату за день числом не меньше 0.';
    }

    const coefficientValue = form.coefficient.trim();
    if (coefficientValue) {
      const coefficient = numberFromInput(coefficientValue);
      const normalizedCoefficient = coefficientValue.replace(',', '.');
      const decimalPlaces = normalizedCoefficient.split('.')[1]?.length ?? 0;
      if (
        coefficient === null ||
        coefficient < 0 ||
        decimalPlaces > 4 ||
        !/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(coefficientValue)
      ) {
        return 'Укажите коэффициент числом не меньше 0, не более чем с 4 знаками после запятой.';
      }
    }
  }
  if (form.payment_mode === 'DEFAULT' && form.fixed_daily_amount.trim()) {
    return 'Для режима "Без изменений" поле фиксированной оплаты должно быть пустым.';
  }
  if (absenceOverlaps(form, absences, original?.id)) {
    return 'Период пересекается с другим отсутствием сотрудника.';
  }
  if (!canChangePast && original && isFullyPast(original, today)) {
    return 'Нельзя редактировать полностью прошедшее отсутствие.';
  }
  if (!canChangePast && original && isStarted(original, today)) {
    if (form.date_from !== original.date_from) {
      return 'У начавшегося отсутствия нельзя менять дату начала.';
    }
    if (form.type !== original.type) {
      return 'У начавшегося отсутствия нельзя менять тип.';
    }
    if (form.payment_mode !== original.payment_mode) {
      return 'У начавшегося отсутствия нельзя менять способ оплаты.';
    }
    if (form.fixed_daily_amount !== moneyToInput(original.fixed_daily_amount)) {
      return 'У начавшегося отсутствия нельзя менять фиксированную оплату.';
    }
    if (coefficientFromInput(form.coefficient) !== (original.coefficient ?? 1)) {
      return 'У начавшегося отсутствия нельзя менять коэффициент.';
    }
    if (form.date_to < addDays(today, -1)) {
      return 'Нельзя поставить дату окончания раньше уже прошедших дней.';
    }
  }

  return null;
}

export function monthTitle(month: Date) {
  const value = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(month);

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildCalendarGrid(
  month: Date,
  days: EmployeeAbsenceCalendarDay[],
): CalendarGridDay[] {
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = new Date(first);
  const startOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - startOffset);

  const end = new Date(last);
  const endOffset = 6 - ((last.getDay() + 6) % 7);
  end.setDate(last.getDate() + endOffset);

  const result: CalendarGridDay[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const date = dateInputValue(cursor);
    const loaded = dayMap.get(date);
    result.push({
      date,
      is_working_day: loaded?.is_working_day ?? ![0, 6].includes(cursor.getDay()),
      worked_seconds: loaded?.worked_seconds ?? 0,
      absence: loaded?.absence ?? null,
      inMonth: cursor.getMonth() === month.getMonth(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

export function findAbsenceForDay(
  day: EmployeeAbsenceCalendarDay,
  absences: EmployeeAbsence[],
) {
  if (!day.absence) return null;

  return (
    absences.find((absence) => absence.id === day.absence?.id) ??
    absenceFromForm(
      {
        type: day.absence.type,
        date_from: day.date,
        date_to: day.date,
        payment_mode: day.absence.payment_mode,
        fixed_daily_amount: moneyToInput(day.absence.fixed_daily_amount),
        coefficient: String(day.absence.coefficient ?? 1),
        comment: day.absence.comment ?? '',
      },
      day.absence.id,
    )
  );
}

export function buildAbsenceSummary(absences: EmployeeAbsence[]) {
  const summary = {
    VACATION: 0,
    DAY_OFF: 0,
    SICK_LEAVE: 0,
    WEEKEND: 0,
  } satisfies Record<EmployeeAbsenceType, number>;

  for (const absence of absences) {
    summary[absence.type] += inclusiveDays(absence.date_from, absence.date_to);
  }

  return {
    ...summary,
    total: summary.VACATION + summary.DAY_OFF + summary.SICK_LEAVE + summary.WEEKEND,
  };
}

export function formatWorkedTime(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);

  return `${Math.floor(totalMinutes / 60)}:${pad(totalMinutes % 60)}`;
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/**
 * Прошедшие дни, начисления за которые могут измениться после сохранения отсутствия.
 * Если менялись только даты, затронуты добавленные и убранные дни, иначе весь период до и после.
 */
export function changedPastDates(
  before: EmployeeAbsence | null,
  after: EmployeeAbsenceForm | null,
  today = todayInputValue(),
) {
  const beforeDates = new Set(
    before ? datesBetween(before.date_from, before.date_to) : [],
  );
  const afterDates = new Set(after ? datesBetween(after.date_from, after.date_to) : []);
  const next = after ? absenceFromForm(after) : null;
  const isSamePayment =
    before !== null &&
    next !== null &&
    before.type === next.type &&
    before.payment_mode === next.payment_mode &&
    (before.fixed_daily_amount ?? null) === next.fixed_daily_amount &&
    (before.coefficient ?? 1) === next.coefficient;
  const changed = isSamePayment
    ? [
        ...[...beforeDates].filter((date) => !afterDates.has(date)),
        ...[...afterDates].filter((date) => !beforeDates.has(date)),
      ]
    : [...new Set([...beforeDates, ...afterDates])];

  return changed.filter((date) => date < today).sort();
}

export type PayrollPeriodRange = { period_from: string; period_to: string };

/** Период ФОТ с датой: неделя Пн-Вс, разрезанная границей месяца, как на сервере. */
export function payrollPeriodForDate(date: string): PayrollPeriodRange {
  const day = parseInputDate(date);
  const weekday = (day.getDay() + 6) % 7;
  const monthStart = dateInputValue(new Date(day.getFullYear(), day.getMonth(), 1));
  const monthEnd = dateInputValue(new Date(day.getFullYear(), day.getMonth() + 1, 0));
  const monday = addDays(date, -weekday);
  const sunday = addDays(date, 6 - weekday);

  return {
    period_from: monday > monthStart ? monday : monthStart,
    period_to: sunday < monthEnd ? sunday : monthEnd,
  };
}

export function payrollPeriodsForDates(dates: string[]) {
  const periods = new Map<string, PayrollPeriodRange>();
  for (const date of dates) {
    const period = payrollPeriodForDate(date);
    periods.set(`${period.period_from}|${period.period_to}`, period);
  }

  return [...periods.values()].sort((left, right) =>
    left.period_from.localeCompare(right.period_from),
  );
}
