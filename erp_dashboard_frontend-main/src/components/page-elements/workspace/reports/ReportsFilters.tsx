import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DateRangePicker } from 'react-date-range';
import type { Range } from 'react-date-range';

import Button from '../../../ui/Button';
import { Field, MultiSelect, Select, inputBaseClasses } from '../../../ui/FormField';
import {
  createDateRangePresets,
  toStaticRanges,
} from '../../../../utils/dateRangePresets';
import { formatName } from '../../../../utils/formatters';
import type {
  Project,
  ReportForm,
  ReportGroupBy,
  ReportProjectKind,
  Task,
  User,
} from '../../../../types/app';

// Типы проектов живут в том же списке, что и проекты, под значениями с префиксом.
const PROJECT_KIND_PREFIX = 'kind:';
const PROJECT_KIND_OPTIONS: Array<{ kind: ReportProjectKind; label: string }> = [
  { kind: 'commercial', label: 'Коммерческие проекты' },
  { kind: 'internal', label: 'Внутренние проекты' },
];

type Props = {
  reportForm: ReportForm;
  employees: User[];
  projects: Project[];
  tasks: Task[];
  isLoadingReport: boolean;
  isLoadingProjectsAndEmployees: boolean;
  isLoadingTasks: boolean;
  onReportFormChange: (_next: ReportForm) => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  canSelectEmployee?: boolean;
  isWorker?: boolean;
  showGroupBy?: boolean;
  // Отчёты-снимки на сегодня (например, «Задачи без движения») скрывают период.
  showPeriod?: boolean;
  // Отчёты по проектам целиком (например, графический по часам) обходятся без выбора задач.
  showTasks?: boolean;
  // Дополнительный фильтр отчёта, встаёт последним в ряд фильтров.
  extraFilter?: ReactNode;
  // Своя группировка отчёта вместо группировок отчёта по времени (например, «По клиентам»).
  groupBy?: {
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (_value: string) => void;
  };
};

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value: string): string {
  const parsed = parseInputDate(value);
  if (!parsed) return value;
  return format(parsed, 'dd.MM.yyyy', { locale: ru });
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function ReportsFilters({
  reportForm,
  employees,
  projects,
  tasks,
  isLoadingReport,
  isLoadingProjectsAndEmployees,
  isLoadingTasks,
  onReportFormChange,
  onSubmit,
  canSelectEmployee = true,
  isWorker = false,
  showGroupBy = true,
  showPeriod = true,
  showTasks = true,
  extraFilter,
  groupBy,
}: Props) {
  const isTaskSelectDisabled =
    isLoadingProjectsAndEmployees || reportForm.project_ids.length === 0;
  const isTasksLoadingOrUnavailable = isTaskSelectDisabled || isLoadingTasks;
  const projectOptions = useMemo(
    () => [
      ...PROJECT_KIND_OPTIONS.map(({ kind, label }) => ({
        value: `${PROJECT_KIND_PREFIX}${kind}`,
        label,
        group: 'Тип проекта',
      })),
      ...projects.map((project) => ({
        value: project.id,
        label: project.name,
        group: 'Проекты',
      })),
    ],
    [projects],
  );
  const projectSelectValues = useMemo(
    () => [
      ...reportForm.project_kinds.map((kind) => `${PROJECT_KIND_PREFIX}${kind}`),
      ...reportForm.project_ids,
    ],
    [reportForm.project_ids, reportForm.project_kinds],
  );
  const managerOptions = useMemo(() => {
    const managers = new Map<string, string>();

    projects.forEach((project) => {
      project.members?.forEach((member) => {
        if (member.is_pm && member.user?.id) {
          managers.set(member.user.id, formatName(member.user));
        }
      });
    });

    // Фильтр берёт текущих руководителей проектов, заголовок группы говорит об этом прямо.
    return Array.from(managers, ([value, label]) => ({
      value,
      label,
      group: 'Текущие руководители проектов',
    })).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [projects]);
  const taskOptions = useMemo(
    () =>
      tasks
        .filter((task) => !task.is_draft)
        .map((task) => ({ value: task.id, label: task.title })),
    [tasks],
  );
  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: formatName(employee),
      })),
    [employees],
  );

  const datePickerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const hasRange = Boolean(reportForm.from && reportForm.to);
  const selectedRange = useMemo<Range>(() => {
    const now = new Date();
    const startDate = parseInputDate(reportForm.from) ?? now;
    const endDate = parseInputDate(reportForm.to) ?? startDate;

    return {
      startDate,
      endDate,
      key: 'selection',
    };
  }, [reportForm.from, reportForm.to]);

  const staticRanges = useMemo(() => toStaticRanges(createDateRangePresets()), []);

  useEffect(() => {
    if (!isDatePickerOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerContainerRef.current &&
        !datePickerContainerRef.current.contains(event.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDatePickerOpen]);

  // Пять фильтров не помещаются в одну строку с периодом до 2xl: период уходит под них.
  const periodLayoutClasses = canSelectEmployee
    ? {
        row: 'xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end 2xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)_auto]',
        filters: `md:grid-cols-3 xl:col-span-2 2xl:col-span-1 ${showGroupBy ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`,
        period: '2xl:border-l 2xl:border-slate-200 2xl:pl-4',
      }
    : {
        row: 'xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_auto] xl:items-end',
        filters: showGroupBy ? 'md:grid-cols-3' : 'md:grid-cols-2',
        period: 'xl:border-l xl:border-slate-200 xl:pl-4',
      };
  // Без периода фильтры занимают весь ряд перед кнопкой.
  const filterCount =
    (showGroupBy ? 1 : 0) +
    (canSelectEmployee ? 3 : 1) +
    (showTasks ? 1 : 0) +
    (extraFilter ? 1 : 0);
  const layoutClasses = showPeriod
    ? periodLayoutClasses
    : {
        row: 'xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end',
        filters:
          filterCount >= 5
            ? 'md:grid-cols-3 xl:grid-cols-5'
            : filterCount === 4
              ? 'md:grid-cols-2 xl:grid-cols-4'
              : filterCount === 3
                ? 'md:grid-cols-3'
                : 'md:grid-cols-2',
        period: 'hidden',
      };

  return (
    <form onSubmit={onSubmit} className='grid gap-3'>
      <div className={`grid gap-3 ${layoutClasses.row}`}>
        <div className={`grid min-w-0 gap-3 ${layoutClasses.filters}`}>
          {showGroupBy && groupBy ? (
            <Field label='Группировка' className='min-w-0'>
              <Select
                value={groupBy.value}
                onChange={(e) => groupBy.onChange(e.target.value)}
              >
                {groupBy.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : showGroupBy ? (
            <Field label='Группировка' className='min-w-0'>
              <Select
                value={reportForm.group_by}
                onChange={(e) =>
                  onReportFormChange({
                    ...reportForm,
                    group_by: e.target.value as ReportGroupBy,
                  })
                }
              >
                <option value='day'>По дням</option>
                <option value='task'>По задачам</option>
                <option value='project'>По проектам</option>
                {!isWorker ? <option value='employee'>По сотрудникам</option> : null}
              </Select>
            </Field>
          ) : null}
          <Field label='Проекты' className='min-w-0'>
            <MultiSelect
              values={projectSelectValues}
              onValuesChange={(values) => {
                const projectKinds = values
                  .filter((value) => value.startsWith(PROJECT_KIND_PREFIX))
                  .map(
                    (value) =>
                      value.slice(PROJECT_KIND_PREFIX.length) as ReportProjectKind,
                  );
                const projectIds = values.filter(
                  (value) => !value.startsWith(PROJECT_KIND_PREFIX),
                );
                const projectIdsChanged =
                  projectIds.join('|') !== reportForm.project_ids.join('|');

                onReportFormChange({
                  ...reportForm,
                  project_ids: projectIdsChanged ? projectIds : reportForm.project_ids,
                  project_kinds: projectKinds,
                  task_ids: projectIdsChanged ? [] : reportForm.task_ids,
                });
              }}
              options={projectOptions}
              placeholder='Все проекты'
              emptyText='Нет доступных проектов'
              searchable
              searchPlaceholder='Поиск проектов...'
              disabled={isLoadingProjectsAndEmployees}
              isLoading={isLoadingProjectsAndEmployees}
            />
          </Field>
          {canSelectEmployee ? (
            <Field label='Руководители' className='min-w-0'>
              <MultiSelect
                values={reportForm.manager_ids}
                onValuesChange={(managerIds) =>
                  onReportFormChange({
                    ...reportForm,
                    manager_ids: managerIds,
                  })
                }
                options={managerOptions}
                placeholder='Все руководители'
                emptyText='Нет руководителей проектов'
                searchable
                searchPlaceholder='Поиск руководителей...'
                disabled={isLoadingProjectsAndEmployees}
                isLoading={isLoadingProjectsAndEmployees}
              />
            </Field>
          ) : null}
          {showTasks ? (
            <Field label='Задачи' className='min-w-0'>
              <MultiSelect
                values={reportForm.task_ids}
                onValuesChange={(taskIds) =>
                  onReportFormChange({
                    ...reportForm,
                    task_ids: taskIds,
                  })
                }
                options={taskOptions}
                placeholder={
                  reportForm.project_ids.length === 0
                    ? 'Выберите проект(ы)'
                    : 'Все задачи'
                }
                emptyText={
                  isWorker
                    ? 'Нет назначенных вам задач в выбранных проектах'
                    : 'Нет задач в выбранных проектах'
                }
                searchable
                searchPlaceholder='Поиск задач...'
                disabled={isTasksLoadingOrUnavailable}
                isLoading={isLoadingTasks}
              />
            </Field>
          ) : null}
          {canSelectEmployee ? (
            <Field label='Сотрудники' className='min-w-0'>
              <MultiSelect
                values={reportForm.user_ids}
                onValuesChange={(userIds) =>
                  onReportFormChange({
                    ...reportForm,
                    user_ids: userIds,
                  })
                }
                options={employeeOptions}
                placeholder='Все сотрудники'
                emptyText='Нет доступных сотрудников'
                searchable
                searchPlaceholder='Поиск сотрудников...'
                disabled={isLoadingProjectsAndEmployees}
                isLoading={isLoadingProjectsAndEmployees}
              />
            </Field>
          ) : null}
          {extraFilter}
        </div>

        <div
          className={`relative grid gap-3 ${layoutClasses.period}`}
          ref={datePickerContainerRef}
        >
          <div className='grid gap-3 md:grid-cols-2'>
            <Field label='Период: от'>
              <button
                type='button'
                className={`${inputBaseClasses} text-left`}
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
              >
                {hasRange ? formatDateForDisplay(reportForm.from) : 'дд.мм.гггг'}
              </button>
            </Field>
            <Field label='Период: до'>
              <button
                type='button'
                className={`${inputBaseClasses} text-left`}
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
              >
                {hasRange ? formatDateForDisplay(reportForm.to) : 'дд.мм.гггг'}
              </button>
            </Field>
          </div>

          {isDatePickerOpen ? (
            <div className='absolute top-[calc(100%+8px)] right-0 left-0 z-50 max-w-[calc(100vw-1rem)] overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10 md:left-auto'>
              <DateRangePicker
                className='reports-date-range'
                ranges={[selectedRange]}
                onChange={(ranges) => {
                  const nextRange = ranges.selection;
                  const startDate = nextRange.startDate ?? selectedRange.startDate;
                  const endDate = nextRange.endDate ?? selectedRange.endDate;

                  if (!startDate || !endDate) return;

                  onReportFormChange({
                    ...reportForm,
                    from: formatDateForInput(startDate),
                    to: formatDateForInput(endDate),
                  });
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
              {/* На телефоне календарь перекрывает кнопку отчёта, нужен явный способ закрыть. */}
              <div className='sticky bottom-0 border-t border-slate-200 bg-white p-2 md:hidden'>
                <Button
                  type='button'
                  size='sm'
                  className='w-full'
                  onClick={() => setIsDatePickerOpen(false)}
                >
                  Готово
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <Button
          type='submit'
          className='xl:whitespace-nowrap'
          disabled={isLoadingReport || (showPeriod && !hasRange)}
          variant={isLoadingReport ? 'secondary' : 'primary'}
        >
          {isLoadingReport ? 'Построение отчёта...' : 'Построить отчёт'}
        </Button>
      </div>
    </form>
  );
}
