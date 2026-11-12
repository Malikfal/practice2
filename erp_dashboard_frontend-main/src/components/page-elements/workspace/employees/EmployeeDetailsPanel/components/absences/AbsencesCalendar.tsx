import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

import type { EmployeeAbsence } from '../../../../../../../types/app';

import {
  ABSENCE_TYPE_LABELS,
  ABSENCE_TYPE_STYLES,
  MONTH_OPTIONS,
  PAYMENT_MODE_LABELS,
  WORKED_DAY_BADGE_CLASS,
} from './constants';
import { LegendDot, StyledSelect } from './AbsenceSharedUi';
import type { CalendarGridDay } from './types';
import {
  applyFixedPaymentCoefficient,
  findAbsenceForDay,
  formatMoney,
  formatWorkedTime,
  parseInputDate,
  todayInputValue,
} from './utils';

type DaySelection = { anchor: string; current: string };

type Props = {
  calendarMonth: Date;
  selectedYear: number;
  yearOptions: number[];
  days: CalendarGridDay[];
  absences: EmployeeAbsence[];
  isLoading: boolean;
  canManageAbsences: boolean;
  canChangePast: boolean;
  onMoveMonth: (_amount: number) => void;
  onSelectMonth: (_monthIndex: number) => void;
  onSelectYear: (_year: number) => void;
  onOpenCreate: (_date: string) => void;
  onSelectRange: (_from: string, _to: string) => void;
  onOpenEdit: (_absence: EmployeeAbsence) => void;
  onShowTooltip: (
    _event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    _day: CalendarGridDay,
    _absence: EmployeeAbsence | null,
  ) => void;
  onHideTooltip: () => void;
};

