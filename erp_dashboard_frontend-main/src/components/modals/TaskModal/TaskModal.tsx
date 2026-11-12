import {
  useEffect,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from 'react';
import Button from '../../ui/Button';
import type {
  ProjectMember,
  Task,
  TaskClientApprovalStatus,
  TaskCreateForm,
  TaskCreator,
  TaskPriority,
  TaskStatusColumn,
} from '../../../types/app';
import TaskSidePanel from './components/TaskSidePanel';
import TaskDescriptionEditor from './components/LazyTaskDescriptionEditor';
import TaskDetailsColumn, {
  type ClientTaskApproval,
  type ClientTaskFields,
} from './components/TaskDetailsColumn';
import CopyLinkMenu from './components/CopyLinkMenu';
import TaskWatchMenu from './components/TaskWatchMenu';
import { notificationsStore } from '../../../notifications/notificationsStore';
import { taskViewsStore } from '../../../notifications/taskViewsStore';

export default function TaskModal({
  isOpen,
  isSubmitting,
  canEditTasks,
  projectId,
  form,
  members,
  creator,
  columns = [],
  columnId = '',
  spentSeconds = 0,
  onColumnIdChange,
  title = 'Новая задача',
  submitLabel,
  onChange,
  onClose,
  onSubmit,
  taskId = '',
  allTasks = [],
  currentUserId = '',
  canDeleteAnyComment = false,
  canDeleteOwnComment = false,
  canDeleteAnyAttachments = false,
  canDeleteOwnAttachments = false,
  canViewClientTab = false,
  canViewClientComments = false,
  canReplyToClient = false,
  canUpdateClientStatus = false,
  canManageClientLink = false,
  clientPublicLink = null,
  clientApprovalStatus = null,
  createdAt = '',
  projectName = '',
  onOpenTask,
  onCreateSubtask,
  onToggleSubtaskDone,
  isDraft = false,
  onDelete,
  clientView = false,
  clientFields,
  clientPanel = null,
  onClientPriorityChange,
  onClientDeadlineSet,
  clientApproval,
}: {
  isOpen: boolean;
  isSubmitting: boolean;
  canEditTasks: boolean;
  projectId: string;
  form: TaskCreateForm;
  members: ProjectMember[];
  columns?: TaskStatusColumn[];
  columnId?: string;
  spentSeconds?: number;
  onColumnIdChange?: (_columnId: string) => void;
  title?: string;
  submitLabel?: string;
  onChange: (_nextForm: TaskCreateForm) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  taskId?: string;
  allTasks?: Task[];
  currentUserId?: string;
  canDeleteAnyComment?: boolean;
  canDeleteOwnComment?: boolean;
  canDeleteAnyAttachments?: boolean;
  canDeleteOwnAttachments?: boolean;
  canViewClientTab?: boolean;
  canViewClientComments?: boolean;
  canReplyToClient?: boolean;
  canUpdateClientStatus?: boolean;
  canManageClientLink?: boolean;
  clientPublicLink?: string | null;
  clientApprovalStatus?: TaskClientApprovalStatus | null;
  createdAt?: string;
  creator?: TaskCreator | null;
  projectName?: string;
  onOpenTask?: (_taskId: string) => void;
  onCreateSubtask?: (_parentTaskId: string) => void;
  onToggleSubtaskDone?: (_subtaskId: string, _done: boolean) => void;
  isDraft?: boolean;
  onDelete?: () => void;
  clientView?: boolean;
  clientFields?: ClientTaskFields;
  clientPanel?: ReactNode;
  onClientPriorityChange?: (_priority: TaskPriority | null) => void;
  onClientDeadlineSet?: (_deadline: string) => void;
  clientApproval?: ClientTaskApproval;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [form.title, isOpen]);

  const isStartAfterDeadline = Boolean(
    form.start_at && form.deadline && new Date(form.start_at) > new Date(form.deadline),
  );

  // Открытая задача: её уведомления прочитаны, новые по ней не увеличивают счётчик.
  useEffect(() => {
    if (!isOpen || !taskId) return;
    return notificationsStore.openTask(taskId);
  }, [isOpen, taskId]);

  // Метка "Есть изменения" снимается при открытии и закрытии задачи. У клиента меток нет.
  useEffect(() => {
    if (!isOpen || !taskId || clientView) return;
    return taskViewsStore.openTask(taskId);
  }, [clientView, isOpen, taskId]);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 md:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose) {
          onClose();
        }
      }}
    >
      <div
        className='flex h-[calc(100dvh-1rem)] max-h-300 w-full max-w-[1680px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 md:h-[calc(100dvh-2rem)] md:rounded-2xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='min-w-0 border-b border-slate-100 p-3 md:px-6 md:py-4'>
          <span className='block px-2 text-[12px] font-medium text-slate-400'>
            {title}
          </span>
          <div className='mt-0.5 flex items-center gap-3'>
            <textarea
              ref={titleRef}
              value={form.title}
              readOnly={!canEditTasks}
              rows={1}
              placeholder='Название задачи'
              title={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              onInput={(event) => {
                const element = event.currentTarget;
                element.style.height = 'auto';
                element.style.height = `${element.scrollHeight}px`;
              }}
              className='block min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg leading-tight font-semibold text-slate-900 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 read-only:cursor-default read-only:hover:border-transparent md:text-[20px]'
            />
            <div className='flex shrink-0 items-center gap-1'>
              {taskId && !clientView && !isDraft ? (
                <TaskWatchMenu key={taskId} taskId={taskId} />
              ) : null}
              {taskId && projectId && !clientView ? (
                <CopyLinkMenu
                  taskId={taskId}
                  canManageClientLink={
                    canManageClientLink &&
                    !isDraft &&
                    columns.find((c) => c.id === columnId)?.slug !== 'done'
                  }
                  initLinkToken={clientPublicLink}
                  isClientVisible={form.is_client_visible ?? true}
                />
              ) : null}
              <button
                type='button'
                onClick={onClose}
                className='grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700'
                aria-label='Закрыть'
                title='Закрыть'
              >
                <svg
                  viewBox='0 0 24 24'
                  className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                >
                  <path d='M6 6l12 12M18 6L6 18' />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isStartAfterDeadline) return;
            onSubmit(event);
          }}
          className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
        >
          <div className='grid min-h-0 min-w-0 flex-1 auto-rows-max content-start gap-4 overflow-x-hidden overflow-y-auto p-3 md:px-6 md:py-5 lg:auto-rows-auto lg:grid-cols-[280px_minmax(0,1fr)_320px] lg:content-stretch lg:gap-6'>
            <TaskDetailsColumn
              canEditTasks={canEditTasks}
              form={form}
              members={members}
              columns={columns}
              columnId={columnId}
              spentSeconds={spentSeconds}
              createdAt={createdAt}
              creator={creator}
              projectName={projectName}
              currentTaskId={taskId}
              allTasks={allTasks}
              onOpenTask={onOpenTask}
              onCreateSubtask={onCreateSubtask}
              onToggleSubtaskDone={onToggleSubtaskDone}
              onChange={onChange}
              onColumnIdChange={onColumnIdChange}
              clientView={clientView}
              clientFields={clientFields}
              onClientPriorityChange={onClientPriorityChange}
              onClientDeadlineSet={onClientDeadlineSet}
              clientAccess={
                !clientView && canViewClientTab
                  ? {
                      canEditVisibility: canEditTasks,
                      // Новой задаче согласование запрашивается сразу.
                      approvalStatus: clientApprovalStatus ?? 'pending',
                    }
                  : undefined
              }
              clientApproval={clientView ? clientApproval : undefined}
            />

            {clientView && clientFields && !clientFields.description ? (
              <div className='hidden lg:block' />
            ) : (
              <TaskDescriptionEditor
                canEditTasks={canEditTasks}
                projectId={projectId}
                taskId={taskId}
                form={form}
                onChange={onChange}
              />
            )}

            {clientView ? (
              clientPanel
            ) : (
              <TaskSidePanel
                taskId={taskId}
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
                mentionUsers={members.map((member) => member.user)}
              />
            )}
          </div>

          <div className='grid min-w-0 gap-2 border-t border-slate-100 p-3 sm:flex sm:items-center sm:justify-between sm:gap-3 md:px-6 md:py-4'>
            <div>
              {onDelete ? (
                <Button
                  type='button'
                  variant='danger'
                  onClick={onDelete}
                  disabled={isSubmitting}
                >
                  {isDraft ? 'Удалить черновик' : 'Удалить задачу'}
                </Button>
              ) : null}
            </div>
            <div className='grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3'>
              <Button
                type='button'
                variant='secondary'
                onClick={onClose}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              {canEditTasks ? (
                <>
                  <Button
                    type='submit'
                    disabled={isSubmitting || isStartAfterDeadline}
                    title={isStartAfterDeadline ? 'Старт позже дедлайна' : undefined}
                    variant='primary'
                  >
                    {isSubmitting ? 'Сохранение...' : (submitLabel ?? 'Сохранить')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
