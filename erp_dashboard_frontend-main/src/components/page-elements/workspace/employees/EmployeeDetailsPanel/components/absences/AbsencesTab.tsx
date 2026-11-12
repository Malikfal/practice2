import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import type {
  EmployeeAbsence,
  EmployeeAbsenceCalendarPayload,
  EmployeeAbsenceFixedDailyAmountMonths,
  EmployeeAbsenceForm,
  User,
} from '../../../../../../../types/app';
import Button from '../../../../../../ui/Button';

import { AbsenceModal } from './AbsenceModal';
import { DayTooltip } from './AbsenceSharedUi';
import { AbsencesCalendar } from './AbsencesCalendar';
import { AbsencesSummary } from './AbsencesSummary';
import { AbsencesTable } from './AbsencesTable';
import { ABSENCE_TYPE_LABELS } from './constants';
import { PayrollRecalculationNotice } from './PayrollRecalculationNotice';
import type { AbsenceModalState, CalendarGridDay, DayTooltipState } from './types';
import {
  buildAbsenceSummary,
  buildCalendarGrid,
  canDeleteAbsence,
  changedPastDates,
  coefficientFromInput,
  formFromAbsence,
  formatPeriod,
  inclusiveDays,
  isFullyPast,
  isStarted,
  moneyToInput,
  monthBounds,
  numberFromInput,
  payrollPeriodsForDates,
  todayInputValue,
  validateAbsenceForm,
  yearBounds,
  type PayrollPeriodRange,
} from './utils';

type Props = {
  employee: User;
  canManageAbsences?: boolean;
  canChangePast?: boolean;
  canRecalculatePayroll?: boolean;
};

const EMPTY_FORM: EmployeeAbsenceForm = {
  type: 'VACATION',
  date_from: '',
  date_to: '',
  payment_mode: 'DEFAULT',
  fixed_daily_amount: '',
  coefficient: '1',
  comment: '',
};

