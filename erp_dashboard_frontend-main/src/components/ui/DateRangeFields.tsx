import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DateRangePicker } from 'react-date-range';
import type { Range, RangeFocus, RangeKeyDict, StaticRange } from 'react-date-range';

import { createDateRangePresets, toStaticRanges } from '../../utils/dateRangePresets';
import Button from './Button';
import { Field, inputBaseClasses } from './FormField';

type PickerPosition = Pick<CSSProperties, 'top' | 'right' | 'left'>;

const DEFAULT_PICKER_WIDTH = 668;

type Props = {
  from: string;
  to: string;
  onChange: (_from: string, _to: string) => void;
  fromLabel?: string;
  toLabel?: string;
  required?: boolean;
  className?: string;
  /**
   * Передавать диапазон только после выбора обеих дат. Без этого первый клик
   * сразу отдает однодневный диапазон, что лишнее для отчётов, которые
   * перестраиваются при каждом изменении фильтра.
   */
  commitCompleteRange?: boolean;
  /**
   * Первая дата с данными (yyyy-MM-dd) для пресета «За всё время». Без нее пресет
   * сбрасывает период, а у обязательного периода не показывается.
   */
  allTimeFrom?: string | null;
};

type PendingRange = { startDate: Date; endDate: Date };

function parseInputDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
    ? null
    : date;
}

function formatInputDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function formatDisplayDate(value: string): string {
  const date = parseInputDate(value);
  return date ? format(date, 'dd.MM.yyyy', { locale: ru }) : 'дд.мм.гггг';
}

// Пресет «За всё время» без известного начала сбрасывает период: пустой период и есть всё время.
const CLEAR_PERIOD_DATE = new Date(0);

function isClearPeriod(range: Range): boolean {
  return range.startDate?.getTime() === CLEAR_PERIOD_DATE.getTime();
}

function createDateRanges({
  allTimeFrom,
  canClear,
  isEmpty,
}: {
  allTimeFrom: string | null;
  canClear: boolean;
  isEmpty: boolean;
}): StaticRange[] {
  const presets = createDateRangePresets();
  const allTimeStart = allTimeFrom ? parseInputDate(allTimeFrom) : null;
  if (allTimeStart) {
    presets.push({ label: 'За всё время', startDate: allTimeStart, endDate: new Date() });
  }
  const ranges = toStaticRanges(presets);
  if (!allTimeStart && canClear) {
    ranges.push({
      label: 'За всё время',
      range: () => ({ startDate: CLEAR_PERIOD_DATE, endDate: CLEAR_PERIOD_DATE }),
      isSelected: () => isEmpty,
    });
  }

  return ranges;
}

