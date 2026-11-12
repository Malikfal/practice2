import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import DateRangeFields from '../../../../ui/DateRangeFields';
import { Field, MultiSelect, labelBaseClasses } from '../../../../ui/FormField';
import type {
  ManagerReportFilters,
  ManagerReportPayload,
} from '../../../../../types/managerReport';
import ManagerReportCharts from '../manager-report/ManagerReportCharts';
import ManagerReportTable from '../manager-report/ManagerReportTable';
import {
  createManagerReportFilters,
  defaultManagerReportSort,
  formatReportDate,
  managerReportGranularityOptions,
  sortManagerReportRows,
  type ManagerReportSort,
} from '../manager-report/managerReportUtils';

const VIEW_OPTIONS: Array<{ value: 'table' | 'charts'; label: string }> = [
  { value: 'table', label: 'Табличное' },
  { value: 'charts', label: 'Графическое' },
];

export default function ManagerReportsView() {
  const [filters, setFilters] = useState<ManagerReportFilters>(
    createManagerReportFilters,
  );
  const [report, setReport] = useState<ManagerReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState<ManagerReportSort>(defaultManagerReportSort);
  const [view, setView] = useState<'table' | 'charts'>('table');
  const requestIdRef = useRef(0);

  // Отчёт динамический: перестраивается при любом изменении фильтров, устаревшие ответы отбрасываются.
  const loadReport = useCallback(async (nextFilters: ManagerReportFilters) => {
    if (!nextFilters.from || !nextFilters.to) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const data = await api.workspace.reports.getManagers(nextFilters);
      if (requestId === requestIdRef.current) setReport(data);
    } catch (err) {
      if (requestId === requestIdRef.current) {
        toast.error(err instanceof Error ? err.message : 'Не удалось построить отчёт.');
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(filters);
  }, [filters, loadReport]);

  const managerOptions = useMemo(
    () =>
      (report?.manager_options ?? []).map((manager) => ({
        value: manager.id,
        label: manager.name,
      })),
    [report?.manager_options],
  );
  const canViewFinance = report?.can_view_finance ?? false;
  // Карточки графиков идут в порядке сортировки таблицы.
  const sortedManagers = useMemo(
    () => sortManagerReportRows(report?.managers ?? [], sort, (row) => row.manager.name),
    [report?.managers, sort],
  );
  const isRangeExtended =
    report !== null && (report.from !== filters.from || report.to !== filters.to);

  return (
    <section className='grid h-full content-start gap-3 overflow-auto rounded-xl border border-slate-200 bg-white p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
          <h2 className='text-base font-semibold text-slate-800'>Отчёт по менеджерам</h2>
          {report?.collected_at ? (
            <span className='text-xs text-[#7e8fb4]'>
              Статистика обновлена {new Date(report.collected_at).toLocaleString('ru-RU')}
            </span>
          ) : null}
        </div>
        <div
          className='flex overflow-hidden rounded-lg border border-[#d3dcec] bg-white'
          role='group'
          aria-label='Представление'
        >
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type='button'
              aria-pressed={view === option.value}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === option.value
                  ? 'bg-[#2d6ff7] text-white'
                  : 'text-[#53617c] hover:bg-[#eef3fc]'
              }`}
              onClick={() => setView(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className='grid gap-3 xl:grid-cols-[minmax(260px,1fr)_minmax(280px,auto)_minmax(220px,1fr)] xl:items-end'>
        <DateRangeFields
          from={filters.from}
          to={filters.to}
          required
          commitCompleteRange
          onChange={(from, to) => setFilters((current) => ({ ...current, from, to }))}
        />
        {/* Не Field: label переключал бы первую кнопку при клике по свободному месту. */}
        <div className={labelBaseClasses} role='group' aria-label='Группировка'>
          <span className='text-[13px] leading-tight font-medium text-slate-700'>
            Группировка
          </span>
          <div className='flex h-11 overflow-hidden rounded-lg border border-[#d3dcec] bg-white'>
            {managerReportGranularityOptions.map((option) => (
              <button
                key={option.value}
                type='button'
                aria-pressed={filters.granularity === option.value}
                className={`flex-1 px-3 text-xs font-semibold transition-colors ${
                  filters.granularity === option.value
                    ? 'bg-[#2d6ff7] text-white'
                    : 'text-[#53617c] hover:bg-[#eef3fc]'
                }`}
                onClick={() =>
                  setFilters((current) => ({ ...current, granularity: option.value }))
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <Field label='Менеджеры'>
          <MultiSelect
            values={filters.manager_ids}
            onValuesChange={(manager_ids) =>
              setFilters((current) => ({ ...current, manager_ids }))
            }
            options={managerOptions}
            placeholder='Все менеджеры'
            emptyText='Статистика по менеджерам еще не собрана'
            searchable
            searchPlaceholder='Поиск менеджеров...'
            isLoading={isLoading && report === null}
          />
        </Field>
      </div>

      {isRangeExtended && report ? (
        <p className='text-xs text-[#7e8fb4]'>
          Статистика собирается по неделям, поэтому период расширен до{' '}
          {formatReportDate(report.from)} - {formatReportDate(report.to)}.
        </p>
      ) : null}

      {report === null ? (
        <div className='py-12 text-center text-sm text-[#7e8fb4]'>
          {isLoading ? 'Построение отчёта...' : 'Нет данных'}
        </div>
      ) : (
        <div className={`grid gap-3 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          {view === 'table' ? (
            <ManagerReportTable
              managers={sortedManagers}
              summary={report.summary}
              canViewFinance={canViewFinance}
              sort={sort}
              onSortChange={setSort}
            />
          ) : (
            <ManagerReportCharts
              managers={sortedManagers}
              company={report.company}
              buckets={report.buckets}
              granularity={report.granularity}
              canViewFinance={canViewFinance}
            />
          )}
        </div>
      )}
    </section>
  );
}
