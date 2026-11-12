import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DateRangePicker } from 'react-date-range';
import type { Range } from 'react-date-range';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import {
  createDateRangePresets,
  toStaticRanges,
} from '../../../../utils/dateRangePresets';
import type {
  FinanceAnalyticsGranularity,
  FinanceAnalyticsOverview,
} from '../../../../types/financeAnalytics';
import FinanceAnalyticsOverviewBlock from './FinanceAnalyticsOverview';
import FinanceArticlesDonut from './FinanceArticlesDonut';
import { createCurrentWeekFilters, formatAnalyticsPeriod } from './financeAnalyticsUtils';
import { Field, inputBaseClasses } from '../../../ui/FormField';

const granularityOptions: Array<{ value: FinanceAnalyticsGranularity; label: string }> = [
  { value: 'day', label: 'Дни' },
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
  { value: 'quarter', label: 'Кварталы' },
];

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

type Scope = { project_ids?: string[]; client_ids?: string[] };

export default function ScopedFinancePanel({
  scope,
  refreshKey = 0,
  onPeriodChange,
}: {
  scope: Scope;
  refreshKey?: number;
  onPeriodChange?: (_period: { from: string; to: string }) => void;
}) {
  const initialRange = useMemo(createCurrentWeekFilters, []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [granularity, setGranularity] = useState<FinanceAnalyticsGranularity>('day');
  const [overview, setOverview] = useState<FinanceAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement | null>(null);
  const staticRanges = useMemo(() => toStaticRanges(createDateRangePresets()), []);
  const selectedRange = useMemo<Range>(
    () => ({
      startDate: parseDate(from),
      endDate: parseDate(to),
      key: 'selection',
    }),
    [from, to],
  );
  const periodLabel = useMemo(() => formatAnalyticsPeriod(from, to), [from, to]);

  const projectIdsKey = scope.project_ids?.join(',') ?? '';
  const clientIdsKey = scope.client_ids?.join(',') ?? '';
  const projectIds = useMemo(
    () => (projectIdsKey ? projectIdsKey.split(',') : undefined),
    [projectIdsKey],
  );
  const clientIds = useMemo(
    () => (clientIdsKey ? clientIdsKey.split(',') : undefined),
    [clientIdsKey],
  );

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const close = (event: MouseEvent) => {
      if (!datePickerRef.current?.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isDatePickerOpen]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await api.workspace.financeAnalytics.getOverview({
          from,
          to,
          granularity,
          project_ids: projectIds,
          client_ids: clientIds,
        });
        if (!cancelled) setOverview(data);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Не удалось загрузить финансы.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to, granularity, projectIds, clientIds, refreshKey]);

  return (
    <div className='grid gap-3 text-[#1f3565]'>
      <div className='flex flex-wrap items-end gap-3 rounded-xl border border-[#e3e9f3] bg-white p-4'>
        <div ref={datePickerRef} className='relative grid min-w-65 grid-cols-2 gap-3'>
          <Field label='Период: от'>
            <button
              type='button'
              className={`${inputBaseClasses} text-left`}
              onClick={() => setIsDatePickerOpen((current) => !current)}
            >
              {format(parseDate(from), 'dd.MM.yyyy', { locale: ru })}
            </button>
          </Field>
          <Field label='Период: до'>
            <button
              type='button'
              className={`${inputBaseClasses} text-left`}
              onClick={() => setIsDatePickerOpen((current) => !current)}
            >
              {format(parseDate(to), 'dd.MM.yyyy', { locale: ru })}
            </button>
          </Field>
          {isDatePickerOpen ? (
            <div className='absolute top-[calc(100%+8px)] left-0 z-50 max-w-[calc(100vw-2rem)] overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10'>
              <DateRangePicker
                className='reports-date-range'
                ranges={[selectedRange]}
                onChange={(ranges) => {
                  const range = ranges.selection;
                  if (!range.startDate || !range.endDate) return;
                  const nextFrom = toInputDate(range.startDate);
                  const nextTo = toInputDate(range.endDate);
                  setFrom(nextFrom);
                  setTo(nextTo);
                  onPeriodChange?.({ from: nextFrom, to: nextTo });
                }}
                staticRanges={staticRanges}
                inputRanges={[]}
                months={2}
                direction='horizontal'
                showMonthAndYearPickers
                weekStartsOn={1}
                locale={ru}
                weekdayDisplayFormat='EEEEEE'
                rangeColors={['#2d6ff7']}
              />
            </div>
          ) : null}
        </div>
        <div className='grid gap-1'>
          <span className='text-xs text-[#7e8fb4]'>Группировка</span>
          <div className='flex h-10 overflow-hidden rounded-lg border border-[#d3dcec] bg-white'>
            {granularityOptions.map((option) => (
              <button
                key={option.value}
                type='button'
                className={`px-3 text-xs font-semibold transition-colors ${
                  granularity === option.value
                    ? 'bg-[#2d6ff7] text-white'
                    : 'text-[#53617c] hover:bg-[#eef3fc]'
                }`}
                onClick={() => setGranularity(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && !overview ? (
        <div className='grid min-h-72 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
          Загрузка финансов...
        </div>
      ) : overview ? (
        <>
          <FinanceAnalyticsOverviewBlock data={overview} />
          <div className='grid gap-3 xl:grid-cols-2'>
            <FinanceArticlesDonut
              title='Поступления'
              periodLabel={periodLabel}
              total={overview.summary?.income ?? 0}
              articles={overview.income_articles ?? []}
              tone='income'
            />
            <FinanceArticlesDonut
              title='Расходы'
              periodLabel={periodLabel}
              total={overview.summary?.expenses ?? 0}
              articles={overview.expense_articles ?? []}
              tone='expense'
            />
            {(overview.summary?.company_planned_expenses ?? 0) > 0 ? (
              <FinanceArticlesDonut
                title={
                  overview.summary.planned_expenses_included
                    ? 'Планируемые расходы'
                    : 'План компании (не включён)'
                }
                periodLabel={periodLabel}
                total={overview.summary.company_planned_expenses}
                articles={overview.planned_expense_articles ?? []}
                tone='planned'
              />
            ) : null}
          </div>
        </>
      ) : (
        <div className='grid min-h-72 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
          Данные финансов недоступны
        </div>
      )}
    </div>
  );
}