export function AbsencesCalendar({
  calendarMonth,
  selectedYear,
  yearOptions,
  days,
  absences,
  isLoading,
  canManageAbsences,
  canChangePast,
  onMoveMonth,
  onSelectMonth,
  onSelectYear,
  onOpenCreate,
  onSelectRange,
  onOpenEdit,
  onShowTooltip,
  onHideTooltip,
}: Props) {
  const [selection, setSelection] = useState<DaySelection | null>(null);
  const selectionRef = useRef<DaySelection | null>(null);
  const onSelectRangeRef = useRef(onSelectRange);
  const isSelecting = selection !== null;
  const [rangeFrom, rangeTo] = selection
    ? [selection.anchor, selection.current].sort()
    : ['', ''];

  useEffect(() => {
    onSelectRangeRef.current = onSelectRange;
  }, [onSelectRange]);

  useEffect(() => {
    if (!isSelecting) return;

    // Отпускание мыши может случиться за пределами календаря, поэтому слушаем окно.
    // Одиночный день обрабатывает обычный click по ячейке.
    const finishSelection = () => {
      const current = selectionRef.current;
      selectionRef.current = null;
      setSelection(null);
      if (current && current.anchor !== current.current) {
        const [from, to] = [current.anchor, current.current].sort();
        onSelectRangeRef.current(from, to);
      }
    };

    window.addEventListener('pointerup', finishSelection);

    return () => window.removeEventListener('pointerup', finishSelection);
  }, [isSelecting]);

  const updateSelection = (next: DaySelection | null) => {
    selectionRef.current = next;
    setSelection(next);
  };

  const startSelection = (event: PointerEvent<HTMLButtonElement>, date: string) => {
    if (!canManageAbsences || event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }

    onHideTooltip();
    updateSelection({ anchor: date, current: date });
  };

  const extendSelection = (date: string) => {
    if (!selectionRef.current || selectionRef.current.current === date) return;
    updateSelection({ ...selectionRef.current, current: date });
  };

  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 md:p-3'>
      <div className='mb-3 grid gap-3 md:flex md:flex-wrap md:items-center md:justify-between'>
        <div className='grid w-full grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,0.72fr)_2.5rem] items-center gap-2 md:flex md:w-auto md:flex-wrap md:gap-3'>
          <CalendarNavButton direction='previous' onClick={() => onMoveMonth(-1)} />
          <div className='contents md:flex md:items-center md:gap-2'>
            <StyledSelect
              className='w-full md:w-36'
              buttonClassName='border-[#cfe0ff] bg-gradient-to-b from-white to-[#f8fbff] px-4 font-semibold shadow-sm shadow-[#10275a]/5 hover:border-[#9fbcff] hover:bg-[#f8fbff]'
              value={calendarMonth.getMonth()}
              ariaLabel='Выбрать месяц календаря'
              options={MONTH_OPTIONS.map((month, index) => ({
                value: index,
                label: month,
              }))}
              onChange={(value) => onSelectMonth(Number(value))}
            />
            <StyledSelect
              className='w-full md:w-28'
              buttonClassName='border-[#cfe0ff] bg-gradient-to-b from-white to-[#f8fbff] px-4 font-semibold shadow-sm shadow-[#10275a]/5 hover:border-[#9fbcff] hover:bg-[#f8fbff]'
              value={selectedYear}
              ariaLabel='Выбрать год календаря'
              options={yearOptions.map((year) => ({
                value: year,
                label: String(year),
              }))}
              onChange={(value) => onSelectYear(Number(value))}
            />
          </div>
          <CalendarNavButton direction='next' onClick={() => onMoveMonth(1)} />
        </div>

        <div className='flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold text-[#7e8fb4] md:text-xs'>
          <LegendDot className='bg-[#2d6ff7]' label='Отпуск' />
          <LegendDot className='bg-[#f59f25]' label='Отгул' />
          <LegendDot className='bg-[#42b85b]' label='Больничный' />
          <LegendDot className='bg-[#7e8fb4]' label='Выходной' />
          <LegendDot className='bg-[#10275a]' label='Фиксированная оплата' />
          <LegendDot className='bg-[#0f7f74]' label='Отработано, ч' />
        </div>
      </div>

      <div className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white md:overflow-x-auto'>
        <div className='grid grid-cols-7 border-b border-[#e3e9f3] bg-[#f3f7ff] text-center text-[10px] font-bold tracking-[0.05em] text-[#7e8fb4] uppercase md:min-w-[860px] md:text-xs'>
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
            <div key={day} className='border-r border-[#e3e9f3] py-2 last:border-r-0'>
              {day}
            </div>
          ))}
        </div>
        <div className='grid grid-cols-7 select-none md:min-w-[860px]'>
          {days.map((day) => (
            <CalendarDay
              key={day.date}
              day={day}
              absence={findAbsenceForDay(day, absences)}
              canChangePast={canChangePast}
              isSelected={isSelecting && day.date >= rangeFrom && day.date <= rangeTo}
              isSelecting={isSelecting}
              onStartSelection={startSelection}
              onExtendSelection={extendSelection}
              onOpenCreate={onOpenCreate}
              onOpenEdit={onOpenEdit}
              onShowTooltip={onShowTooltip}
              onHideTooltip={onHideTooltip}
            />
          ))}
        </div>
      </div>

      {canManageAbsences ? (
        <p className='mt-2 hidden text-xs text-[#7e8fb4] md:block'>
          Чтобы отметить несколько дней, зажмите кнопку мыши на первом дне и протяните до
          последнего.
        </p>
      ) : null}

      {isLoading ? (
        <div className='mt-3 flex items-center gap-2 text-sm font-medium text-[#7e8fb4]'>
          <span className='h-4 w-4 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          Загрузка календаря...
        </div>
      ) : null}
    </div>
  );
}

function CalendarNavButton({
  direction,
  onClick,
}: {
  direction: 'previous' | 'next';
  onClick: () => void;
}) {
  const label = direction === 'previous' ? 'Предыдущий месяц' : 'Следующий месяц';

  return (
    <button
      type='button'
      className='grid size-10 place-items-center rounded-xl border border-[#cfe0ff] bg-gradient-to-b from-white to-[#f8fbff] text-[#2d6ff7] shadow-sm shadow-[#10275a]/5 transition-all hover:-translate-y-px hover:border-[#9fbcff] hover:bg-[#f3f7ff] hover:shadow-md hover:shadow-[#2d6ff7]/10 focus-visible:border-[#2d6ff7] focus-visible:ring-2 focus-visible:ring-[#2d6ff7]/15 focus-visible:outline-none active:translate-y-0 active:shadow-sm'
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <svg
        viewBox='0 0 24 24'
        className={`size-4 fill-none stroke-current stroke-2 ${
          direction === 'previous' ? 'rotate-180' : ''
        }`}
        aria-hidden='true'
      >
        <path d='M9 6l6 6-6 6' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </button>
  );
}

