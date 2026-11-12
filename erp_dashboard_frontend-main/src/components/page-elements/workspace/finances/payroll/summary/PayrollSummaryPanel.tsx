import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../../../api/api';
import { ApiRequestError } from '../../../../../../api/core/error';
import type { EmployeePayrollCalculationRow } from '../../../../../../types/app';
import type {
  PayrollSummary,
  PayrollSummaryGroupBy,
  PayrollSummaryPeriod,
  PayrollSummaryQuery,
} from '../../../../../../types/payrollSummary';
import DateRangeFields from '../../../../../ui/DateRangeFields';
import { Field, Input } from '../../../../../ui/FormField';
import { HintToolTip } from '../../../../../ui/HintTooltip';
import { PayrollCalculationDetailsModal } from '../../../employees/EmployeeDetailsPanel/components/payroll/PayrollCalculationDetailsModal';
import {
  formatHours,
  formatMoney,
} from '../../../employees/EmployeeDetailsPanel/components/payroll/payrollUtils';
import { PayoutSpinner } from '../payouts/PayoutParts';

import PayrollSummaryEmployeesTable from './PayrollSummaryEmployeesTable';
import PayrollSummaryPeriodsTable from './PayrollSummaryPeriodsTable';
import {
  employeeName,
  formatRange,
  GROUP_OPTIONS,
  readSummaryQuery,
  writeSummaryQuery,
} from './payrollSummaryUtils';

export type PayrollSummaryMode = 'periods' | 'employees';

type Details = { row: EmployeePayrollCalculationRow; employeeName: string };

