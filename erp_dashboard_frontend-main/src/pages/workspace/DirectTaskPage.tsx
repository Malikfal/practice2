import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/api';
import { ApiRequestError } from '../../api/core/error';
import { useAppControllerContext } from '../../context/AppControllerContext';
import { notificationsStore } from '../../notifications/notificationsStore';
import { taskViewsStore } from '../../notifications/taskViewsStore';
import type {
  ProjectMember,
  Task,
  TaskCreateForm,
  TaskPriority,
  TaskStatusColumn,
} from '../../types/app';
import TaskDetailsColumn from '../../components/modals/TaskModal/components/TaskDetailsColumn';
import TaskDescriptionEditor from '../../components/modals/TaskModal/components/LazyTaskDescriptionEditor';
import TaskSidePanel from '../../components/modals/TaskModal/components/TaskSidePanel';
import TaskWatchMenu from '../../components/modals/TaskModal/components/TaskWatchMenu';
import Button from '../../components/ui/Button';

function secondsToTimeValue(seconds?: number | null): string {
  if (typeof seconds !== 'number' || seconds <= 0) {
    return '';
  }
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default function DirectTaskPage() {
  const navigate = useNavigate();
  const { user, currentPath } = useAppControllerContext();

  const taskId = useMemo(() => {
    const parts = currentPath.split('/');
    return parts[parts.length - 1];
  }, [currentPath]);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<number | null>(null);

  const [form, setForm] = useState<TaskCreateForm | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canEditTasks = user?.permissions?.includes('tasks.create_update') ?? false;
  const canViewClientTab =
    user?.permissions?.includes('projects.tabs.tasks.client.view') ?? false;
  const canViewClientComments =
    user?.permissions?.includes('projects.tabs.tasks.client.comments.view') ?? false;
  const canReplyToClient =
    user?.permissions?.includes('projects.tabs.tasks.client.reply') ?? false;
  const canUpdateClientStatus =
    user?.permissions?.includes('projects.tabs.tasks.client.status.update') ?? false;
  const canManageClientLink =
    user?.permissions?.includes('projects.tabs.tasks.client.link.manage') ?? false;
  const canDeleteAnyComment =
    user?.permissions?.includes('projects.tabs.tasks.comments.delete_all') ?? false;
  const canDeleteOwnComment =
    user?.permissions?.includes('projects.tabs.tasks.comments.delete_self') ?? false;
  const canDeleteAnyAttachments =
    user?.permissions?.includes('projects.tabs.tasks.attachments.delete_all') ?? false;
  const canDeleteOwnAttachments =
    user?.permissions?.includes('projects.tabs.tasks.attachments.delete_self') ?? false;
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.workspace.taskDirect.getDirectTask(taskId);
      setTask(data);
      setForm({
        title: data.title ?? '',
        description: data.description ?? '',
        assignee_ids: data.assignee_ids ?? [],
        priority: (data.priority as TaskPriority | undefined) ?? null,
        estimation: secondsToTimeValue(data.estimation),
        deadline: data.deadline ?? null,
        start_at: data.start_at ?? null,
        parent_task_id: data.parent_task_id ?? null,
        is_client_visible: Boolean(data.is_client_visible),
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.status : 500);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // Открытая задача: её уведомления прочитаны, новые по ней не увеличивают счётчик.
  useEffect(() => notificationsStore.openTask(taskId), [taskId]);
  useEffect(() => (taskId ? taskViewsStore.openTask(taskId) : undefined), [taskId]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const handleFormChange = useCallback(
    (newForm: TaskCreateForm) => {
      setForm(newForm);
      if (!task) return;

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await api.workspace.taskDirect.updateDirectTask(task.id, newForm);
        } catch {
          import('sonner').then(({ toast }) => {
            toast.error('Не удалось сохранить изменения');
          });
        } finally {
          setIsSaving(false);
        }
      }, 1500);
    },
    [task],
  );

  const handleManualSave = useCallback(async () => {
    if (!task || !form || isSaving) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setIsSaving(true);
    try {
      await api.workspace.taskDirect.updateDirectTask(task.id, form);
      import('sonner').then(({ toast }) => {
        toast.success('Изменения сохранены');
      });
    } catch {
      import('sonner').then(({ toast }) => {
        toast.error('Не удалось сохранить изменения');
      });
    } finally {
      setIsSaving(false);
    }
  }, [task, form, isSaving]);

  const columns = useMemo<TaskStatusColumn[]>(() => {
    if (!task || !task.status_column_id) return [];
    return [
      {
        id: task.status_column_id,
        name: task.status_label ?? 'Статус',
        color: task.status_color ?? '#e2e8f0',
        slug: task.status_slug ?? '',
      } as TaskStatusColumn,
    ];
  }, [task]);

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
      </div>
    );
  }

  if (error === 403) {
    return (
      <div className='flex h-full flex-col items-center justify-center text-slate-500'>
        <svg
          viewBox='0 0 24 24'
          className='mb-4 size-12 fill-none stroke-current stroke-2'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
          />
        </svg>
        <h2 className='text-xl font-semibold text-slate-700'>
          У вас нет доступа к этой задаче
        </h2>
      </div>
    );
  }

  if (error === 404) {
    return (
      <div className='flex h-full flex-col items-center justify-center text-slate-500'>
        <svg
          viewBox='0 0 24 24'
          className='mb-4 size-12 fill-none stroke-current stroke-2'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
          />
        </svg>
        <h2 className='text-xl font-semibold text-slate-700'>Задача не найдена</h2>
        <p className='mt-2'>Возможно, она была удалена или ссылка указана неверно.</p>
      </div>
    );
  }

  if (error || !task || !form) {
    return (
      <div className='flex h-full flex-col items-center justify-center text-slate-500'>
        <h2 className='text-xl font-semibold text-slate-700'>
          Произошла ошибка при загрузке
        </h2>
        <Button className='mt-4' variant='secondary' onClick={loadTask}>
          Повторить попытку
        </Button>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col overflow-hidden bg-slate-50'>
      <div className='flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6'>
        <div className='min-w-0 flex-1 pr-4'>
          <span className='block text-xs font-medium text-slate-400'>
            Задача{' '}
            {isSaving ? (
              <span className='ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 align-middle'></span>
            ) : null}
          </span>
          <h1 className='truncate text-lg font-semibold text-slate-900 sm:text-xl'>
            {task.title || 'Без названия'}
          </h1>
        </div>
        <div className='flex shrink-0 items-center gap-2 sm:gap-3'>
          {!task.is_draft ? <TaskWatchMenu key={task.id} taskId={task.id} /> : null}
          <Button
            variant='primary'
            onClick={() => {
              navigate(`/projects?project_id=${task.project_id}&task_id=${task.id}`);
            }}
          >
            Открыть в проекте
          </Button>
        </div>
      </div>

      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden'>
        <div className='grid w-full min-w-0 flex-1 auto-rows-max content-start gap-4 p-4 xl:h-full xl:auto-rows-auto xl:content-stretch xl:grid-rows-1 xl:grid-cols-[280px_minmax(0,1fr)_400px] xl:gap-6 xl:p-6 xl:px-8'>
          <div className='flex flex-col min-h-0 xl:h-full xl:overflow-y-auto rounded-lg'>
            <TaskDetailsColumn
              canEditTasks={canEditTasks}
              form={form}
              members={(task.assignees ?? []).map(
                (u): ProjectMember => ({ id: u.id, user: u }),
              )}
              columns={columns}
              columnId={task.status_column_id ?? ''}
              spentSeconds={task.spent_seconds ?? 0}
              currentTaskId={task.id}
              allTasks={[]}
              onChange={handleFormChange}
              clientAccess={
                canViewClientTab
                  ? {
                      canEditVisibility: canEditTasks,
                      approvalStatus: task.client_approval_status ?? 'pending',
                    }
                  : undefined
              }
            />
          </div>

          <div className='flex flex-col min-h-0 xl:h-full xl:overflow-y-auto rounded-lg'>
            <TaskDescriptionEditor
              canEditTasks={canEditTasks}
              projectId={task.project_id}
              taskId={task.id}
              form={form}
              onChange={handleFormChange}
            />
          </div>

          <div className='flex flex-col min-h-0 xl:h-full xl:overflow-hidden rounded-lg'>
            <TaskSidePanel
              taskId={task.id}
              currentUserId={user?.id ?? ''}
              canDeleteAnyComment={canDeleteAnyComment}
              canDeleteOwnComment={canDeleteOwnComment}
              canDeleteAnyAttachments={canDeleteAnyAttachments}
              canDeleteOwnAttachments={canDeleteOwnAttachments}
              canViewClientTab={canViewClientTab}
              canViewClientComments={canViewClientComments}
              canReplyToClient={canReplyToClient}
              canUpdateClientStatus={canUpdateClientStatus}
              canManageClientLink={canManageClientLink}
              mentionUsers={task.assignees ?? []}
            />
          </div>
        </div>
      </div>

      <div className='flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-500 sm:px-6'>
        <div className='flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6'>
          {task.created_at ? (
            <div>
              <span className='text-slate-400'>Создано:</span>{' '}
              <span className='font-medium text-slate-700'>
                {new Date(task.created_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ) : null}

          {task.creator ? (
            <div>
              <span className='text-slate-400'>Создатель:</span>{' '}
              <span className='font-medium text-slate-700'>
                {`${task.creator.name || ''} ${task.creator.last_name || ''}`.trim() ||
                  '—'}
              </span>
            </div>
          ) : null}

          {task.project_name ? (
            <div>
              <span className='text-slate-400'>Проект:</span>{' '}
              <span className='font-medium text-slate-700'>{task.project_name}</span>
            </div>
          ) : null}
        </div>

        {canEditTasks ? (
          <Button
            type='button'
            disabled={isSaving}
            variant='primary'
            onClick={handleManualSave}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
