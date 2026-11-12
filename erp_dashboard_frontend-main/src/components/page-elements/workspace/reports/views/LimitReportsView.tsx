import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import LimitReportsTable from '../LimitReportsTable';
import ReportsFilters from '../ReportsFilters';
import { formatDaysCount } from '../ReportsTable';
import { useReportFilterOptions } from '../useReportFilterOptions';
import { useAppControllerContext } from '../../../../../context/AppControllerContext';
import { createInitialReportForm } from '../../../../../hooks/formFactories';
import type { LimitReportGroupBy, LimitReportResponse } from '../../../../../types/app';

const EMPTY_FILTER: string[] = [];
const GROUP_BY_OPTIONS: Array<{ value: LimitReportGroupBy; label: string }> = [
  { value: 'project', label: 'По проектам' },
  { value: 'client', label: 'По клиентам' },
];

export default function LimitReportsView() {
  const { user } = useAppControllerContext();
  const isWorker = user?.role === 'WORKER';
  const [reportForm, setReportForm] = useState(createInitialReportForm);
  const [groupBy, setGroupBy] = useState<LimitReportGroupBy>('project');
  const [report, setReport] = useState<LimitReportResponse | null>(null);
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
      projectIds: reportForm.project_ids,
      onError: handleError,
    });

  // Фильтры применяются сразу, поэтому ответ устаревшего запроса отбрасывается.
  const requestIdRef = useRef(0);
  const loadReport = useCallback(
    async (showSuccessToast: boolean) => {
      if (!user) return;

      const requestId = ++requestIdRef.current;
      try {
        setIsLoadingReport(true);
        const data = await api.workspace.reports.getLimits({
          from: reportForm.from,
          to: reportForm.to,
          group_by: groupBy,
          project_ids: reportForm.project_ids,
          project_kinds: reportForm.project_kinds,
          task_ids: reportForm.task_ids,
          user_ids: effectiveUserIds,
          manager_ids: effectiveManagerIds,
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
      effectiveManagerIds,
      effectiveUserIds,
      groupBy,
      handleError,
      reportForm.from,
      reportForm.project_ids,
      reportForm.project_kinds,
      reportForm.task_ids,
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
    reportForm.task_ids,
    effectiveUserIds,
    effectiveManagerIds,
  ]
    .map((values) => values.join('|'))
    .join('#');

  useEffect(() => {
    if (!hasUser) return;

    void loadReportRef.current(false);
  }, [filtersKey, hasUser]);

  // Сотрудник у работника подставлен принудительно, это не его фильтр.
  const hasFilters =
    reportForm.project_ids.length > 0 ||
    reportForm.project_kinds.length > 0 ||
    reportForm.task_ids.length > 0 ||
    (!isWorker && reportForm.user_ids.length > 0) ||
    effectiveManagerIds.length > 0;

  return (
    <section className='h-full overflow-auto rounded-xl border border-slate-200 bg-white p-3'>
      <h2 className='text-base font-semibold text-slate-800'>Лимитные проекты</h2>
      <p className='mt-1 mb-3 text-xs text-slate-500'>
        Проекты с недельным лимитом у проекта или у клиента.{' '}
        {report
          ? `Лимит пересчитан на ${formatDaysCount(report.period_days)} периода.`
          : 'Лимит пересчитан на дни выбранного периода.'}{' '}
        Лимит клиента общий на все его проекты и главнее лимита проекта.
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
        groupBy={{
          value: groupBy,
          options: GROUP_BY_OPTIONS,
          onChange: (value) => setGroupBy(value as LimitReportGroupBy),
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void loadReport(true);
        }}
      />

      <LimitReportsTable
        report={report}
        isLoading={isLoadingReport}
        hasFilters={hasFilters}
      />
    </section>
  );
}
