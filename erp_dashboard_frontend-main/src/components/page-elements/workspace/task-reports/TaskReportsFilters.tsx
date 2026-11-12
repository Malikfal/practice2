import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DateRangePicker } from 'react-date-range';
import type { Range, RangeKeyDict } from 'react-date-range';

import Button from '../../../ui/Button';
import { Field, MultiSelect, inputBaseClasses } from '../../../ui/FormField';
import {
  createDateRangePresets,
  toStaticRanges,
} from '../../../../utils/dateRangePresets';
import {
  formatDateForInput,
  type DisplayOptions,
  type StatusScope,
} from './taskReportsShared';

type Option = { value: string; label: string };

type Props = {
  projectScope: StatusScope;
  taskScope: StatusScope;
  employeeScope: StatusScope;
  clientScope: StatusScope;
  onProjectScopeChange: (_next: StatusScope) => void;
  onTaskScopeChange: (_next: StatusScope) => void;
  onEmployeeScopeChange: (_next: StatusScope) => void;
  onClientScopeChange: (_next: StatusScope) => void;
  employeeOptions: Option[];
  projectOptions: Option[];
  taskOptions: Option[];
  clientOptions: Option[];
  selectedEmployeeIds: string[];
  selectedProjectIds: string[];
  selectedTaskIds: string[];
  selectedClientIds: string[];
  onEmployeeIdsChange: (_next: string[]) => void;
  onProjectIdsChange: (_next: string[]) => void;
  onTaskIdsChange: (_next: string[]) => void;
  onClientIdsChange: (_next: string[]) => void;
  periodFrom: string;
  periodTo: string;
  onPeriodChange: (_from: string, _to: string) => void;
  displayOptions: DisplayOptions;
  onDisplayOptionsChange: (_next: DisplayOptions) => void;
  isLoading: boolean;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onPrint: () => void;
};

type DatePickerPosition = Pick<CSSProperties, 'top' | 'right' | 'left'>;

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateForDisplay(value: string): string {
  const parsed = parseInputDate(value);
  if (!parsed) return value;
  return format(parsed, 'dd.MM.yyyy', { locale: ru });
}

