import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { formatName } from '../../../../utils/formatters';
import Button from '../../../ui/Button';
import type {
  ProjectMember,
  Task,
  TaskCreateForm,
  TaskClientApprovalStatus,
  TaskCreator,
  TaskPriority,
  TaskSpentUser,
  TaskStatusColumn,
} from '../../../../types/app';
import { FieldLabel, formatSecondsToHoursMinutes, formatTaskCreatedAt } from '../shared';

const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
}> = [
  { value: 'LOW', label: 'Низкий' },
  { value: 'MEDIUM', label: 'Средний' },
  { value: 'HIGH', label: 'Высокий' },
];

function useDropdownStyle(anchorRef: RefObject<HTMLElement | null>, isOpen: boolean) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const margin = 8;
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUpward = spaceBelow < 240 && spaceAbove > spaceBelow;
      const available = openUpward ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(160, Math.min(360, available - gap));

      setStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      });
    };

    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, isOpen]);

  return style;
}

function findTaskRecursive(tasks: Task[], id: string): Task | null {
  for (const task of tasks) {
    if (task.id === id) return task;
    const nested = findTaskRecursive(task.subtasks ?? [], id);
    if (nested) return nested;
  }
  return null;
}

function parseEstimationSeconds(value?: string): number {
  if (!value) return 0;
  const raw = value.includes(':') ? value : `${value}:00`;
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  const [rawHours, rawMinutes] = trimmed.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 0;
  }

  return hours * 3600 + minutes * 60;
}

function flattenTasks(tasks: Task[]): Task[] {
  const result: Task[] = [];
  const stack = [...tasks];

  while (stack.length > 0) {
    const current = stack.shift() as Task;
    result.push(current);
    if ((current.subtasks ?? []).length > 0) {
      stack.unshift(...(current.subtasks ?? []));
    }
  }

  return result;
}

export type ClientTaskFields = {
  description: boolean;
  estimation: boolean;
  priority: boolean;
  deadline: boolean;
  spentTime: boolean;
};

// Видимость и согласование задачи для клиента в окне сотрудника.
export type TaskClientAccess = {
  canEditVisibility: boolean;
  approvalStatus: TaskClientApprovalStatus | null;
};

// Согласование в окне клиента. Без onApprove кнопка не показывается.
export type ClientTaskApproval = {
  status: TaskClientApprovalStatus | null;
  onApprove?: () => void;
};

const DEFAULT_CLIENT_TASK_FIELDS: ClientTaskFields = {
  description: true,
  estimation: true,
  priority: false,
  deadline: true,
  spentTime: false,
};

