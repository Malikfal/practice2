import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import OverrunReportsTable from '../OverrunReportsTable';
import ReportsFilters from '../ReportsFilters';
import { useReportFilterOptions } from '../useReportFilterOptions';
import { useReportTaskModal } from '../useReportTaskModal';
import { useAppControllerContext } from '../../../../../context/AppControllerContext';
import { createInitialReportForm } from '../../../../../hooks/formFactories';
import { formatHoursCompact } from '../../../../../utils/formatters';
import type { OverrunReportResponse } from '../../../../../types/app';

const EMPTY_FILTER: string[] = [];

export default function OverrunReportsView() {
  const { user } = useAppControllerContext();
  const isWorker = user?.role === 'WORKER';
  const canManageSettings = (user?.permissions ?? []).includes('settings.manage');
  const [reportForm, setReportForm] = useState(createInitialReportForm);
  const [report, setReport] = useState<OverrunReportResponse | null>(null);
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
  const { openTask, taskModal } = useReportTaskModal({
    projects,
    isWorker,
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
        const data = await api.workspace.reports.getOverrun({
          from: reportForm.from,
          to: reportForm.to,
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
      handleError,
      reportForm.from,
      reportForm.project_ids,
      reportForm.project_kinds,
      reportForm.task_ids,
      reportForm.to,
      user,
    ],
  );

  // Период применяется по кнопке, остальные фильтры — сразу, как в отчёте по времени.
  const loadReportRef = useRef(loadReport);
  useEffect(() => {
    loadReportRef.current = loadReport;
  }, [loadReport]);

  const hasUser = Boolean(user);
  const filtersKey = [
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

  return (
    <section className='h-full overflow-auto rounded-xl border border-slate-200 bg-white p-3'>
      <h2 className='text-base font-semibold text-slate-800'>Отчёт по перерасходу</h2>
      <p className='mt-1 mb-3 text-xs text-slate-500'>
        Задачи с временем в выбранном периоде, где затрачено больше оценки. Время
        считается за всю задачу. Задачи без оценки попадают в отчёт, если затрачено больше
        допустимого времени
        {report
          ? ` (${formatHoursCompact(report.unestimated_task_limit_seconds)} ч)`
          : null}
        .
        {canManageSettings ? (
          <>
            {' '}
            <Link
              to='/settings/workspace/company'
              className='rounded-sm text-[#2d6ff7] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d6ff7]'
            >
              Изменить
            </Link>
          </>
        ) : null}
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
        showGroupBy={false}
        onSubmit={(event) => {
          event.preventDefault();
          void loadReport(true);
        }}
      />

      <OverrunReportsTable
        rows={report?.rows ?? []}
        spentSeconds={report?.spent_seconds ?? 0}
        unestimatedTaskLimitSeconds={report?.unestimated_task_limit_seconds ?? 0}
        isLoading={isLoadingReport}
        onOpenTask={(row) => {
          void openTask(row);
        }}
      />

      {taskModal}
    </section>
  );
}