export default function DateRangeFields({
  from,
  to,
  onChange,
  fromLabel = 'Период: от',
  toLabel = 'Период: до',
  required = false,
  className = '',
  commitCompleteRange = false,
  allTimeFrom = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const isEmpty = !from && !to;
  const staticRanges = useMemo(
    () => createDateRanges({ allTimeFrom, canClear: !required, isEmpty }),
    [allTimeFrom, isEmpty, required],
  );
  // Ref нужен обработчику фокуса, state - отрисовке выбранного начала в календаре.
  const pendingRangeRef = useRef<PendingRange | null>(null);
  const [pendingRange, setPendingRange] = useState<PendingRange | null>(null);
  // Фокус хранится здесь: свой onRangeFocusChange отключает внутренний обработчик DateRangePicker.
  const [focusedRange, setFocusedRange] = useState<RangeFocus>([0, 0]);
  // Клик по дню вызывает onChange и сразу onRangeFocusChange, выбор пресета - только onChange.
  const focusChangedRef = useRef(false);
  const setPending = (range: PendingRange | null) => {
    pendingRangeRef.current = range;
    setPendingRange(range);
  };
  const commitPending = () => {
    const pending = pendingRangeRef.current;
    if (!pending) return;
    setPending(null);
    onChange(formatInputDate(pending.startDate), formatInputDate(pending.endDate));
  };
  const selectedRange = useMemo<Range>(() => {
    if (pendingRange) return { ...pendingRange, key: 'selection' };
    const today = new Date();
    const startDate = parseInputDate(from) ?? today;
    return {
      startDate,
      endDate: parseInputDate(to) ?? startDate,
      key: 'selection',
    };
  }, [from, pendingRange, to]);

  const updatePosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (window.innerWidth < 768) {
      setPosition({ top: 8, right: 8, left: 8 });
      return;
    }

    const rect = container.getBoundingClientRect();
    const padding = 8;
    const popupWidth =
      popupRef.current?.getBoundingClientRect().width ?? DEFAULT_PICKER_WIDTH;
    const popupHeight = popupRef.current?.getBoundingClientRect().height ?? 360;
    const centeredLeft = rect.left + rect.width / 2 - popupWidth / 2;
    const left = Math.max(
      padding,
      Math.min(centeredLeft, window.innerWidth - popupWidth - padding),
    );
    const spaceBelow = window.innerHeight - rect.bottom - padding;
    const spaceAbove = rect.top - padding;
    const top =
      spaceBelow >= popupHeight
        ? rect.bottom + padding
        : spaceAbove >= popupHeight
          ? rect.top - popupHeight - padding
          : Math.max(
              padding,
              Math.min(rect.bottom + padding, window.innerHeight - popupHeight - padding),
            );

    setPosition({
      top,
      right: 'auto',
      left,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const toggle = () => {
    if (!isOpen) {
      setPending(null);
      setFocusedRange([0, 0]);
      updatePosition();
      window.requestAnimationFrame(updatePosition);
    }
    setIsOpen((current) => !current);
  };

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <div className='grid min-w-0 grid-cols-2 gap-2 md:gap-2'>
        <Field label={`${fromLabel}${required ? ' *' : ''}`}>
          <button
            type='button'
            className={`${inputBaseClasses} min-w-0 text-left`}
            onClick={toggle}
          >
            {formatDisplayDate(from)}
          </button>
        </Field>
        <Field label={`${toLabel}${required ? ' *' : ''}`}>
          <button
            type='button'
            className={`${inputBaseClasses} min-w-0 text-left`}
            onClick={toggle}
          >
            {formatDisplayDate(to)}
          </button>
        </Field>
      </div>

      {isOpen && position
        ? createPortal(
            <div
              ref={popupRef}
              style={position}
              className='fixed z-1200 max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 md:rounded-lg'
            >
              <DateRangePicker
                className='reports-date-range'
                ranges={[selectedRange]}
                onChange={(ranges: RangeKeyDict) => {
                  const range = ranges.selection;
                  if (isClearPeriod(range)) {
                    setPending(null);
                    setFocusedRange([0, 0]);
                    onChange('', '');
                    setIsOpen(false);
                    return;
                  }
                  const startDate = range.startDate ?? selectedRange.startDate;
                  const endDate = range.endDate ?? selectedRange.endDate;
                  if (!startDate || !endDate) return;
                  if (commitCompleteRange) {
                    setPending({ startDate, endDate });
                    focusChangedRef.current = false;
                    // Без события фокуса это пресет: диапазон уже полный, окно можно закрыть.
                    queueMicrotask(() => {
                      if (focusChangedRef.current) return;
                      setFocusedRange([0, 0]);
                      commitPending();
                      setIsOpen(false);
                    });
                    return;
                  }
                  onChange(formatInputDate(startDate), formatInputDate(endDate));
                }}
                // [0, 1] после клика значит, что выбрано только начало и ждем конец.
                focusedRange={focusedRange}
                onRangeFocusChange={(nextFocusedRange) => {
                  focusChangedRef.current = true;
                  setFocusedRange(nextFocusedRange);
                  if (commitCompleteRange && nextFocusedRange[1] === 0) commitPending();
                }}
                staticRanges={staticRanges}
                inputRanges={[]}
                // Месяцы не переезжают после клика по первой дате.
                preventSnapRefocus
                months={2}
                direction='horizontal'
                showMonthAndYearPickers
                weekStartsOn={1}
                locale={ru}
                weekdayDisplayFormat='EEEEEE'
                rangeColors={['#2d6ff7']}
              />
              {/* Сброс периода делает пресет «За всё время», здесь только закрытие на мобильных. */}
              <div className='sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white p-2 md:hidden'>
                <Button
                  type='button'
                  size='sm'
                  className='w-full md:hidden'
                  onClick={() => setIsOpen(false)}
                >
                  Готово
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
