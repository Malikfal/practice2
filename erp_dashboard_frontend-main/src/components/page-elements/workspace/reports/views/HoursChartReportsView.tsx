import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import { useAppControllerContext } from '../../../../../context/AppControllerContext';
import { createInitialReportForm } from '../../../../../hooks/formFactories';
import type {
  HoursChartGroupBy,
  HoursChartReportResponse,
  ReportForm,
} from '../../../../../types/app';
import Preloader from '../../../../ui/Preloader';
import { Field, MultiSelect } from '../../../../ui/FormField';
import HoursChart from '../hours-chart/HoursChart';
import HoursChartTable from '../hours-chart/HoursChartTable';
import {
  HOURS_CHART_GROUP_OPTIONS,
  toHoursChartPoints,
} from '../hours-chart/hoursChartUtils';
import { formatInputDate } from '../manager-report/managerReportUtils';
import ReportsFilters from '../ReportsFilters';
import { formatReportTime } from '../ReportsTable';
import { useReportFilterOptions } from '../useReportFilterOptions';

const EMPTY_FILTER: string[] = [];

/** По умолчанию — все проекты за текущий месяц. */
function createInitialForm(): ReportForm {
  const today = new Date();
  return {
    ...createInitialReportForm(),
    from: formatInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

export default function HoursChartReportsView() {
  const { user } = useAppControllerContext();
  const isWorker = user?.role === 'WORKER';
  const [reportForm, setReportForm] = useState(createInitialForm);
  const [groupBy, setGroupBy] = useState<HoursChartGroupBy>('day');
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [report, setReport] = useState<HoursChartReportResponse | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const effectiveUserIds = useMemo(
    () => (isWorker ? (user?.id ? [user.id] : []) : reportForm.user_ids),
    [isWorker, reportForm.user_ids, user?.id],
  );
  const effectiveManagerIds = isWorker ? EMPTY_FILTER : reportForm.manager_ids;

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  const { employees, projects, tasks, isLoadingProjectsAndEmployees, isLoadingTasks } =
    useReportFilterOptions({
      enabled: Boolean(user),
      isWorker,
      projectIds: EMPTY_FILTER,
      onError: handleError,
    });

  // Клиенты берутся из проектов: в фильтре только те, у кого есть проекты.
  const clientOptions = useMemo(() => {
    const clients = new Map<string, string>();
    projects.forEach((project) => {
      if (project.client?.id) clients.set(project.client.id, project.client.name);
    });
    return Array.from(clients, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, 'ru'),
    );
  }, [projects]);

  // Фильтры применяются сразу, поэтому ответ устаревшего запроса отбрасывается.
  const requestIdRef = useRef(0);
  const loadReport = useCallback(
    async (showSuccessToast: boolean) => {
      if (!user) return;

      const requestId = ++requestIdRef.current;
      try {
        setIsLoadingReport(true);
        const data = await api.workspace.reports.getHoursChart({
          from: reportForm.from,
          to: reportForm.to,
          group_by: groupBy,
          project_ids: reportForm.project_ids,
          project_kinds: reportForm.project_kinds,
          user_ids: effectiveUserIds,
          manager_ids: effectiveManagerIds,
          client_ids: clientIds,
        });
        if (requestId !== requestIdRef.current) return;
        setReport(data);

        if (showSuccessToast) {
          toast.success('Отчёт сформирован.');
        }
      } catch (err) {
        if (requestId === requestIdRef.current) handleError(err);
      } finally {
        if (requestId === requestIdRef.current) setIsLoadingReport(false);
      }
    },
    [
      clientIds,
      effectiveManagerIds,
      effectiveUserIds,
      groupBy,
      handleError,
      reportForm.from,
      reportForm.project_ids,
      reportForm.project_kinds,
      reportForm.to,
      user,
    ],
  );

  // Период применяется по кнопке, остальные фильтры и группировка — сразу, как в отчёте по времени.
  const loadReportRef = useRef(loadReport);
  useEffect(() => {
    loadReportRef.current = loadReport;
  }, [loadReport]);

  const hasUser = Boolean(user);
  const filtersKey = [
    [groupBy],
    reportForm.project_ids,
    reportForm.project_kinds,
    effectiveUserIds,
    effectiveManagerIds,
    clientIds,
  ]
    .map((values) => values.join('|'))
    .join('#');

  useEffect(() => {
    if (!hasUser) return;

    void loadReportRef.current(false);
  }, [filtersKey, hasUser]);

  const points = useMemo(
    () => (report ? toHoursChartPoints(report.rows, formatInputDate(new Date())) : []),
    [report],
  );
  const reportGroupBy = report?.group_by ?? groupBy;

  return (
    <section className='h-full overflow-auto rounded-xl border border-slate-200 bg-white p-3'>
      <h2 className='text-base font-semibold text-slate-800'>
        Графический отчёт по часам
      </h2>
      <p className='mt-1 mb-3 text-xs text-slate-500'>
        Выработка в часах одной линией по всему выбранному. Часы считаются так же, как в
        отчёте по времени.
      </p>
      <ReportsFilters
        reportForm={reportForm}
        employees={employees}
        projects={projects}
        tasks={tasks}
        isLoadingReport={isLoadingReport}
        isLoadingProjectsAndEmployees={isLoadingProjectsAndEmployees}
        isLoadingTasks={isLoadingTasks}
        onReportFormChange={setReportForm}
        canSelectEmployee={!isWorker}
        isWorker={isWorker}
        showTasks={false}
        groupBy={{
          value: groupBy,
          options: HOURS_CHART_GROUP_OPTIONS,
          onChange: (value) => setGroupBy(value as HoursChartGroupBy),
        }}
        extraFilter={
          <Field label='Клиенты' className='min-w-0'>
            <MultiSelect
              values={clientIds}
              onValuesChange={setClientIds}
              options={clientOptions}
              placeholder='Все клиенты'
              emptyText='Нет клиентов с проектами'
              searchable
              searchPlaceholder='Поиск клиентов...'
              disabled={isLoadingProjectsAndEmployees}
              isLoading={isLoadingProjectsAndEmployees}
            />
          </Field>
        }
        onSubmit={(event) => {
          event.preventDefault();
          void loadReport(true);
        }}
      />

      {!report ? (
        <div className='mt-3 flex justify-center rounded-xl border border-[#e3e9f3] p-10'>
          {isLoadingReport ? <Preloader color='slate' /> : null}
        </div>
      ) : (
        <div
          className={`mt-3 grid gap-3 transition-opacity ${isLoadingReport ? 'opacity-60' : ''}`}
          aria-busy={isLoadingReport}
        >
          <article className='grid gap-2 rounded-xl border border-[#e3e9f3] p-3'>
            <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs'>
              <span className='font-semibold text-[#53617c]'>Часы</span>
              <span className='text-[#7e8fb4]'>
                Всего{' '}
                <span className='font-semibold text-[#1f3565] tabular-nums'>
                  {formatReportTime(report.total_seconds)}
                </span>
              </span>
            </div>
            {report.total_seconds === 0 ? (
              <p className='py-10 text-center text-sm text-[#7e8fb4]'>
                За выбранный период по этим фильтрам нет учтённого времени.
              </p>
            ) : (
              <HoursChart points={points} groupBy={reportGroupBy} />
            )}
          </article>

          {report.total_seconds > 0 ? (
            <HoursChartTable
              points={points}
              groupBy={reportGroupBy}
              totalSeconds={report.total_seconds}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