// Общая панель вкладок "Расчёт по периодам" и "Расчёт по сотрудникам": одни данные, два разреза.
export default function PayrollSummaryPanel({ mode }: { mode: PayrollSummaryMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = readSummaryQuery(location.search);
  const { from, to, group_by: groupBy = 'week' } = query;
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsLoadingKey, setDetailsLoadingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setSummary(
        await api.workspace.companyPayrollSummary.get({ from, to, group_by: groupBy }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof ApiRequestError && loadError.status === 403
          ? 'У вас нет доступа к расчёту ФОТ.'
          : loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить расчёт ФОТ.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeQuery = (next: PayrollSummaryQuery) => {
    const params = writeSummaryQuery(location.search, { ...query, ...next });
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    if (next.group_by && next.group_by !== groupBy) setExpanded(new Set());
  };

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const topKeys =
    mode === 'periods'
      ? (summary?.groups ?? []).map((group) => group.key)
      : (summary?.employees ?? []).map((employee) => employee.id);
  const allExpanded = topKeys.length > 0 && topKeys.every((key) => expanded.has(key));

  const openDetails = async (employeeId: string, period: PayrollSummaryPeriod) => {
    const key = `${employeeId}:${period.key}`;
    setDetailsLoadingKey(key);
    try {
      const response = await api.workspace.employeePayrollCalculations.getForEmployee(
        employeeId,
        {
          from: period.from,
          to: period.to,
          per_page: 10,
        },
      );
      const row = response.data.find((item) => item.period_from === period.from);
      if (!row) throw new Error('Расчёт за эту неделю не найден.');
      const employee = summary?.employees.find((item) => item.id === employeeId);
      setDetails({ row, employeeName: employee ? employeeName(employee) : '' });
    } catch (detailsError) {
      toast.error(
        detailsError instanceof Error
          ? detailsError.message
          : 'Не удалось открыть расчёт.',
      );
    } finally {
      setDetailsLoadingKey(null);
    }
  };

  if (!summary) {
    return (
      <div className='min-h-0 rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] md:p-4'>
        {isLoading ? (
          <PayoutSpinner />
        ) : (
          <div className='my-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {error}
            <button
              type='button'
              className='font-semibold text-[#2d6ff7] hover:underline'
              onClick={() => void load()}
            >
              Повторить
            </button>
          </div>
        )}
      </div>
    );
  }

  // При поиске во вкладке сотрудников сводка считается по найденным, как итог таблицы.
  const searchQuery = mode === 'employees' ? search.trim().toLocaleLowerCase('ru') : '';
  const found = searchQuery
    ? summary.employees.filter((employee) =>
        employeeName(employee).toLocaleLowerCase('ru').includes(searchQuery),
      )
    : null;
  const stripTotals = found
    ? found.reduce(
        (result, employee) => ({
          own_seconds: result.own_seconds + employee.own_seconds,
          supervised_seconds: result.supervised_seconds + employee.supervised_seconds,
          amount_kopecks: result.amount_kopecks + employee.amount_kopecks,
        }),
        { own_seconds: 0, supervised_seconds: 0, amount_kopecks: 0 },
      )
    : summary.totals;
  const isDefaultPeriod = !from;
  const isExtended =
    summary.from < summary.requested_from || summary.to > summary.requested_to;
  const isCut = summary.to < summary.requested_to;
  const hasPeriods = summary.periods.length > 0;

  return (
    <div className='grid min-w-0 gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] md:p-4'>
      <div className='flex flex-wrap items-end gap-x-3 gap-y-2'>
        <DateRangeFields
          from={from ?? summary.requested_from}
          to={to ?? summary.requested_to}
          fromLabel='Период: с'
          toLabel='по'
          required
          commitCompleteRange
          allTimeFrom={summary.available_from}
          className='w-full sm:w-72 [&_button]:h-9! [&_button]:px-2.5 [&_button]:text-sm'
          onChange={(nextFrom, nextTo) => changeQuery({ from: nextFrom, to: nextTo })}
        />
        <div className='grid gap-1.5'>
          <span className='text-[13px] leading-tight font-medium text-slate-700'>
            Группировка
          </span>
          <div
            className='flex h-9 overflow-hidden rounded-lg border border-[#d7e1f1] bg-white'
            role='group'
            aria-label='Группировка'
          >
            {GROUP_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type='button'
                aria-pressed={groupBy === value}
                className={`border-r border-[#e3e9f3] px-3 text-sm font-semibold last:border-r-0 ${
                  groupBy === value
                    ? 'bg-[#edf3ff] text-[#2d6ff7]'
                    : 'text-[#7e8fb4] hover:text-[#1f3565]'
                }`}
                onClick={() => changeQuery({ group_by: value as PayrollSummaryGroupBy })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {mode === 'employees' ? (
          <Field label='Сотрудник' className='w-full sm:w-56'>
            <Input
              type='search'
              className='h-9! text-sm'
              placeholder='Поиск по имени'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        ) : null}
        {!isDefaultPeriod ? (
          <button
            type='button'
            className='h-9 text-sm font-semibold text-[#2d6ff7] hover:underline'
            onClick={() => changeQuery({ from: undefined, to: undefined })}
          >
            Текущий месяц
          </button>
        ) : null}
      </div>

      <dl className='flex flex-wrap items-end gap-x-7 gap-y-2.5 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3.5 py-3'>
        <div>
          <dt className='text-xs text-[#7e8fb4]'>
            {found ? 'Начислено по найденным' : 'Начислено'}
          </dt>
          <dd className='text-[17px] font-semibold text-[#10275a] tabular-nums'>
            {formatMoney(stripTotals.amount_kopecks)}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-[#7e8fb4]'>Свои часы</dt>
          <dd className='text-[17px] font-semibold text-[#10275a] tabular-nums'>
            {formatHours(stripTotals.own_seconds)}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-[#7e8fb4]'>Под контролем</dt>
          <dd className='text-[17px] font-semibold text-[#10275a] tabular-nums'>
            {formatHours(stripTotals.supervised_seconds)}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-[#7e8fb4]'>Сотрудников</dt>
          <dd className='text-[17px] font-semibold text-[#10275a] tabular-nums'>
            {found
              ? `${found.length} из ${summary.totals.employees_count}`
              : summary.totals.employees_count}
          </dd>
        </div>
        <div className='sm:ml-auto sm:text-right'>
          <dt className='flex items-center gap-1 text-xs text-[#7e8fb4] sm:justify-end'>
            Расчётный период
            <HintToolTip
              content={
                <span className='grid gap-1.5'>
                  <span>
                    Начисления считаются по неделям. Неделя на стыке месяцев делится на
                    две части, поэтому месяц, квартал и год всегда равны сумме своих
                    недель.
                  </span>
                  {isExtended ? (
                    <span>Даты фильтра расширены до целых недель.</span>
                  ) : null}
                  {isCut ? (
                    <span>Недели после текущей ещё не начались и не показываются.</span>
                  ) : null}
                </span>
              }
            />
          </dt>
          <dd className='text-sm font-semibold text-[#10275a] tabular-nums'>
            {hasPeriods ? formatRange(summary.from, summary.to) : 'нет недель'}
            {hasPeriods ? (
              <span className='ml-1.5 font-normal text-[#7e8fb4]'>
                · недель: {summary.totals.periods_count}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {error ? (
        <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      ) : null}

      <div
        className={`relative min-w-0 transition-opacity ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        aria-busy={isLoading}
      >
        {!hasPeriods ? (
          <div className='grid min-h-40 place-items-center rounded-xl border border-dashed border-[#d7e1f1] px-4 text-center text-sm text-[#7e8fb4]'>
            {summary.requested_from > summary.today
              ? 'Выбранный период ещё не начался.'
              : 'За выбранный период расчётов нет.'}
          </div>
        ) : mode === 'periods' ? (
          <PayrollSummaryPeriodsTable
            key={`${summary.from}:${summary.to}:${summary.group_by}`}
            summary={summary}
            expanded={expanded}
            onToggle={toggle}
            loadingKey={detailsLoadingKey}
            onOpenDetails={(employeeId, period) => void openDetails(employeeId, period)}
            allExpanded={allExpanded}
            onToggleAll={() => setExpanded(allExpanded ? new Set() : new Set(topKeys))}
          />
        ) : (
          <PayrollSummaryEmployeesTable
            summary={summary}
            search={search}
            expanded={expanded}
            onToggle={toggle}
            loadingKey={detailsLoadingKey}
            onOpenDetails={(employeeId, period) => void openDetails(employeeId, period)}
            allExpanded={allExpanded}
            onToggleAll={() => setExpanded(allExpanded ? new Set() : new Set(topKeys))}
          />
        )}
        {isLoading ? (
          <div className='absolute inset-x-0 top-16 grid place-items-center'>
            <div className='size-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          </div>
        ) : null}
      </div>

      <PayrollCalculationDetailsModal
        row={details?.row ?? null}
        employeeName={details?.employeeName}
        onClose={() => setDetails(null)}
      />
    </div>
  );
}