export default function AbsencesTab({
  employee,
  canManageAbsences = true,
  canChangePast = false,
  canRecalculatePayroll = false,
}: Props) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendar, setCalendar] = useState<EmployeeAbsenceCalendarPayload | null>(null);
  const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState<AbsenceModalState | null>(null);
  const [form, setForm] = useState<EmployeeAbsenceForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [calculationMonths, setCalculationMonths] =
    useState<EmployeeAbsenceFixedDailyAmountMonths>(6);
  const [isCalculating, setIsCalculating] = useState(false);
  const [dayTooltip, setDayTooltip] = useState<DayTooltipState | null>(null);
  const [recalculationPeriods, setRecalculationPeriods] = useState<PayrollPeriodRange[]>(
    [],
  );
  const [recalculationNoticeVersion, setRecalculationNoticeVersion] = useState(0);
  const selectedYear = calendarMonth.getFullYear();

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const firstYear = Math.min(currentYear - 5, selectedYear - 2);
    const lastYear = Math.max(currentYear + 5, selectedYear + 2);

    return Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => firstYear + index,
    );
  }, [selectedYear]);

  const loadData = useCallback(async () => {
    const calendarPeriod = monthBounds(calendarMonth);
    const yearPeriod = yearBounds(selectedYear);

    setIsLoading(true);

    try {
      const [loadedCalendar, loadedAbsences] = await Promise.all([
        api.workspace.employeeAbsences.getCalendarForEmployee(
          employee.id,
          calendarPeriod,
        ),
        api.workspace.employeeAbsences.getForEmployee(employee.id, yearPeriod),
      ]);

      setCalendar(loadedCalendar);
      setAbsences(loadedAbsences);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить отсутствия.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [calendarMonth, employee.id, selectedYear]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const calendarDays = useMemo(
    () => buildCalendarGrid(calendarMonth, calendar?.days ?? []),
    [calendar, calendarMonth],
  );
  const sortedAbsences = useMemo(
    () =>
      [...absences].sort((left, right) =>
        left.date_from === right.date_from
          ? left.date_to.localeCompare(right.date_to)
          : left.date_from.localeCompare(right.date_from),
      ),
    [absences],
  );
  const usedSummary = useMemo(() => buildAbsenceSummary(absences), [absences]);

  const openCreateModal = (initialDate = todayInputValue(), endDate = initialDate) => {
    if (!canManageAbsences) return;
    if (!canChangePast && initialDate < todayInputValue()) {
      toast.error('Нельзя создать отсутствие задним числом.');
      return;
    }

    setDayTooltip(null);
    setModal({ mode: 'create', absence: null, initialDate });
    setForm({
      ...EMPTY_FORM,
      date_from: initialDate,
      date_to: endDate,
    });
    setFormError(null);
  };

  const notePastChanges = (dates: string[]) => {
    if (dates.length === 0) return;

    setRecalculationPeriods((current) => {
      const periods = new Map(
        [...current, ...payrollPeriodsForDates(dates)].map((period) => [
          `${period.period_from}|${period.period_to}`,
          period,
        ]),
      );
      return [...periods.values()].sort((left, right) =>
        left.period_from.localeCompare(right.period_from),
      );
    });
    toast.warning('Изменены прошедшие дни: нужен перерасчёт ФОТ по компании.');
  };

  const removeRecalculatedPeriods = useCallback((keys: string[]) => {
    setRecalculationNoticeVersion((current) => current + 1);
    setRecalculationPeriods((current) =>
      current.filter(
        (period) => !keys.includes(`${period.period_from}|${period.period_to}`),
      ),
    );
  }, []);

  const openEditModal = (absence: EmployeeAbsence) => {
    setDayTooltip(null);
    setModal({ mode: 'edit', absence });
    setForm(formFromAbsence(absence));
    setFormError(null);
  };

  const closeModal = () => {
    if (isSaving) return;
    setModal(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;

    const validationError = validateAbsenceForm(
      form,
      absences,
      modal.mode,
      modal.absence,
      canChangePast,
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (modal.mode === 'create') {
        await api.workspace.employeeAbsences.createForEmployee(employee.id, form);
        toast.success('Отсутствие добавлено.');
        notePastChanges(changedPastDates(null, form));
      } else {
        await api.workspace.employeeAbsences.update(modal.absence.id, form);
        toast.success('Отсутствие обновлено.');
        notePastChanges(changedPastDates(modal.absence, form));
      }

      closeModal();
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить отсутствие.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAbsence = async (absence: EmployeeAbsence) => {
    if (!canManageAbsences || !(canChangePast || canDeleteAbsence(absence))) return;

    const confirmed = window.confirm(
      `Удалить ${ABSENCE_TYPE_LABELS[absence.type].toLowerCase()} ${formatPeriod(
        absence.date_from,
        absence.date_to,
      )}?`,
    );
    if (!confirmed) return;

    setActiveId(absence.id);

    try {
      await api.workspace.employeeAbsences.delete(absence.id);
      toast.success('Отсутствие удалено.');
      notePastChanges(changedPastDates(absence, null));
      if (modal?.absence?.id === absence.id) closeModal();
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось удалить отсутствие.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const calculateFixedDailyAmount = async () => {
    if (!form.date_from) {
      setFormError('Укажите дату начала для расчета фиксированной оплаты.');
      return;
    }

    setIsCalculating(true);
    setFormError(null);

    try {
      const result = await api.workspace.employeeAbsences.calculateFixedDailyAmount(
        employee.id,
        {
          date_from: form.date_from,
          months: calculationMonths,
        },
      );

      setForm((current) => ({
        ...current,
        payment_mode: 'FIXED',
        fixed_daily_amount: moneyToInput(result.fixed_daily_amount),
      }));
      toast.success('Рекомендуемая фиксированная оплата подставлена.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось рассчитать фиксированную оплату.',
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const moveMonth = (amount: number) => {
    setDayTooltip(null);
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  };

  const selectCalendarMonth = (monthIndex: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setDayTooltip(null);
  };

  const selectCalendarYear = (year: number) => {
    setCalendarMonth((current) => new Date(year, current.getMonth(), 1));
    setDayTooltip(null);
  };

  const showDayTooltip = (
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    day: CalendarGridDay,
    absence: EmployeeAbsence | null,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = 288;
    const tooltipHeight = 220;
    const gap = 10;
    const left = Math.min(
      Math.max(gap, rect.left + rect.width / 2 - tooltipWidth / 2),
      window.innerWidth - tooltipWidth - gap,
    );
    const top =
      rect.bottom + tooltipHeight + gap > window.innerHeight
        ? Math.max(gap, rect.top - tooltipHeight - gap)
        : rect.bottom + gap;

    setDayTooltip({
      day,
      absence,
      top,
      left,
    });
  };

  const isCurrentAbsenceStarted =
    !canChangePast && modal?.absence ? isStarted(modal.absence) : false;
  const isCurrentAbsencePast =
    !canChangePast && modal?.absence ? isFullyPast(modal.absence) : false;
  const canEditCurrentAbsence =
    canManageAbsences && (!modal?.absence || !isCurrentAbsencePast);
  const fixedTotal =
    form.payment_mode === 'FIXED'
      ? Math.round(
          Math.round((numberFromInput(form.fixed_daily_amount) ?? 0) * 100) *
            coefficientFromInput(form.coefficient),
        ) * inclusiveDays(form.date_from, form.date_to)
      : null;

  return (
    <>
      <section className='grid min-w-0 gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h3 className='text-xl leading-none font-semibold text-[#10275a] sm:text-[22px]'>
              Рабочий календарь
            </h3>
            <p className='mt-1 text-[13px] text-[#7e8fb4]'>
              Отработанные часы, отпуска, отгулы, больничные и выходные за {selectedYear}{' '}
              год.
            </p>
          </div>

          {canManageAbsences ? (
            <Button
              type='button'
              variant='secondary'
              className='h-10 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! sm:w-auto'
              onClick={() => openCreateModal()}
            >
              Добавить отсутствие
            </Button>
          ) : null}
        </div>

        {recalculationPeriods.length ? (
          <PayrollRecalculationNotice
            key={recalculationNoticeVersion}
            periods={recalculationPeriods}
            canRecalculate={canRecalculatePayroll}
            onRecalculated={removeRecalculatedPeriods}
            onDismiss={() => setRecalculationPeriods([])}
          />
        ) : null}

        <AbsencesSummary summary={usedSummary} />
        <AbsencesCalendar
          calendarMonth={calendarMonth}
          selectedYear={selectedYear}
          yearOptions={yearOptions}
          days={calendarDays}
          absences={absences}
          isLoading={isLoading}
          canManageAbsences={canManageAbsences}
          canChangePast={canChangePast}
          onMoveMonth={moveMonth}
          onSelectMonth={selectCalendarMonth}
          onSelectYear={selectCalendarYear}
          onOpenCreate={openCreateModal}
          onSelectRange={openCreateModal}
          onOpenEdit={openEditModal}
          onShowTooltip={showDayTooltip}
          onHideTooltip={() => setDayTooltip(null)}
        />
        <AbsencesTable
          selectedYear={selectedYear}
          absences={sortedAbsences}
          isLoading={isLoading}
          activeId={activeId}
          canManageAbsences={canManageAbsences}
          canChangePast={canChangePast}
          onEdit={openEditModal}
          onDelete={(absence) => void deleteAbsence(absence)}
        />
      </section>

      {dayTooltip ? <DayTooltip tooltip={dayTooltip} /> : null}
      {modal ? (
        <AbsenceModal
          modal={modal}
          form={form}
          formError={formError}
          calculationMonths={calculationMonths}
          fixedTotal={fixedTotal}
          isSaving={isSaving}
          isCalculating={isCalculating}
          canManageAbsences={canManageAbsences}
          canEditCurrentAbsence={canEditCurrentAbsence}
          canChangePast={canChangePast}
          isCurrentAbsenceStarted={isCurrentAbsenceStarted}
          isCurrentAbsencePast={isCurrentAbsencePast}
          onFormChange={setForm}
          onCalculationMonthsChange={setCalculationMonths}
          onSubmit={submitForm}
          onClose={closeModal}
          onDelete={() => {
            if (modal.absence) void deleteAbsence(modal.absence);
          }}
          onCalculateFixedDailyAmount={() => void calculateFixedDailyAmount()}
        />
      ) : null}
    </>
  );
}
