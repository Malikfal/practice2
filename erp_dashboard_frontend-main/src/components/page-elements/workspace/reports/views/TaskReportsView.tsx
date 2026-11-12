import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import ProjectTaskEditorModal from '../../projects/ProjectTasks/ProjectTaskEditorModal';
import { projectTasksStore } from '../../projects/ProjectTasks/projectTasksStore';
import TaskReportsFilters from '../../task-reports/TaskReportsFilters';
import TaskReportsTable from '../../task-reports/TaskReportsTable';
import {
  INITIAL_DISPLAY_OPTIONS,
  buildTaskReportExportHeaders,
  buildTaskReportExportRows,
  buildTaskReportsFileBaseName,
  downloadCsvFile,
  formatDateForInput,
  toCsvLine,
  type DisplayOptions,
  type StatusScope,
  type TaskReportRow,
} from '../../task-reports/taskReportsShared';
import { useAppControllerContext } from '../../../../../context/AppControllerContext';
import { formatName } from '../../../../../utils/formatters';
import { downloadXlsx } from '../../../../../utils/xlsx';
import type { Project, Task, User } from '../../../../../types/app';

export default function TaskReportsView() {
  const { user } = useAppControllerContext();
  const isWorker = user?.role === 'WORKER';
  const userPermissions = user?.permissions ?? [];
  const canCreateUpdateTasks = userPermissions.includes('tasks.create_update');
  const canMoveTasks = userPermissions.includes('tasks.move');
  const canDeleteAnyComment = userPermissions.includes(
    'projects.tabs.tasks.comments.delete_all',
  );
  const canDeleteOwnComment = userPermissions.includes(
    'projects.tabs.tasks.comments.delete_self',
  );
  const canDeleteAnyAttachments = userPermissions.includes(
    'projects.tabs.tasks.attachments.delete_all',
  );
  const canDeleteOwnAttachments = userPermissions.includes(
    'projects.tabs.tasks.attachments.delete_self',
  );
  const currentUserId = user?.id ?? '';

  const [projectScope, setProjectScope] = useState<StatusScope>('all');
  const [taskScope, setTaskScope] = useState<StatusScope>('all');
  const [employeeScope, setEmployeeScope] = useState<StatusScope>('all');
  const [clientScope, setClientScope] = useState<StatusScope>('all');
  const [employees, setEmployees] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskReportRow[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [periodFrom, setPeriodFrom] = useState(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return formatDateForInput(weekAgo);
  });
  const [periodTo, setPeriodTo] = useState(() => formatDateForInput(new Date()));
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(
    INITIAL_DISPLAY_OPTIONS,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [requestedTaskId, setRequestedTaskId] = useState('');
  const allProjectsCacheRef = useRef<Project[] | null>(null);
  const allEmployeesCacheRef = useRef<User[] | null>(null);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadProjectsForScope = async () => {
      try {
        if (projectScope === 'all' && allProjectsCacheRef.current) {
          setProjects(allProjectsCacheRef.current);
          return;
        }
        const response = isWorker
          ? await api.worker.projects.getMany({ status: projectScope, per_page: 1000 })
          : await api.workspace.projects.getMany({
              status: projectScope,
            });
        const nextProjects = Array.isArray(response.data) ? response.data : [];
        setProjects(nextProjects);
        if (projectScope === 'all') {
          allProjectsCacheRef.current = nextProjects;
        }
      } catch (err) {
        setProjects([]);
        handleError(err);
      }
    };

    void loadProjectsForScope();
  }, [handleError, isWorker, projectScope, user]);

  useEffect(() => {
    if (!user) return;
    if (isWorker) {
      setEmployees([]);
      return;
    }

    const loadEmployeesForScope = async () => {
      try {
        if (employeeScope === 'all' && allEmployeesCacheRef.current) {
          setEmployees(allEmployeesCacheRef.current);
          return;
        }
        const response = await api.workspace.employees.getMany({
          status: employeeScope === 'archived' ? 'blocked' : employeeScope,
          per_page: 1000,
        });
        const nextEmployees = Array.isArray(response.data) ? response.data : [];
        setEmployees(nextEmployees);
        if (employeeScope === 'all') {
          allEmployeesCacheRef.current = nextEmployees;
        }
      } catch (err) {
        setEmployees([]);
        handleError(err);
      }
    };

    void loadEmployeesForScope();
  }, [employeeScope, handleError, isWorker, user]);

  useEffect(() => {
    if (!user) return;

    const loadClientsForScope = async () => {
      try {
        if (clientScope === 'all' && allProjectsCacheRef.current) {
          setClientProjects(allProjectsCacheRef.current);
          return;
        }
        if (clientScope === projectScope) {
          setClientProjects(projects);
          return;
        }
        const response = isWorker
          ? await api.worker.projects.getMany({ status: clientScope, per_page: 1000 })
          : await api.workspace.projects.getMany({ status: clientScope });
        setClientProjects(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setClientProjects([]);
        handleError(err);
      }
    };

    void loadClientsForScope();
  }, [clientScope, handleError, isWorker, projectScope, projects, user]);

  useEffect(() => {
    if (!user) return;

    const rebuildReport = async () => {
      try {
        setIsLoading(true);
        const requestTaskReport = isWorker
          ? api.worker.reports.getTasks
          : api.workspace.reports.getTasks;

        const taskReport = await requestTaskReport({
          from: periodFrom,
          to: periodTo,
          project_scope: projectScope,
          task_scope: taskScope,
          employee_scope: employeeScope,
          client_scope: clientScope,
          project_ids: selectedProjectIds,
          task_ids: selectedTaskIds,
          user_ids: selectedEmployeeIds,
          client_ids: selectedClientIds,
        });

        const rows = Array.isArray(taskReport.rows) ? taskReport.rows : [];
        const mappedRows: TaskReportRow[] = rows.map((row) => {
          const rawAssignees = (row as { assignees?: unknown }).assignees;
          const rawSpentByUsers = (row as { spent_by_users?: unknown }).spent_by_users;
          const assignees = Array.isArray(rawAssignees)
            ? rawAssignees
                .filter(
                  (
                    assignee,
                  ): assignee is {
                    id?: unknown;
                    name?: unknown;
                    last_name?: unknown;
                    status?: unknown;
                  } => typeof assignee === 'object' && assignee !== null,
                )
                .map((assignee) => ({
                  id: String(assignee.id ?? ''),
                  name: String(assignee.name ?? ''),
                  last_name: String(assignee.last_name ?? ''),
                  status: String(assignee.status ?? ''),
                }))
                .filter((assignee) => assignee.id !== '')
            : [];
          const spentByUsers = Array.isArray(rawSpentByUsers)
            ? rawSpentByUsers
                .filter(
                  (
                    spentByUser,
                  ): spentByUser is {
                    user_id?: unknown;
                    name?: unknown;
                    last_name?: unknown;
                    spent_seconds?: unknown;
                  } => typeof spentByUser === 'object' && spentByUser !== null,
                )
                .map((spentByUser) => ({
                  user_id: String(spentByUser.user_id ?? ''),
                  name: String(spentByUser.name ?? ''),
                  last_name: String(spentByUser.last_name ?? ''),
                  spent_seconds: Number(spentByUser.spent_seconds ?? 0),
                }))
                .filter((spentByUser) => spentByUser.user_id !== '')
            : [];

          return {
            ...(row as Task),
            project_name: String((row as { project_name?: string }).project_name ?? ''),
            client_id: String((row as { client_id?: string }).client_id ?? 'unknown'),
            assignee_names: assignees
              .map((assignee) =>
                [assignee.name, assignee.last_name].filter(Boolean).join(' ').trim(),
              )
              .filter(Boolean),
            assignee_ids: assignees.map((assignee) => assignee.id),
            assignees,
            spent_by_users: spentByUsers,
          };
        });

        setTasks(mappedRows);
      } catch (err) {
        setTasks([]);
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    void rebuildReport();
  }, [
    clientScope,
    employeeScope,
    handleError,
    isWorker,
    periodFrom,
    periodTo,
    projectScope,
    selectedClientIds,
    selectedEmployeeIds,
    selectedProjectIds,
    selectedTaskIds,
    taskScope,
    user,
  ]);

  const clientOptions = useMemo(() => {
    const uniqueClientIds = Array.from(
      new Set(clientProjects.map((project) => project.company_id).filter(Boolean)),
    ) as string[];

    return uniqueClientIds.map((clientId) => ({
      value: clientId,
      label: `Клиент ${clientId.slice(0, 8)}`,
    }));
  }, [clientProjects]);

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: formatName(employee),
      })),
    [employees],
  );

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );
  const selectedProjectNames = useMemo(
    () =>
      projects
        .filter((project) => selectedProjectIds.includes(project.id))
        .map((project) => project.name),
    [projects, selectedProjectIds],
  );
  const projectIndex = useMemo(() => {
    const map = new Map<string, Project>();

    [...projects, ...clientProjects].forEach((project) => {
      map.set(project.id, project);
    });

    return map;
  }, [clientProjects, projects]);
  const taskOptions = useMemo(
    () =>
      tasks
        .filter((task) => !task.is_draft)
        .map((task) => ({ value: task.id, label: task.title })),
    [tasks],
  );

  const filteredRows = tasks;
  const showSpentBreakdown = selectedEmployeeIds.length === 0;

  const openTaskModal = useCallback(
    async (row: TaskReportRow) => {
      const project: Project = projectIndex.get(row.project_id) ?? {
        id: row.project_id,
        default_entrance_finance_article_id: null,
        name: row.project_name || 'Проект',
        latest_activity_period: null,
        created_by_id: '',
        members: [],
        exclude_from_payroll: false,
        payroll_exclusion_scope: 'ALL',
        payroll_excluded_employee_ids: [],
      };

      try {
        await projectTasksStore.loadBoard(row.project_id, {
          worker: isWorker,
          force: true,
        });
        setActiveProject(project);
        setRequestedTaskId(row.id);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, isWorker, projectIndex],
  );

  const onExportCsv = () => {
    const headers = buildTaskReportExportHeaders(displayOptions);
    const rows = buildTaskReportExportRows(
      filteredRows,
      displayOptions,
      showSpentBreakdown,
    );
    const csv = [headers, ...rows].map(toCsvLine).join('\n');
    const fileBaseName = buildTaskReportsFileBaseName(
      selectedProjectNames,
      periodFrom,
      periodTo,
    );

    downloadCsvFile(csv, `${fileBaseName}.csv`);
    toast.success('CSV сохранен.');
  };

  const onExportXlsx = async () => {
    const headers = buildTaskReportExportHeaders(displayOptions);
    const rows = buildTaskReportExportRows(
      filteredRows,
      displayOptions,
      showSpentBreakdown,
    );
    const fileBaseName = buildTaskReportsFileBaseName(
      selectedProjectNames,
      periodFrom,
      periodTo,
    );
    await downloadXlsx({
      headers,
      rows,
      fileName: `${fileBaseName}.xlsx`,
      sheetName: 'Отчёт по задачам',
    });
    toast.success('XLSX сохранен.');
  };

  const onPrint = () => {
    window.print();
  };

  return (
    <section className='h-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:p-3'>
      <h2 className='mb-3 text-base font-semibold text-slate-800'>Отчёт по задачам</h2>

      <TaskReportsFilters
        projectScope={projectScope}
        taskScope={taskScope}
        employeeScope={employeeScope}
        clientScope={clientScope}
        onProjectScopeChange={setProjectScope}
        onTaskScopeChange={setTaskScope}
        onEmployeeScopeChange={setEmployeeScope}
        onClientScopeChange={setClientScope}
        employeeOptions={employeeOptions}
        projectOptions={projectOptions}
        taskOptions={taskOptions}
        clientOptions={clientOptions}
        selectedEmployeeIds={selectedEmployeeIds}
        selectedProjectIds={selectedProjectIds}
        selectedTaskIds={selectedTaskIds}
        selectedClientIds={selectedClientIds}
        onEmployeeIdsChange={setSelectedEmployeeIds}
        onProjectIdsChange={setSelectedProjectIds}
        onTaskIdsChange={setSelectedTaskIds}
        onClientIdsChange={setSelectedClientIds}
        periodFrom={periodFrom}
        periodTo={periodTo}
        onPeriodChange={(from, to) => {
          setPeriodFrom(from);
          setPeriodTo(to);
        }}
        displayOptions={displayOptions}
        onDisplayOptionsChange={setDisplayOptions}
        isLoading={isLoading}
        onExportCsv={onExportCsv}
        onExportXlsx={onExportXlsx}
        onPrint={onPrint}
      />

      <TaskReportsTable
        rows={filteredRows}
        displayOptions={displayOptions}
        isLoading={isLoading}
        selectedProjectNames={selectedProjectNames}
        periodFrom={periodFrom}
        periodTo={periodTo}
        showSpentBreakdown={showSpentBreakdown}
        getEmployeeHref={(_row, employeeId) => `/employees?user_id=${employeeId}`}
        getProjectHref={(row) => `/projects?project_id=${row.project_id}`}
        onOpenTask={(row) => {
          void openTaskModal(row);
        }}
      />

      {activeProject ? (
        <ProjectTaskEditorModal
          selectedProject={activeProject}
          requestedTaskId={requestedTaskId}
          onSelectedTaskIdChange={(taskId) => {
            setRequestedTaskId(taskId);
            if (!taskId) {
              setActiveProject(null);
            }
          }}
          canCreateUpdateTasks={canCreateUpdateTasks}
          canMoveTasks={canMoveTasks}
          currentUserId={currentUserId}
          canDeleteAnyComment={canDeleteAnyComment}
          canDeleteOwnComment={canDeleteOwnComment}
          canDeleteAnyAttachments={canDeleteAnyAttachments}
          canDeleteOwnAttachments={canDeleteOwnAttachments}
          syncTaskIdInUrl={false}
        />
      ) : null}
    </section>
  );
}