function CalendarDay({
  day,
  absence,
  canChangePast,
  isSelected,
  isSelecting,
  onStartSelection,
  onExtendSelection,
  onOpenCreate,
  onOpenEdit,
  onShowTooltip,
  onHideTooltip,
}: {
  day: CalendarGridDay;
  absence: EmployeeAbsence | null;
  canChangePast: boolean;
  isSelected: boolean;
  isSelecting: boolean;
  onStartSelection: (_event: PointerEvent<HTMLButtonElement>, _date: string) => void;
  onExtendSelection: (_date: string) => void;
  onOpenCreate: (_date: string) => void;
  onOpenEdit: (_absence: EmployeeAbsence) => void;
  onShowTooltip: (
    _event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    _day: CalendarGridDay,
    _absence: EmployeeAbsence | null,
  ) => void;
  onHideTooltip: () => void;
}) {
  const date = parseInputDate(day.date);
  const isCreateDisabled = !absence && !canChangePast && day.date < todayInputValue();
  const isWorked = day.worked_seconds > 0;
  const dayClass = day.absence
    ? ABSENCE_TYPE_STYLES[day.absence.type]
    : day.is_working_day || isWorked
      ? 'border-[#e3e9f3] bg-white text-[#1f3565]'
      : 'border-[#e3e9f3] bg-[#f5f7fb] text-[#7e8fb4]';

  return (
    <button
      type='button'
      className={`group relative min-h-14 min-w-0 overflow-hidden border-r border-b p-1 text-left transition-colors hover:z-10 hover:border-[#2d6ff7] hover:shadow-[0_0_0_2px_rgba(45,111,247,0.16)] md:min-h-[112px] md:overflow-visible md:p-2 ${dayClass} ${
        day.inMonth ? '' : 'opacity-50'
      } ${
        isCreateDisabled
          ? 'cursor-not-allowed opacity-60 hover:border-[#e3e9f3] hover:shadow-none'
          : ''
      } ${
        isSelected
          ? 'z-10 border-[#2d6ff7] bg-[#eef4ff]! shadow-[inset_0_0_0_2px_#2d6ff7]'
          : ''
      }`}
      disabled={isCreateDisabled}
      onPointerDown={(event) => {
        if (!absence) onStartSelection(event, day.date);
      }}
      onPointerEnter={() => onExtendSelection(day.date)}
      onMouseEnter={(event) => {
        if (!isSelecting) onShowTooltip(event, day, absence);
      }}
      onMouseLeave={onHideTooltip}
      onFocus={(event) => onShowTooltip(event, day, absence)}
      onBlur={onHideTooltip}
      onClick={() => (absence ? onOpenEdit(absence) : onOpenCreate(day.date))}
    >
      <div className='flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5'>
        <span className='text-xs font-semibold md:text-[15px]'>{date.getDate()}</span>
        {isWorked ? (
          <span
            className={`rounded-md px-1 py-0.5 text-[9px] leading-none font-bold md:px-1.5 md:text-[11px] ${WORKED_DAY_BADGE_CLASS}`}
            title='Отработано за день'
          >
            {formatWorkedTime(day.worked_seconds)}
            <span className='hidden md:inline'> ч</span>
          </span>
        ) : !day.is_working_day ? (
          <span className='hidden rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-[#7e8fb4] md:inline'>
            Вых
          </span>
        ) : null}
      </div>

      {day.absence ? (
        <>
          <span className='absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-current md:hidden' />
          <div className='mt-2 hidden gap-1 text-[12px] font-semibold md:grid'>
            <span>{ABSENCE_TYPE_LABELS[day.absence.type]}</span>
            <span className='truncate font-medium'>
              {PAYMENT_MODE_LABELS[day.absence.payment_mode]}
            </span>
            {day.absence.payment_mode === 'FIXED' ? (
              <span className='truncate font-medium'>
                {formatMoney(
                  applyFixedPaymentCoefficient(
                    day.absence.fixed_daily_amount,
                    day.absence.coefficient,
                  ),
                )}
              </span>
            ) : null}
            {day.absence.comment ? (
              <span className='line-clamp-2 font-medium opacity-80'>
                {day.absence.comment}
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <span className='mt-8 hidden text-center text-[12px] font-medium text-[#9aa8c7] opacity-0 transition-opacity group-hover:opacity-100 md:block'>
          Добавить
        </span>
      )}
    </button>
  );
}
