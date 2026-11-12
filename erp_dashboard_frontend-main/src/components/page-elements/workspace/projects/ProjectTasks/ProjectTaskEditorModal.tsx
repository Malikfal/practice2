import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import ConfirmDialog from '../../../../modals/ConfirmDialog';
import TaskModal from '../../../../modals/TaskModal/TaskModal';
import type {
  Project,
  Task,
  TaskCreateForm,
  TaskPriority,
} from '../../../../../types/app';
import { projectTasksStore, useProjectTasksStore } from './projectTasksStore';
import { findTaskById, pickDefaultColumnId } from './taskUtils';

const INITIAL_TASK_FORM: TaskCreateForm = {
  title: '',
  description: '',
  assignee_ids: [],
  priority: null,
  estimation: '',
  parent_task_id: null,
  is_client_visible: true,
};

const TRACKED_TASK_DELETE_ERROR =
  'По задаче уже есть затреканное время. Перенесите его в другую задачу, затем удалите задачу.';

export function secondsToTimeValue(seconds?: number | null): string {
  if (typeof seconds !== 'number' || seconds <= 0) {
    return '';
  }
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function taskFormSnapshot(form: TaskCreateForm, columnId: string): string {
  return JSON.stringify({ form, columnId });
}

type NewTaskPayload = { status_column_id: string | null; parent_task_id?: string };

type RenderProps = {
  openEditTaskModal: (_task: Task) => void;
  openTaskById: (_taskId: string) => Promise<void>;
  openNewTaskModal: (_payload: NewTaskPayload) => void;
};

type Props = {
  selectedProject: Project;
  requestedTaskId?: string;
  onSelectedTaskIdChange?: (_taskId: string) => void;
  canCreateUpdateTasks: boolean;
  canMoveTasks: boolean;
  currentUserId: string;
  canDeleteAnyComment: boolean;
  canDeleteOwnComment: boolean;
  canDeleteAnyAttachments: boolean;
  canDeleteOwnAttachments: boolean;
  canViewClientTab?: boolean;
  canViewClientComments?: boolean;
  canReplyToClient?: boolean;
  canUpdateClientStatus?: boolean;
  canManageClientLink?: boolean;
  syncTaskIdInUrl?: boolean;
  children?: (_props: RenderProps) => ReactNode;
};

export default function ProjectTaskEditorModal({
  selectedProject,
  requestedTaskId = '',
  onSelectedTaskIdChange,
  canCreateUpdateTasks,
  canMoveTasks,
  currentUserId,
  canDeleteAnyComment,
  canDeleteOwnComment,
  canDeleteAnyAttachments,
  canDeleteOwnAttachments,
  canViewClientTab,
  canViewClientComments,
  canReplyToClient,
  canUpdateClientStatus,
  canManageClientLink,
  syncTaskIdInUrl = true,
  children,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedProjectId = selectedProject.id;
  const board = useProjectTasksStore(selectedProjectId);
  const taskColumns = board.columns;
  const projectTasks = board.tasks;
  const [taskForm, setTaskForm] = useState<TaskCreateForm>(INITIAL_TASK_FORM);
  const [taskFormColumnId, setTaskFormColumnId] = useState('');
  const [editingTaskId, setEditingTaskId] = useState('');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);

  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const openedTaskFromQueryRef = useRef('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTaskSnapshotRef = useRef('');
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const isCreatingTaskRef = useRef(false);

  const handleError = useCallback((error: unknown) => {
    toast.error(error instanceof Error ? error.message : 'Произошла ошибка.');
  }, []);

  useEffect(() => {
    openedTaskFromQueryRef.current = '';
  }, [selectedProjectId]);

  const openEditTaskModal = useCallback(
    (task: Task) => {
      if (syncTaskIdInUrl) {
        const params = new URLSearchParams(location.search);
        params.set('project_id', selectedProjectId);
        params.set('task_id', task.id);
        const search = params.toString();
        navigate(`${location.pathname}${search ? `?${search}` : ''}`);
      }

      const nextColumnId =
        task.status_column_id ??
        pickDefaultColumnId(taskColumns, selectedProject.tracker_default_status_name);
      const nextForm: TaskCreateForm = {
        title: task.title ?? '',
        description: task.description ?? '',
        assignee_ids: task.assignee_ids ?? [],
        priority: (task.priority as TaskPriority | undefined) ?? null,
        estimation: secondsToTimeValue(task.estimation),
        deadline: task.deadline ?? null,
        start_at: task.start_at ?? null,
        parent_task_id: task.parent_task_id ?? null,
        is_client_visible: Boolean(task.is_client_visible),
      };
      lastSavedTaskSnapshotRef.current = taskFormSnapshot(nextForm, nextColumnId);
      // task_id в URL теперь указывает на открытую задачу: без отметки эффект ниже
      // повторно загрузил бы её с сервера и затёр бы уже введённый текст.
      openedTaskFromQueryRef.current = `${selectedProjectId}:${task.id}`;
      setEditingTaskId(task.id);
      setActiveTask(task);
      setTaskFormColumnId(nextColumnId);
      setTaskForm(nextForm);
      setIsTaskModalOpen(true);
      onSelectedTaskIdChange?.(task.id);
    },
    [
      location.pathname,
      location.search,
      navigate,
      onSelectedTaskIdChange,
      selectedProject.tracker_default_status_name,
      selectedProjectId,
      syncTaskIdInUrl,
      taskColumns,
    ],
  );

  const openTaskById = useCallback(
    async (taskId: string) => {
      if (!selectedProjectId) return;

      const fetchedTask = await api.workspace.projects.getTask(selectedProjectId, taskId);
      openEditTaskModal(fetchedTask);
    },
    [openEditTaskModal, selectedProjectId],
  );

  useEffect(() => {
    if (!requestedTaskId) return;
    const taskKey = `${selectedProjectId}:${requestedTaskId}`;
    if (openedTaskFromQueryRef.current === taskKey) return;

    // Отмечаем до запроса, чтобы повторный запуск эффекта не загрузил задачу второй раз.
    openedTaskFromQueryRef.current = taskKey;
    void openTaskById(requestedTaskId).catch((error: unknown) => {
      if (openedTaskFromQueryRef.current === taskKey) openedTaskFromQueryRef.current = '';
      handleError(error);
    });
  }, [handleError, openTaskById, requestedTaskId, selectedProjectId]);

  const handleToggleSubtaskDone = useCallback(
    async (subtaskId: string, done: boolean) => {
      if (!canMoveTasks || !selectedProjectId) return;

      const targetColumn = done
        ? taskColumns.find((column) => column.is_final)
        : (taskColumns.find((column) => column.is_default) ??
          taskColumns.find((column) => !column.is_final));

      if (!targetColumn) {
        toast.error(
          done ? 'Не найдена финальная колонка.' : 'Не найдена колонка для возврата.',
        );
        return;
      }

      try {
        const destinationIndex = projectTasks.filter(
          (task) => task.status_column_id === targetColumn.id,
        ).length;
        const moved = await projectTasksStore.moveTask(
          selectedProjectId,
          subtaskId,
          targetColumn.id,
          destinationIndex,
        );
        if (!moved) return;

        if (activeTask) {
          const refreshedParent = await api.workspace.projects.getTask(
            selectedProjectId,
            activeTask.id,
          );
          setActiveTask(refreshedParent);
        }
      } catch (error) {
        handleError(error);
      }
    },
    [activeTask, canMoveTasks, handleError, projectTasks, selectedProjectId, taskColumns],
  );

  const finishClosingTaskModal = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    openedTaskFromQueryRef.current = '';
    setIsTaskModalOpen(false);
    setEditingTaskId('');
    setActiveTask(null);
    onSelectedTaskIdChange?.('');
  };

  const saveTaskChanges = useCallback(
    async (showSuccessToast = false, manageSubmitting = true): Promise<boolean> => {
      if (!canCreateUpdateTasks || !editingTaskId || !selectedProjectId) return true;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const snapshot = taskFormSnapshot(taskForm, taskFormColumnId);
      if (snapshot === lastSavedTaskSnapshotRef.current) {
        if (showSuccessToast) toast.success('Изменения сохранены.');
        return true;
      }

      let confirmation: Promise<boolean> | null = null;
      try {
        if (manageSubmitting) setIsSavingTask(true);
        const saving = projectTasksStore.saveTask(
          selectedProjectId,
          editingTaskId,
          taskForm,
          taskFormColumnId,
        );
        confirmation = saving.then(
          () => true,
          () => false,
        );
        savePromiseRef.current = confirmation;
        const updatedTask = await saving;
        lastSavedTaskSnapshotRef.current = snapshot;
        setActiveTask(updatedTask);
        if (showSuccessToast) toast.success('Задача обновлена.');
        return true;
      } catch (error) {
        handleError(error);
        return false;
      } finally {
        if (savePromiseRef.current === confirmation) savePromiseRef.current = null;
        if (manageSubmitting) setIsSavingTask(false);
      }
    },
    [
      canCreateUpdateTasks,
      editingTaskId,
      handleError,
      selectedProjectId,
      taskForm,
      taskFormColumnId,
    ],
  );

  useEffect(() => {
    if (!isTaskModalOpen || !editingTaskId || !canCreateUpdateTasks) return;
    const snapshot = taskFormSnapshot(taskForm, taskFormColumnId);
    if (snapshot === lastSavedTaskSnapshotRef.current) return;

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void saveTaskChanges(false);
    }, 3000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    canCreateUpdateTasks,
    editingTaskId,
    isTaskModalOpen,
    saveTaskChanges,
    taskForm,
    taskFormColumnId,
  ]);

  const closeTaskModal = async () => {
    if (isSavingTask && !savePromiseRef.current) return;
    if (savePromiseRef.current) await savePromiseRef.current;
    const saved = await saveTaskChanges(false);
    if (saved) finishClosingTaskModal();
  };

  const openNewTaskModal = async (payload: NewTaskPayload) => {
    // Пока черновик создаётся, повторный клик создал бы второй пустой черновик
    // и открыл бы его поверх первого, сбросив введённый текст.
    if (isCreatingTaskRef.current) return;
    isCreatingTaskRef.current = true;
    try {
      // Подзадача открывается вместо родителя: сначала сохраняем его правки.
      if (savePromiseRef.current) await savePromiseRef.current;
      if (!(await saveTaskChanges(false))) return;
      const draft = await projectTasksStore.createTask(selectedProjectId, payload);
      openEditTaskModal(draft);
    } catch (error) {
      handleError(error);
    } finally {
      isCreatingTaskRef.current = false;
    }
  };

  const submitTaskForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveTaskChanges(true);
    } finally {
      // Nothing here
    }
  };

  const editingTask = useMemo(
    () =>
      (activeTask && activeTask.id === editingTaskId
        ? activeTask
        : projectTasks.find((task) => task.id === editingTaskId)) ?? null,
    [activeTask, editingTaskId, projectTasks],
  );

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      setIsSavingTask(true);
      await projectTasksStore.deleteTask(selectedProjectId, taskToDelete.id);
      setTaskToDelete(null);
      finishClosingTaskModal();
      toast.success('Задача удалена.');
    } catch (error) {
      handleError(error);
    } finally {
      setIsSavingTask(false);
    }
  };

  const taskModalTitle = useMemo(() => {
    if (!editingTaskId) {
      return taskForm.parent_task_id ? 'Новая подзадача' : 'Новая задача';
    }

    const title = canCreateUpdateTasks ? 'Редактирование задачи' : 'Просмотр задачи';
    return editingTask?.number ? `${title} #${editingTask.number}` : title;
  }, [canCreateUpdateTasks, editingTask?.number, editingTaskId, taskForm.parent_task_id]);

  const allTasksForModal = useMemo(() => {
    if (!activeTask) return projectTasks;

    return [activeTask, ...projectTasks.filter((task) => task.id !== activeTask.id)];
  }, [activeTask, projectTasks]);

  return (
    <>
      {children?.({
        openEditTaskModal,
        openTaskById,
        openNewTaskModal: (payload) => void openNewTaskModal(payload),
      })}

      <TaskModal
        isOpen={isTaskModalOpen}
        isSubmitting={isSavingTask}
        canEditTasks={canCreateUpdateTasks}
        projectId={selectedProjectId}
        form={taskForm}
        members={selectedProject.members ?? []}
        columns={taskColumns}
        columnId={taskFormColumnId}
        spentSeconds={editingTask?.spent_seconds ?? 0}
        onColumnIdChange={setTaskFormColumnId}
        title={taskModalTitle}
        submitLabel='Сохранить'
        onChange={setTaskForm}
        onClose={() => void closeTaskModal()}
        onSubmit={submitTaskForm}
        taskId={editingTaskId}
        allTasks={allTasksForModal}
        currentUserId={currentUserId}
        canDeleteAnyComment={canDeleteAnyComment}
        canDeleteOwnComment={canDeleteOwnComment}
        canDeleteAnyAttachments={canDeleteAnyAttachments}
        canDeleteOwnAttachments={canDeleteOwnAttachments}
        canViewClientTab={canViewClientTab}
        canViewClientComments={canViewClientComments}
        canReplyToClient={canReplyToClient}
        canUpdateClientStatus={canUpdateClientStatus}
        canManageClientLink={canManageClientLink}
        clientPublicLink={editingTask?.client_public_link ?? null}
        clientApprovalStatus={editingTask?.client_approval_status ?? null}
        createdAt={editingTask?.created_at}
        creator={editingTask?.creator}
        projectName={selectedProject.name}
        onToggleSubtaskDone={
          canMoveTasks
            ? (subtaskId, done) => void handleToggleSubtaskDone(subtaskId, done)
            : undefined
        }
        isDraft={Boolean(editingTask?.is_draft)}
        onDelete={
          editingTask && canCreateUpdateTasks
            ? () => {
                // Сервер не удаляет задачу с затреканным временем, предупреждаем до запроса.
                if ((editingTask.spent_seconds ?? 0) > 0) {
                  toast.error(TRACKED_TASK_DELETE_ERROR);
                  return;
                }
                setTaskToDelete(editingTask);
              }
            : undefined
        }
        onOpenTask={(subtaskId) => {
          void openTaskById(subtaskId).catch(handleError);
        }}
        onCreateSubtask={(parentTaskId) => {
          const parentTask = findTaskById(allTasksForModal, parentTaskId);
          const columnId =
            parentTask?.status_column_id ??
            pickDefaultColumnId(taskColumns, selectedProject.tracker_default_status_name);
          void openNewTaskModal({
            status_column_id: columnId || null,
            parent_task_id: parentTaskId,
          });
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(taskToDelete)}
        isProcessing={isSavingTask}
        title={taskToDelete?.is_draft ? 'Удалить черновик?' : 'Удалить задачу?'}
        message='Задача будет удалена безвозвратно. Возможность удаления окончательно проверит сервер.'
        confirmLabel='Удалить'
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => void confirmDeleteTask()}
      />
    </>
  );
}