export default function TaskReportsFilters({
  projectScope,
  taskScope,
  employeeScope,
  clientScope,
  onProjectScopeChange,
  onTaskScopeChange,
  onEmployeeScopeChange,
  onClientScopeChange,
  employeeOptions,
  projectOptions,
  taskOptions,
  clientOptions,
  selectedEmployeeIds,
  selectedProjectIds,
  selectedTaskIds,
  selectedClientIds,
  onEmployeeIdsChange,
  onProjectIdsChange,
  onTaskIdsChange,
  onClientIdsChange,
  periodFrom,
  periodTo,
  onPeriodChange,
  displayOptions,
  onDisplayOptionsChange,
  isLoading,
  onExportCsv,
  onExportXlsx,
  onPrint,
}: Props) {
  const isTaskSelectDisabled = isLoading || selectedProjectIds.length === 0;
  const datePickerContainerRef = useRef<HTMLDivElement | null>(null);
  const datePickerPopupRef = useRef<HTMLDivElement | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState<DatePickerPosition | null>(
    null,
  );
  const displayItems = useMemo(
    () =>
      [
        { key: 'showEmployees', label: 'Показывать сотрудников' },
        { key: 'showProjects', label: 'Показывать проекты' },
        { key: 'showTaskStatus', label: 'Показывать статус задачи' },
        { key: 'showUpdatedAt', label: 'Показывать дату обновления' },
        { key: 'showRemainingTime', label: 'Показывать оставшееся время' },
      ] as const,
    [],
  );
  const displayOptionsMap = useMemo(
    () =>
      ({
        showEmployees: 'Показывать сотрудников',
        showProjects: 'Показывать проекты',
        showTaskStatus: 'Показывать статус задачи',
        showUpdatedAt: 'Показывать дату обновления',
        showRemainingTime: 'Показывать оставшееся время',
      }) as const,
    [],
  );
  const selectedDisplayOptionKeys = useMemo(
    () =>
      (Object.keys(displayOptionsMap) as Array<keyof DisplayOptions>).filter(
        (key) => displayOptions[key],
      ),
    [displayOptions, displayOptionsMap],
  );
  const hasRange = Boolean(periodFrom && periodTo);
  const selectedRange = useMemo<Range>(() => {
    const now = new Date();
    const startDate = parseInputDate(periodFrom) ?? now;
    const endDate = parseInputDate(periodTo) ?? startDate;
    return { startDate, endDate, key: 'selection' };
  }, [periodFrom, periodTo]);

  const staticRanges = useMemo(() => toStaticRanges(createDateRangePresets()), []);

  const updateDatePickerPosition = useCallback(() => {
    const container = datePickerContainerRef.current;
    if (!container) return;

    if (window.innerWidth < 768) {
      setDatePickerPosition({ top: 80, right: 8, left: 8 });
      return;
    }

    const rect = container.getBoundingClientRect();
    const viewportPadding = 8;
    const estimatedPickerHeight = 430;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    let top = rect.bottom + viewportPadding;

    if (spaceBelow < estimatedPickerHeight) {
      top =
        spaceAbove >= estimatedPickerHeight
          ? rect.top - estimatedPickerHeight - viewportPadding
          : viewportPadding;
    }

    setDatePickerPosition({
      top,
      right: Math.max(viewportPadding, window.innerWidth - rect.right),
      left: 'auto',
    });
  }, []);

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !datePickerContainerRef.current?.contains(target) &&
        !datePickerPopupRef.current?.contains(target)
      ) {
        setIsDatePickerOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDatePickerOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateDatePickerPosition);
    window.addEventListener('scroll', updateDatePickerPosition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateDatePickerPosition);
      window.removeEventListener('scroll', updateDatePickerPosition, true);
    };
  }, [isDatePickerOpen, updateDatePickerPosition]);

  const toggleDatePicker = () => {
    if (!isDatePickerOpen) updateDatePickerPosition();
    setIsDatePickerOpen((prev) => !prev);
  };

  return (
    <div className='grid min-w-0 max-w-full gap-3 overflow-hidden'>
      <div className='grid gap-3 lg:grid-cols-4'>
        <Field label='Проекты: статус'>
          <div className='grid min-w-0 grid-cols-3 gap-1 text-[11px] font-semibold'>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                projectScope === 'all'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onProjectScopeChange('all')}
            >
              Все
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                projectScope === 'active'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onProjectScopeChange('active')}
            >
              Активные
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                projectScope === 'archived'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onProjectScopeChange('archived')}
            >
              Архивные
            </button>
          </div>
        </Field>
        <Field label='Задачи: статус'>
          <div className='grid min-w-0 grid-cols-3 gap-1 text-[11px] font-semibold'>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                taskScope === 'all'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onTaskScopeChange('all')}
            >
              Все
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                taskScope === 'active'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onTaskScopeChange('active')}
            >
              Активные
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                taskScope === 'archived'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onTaskScopeChange('archived')}
            >
              Архивные
            </button>
          </div>
        </Field>
        <Field label='Сотрудники: статус'>
          <div className='grid min-w-0 grid-cols-3 gap-1 text-[11px] font-semibold'>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                employeeScope === 'all'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onEmployeeScopeChange('all')}
            >
              Все
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                employeeScope === 'active'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onEmployeeScopeChange('active')}
            >
              Активные
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                employeeScope === 'archived'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onEmployeeScopeChange('archived')}
            >
              Архивные
            </button>
          </div>
        </Field>
        <Field label='Клиенты: статус'>
          <div className='grid min-w-0 grid-cols-3 gap-1 text-[11px] font-semibold'>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                clientScope === 'all'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onClientScopeChange('all')}
            >
              Все
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                clientScope === 'active'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onClientScopeChange('active')}
            >
              Активные
            </button>
            <button
              type='button'
              className={`rounded-xl px-2 py-1 transition-colors duration-150 ${
                clientScope === 'archived'
                  ? 'bg-[#2d6ff7] text-white'
                  : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onClientScopeChange('archived')}
            >
              Архивные
            </button>
          </div>
        </Field>
      </div>

      <div className='grid gap-3 lg:grid-cols-4'>
        <Field label='Проекты'>
          <MultiSelect
            values={selectedProjectIds}
            onValuesChange={onProjectIdsChange}
            options={projectOptions}
            placeholder='Все проекты'
            emptyText='Проекты не найдены'
            searchPlaceholder='Поиск проекта'
            searchable
            disabled={isLoading}
            isLoading={isLoading}
          />
        </Field>

        <Field label='Сотрудники'>
          <MultiSelect
            values={selectedEmployeeIds}
            onValuesChange={onEmployeeIdsChange}
            options={employeeOptions}
            placeholder='Все сотрудники'
            emptyText='Сотрудники не найдены'
            searchPlaceholder='Поиск сотрудника'
            searchable
            disabled={isLoading}
            isLoading={isLoading}
          />
        </Field>

        <Field label='Задачи'>
          <MultiSelect
            values={selectedTaskIds}
            onValuesChange={onTaskIdsChange}
            options={taskOptions}
            placeholder={
              selectedProjectIds.length === 0 ? 'Выберите проект(ы)' : 'Все задачи'
            }
            emptyText='Задачи не найдены'
            searchPlaceholder='Поиск задачи'
            searchable
            disabled={isTaskSelectDisabled}
            isLoading={isLoading}
          />
        </Field>

        <Field label='Клиенты'>
          <MultiSelect
            values={selectedClientIds}
            onValuesChange={onClientIdsChange}
            options={clientOptions}
            placeholder='Все клиенты'
            emptyText='Клиенты не найдены'
            searchPlaceholder='Поиск клиента'
            searchable
            disabled={isLoading}
            isLoading={isLoading}
          />
        </Field>
      </div>
      <div className='grid min-w-0 gap-3 xl:grid-cols-4 xl:items-end'>
        <div className='relative min-w-0 xl:col-span-2' ref={datePickerContainerRef}>
          <div className='grid grid-cols-2 gap-2 sm:gap-3'>
            <Field label='Период: от'>
              <button
                type='button'
                className={`${inputBaseClasses} text-left`}
                onClick={toggleDatePicker}
              >
                {hasRange ? formatDateForDisplay(periodFrom) : 'дд.мм.гггг'}
              </button>
            </Field>
            <Field label='Период: до'>
              <button
                type='button'
                className={`${inputBaseClasses} text-left`}
                onClick={toggleDatePicker}
              >
                {hasRange ? formatDateForDisplay(periodTo) : 'дд.мм.гггг'}
              </button>
            </Field>
          </div>

          {isDatePickerOpen && datePickerPosition
            ? createPortal(
                <div
                  ref={datePickerPopupRef}
                  style={datePickerPosition}
                  className='fixed z-[100] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 md:rounded-lg'
                >
                  <DateRangePicker
                    className='reports-date-range'
                    ranges={[selectedRange]}
                    onChange={(ranges: RangeKeyDict) => {
                      const nextRange = ranges.selection;
                      const startDate = nextRange.startDate ?? selectedRange.startDate;
                      const endDate = nextRange.endDate ?? selectedRange.endDate;
                      if (!startDate || !endDate) return;
                      onPeriodChange(
                        formatDateForInput(startDate),
                        formatDateForInput(endDate),
                      );
                    }}
                    staticRanges={staticRanges}
                    inputRanges={[]}
                    months={2}
                    direction='horizontal'
                    showMonthAndYearPickers
                    weekStartsOn={1}
                    locale={ru}
                    weekdayDisplayFormat='EEEEEE'
                    rangeColors={['#2563eb']}
                  />
                  <div className='sticky bottom-0 border-t border-slate-200 bg-white p-2 md:hidden'>
                    <Button
                      type='button'
                      className='w-full'
                      onClick={() => setIsDatePickerOpen(false)}
                    >
                      Готово
                    </Button>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>

        <div className='grid min-w-0 gap-3 xl:col-span-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end'>
          <Field label='Опции отображения'>
            <MultiSelect
              values={selectedDisplayOptionKeys}
              onValuesChange={(nextValues) => {
                const selectedSet = new Set(nextValues);
                onDisplayOptionsChange({
                  showEmployees: selectedSet.has('showEmployees'),
                  showProjects: selectedSet.has('showProjects'),
                  showTaskStatus: selectedSet.has('showTaskStatus'),
                  showUpdatedAt: selectedSet.has('showUpdatedAt'),
                  showRemainingTime: selectedSet.has('showRemainingTime'),
                });
              }}
              options={displayItems.map((item) => ({
                value: item.key,
                label: item.label,
              }))}
              placeholder='Выберите опции отображения'
              emptyText='Нет доступных опций'
              className='h-10'
            />
          </Field>

          <div className='grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 xl:self-end'>
            <Button
              type='button'
              variant='secondary'
              className='w-full sm:w-auto'
              onClick={onExportCsv}
            >
              <span className='sm:whitespace-nowrap'>Сохранить в CSV</span>
            </Button>
            <Button
              type='button'
              variant='secondary'
              className='w-full sm:w-auto'
              onClick={onExportXlsx}
            >
              <span className='sm:whitespace-nowrap'>Сохранить в XLSX</span>
            </Button>
            <Button
              type='button'
              className='col-span-2 w-full sm:w-auto'
              onClick={onPrint}
            >
              <span className='sm:whitespace-nowrap'>Печать</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
