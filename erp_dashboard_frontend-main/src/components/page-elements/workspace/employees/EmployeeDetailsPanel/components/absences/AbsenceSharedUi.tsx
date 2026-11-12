import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ABSENCE_TYPE_LABELS, PAYMENT_MODE_LABELS } from './constants';
import type { DayTooltipState } from './types';
import {
  applyFixedPaymentCoefficient,
  formatCoefficient,
  formatDate,
  formatMoney,
  formatPeriod,
  formatWorkedTime,
} from './utils';

type SelectValue = string | number;

type StyledSelectOption = {
  value: SelectValue;
  label: string;
};

export const FIELD_CONTROL_CLASS =
  'h-10 min-w-0 max-w-full w-full rounded-xl border border-[#d7e0ee] bg-white px-3.5 text-sm font-medium text-[#1f3565] outline-none transition-colors placeholder:text-[#9aa8c7] focus:border-[#2d6ff7] focus:ring-2 focus:ring-[#2d6ff7]/10 disabled:cursor-not-allowed disabled:bg-[#f5f7fb] disabled:text-[#7e8fb4]';

export const FIELD_TEXTAREA_CLASS =
  'min-h-24 w-full rounded-xl border border-[#d7e0ee] bg-white px-3.5 py-2 text-sm font-medium text-[#1f3565] outline-none transition-colors placeholder:text-[#9aa8c7] focus:border-[#2d6ff7] focus:ring-2 focus:ring-[#2d6ff7]/10 disabled:cursor-not-allowed disabled:bg-[#f5f7fb] disabled:text-[#7e8fb4]';

export function SummaryCard({
  label,
  value,
  markerClass,
}: {
  label: string;
  value: number;
  markerClass?: string;
}) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-white p-3 sm:p-4'>
      <div className='flex items-center gap-2 text-[13px] font-semibold text-[#7e8fb4]'>
        {markerClass ? <span className={`size-2 rounded-full ${markerClass}`} /> : null}
        {label}
      </div>
      <p className='mt-2 text-xl leading-none font-semibold text-[#10275a] sm:text-[26px]'>
        {value} дн.
      </p>
    </div>
  );
}

export function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className={`size-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}

export function DayTooltip({ tooltip }: { tooltip: DayTooltipState }) {
  const { day, absence, top, left } = tooltip;
  const adjustedFixedDailyAmount = absence
    ? applyFixedPaymentCoefficient(absence.fixed_daily_amount, absence.coefficient)
    : null;

  return (
    <div
      className='pointer-events-none fixed z-[60] w-72 rounded-xl border border-[#d7e0ee] bg-white p-3 text-left text-xs text-[#1f3565] shadow-xl shadow-[#10275a]/15'
      style={{ top, left }}
    >
      <p className='font-bold'>{formatDate(day.date)}</p>
      <p className='mt-1 text-[#7e8fb4]'>
        {day.worked_seconds > 0
          ? `Рабочий день, отработано ${formatWorkedTime(day.worked_seconds)} ч`
          : day.is_working_day
            ? 'Рабочий день'
            : 'Выходной день'}
      </p>
      {absence ? (
        <div className='mt-2 grid gap-1'>
          <InfoLine label='Тип' value={ABSENCE_TYPE_LABELS[absence.type]} />
          <InfoLine
            label='Период'
            value={formatPeriod(absence.date_from, absence.date_to)}
          />
          <InfoLine label='Оплата' value={PAYMENT_MODE_LABELS[absence.payment_mode]} />
          {absence.payment_mode === 'FIXED' ? (
            <InfoLine
              label='Расчёт за день'
              value={`${formatMoney(absence.fixed_daily_amount)} × ${formatCoefficient(
                absence.coefficient,
              )} = ${formatMoney(adjustedFixedDailyAmount)}`}
            />
          ) : null}
          {absence.comment ? (
            <InfoLine label='Комментарий' value={absence.comment} />
          ) : null}
        </div>
      ) : (
        <p className='mt-2 font-medium'>
          Нажмите, чтобы добавить отсутствие на этот день.
        </p>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className='grid gap-1.5 text-sm font-semibold text-[#1f3565]'>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StyledSelect({
  value,
  options,
  ariaLabel,
  className = '',
  buttonClassName = '',
  disabled = false,
  onChange,
}: {
  value: SelectValue;
  options: StyledSelectOption[];
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  onChange: (_value: SelectValue) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    options.find((option) => String(option.value) === String(value)) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type='button'
        className={`${FIELD_CONTROL_CLASS} flex items-center justify-between gap-3 text-left ${
          isOpen ? 'border-[#2d6ff7] ring-2 ring-[#2d6ff7]/10' : ''
        } ${buttonClassName}`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
      >
        <span className='min-w-0 truncate'>{selectedOption?.label}</span>
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[10px] leading-none text-[#2d6ff7] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden='true'
        >
          ▼
        </span>
      </button>

      {isOpen ? (
        <div
          className='absolute top-[calc(100%+6px)] left-0 z-50 max-h-64 w-full overflow-auto rounded-xl border border-[#d7e0ee] bg-white p-1 shadow-xl shadow-[#10275a]/15'
          role='listbox'
        >
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);

            return (
              <button
                key={String(option.value)}
                type='button'
                className={`flex h-9 w-full items-center rounded-lg px-3 text-left text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-[#edf3ff] text-[#2d6ff7]'
                    : 'text-[#1f3565] hover:bg-[#f5f7fb]'
                }`}
                role='option'
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className='truncate'>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='grid gap-0.5'>
      <span className='text-xs font-semibold text-[#7e8fb4]'>{label}</span>
      <span className='font-semibold text-[#1f3565]'>{value}</span>
    </div>
  );
}
