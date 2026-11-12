import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import { useAppControllerContext } from '../../../../../../../context/AppControllerContext';
import { createInitialManualTimeForm } from '../../../../../../../hooks/formFactories';
import type { ManualTimeForm, Project, Task, User } from '../../../../../../../types/app';
import {
  isEmployeeBlocked,
  isProjectArchived,
} from '../../../../../../../utils/formatters';

import ManualTimeFormCard from './ManualTimeFormCard';
import ConfirmDialog from '../../../../../../modals/ConfirmDialog';
import { NON_CURRENT_DATE_FINANCE_WARNING } from './dayTimelineUtils';

type Props = {
  employee?: User | null;
  embedded?: boolean;
  onSuccess?: () => void;
};

function createManualTimeForm(employeeId = ''): ManualTimeForm {
  return {
    ...createInitialManualTimeForm(),
    user_id: employeeId,
  };
}

export default function ManualTimePanel({
  employee = null,
  embedded = false,
  onSuccess,
}: Props) {
  const { user } = useAppControllerContext();
  const userPermissions = user?.permissions ?? [];
  const isWorker = user?.role === 'WORKER';
  const hasTimeAddForOthers =
    userPermissions.includes('time.add_for_others') ||
    userPermissions.includes('time.add_for_project_users') ||
    userPermissions.includes('time.add_for_all');
  const canAddManualTime = hasTimeAddForOthers;
  const fixedEmployeeId = employee?.id ?? '';

  const [isLoadingProjectsAndEmployees, setIsLoadingProjectsAndEmployees] =
    useState(false);
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [isAddConfirmationOpen, setIsAddConfirmationOpen] = useState(false);
  const [employees, setEmployees] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [formRenderKey, setFormRenderKey] = useState(0);
  const [manualTimeForm, setManualTimeForm] = useState<ManualTimeForm>(() =>
    createManualTimeForm(fixedEmployeeId),
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === manualTimeForm.project_id) ?? null,
    [projects, manualTimeForm.project_id],
  );

  const workerProjectEmployees = useMemo(() => {
    if (!isWorker || !hasTimeAddForOthers) return [];
    if (!selectedProject) return user ? [user] : [];

    const byId = new Map<string, User>();

    for (const member of selectedProject.members ?? []) {
      if (member?.user?.id) {
        byId.set(member.user.id, member.user);
      }
    }

    if (user?.id && !byId.has(user.id)) {
      byId.set(user.id, user);
    }

    return Array.from(byId.values());
  }, [hasTimeAddForOthers, isWorker, selectedProject, user]);

  const availableEmployees = useMemo(() => {
    if (employee) return [employee];
    if (!isWorker) return employees;
    if (hasTimeAddForOthers) return workerProjectEmployees;
    return user ? [user] : [];
  }, [employee, employees, hasTimeAddForOthers, isWorker, user, workerProjectEmployees]);

  const activeEmployees = useMemo(
    () =>
      availableEmployees.filter(
        (employeeItem) => !isEmployeeBlocked(employeeItem.status),
      ),
    [availableEmployees],
  );
  const activeProjects = useMemo(
    () => projects.filter((project) => !isProjectArchived(project.status)),
    [projects],
  );
  const maxDateTime = useMemo(() => {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
  }, []);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  useEffect(() => {
    if (!fixedEmployeeId) return;

    setManualTimeForm((prev) => {
      if (prev.user_id === fixedEmployeeId) return prev;
      return { ...prev, user_id: fixedEmployeeId, task_id: '' };
    });
  }, [fixedEmployeeId]);

  useEffect(() => {
    if (!isWorker || !user?.id || hasTimeAddForOthers || fixedEmployeeId) return;

    setManualTimeForm((prev) => {
      if (prev.user_id === user.id) return prev;
      return { ...prev, user_id: user.id, task_id: '', task_title: '' };
    });
  }, [fixedEmployeeId, hasTimeAddForOthers, isWorker, user?.id]);

  useEffect(() => {
    if (!isWorker || !hasTimeAddForOthers || fixedEmployeeId) return;

    const availableIds = new Set(activeEmployees.map((employeeItem) => employeeItem.id));
    const fallbackUserId = activeEmployees[0]?.id ?? user?.id ?? '';

    setManualTimeForm((prev) => {
      if (!fallbackUserId) return prev;
      if (availableIds.has(prev.user_id)) return prev;
      return { ...prev, user_id: fallbackUserId, task_id: '', task_title: '' };
    });
  }, [activeEmployees, fixedEmployeeId, hasTimeAddForOthers, isWorker, user?.id]);

  const fetchLists = useCallback(async () => {
    try {
      setIsLoadingProjectsAndEmployees(true);

      if (isWorker) {
        const projectResponse = await api.worker.projects.getMany({
          status: 'all',
          per_page: 1000,
        });

        setEmployees(user ? [user] : []);
        setProjects(Array.isArray(projectResponse.data) ? projectResponse.data : []);
        return;
      }

      if (fixedEmployeeId) {
        const projectData = await api.workspace.projects.getMany({
          status: 'all',
        });
        setEmployees(employee ? [employee] : []);
        setProjects(projectData.data ?? []);
        return;
      }

      const [employeeData, projectData] = await api.workspace.lists.getAll();
      setEmployees(Array.isArray(employeeData) ? employeeData : []);
      setProjects(Array.isArray(projectData) ? projectData : []);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingProjectsAndEmployees(false);
    }
  }, [employee, fixedEmployeeId, handleError, isWorker, user]);

  const fetchTasksForSelectedProjectAndUser = useCallback(async () => {
    try {
      setIsLoadingTasks(true);
      if (!manualTimeForm.project_id || !manualTimeForm.user_id) {
        setTasks([]);
        return;
      }

      if (isWorker) {
        const shouldLoadForSelectedUser =
          hasTimeAddForOthers &&
          Boolean(manualTimeForm.user_id) &&
          manualTimeForm.user_id !== user?.id;

        const tasksData = shouldLoadForSelectedUser
          ? await api.worker.projects.getTasksForUser(
              manualTimeForm.project_id,
              manualTimeForm.user_id,
            )
          : await api.worker.projects.getTasks(manualTimeForm.project_id);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        return;
      }

      const tasksData = await api.workspace.projects.getForUser(
        manualTimeForm.project_id,
        manualTimeForm.user_id,
      );
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [
    handleError,
    hasTimeAddForOthers,
    isWorker,
    manualTimeForm.project_id,
    manualTimeForm.user_id,
    user?.id,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLists();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLists]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTasksForSelectedProjectAndUser();
    }, 0);
    return () => clearTimeout(timer);
  }, [
    fetchTasksForSelectedProjectAndUser,
    manualTimeForm.project_id,
    manualTimeForm.user_id,
  ]);

  const onAddManualTime = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const effectiveUserId =
      isWorker && !hasTimeAddForOthers ? (user?.id ?? '') : manualTimeForm.user_id;
    const normalizedUserId = effectiveUserId.trim();
    const normalizedProjectId = manualTimeForm.project_id.trim();

    if (normalizedUserId === '' || normalizedProjectId === '') {
      toast.error('Выберите сотрудника и проект из выпадающего списка.');
      setManualTimeForm((prev) => ({
        ...prev,
        user_id: '',
        project_id: '',
        task_id: '',
        task_title: '',
      }));
      setFormRenderKey((prev) => prev + 1);
      return;
    }

    setIsAddConfirmationOpen(true);
  };

  const confirmAddManualTime = async () => {
    const effectiveUserId =
      isWorker && !hasTimeAddForOthers ? (user?.id ?? '') : manualTimeForm.user_id;

    try {
      setIsAddingTime(true);
      await api.workspace.timeEntries.create({
        ...manualTimeForm,
        user_id: effectiveUserId.trim(),
        project_id: manualTimeForm.project_id.trim(),
      });
      setIsAddConfirmationOpen(false);
      setManualTimeForm(createManualTimeForm(fixedEmployeeId));
      setFormRenderKey((prev) => prev + 1);
      toast.success('Время добавлено вручную.');
      onSuccess?.();
    } catch (err) {
      handleError(err);
    } finally {
      setIsAddingTime(false);
    }
  };

  if (!canAddManualTime) {
    return null;
  }

  const today = maxDateTime.slice(0, 10);
  const affectsFinancialCalculations = [
    manualTimeForm.started_at,
    manualTimeForm.ended_at,
  ].some((value) => value.slice(0, 10) !== today);

  return (
    <>
      <ManualTimeFormCard
        key={formRenderKey}
        manualTimeForm={manualTimeForm}
        projects={activeProjects}
        maxDateTime={maxDateTime}
        onFormChange={setManualTimeForm}
        onSubmit={onAddManualTime}
        isLoadingProjectsAndEmployees={isLoadingProjectsAndEmployees}
        isAddingTime={isAddingTime}
        isLoadingTasks={isLoadingTasks}
        tasks={tasks}
        embedded={embedded}
      />

      <ConfirmDialog
        isOpen={isAddConfirmationOpen}
        isProcessing={isAddingTime}
        title='Подтвердите добавление времени'
        message={
          <div className='grid gap-2'>
            <p>Добавить указанный интервал времени?</p>
            {affectsFinancialCalculations ? (
              <p className='font-medium text-amber-700'>
                {NON_CURRENT_DATE_FINANCE_WARNING}
              </p>
            ) : null}
          </div>
        }
        confirmLabel='Добавить время'
        processingLabel='Добавление...'
        danger={false}
        onClose={() => setIsAddConfirmationOpen(false)}
        onConfirm={confirmAddManualTime}
      />
    </>
  );
}
