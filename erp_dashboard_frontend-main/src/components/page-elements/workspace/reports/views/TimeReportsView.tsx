import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import ReportsFilters from '../ReportsFilters';
import ReportsTable from '../ReportsTable';
import { useReportFilterOptions } from '../useReportFilterOptions';
import { useReportTaskModal } from '../useReportTaskModal';
import { useAppControllerContext } from '../../../../../context/AppControllerContext';
import { createInitialReportForm } from '../../../../../hooks/formFactories';
import type { ReportGroupBy, TimeReportRow } from '../../../../../types/app';

const WORKER_REPORT_GROUPS: ReportGroupBy[] = ['day', 'project', 'task'];
const EMPTY_FILTER: string[] = [];
const serializeFilter = (values: string[]) => values.join('|');

export default function TimeReportsView() {
  const { user } = useAppControllerContext();
  const isWorker = user?.role === 'WORKER';
  const [reportForm, setReportForm] = useState(createInitialReportForm);
  const [reports, setReports] = useState<TimeReportRow[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportOwnSeconds, setReportOwnSeconds] = useState(0);
  const effectiveUserIds = useMemo(
    () => (isWorker ? (user?.id ? [user.id] : []) : reportForm.user_ids),
    [isWorker, reportForm.user_ids, user?.id],
  );
  const effectiveManagerIds = isWorker ? EMPTY_FILTER : reportForm.manager_ids;
  const previousFiltersRef = useRef({
    group_by: reportForm.group_by,
    project_ids: serializeFilter(reportForm.project_ids),
    project_kinds: serializeFilter(reportForm.project_kinds),
    task_ids: serializeFilter(reportForm.task_ids),
    user_ids: serializeFilter(effectiveUserIds),
    manager_ids: serializeFilter(effectiveManagerIds),
  });

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
    async (showSuccessToast = true) => {
      if (!user) return;

      const requestId = ++requestIdRef.current;
      try {
        setIsLoadingReport(true);
        const requestReport = isWorker
          ? api.worker.reports.getTime
          : api.workspace.reports.getTime;
        const data = await requestReport({
          from: reportForm.from,
          to: reportForm.to,
          group_by: reportForm.group_by,
          project_ids: reportForm.project_ids,
          project_kinds: reportForm.project_kinds,
          task_ids: reportForm.task_ids,
          user_ids: effectiveUserIds,
          manager_ids: effectiveManagerIds,
        });
        if (requestId !== requestIdRef.current) return;
        setReports(data.rows);
        setReportOwnSeconds(data.own_seconds);

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
      isWorker,
      reportForm.from,
      reportForm.group_by,
      reportForm.project_ids,
      reportForm.project_kinds,
      reportForm.task_ids,
      reportForm.to,
      user,
    ],
  );

  useEffect(() => {
    const filtersChanged =
      previousFiltersRef.current.group_by !== reportForm.group_by ||
      previousFiltersRef.current.project_ids !==
        serializeFilter(reportForm.project_ids) ||
      previousFiltersRef.current.project_kinds !==
        serializeFilter(reportForm.project_kinds) ||
      previousFiltersRef.current.task_ids !== serializeFilter(reportForm.task_ids) ||
      previousFiltersRef.current.user_ids !== serializeFilter(effectiveUserIds) ||
      previousFiltersRef.current.manager_ids !== serializeFilter(effectiveManagerIds);

    if (!filtersChanged) {
      return;
    }

    previousFiltersRef.current = {
      group_by: reportForm.group_by,
      project_ids: serializeFilter(reportForm.project_ids),
      project_kinds: serializeFilter(reportForm.project_kinds),
      task_ids: serializeFilter(reportForm.task_ids),
      user_ids: serializeFilter(effectiveUserIds),
      manager_ids: serializeFilter(effectiveManagerIds),
    };

    void loadReport(false);
  }, [
    effectiveManagerIds,
    effectiveUserIds,
    loadReport,
    reportForm.group_by,
    reportForm.project_ids,
    reportForm.project_kinds,
    reportForm.task_ids,
  ]);

  useEffect(() => {
    if (!isWorker || !user?.id) return;

    if (reportForm.user_ids.length === 1 && reportForm.user_ids[0] === user.id) {
      return;
    }

    setReportForm((current) => ({
      ...current,
      user_ids: [user.id],
    }));
  }, [isWorker, reportForm.user_ids, user?.id]);

  useEffect(() => {
    if (!isWorker || WORKER_REPORT_GROUPS.includes(reportForm.group_by)) return;

    setReportForm((current) => ({
      ...current,
      group_by: 'day',
    }));
  }, [isWorker, reportForm.group_by]);

  const onLoadReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadReport(true);
  };

  return (
    <section className='h-full overflow-auto rounded-xl border border-slate-200 bg-white p-3'>
      <h2 className='mb-3 text-base font-semibold text-slate-800'>Отчёт по времени</h2>
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
        onSubmit={(event) => {
          event.preventDefault();
          onLoadReport(event);
        }}
      />

      <ReportsTable
        reportFormGroupBy={reportForm.group_by}
        reports={reports}
        reportOwnSeconds={reportOwnSeconds}
        onOpenTask={(row) => {
          void openTask(row);
        }}
      />

      {taskModal}
    </section>
  );
}
