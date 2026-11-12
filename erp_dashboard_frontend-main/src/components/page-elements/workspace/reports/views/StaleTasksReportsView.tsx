import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import ReportsFilters from '../ReportsFilters';
import StaleTasksReportsTable from '../StaleTasksReportsTable';
import { useReportFilterOptions } from '../useReportFilterOptions';
import { useReportTaskModal } from '../useReportTaskModal';
import { Field, MultiSelect } from '../../../../ui/FormField';
import { useAppControllerContext } from '../../../../../context/AppControllerContext';
import { createInitialReportForm } from '../../../../../hooks/formFactories';
import type { StaleTasksReportResponse } from '../../../../../types/app';

const EMPTY_FILTER: string[] = [];
const DEFAULT_THRESHOLD_DAYS = 3;

export default function StaleTasksReportsView() {
  const { user } = useAppControllerContext();
  const isWorker = user?.role === 'WORKER';
  // Период из общей формы этот отчёт не использует: он показывает состояние на сегодня.
  const [reportForm, setReportForm] = useState(createInitialReportForm);
  const [statusNames, setStatusNames] = useState<string[]>([]);
  const [report, setReport] = useState<StaleTasksReportResponse | null>(null);
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
        const data = await api.workspace.reports.getStaleTasks({
          project_ids: reportForm.project_ids,
          project_kinds: reportForm.project_kinds,
          task_ids: reportForm.task_ids,
          user_ids: effectiveUserIds,
          manager_ids: effectiveManagerIds,
          status_names: statusNames,
        });
        if (requestId !== requestIdRef.current) return;
        setReport(data);

        if (showSuccessToast) {
          toast.success('Отчёт обновлён.');
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
      reportForm.project_ids,
      reportForm.project_kinds,
      reportForm.task_ids,
      statusNames,
      user,
    ],
  );

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
    statusNames,
  ]
    .map((values) => values.join('|'))
    .join('#');

  useEffect(() => {
    if (!hasUser) return;

    void loadReportRef.current(false);
  }, [filtersKey, hasUser]);

  // Выбранные статусы остаются в списке, даже если в ответе их больше нет.
  const statusOptions = useMemo(
    () =>
      Array.from(new Set([...(report?.available_statuses ?? []), ...statusNames])).map(
        (name) => ({ value: name, label: name }),
      ),
    [report?.available_statuses, statusNames],
  );
  const thresholdDays = report?.threshold_days ?? DEFAULT_THRESHOLD_DAYS;
  // Сотрудник у работника подставлен принудительно, это не его фильтр.
  const hasFilters =
    reportForm.project_ids.length > 0 ||
    reportForm.project_kinds.length > 0 ||
    reportForm.task_ids.length > 0 ||
    (!isWorker && reportForm.user_ids.length > 0) ||
    effectiveManagerIds.length > 0 ||
    statusNames.length > 0;

  return (
    <section className='h-full overflow-auto rounded-xl border border-slate-200 bg-white p-3'>
      <h2 className='text-base font-semibold text-slate-800'>Задачи без движения</h2>
      <p className='mt-1 mb-3 text-xs text-slate-500'>
        Задачи активных проектов не в финальном статусе, с которыми {thresholdDays} дня и
        дольше ничего не происходит: их не редактировали, не меняли статус и исполнителей,
        не оставляли комментариев и вложений и не трекали по ним время. Отчёт показывает
        состояние на сегодня, дни считаются по часовому поясу компании.
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
        showPeriod={false}
        extraFilter={
          <Field label='Статусы' className='min-w-0'>
            <MultiSelect
              values={statusNames}
              onValuesChange={setStatusNames}
              options={statusOptions}
              placeholder='Все статусы'
              emptyText='Нет статусов'
              searchable
              searchPlaceholder='Поиск статусов...'
              disabled={report === null && isLoadingReport}
              isLoading={report === null && isLoadingReport}
            />
          </Field>
        }
        onSubmit={(event) => {
          event.preventDefault();
          void loadReport(true);
        }}
      />

      <StaleTasksReportsTable
        rows={report?.rows ?? []}
        spentSeconds={report?.spent_seconds ?? 0}
        isLoading={isLoadingReport}
        thresholdDays={thresholdDays}
        hasFilters={hasFilters}
        onOpenTask={(row) => {
          void openTask(row);
        }}
      />

      {taskModal}
    </section>
  );
}