export default function TaskDetailsColumn({
  canEditTasks,
  form,
  members,
  columns,
  columnId,
  spentSeconds,
  createdAt,
  creator,
  projectName,
  currentTaskId,
  allTasks,
  onOpenTask,
  onCreateSubtask,
  onToggleSubtaskDone,
  onChange,
  onColumnIdChange,
  clientView = false,
  clientFields = DEFAULT_CLIENT_TASK_FIELDS,
  onClientPriorityChange,
  onClientDeadlineSet,
  clientAccess,
  clientApproval,
}: {
  canEditTasks: boolean;
  form: TaskCreateForm;
  members: ProjectMember[];
  columns: TaskStatusColumn[];
  columnId: string;
  spentSeconds: number;
  createdAt?: string;
  creator?: TaskCreator | null;
  projectName?: string;
  currentTaskId?: string;
  allTasks?: Task[];
  onOpenTask?: (_taskId: string) => void;
  onCreateSubtask?: (_parentTaskId: string) => void;
  onToggleSubtaskDone?: (_subtaskId: string, _done: boolean) => void;
  onChange: (_nextForm: TaskCreateForm) => void;
  onColumnIdChange?: (_columnId: string) => void;
  clientView?: boolean;
  clientFields?: ClientTaskFields;
  // Клиент сохраняет эти поля сразу, без общей кнопки «Сохранить».
  onClientPriorityChange?: (_priority: TaskPriority | null) => void;
  onClientDeadlineSet?: (_deadline: string) => void;
  clientAccess?: TaskClientAccess;
  clientApproval?: ClientTaskApproval;
}) {
  // У клиента поля подчиняются его правам, а canEditTasks означает только черновик новой задачи.
  const isClientDraft = clientView && canEditTasks;
  const canClientChangePriority = clientView && Boolean(onClientPriorityChange);
  const canChangePriority = clientView ? canClientChangePriority : canEditTasks;
  const canEditDeadline = clientView
    ? isClientDraft && clientFields.deadline
    : canEditTasks;
  const canClientSetDeadline =
    clientView && !isClientDraft && !form.deadline && Boolean(onClientDeadlineSet);
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const showPriority = !clientView || clientFields.priority;
  const showEstimation = !clientView || clientFields.estimation;
  const showDeadline = !clientView || clientFields.deadline;
  const assigneePickerRef = useRef<HTMLDivElement | null>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const assigneeDropdownStyle = useDropdownStyle(assigneePickerRef, isAssigneePickerOpen);

  useEffect(() => {
    if (!isAssigneePickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        assigneePickerRef.current?.contains(target) ||
        assigneeDropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsAssigneePickerOpen(false);
      setAssigneeSearch('');
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isAssigneePickerOpen]);

  const assigneeOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        label: formatName(member.user),
      })),
    [members],
  );

  const filteredOptions = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();
    if (!query) return assigneeOptions;

    return assigneeOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [assigneeOptions, assigneeSearch]);

  const selectedAssignees = useMemo(
    () => assigneeOptions.filter((option) => form.assignee_ids?.includes(option.id)),
    [assigneeOptions, form.assignee_ids],
  );

  const orderedColumns = useMemo(
    () =>
      [...columns].sort(
        (left, right) =>
          (left.position ?? left.order ?? 0) - (right.position ?? right.order ?? 0),
      ),
    [columns],
  );

  const canManageAssignees = canEditTasks;
  const currentTask = useMemo(() => {
    if (!currentTaskId) return null;

    return findTaskRecursive(allTasks ?? [], currentTaskId);
  }, [allTasks, currentTaskId]);
  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of flattenTasks(allTasks ?? [])) {
      map.set(task.id, task);
    }
    return map;
  }, [allTasks]);
  const parentTask = useMemo(() => {
    const parentId = currentTask?.parent_task_id;
    if (!parentId) return null;
    return tasksById.get(parentId) ?? null;
  }, [currentTask?.parent_task_id, tasksById]);
  const newSubtaskParent = useMemo(() => {
    if (currentTaskId) return null;
    const parentId = form.parent_task_id ?? null;
    if (!parentId) return null;
    return tasksById.get(parentId) ?? null;
  }, [currentTaskId, form.parent_task_id, tasksById]);
  const subtasks = useMemo(() => currentTask?.subtasks ?? [], [currentTask?.subtasks]);
  const spentByUsers = useMemo(
    () =>
      (Array.isArray(currentTask?.spent_by_users)
        ? currentTask.spent_by_users
        : []
      ).filter(
        (item): item is TaskSpentUser =>
          Boolean(item) && typeof item.user_id === 'string' && item.user_id.length > 0,
      ),
    [currentTask?.spent_by_users],
  );
  const columnsById = useMemo(() => {
    const map = new Map<string, TaskStatusColumn>();
    for (const column of columns) map.set(column.id, column);
    return map;
  }, [columns]);
  const isOverdue = useMemo(() => {
    if (!form.deadline) return false;

    const hasExpired = new Date(form.deadline) < new Date();
    const currentColumn = columnsById.get(columnId);
    const isDone = currentColumn?.slug === 'done';

    return hasExpired && !isDone;
  }, [form.deadline, columnsById, columnId]);
  const doneSubtasks = useMemo(
    () =>
      subtasks.filter((subtask) => {
        const column = subtask.status_column_id
          ? columnsById.get(subtask.status_column_id)
          : null;
        return Boolean(column?.is_final);
      }),
    [columnsById, subtasks],
  );

  const toggleAssignee = (assigneeId: string) => {
    if (form.assignee_ids?.includes(assigneeId)) {
      onChange({
        ...form,
        assignee_ids: form.assignee_ids?.filter((id) => id !== assigneeId),
      });
      return;
    }

    onChange({
      ...form,
      assignee_ids: [...(form.assignee_ids || []), assigneeId],
    });
  };

  const handleEstimationChange = (rawValue: string) => {
    const cleaned = rawValue.replace(/[^0-9:]/g, '');
    onChange({ ...form, estimation: cleaned });
  };

  const handleDeadlineChange = (value: string | null) => {
    onChange({ ...form, deadline: value });
  };

  const handleStartChange = (value: string | null) => {
    onChange({ ...form, start_at: value });
  };
  const isStartAfterDeadline = Boolean(
    form.start_at && form.deadline && new Date(form.start_at) > new Date(form.deadline),
  );

  const estimateSeconds = useMemo(
    () => parseEstimationSeconds(form.estimation),
    [form.estimation],
  );
  const hasEstimate = estimateSeconds > 0;
  const remainingSeconds = estimateSeconds - spentSeconds;

  const handlePriorityChange = (priority: TaskPriority | null) => {
    if (!canEditTasks) return;
    onChange({ ...form, priority });
  };

  const formatToInput = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  // Получает текущую локальную дату и время для ограничения min
  const getLocalNowString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  return (
    <div className='min-w-0 max-w-full space-y-4 overflow-visible lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:pr-1'>
      {currentTask && parentTask ? (
        <button
          type='button'
          onClick={() => onOpenTask?.(parentTask.id)}
          className='inline-flex items-center gap-1 text-[13px] font-medium text-slate-700 transition-colors hover:text-slate-900'
        >
          <span aria-hidden='true'>↩</span>
          <span className='max-w-70 truncate' title={parentTask.title || '—'}>
            {parentTask.title || '—'}
          </span>
        </button>
      ) : null}

      {newSubtaskParent ? (
        <div className='rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-700'>
          Новая подзадача для задачи{' '}
          <span className='font-semibold' title={newSubtaskParent.title || '—'}>
            «{newSubtaskParent.title || 'Без названия'}»
          </span>
        </div>
      ) : null}

      {clientAccess ? (
        <div className='grid gap-3'>
          <label className='flex w-fit items-center gap-2 text-[13px] font-medium text-slate-700'>
            <input
              type='checkbox'
              className='size-4 shrink-0 accent-blue-600 disabled:cursor-not-allowed'
              checked={form.is_client_visible ?? true}
              disabled={!clientAccess.canEditVisibility}
              onChange={(event) =>
                onChange({ ...form, is_client_visible: event.target.checked })
              }
            />
            Видна клиенту
          </label>
          {/* Скрытую задачу клиент не видит и согласовать не может. */}
          {(form.is_client_visible ?? true) ||
          clientAccess.approvalStatus === 'approved' ? (
            <div className='grid gap-1.5'>
              <span className='text-[13px] leading-tight font-medium text-slate-700'>
                Согласование
              </span>
              <ApprovalStatusField status={clientAccess.approvalStatus} />
              {clientAccess.approvalStatus !== 'approved' ? (
                <span className='text-[12px] text-slate-400'>
                  «Согласовано» отмечает клиент в своём кабинете.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {clientApproval?.status === 'approved' ? (
        <ClientApprovalBlock>
          <Button type='button' size='sm' variant='success' disabled className='w-full'>
            <CheckIcon />
            Согласовано
          </Button>
        </ClientApprovalBlock>
      ) : clientApproval?.status === 'pending' ? (
        <ClientApprovalBlock>
          {clientApproval.onApprove ? (
            <>
              <Button
                type='button'
                size='sm'
                variant='danger'
                className='w-full'
                onClick={clientApproval.onApprove}
              >
                Согласовать
              </Button>
              <span className='text-[12px] text-slate-400'>
                Согласуйте задачу, когда все детали обсуждены. Отменить согласование
                нельзя.
              </span>
            </>
          ) : (
            <ApprovalStatusField status='pending' />
          )}
        </ClientApprovalBlock>
      ) : null}

      {!isClientDraft ? (
        <FieldLabel label='Статус'>
          <select
            value={columnId}
            disabled={!canEditTasks || orderedColumns.length === 0}
            onChange={(event) => onColumnIdChange?.(event.target.value)}
            className='block h-10 min-w-0 max-w-full w-full appearance-none rounded-lg border border-slate-300 bg-white bg-[url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22%23667085%22%20stroke-width%3D%221.6%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")] bg-size-[18px_18px] bg-position-[right_10px_center] bg-no-repeat px-3 pr-9 text-[14px] text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60'
          >
            <option value=''>
              {orderedColumns.length === 0 ? 'Нет статусов' : 'Без статуса'}
            </option>
            {orderedColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name ?? column.label}
              </option>
            ))}
          </select>
        </FieldLabel>
      ) : null}

      {showPriority ? (
        <FieldLabel label='Приоритет'>
          <select
            value={form.priority || ''}
            disabled={!canChangePriority}
            onChange={(event) => {
              const priority = (event.target.value || null) as TaskPriority | null;
              if (clientView) onClientPriorityChange?.(priority);
              else handlePriorityChange(priority);
            }}
            className='block h-10 min-w-0 max-w-full w-full appearance-none rounded-lg border border-slate-300 bg-white bg-[url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22%23667085%22%20stroke-width%3D%221.6%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")] bg-size-[18px_18px] bg-position-[right_10px_center] bg-no-repeat px-3 pr-9 text-[14px] text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60'
          >
            <option value=''>Без приоритета</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FieldLabel>
      ) : null}

      {showEstimation ? (
        <FieldLabel label='Оценка времени (ч)'>
          <input
            type='text'
            inputMode='numeric'
            placeholder={canEditTasks && !clientView ? '4:00' : '—'}
            value={form.estimation}
            readOnly={!canEditTasks || clientView}
            onChange={(event) => handleEstimationChange(event.target.value)}
            className='block h-10 min-w-0 max-w-full w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
          />
        </FieldLabel>
      ) : null}

      {clientView && clientFields.spentTime ? (
        <TaskTimeInfo
          label='Затрачено'
          value={formatSecondsToHoursMinutes(spentSeconds)}
        />
      ) : null}

      {!clientView ? (
        <div className={`grid gap-2 ${hasEstimate ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TaskTimeInfo
            label='Затрачено'
            value={formatSecondsToHoursMinutes(spentSeconds)}
          />
          {hasEstimate ? (
            remainingSeconds < 0 ? (
              <TaskTimeInfo
                label='Перерасход'
                value={formatSecondsToHoursMinutes(Math.abs(remainingSeconds))}
                tone='danger'
              />
            ) : (
              <TaskTimeInfo
                label='Осталось'
                value={formatSecondsToHoursMinutes(remainingSeconds)}
              />
            )
          ) : null}
        </div>
      ) : null}
      {!clientView && spentByUsers.length > 0 ? (
        <div className='mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2'>
          <div className='text-[11px] font-semibold text-slate-500'>По сотрудникам</div>
          <div className='mt-1 grid gap-1'>
            {spentByUsers.map((spentByUser) => {
              const fullName = [spentByUser.name, spentByUser.last_name]
                .filter(Boolean)
                .join(' ')
                .trim();

              return (
                <div
                  key={spentByUser.user_id}
                  className='flex items-center justify-between gap-3 text-[12px]'
                >
                  <span className='truncate text-slate-600' title={fullName || '—'}>
                    {fullName || '—'}
                  </span>
                  <span className='shrink-0 font-medium text-slate-800'>
                    {formatSecondsToHoursMinutes(spentByUser.spent_seconds ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!clientView ? (
        <FieldLabel label='Старт выполнения'>
          <div className='relative min-w-0 max-w-full w-full'>
            <input
              type='datetime-local'
              value={formatToInput(form.start_at)}
              readOnly={!canEditDeadline}
              onChange={(event) => {
                const val = event.target.value;
                handleStartChange(val ? new Date(val).toISOString() : null);
              }}
              className='block h-10 min-w-0 max-w-full w-full rounded-lg border border-slate-300 bg-white pl-3 pr-10 text-[14px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50'
            />

            {form.start_at && canEditDeadline && (
              <button
                type='button'
                onClick={() => handleStartChange(null)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 transition-colors hover:text-slate-600 context-menu-none'
                title='Убрать старт выполнения'
              >
                <svg
                  viewBox='0 0 24 24'
                  className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                >
                  <path d='M6 6l12 12M18 6L6 18'></path>
                </svg>
              </button>
            )}
          </div>
          {isStartAfterDeadline && (
            <span className='block mt-1 text-[12px] font-medium text-red-500 transition-all'>
              Старт позже дедлайна
            </span>
          )}
        </FieldLabel>
      ) : null}

      {canClientSetDeadline ? (
        <FieldLabel label='Дедлайн'>
          <div className='grid gap-2'>
            <input
              type='datetime-local'
              min={getLocalNowString()}
              value={deadlineDraft}
              onChange={(event) => setDeadlineDraft(event.target.value)}
              className='block h-10 min-w-0 max-w-full w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
            />
            <Button
              type='button'
              size='sm'
              disabled={!deadlineDraft}
              onClick={() => onClientDeadlineSet?.(new Date(deadlineDraft).toISOString())}
            >
              Установить дедлайн
            </Button>
            <span className='text-[12px] text-slate-400'>
              Изменить установленный дедлайн сможет только команда проекта.
            </span>
          </div>
        </FieldLabel>
      ) : showDeadline ? (
        <FieldLabel label='Дедлайн'>
          <div className='relative min-w-0 max-w-full w-full'>
            <input
              type='datetime-local'
              min={getLocalNowString()}
              value={formatToInput(form.deadline)}
              readOnly={!canEditDeadline}
              onChange={(event) => {
                const val = event.target.value;
                handleDeadlineChange(
                  event.target.value ? new Date(val).toISOString() : null,
                );
              }}
              className='block h-10 min-w-0 max-w-full w-full rounded-lg border border-slate-300 bg-white pl-3 pr-10 text-[14px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50'
            />

            {form.deadline && canEditDeadline && (
              <button
                type='button'
                onClick={() => handleDeadlineChange(null)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 transition-colors hover:text-slate-600 context-menu-none'
                title='Убрать дедлайн'
              >
                <svg
                  viewBox='0 0 24 24'
                  className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                >
                  <path d='M6 6l12 12M18 6L6 18'></path>
                </svg>
              </button>
            )}
          </div>
          {isOverdue && (
            <span className='block mt-1 text-[12px] font-medium text-red-500 transition-all'>
              Дедлайн просрочен!
            </span>
          )}
        </FieldLabel>
      ) : null}
      {!clientView && currentTask ? (
        <div className='rounded-lg border border-slate-200 bg-white p-3'>
          <div className='mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-2'>
            <span className='text-[13px] font-semibold text-slate-700'>
              Подзадачи {doneSubtasks.length}/{subtasks.length}
            </span>
          </div>
          <div className='grid gap-1.5'>
            {subtasks.length === 0 ? (
              <span className='text-[12px] text-slate-500'>Подзадач пока нет</span>
            ) : (
              subtasks.map((subtask) => {
                const subtaskColumn = subtask.status_column_id
                  ? columnsById.get(subtask.status_column_id)
                  : null;
                const isDone = Boolean(subtaskColumn?.is_final);

                return (
                  <div
                    key={subtask.id}
                    className='flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-slate-700 transition-colors hover:bg-slate-50'
                  >
                    <button
                      type='button'
                      disabled={!onToggleSubtaskDone}
                      onClick={() => onToggleSubtaskDone?.(subtask.id, !isDone)}
                      aria-label={
                        isDone ? 'Снять отметку «выполнено»' : 'Отметить выполненной'
                      }
                      title={
                        isDone ? 'Снять отметку «выполнено»' : 'Отметить выполненной'
                      }
                      className={`inline-grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${
                        isDone
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600'
                          : 'border-slate-400 text-transparent'
                      } ${
                        onToggleSubtaskDone
                          ? 'cursor-pointer hover:border-emerald-500'
                          : 'cursor-default'
                      }`}
                    >
                      <svg
                        viewBox='0 0 24 24'
                        className='size-2.5 fill-none stroke-current stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]'
                        aria-hidden='true'
                      >
                        <path d='M5 13l4 4L19 7' />
                      </svg>
                    </button>
                    <button
                      type='button'
                      onClick={() => onOpenTask?.(subtask.id)}
                      className={`min-w-0 flex-1 truncate text-left transition-colors hover:text-slate-900 ${
                        isDone ? 'text-slate-400 line-through' : ''
                      }`}
                    >
                      {subtask.title || 'Без названия'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {canEditTasks ? (
            <button
              type='button'
              onClick={() => currentTaskId && onCreateSubtask?.(currentTaskId)}
              className='mt-2 text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900'
            >
              + Добавить подзадачу
            </button>
          ) : null}
        </div>
      ) : null}

      {!clientView && (canManageAssignees || selectedAssignees.length > 0) && (
        <FieldLabel label='Сотрудники'>
          <div className='grid gap-2'>
            <div className='flex flex-wrap gap-1.5'>
              {selectedAssignees.length === 0 ? (
                <span className='text-[12px] text-slate-500'>Сотрудники не выбраны</span>
              ) : (
                selectedAssignees.map((assignee) => (
                  <span
                    key={assignee.id}
                    className='inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] text-slate-700'
                  >
                    {assignee.label}
                    {canManageAssignees ? (
                      <button
                        type='button'
                        className='grid size-4 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                        onClick={() => toggleAssignee(assignee.id)}
                        aria-label={`Убрать ${assignee.label}`}
                      >
                        <svg
                          viewBox='0 0 12 12'
                          className='size-2.5 fill-none stroke-current stroke-2'
                        >
                          <path
                            d='M3 3l6 6M9 3l-6 6'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                        </svg>
                      </button>
                    ) : null}
                  </span>
                ))
              )}
            </div>

            {canManageAssignees ? (
              <div className='relative' ref={assigneePickerRef}>
                <button
                  type='button'
                  onClick={() => setIsAssigneePickerOpen((current) => !current)}
                  className='flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-[14px] text-slate-700 transition-colors hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none'
                >
                  <span>Выбрать сотрудников</span>
                  <svg
                    viewBox='0 0 20 20'
                    className='size-4 fill-none stroke-slate-500 stroke-[1.8]'
                    aria-hidden='true'
                  >
                    <path d='M5 8l5 5 5-5' strokeLinecap='round' strokeLinejoin='round' />
                  </svg>
                </button>

                {isAssigneePickerOpen && assigneeDropdownStyle
                  ? createPortal(
                      <div
                        ref={assigneeDropdownRef}
                        style={assigneeDropdownStyle}
                        className='z-[2000] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/10'
                      >
                        <div className='shrink-0 border-b border-slate-100 p-2'>
                          <input
                            value={assigneeSearch}
                            onChange={(event) => setAssigneeSearch(event.target.value)}
                            placeholder='Поиск'
                            autoFocus
                            className='block h-8 w-full rounded-md border border-slate-200 px-2 text-[13px] outline-none focus:border-blue-500'
                          />
                        </div>
                        <div className='min-h-0 flex-1 overflow-auto py-1'>
                          {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => {
                              const checked = form.assignee_ids?.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type='button'
                                  className='flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50'
                                  onClick={() => toggleAssignee(option.id)}
                                >
                                  <input
                                    type='checkbox'
                                    checked={checked}
                                    readOnly
                                    className='pointer-events-none'
                                  />
                                  <span>{option.label}</span>
                                </button>
                              );
                            })
                          ) : (
                            <div className='px-3 py-2 text-[13px] text-slate-500'>
                              Ничего не найдено
                            </div>
                          )}
                        </div>
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            ) : null}
          </div>
        </FieldLabel>
      )}

      {(createdAt || creator || projectName) && (
        <div className='mt-2 grid gap-1.5 border-t border-slate-100 pt-3 text-[12px] text-slate-500'>
          {!clientView && createdAt ? (
            <div className='flex items-baseline gap-2'>
              <span className='shrink-0 text-slate-400'>Создано</span>
              <span className='text-slate-700'>{formatTaskCreatedAt(createdAt)}</span>
            </div>
          ) : null}
          {!clientView ? (
            <div className='flex items-baseline gap-2'>
              <span className='shrink-0 text-slate-400'>Создатель</span>
              <span className='text-slate-700'>
                {`${creator?.name || ''} ${creator?.last_name || ''}`.trim() || '—'}
              </span>
            </div>
          ) : null}
          {projectName ? (
            <div className='flex items-baseline gap-2'>
              <span className='shrink-0 text-slate-400'>Проект</span>
              <span className='truncate text-slate-700' title={projectName}>
                {projectName}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TaskTimeInfo({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}) {
  const isDanger = tone === 'danger';
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-lg border px-3 py-2 ${
        isDanger ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div
        className={`text-[11px] font-semibold ${
          isDanger ? 'text-red-600' : 'text-slate-500'
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-[14px] font-semibold ${
          isDanger ? 'text-red-600' : 'text-slate-800'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='mr-1.5 size-4 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <path d='M20 6 9 17l-5-5' />
    </svg>
  );
}

// Не FieldLabel: внутри <label> клик по подписи нажимал бы кнопку согласования.
function ClientApprovalBlock({ children }: { children: ReactNode }) {
  return (
    <div className='grid min-w-0 gap-1.5'>
      <span className='text-[13px] leading-tight font-medium text-slate-700'>
        Согласование
      </span>
      <div className='grid gap-2'>{children}</div>
    </div>
  );
}

function ApprovalStatusField({ status }: { status: TaskClientApprovalStatus | null }) {
  const isApproved = status === 'approved';

  return (
    <div
      className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-[14px] ${
        isApproved
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-amber-500'}`}
      />
      {isApproved ? 'Согласовано' : 'Ожидает согласования'}
    </div>
  );
}
