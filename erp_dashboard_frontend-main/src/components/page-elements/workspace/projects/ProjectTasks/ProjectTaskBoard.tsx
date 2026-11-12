import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import {
  Table,
  TableContainer,
  TableEmptyRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useTableSort,
} from '../../../../ui/table';
import { formatDurationHms, formatName } from '../../../../../utils/formatters';
import { formatTaskDueDates, groupTasksByDue } from '../../../../../utils/taskDueBuckets';
import { useTaskViews } from '../../../../../notifications/taskViewsStore';
import ViewModeTabs from '../AllTasksTablePanel/components/ViewModeTabs';
import type { ViewMode } from '../AllTasksTablePanel/types';
import TasksGantt from '../TasksGantt';
import { orderTasksByHierarchy } from '../orderTasksByHierarchy';
import type {
  ProjectMember,
  Task,
  TaskPriority,
  TaskStatusColumn,
  User,
} from '../../../../../types/app';

type SortKey = 'title' | 'status' | 'priority' | 'assignees' | 'spent';

type GroupBy = 'status' | 'assignee' | 'priority';

type Props = {
  tasks: Task[];
  columns: TaskStatusColumn[];
  members: ProjectMember[];
  isLoading: boolean;
  isTaskDragBlocked: boolean;
  isColumnDragBlocked: boolean;
  canCreateTasks: boolean;
  canMoveTasks: boolean;
  canCreateUpdateColumns: boolean;
  canDeleteColumns: boolean;
  onMoveTask: (
    _taskId: string,
    _statusColumnId: string,
    _destinationIndex: number,
    _beforeTaskId?: string,
    _afterTaskId?: string,
  ) => void;
  onMoveColumn: (_columnId: string, _destinationIndex: number) => void;
  onOpenTask: (_task: Task) => void;
  onCreateTaskInColumn: (_column: TaskStatusColumn) => void;
  onCreateColumn: () => void;
  onEditColumn: (_column: TaskStatusColumn) => void;
  onDeleteColumn: (_column: TaskStatusColumn) => void;
  clientView?: boolean;
};

type DropTarget = {
  statusColumnId: string;
  index: number;
};

const NO_STATUS_COLUMN_ID = '__no_status__';
const NO_STATUS_COLUMN: TaskStatusColumn = {
  id: NO_STATUS_COLUMN_ID,
  label: 'Без статуса',
  order: Number.MAX_SAFE_INTEGER,
  name: 'Без статуса',
  color: '#7e8fb4',
};

const GROUP_BY_LABEL: Record<GroupBy, string> = {
  status: 'По статусу',
  assignee: 'По исполнителю',
  priority: 'По приоритету',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

const PRIORITY_COLUMN_COLOR: Record<TaskPriority, string> = {
  HIGH: '#ef2d2d',
  MEDIUM: '#f29a3f',
  LOW: '#2d6ff7',
};

const PRIORITY_CHIP_CLASS: Record<TaskPriority, string> = {
  LOW: 'bg-[#edf3ff] text-[#2d6ff7]',
  MEDIUM: 'bg-[#fff1e0] text-[#f29a3f]',
  HIGH: 'bg-[#fde8eb] text-[#ef2d2d]',
};

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function getTaskStatusKey(task: Task): string {
  return task.status_column_id ?? '';
}

function getResolvedTaskStatusKey(task: Task, statusColumnIds: Set<string>): string {
  const key = getTaskStatusKey(task);
  return key && statusColumnIds.has(key) ? key : NO_STATUS_COLUMN_ID;
}

function memberInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function getUserInitials(user: User): string {
  const first = (user.first_name ?? '').trim();
  const last = (user.last_name ?? '').trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
  }
  const name = (user.name ?? '').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/);
  return (
    (parts[0]?.charAt(0) ?? '?').toUpperCase() + (parts[1]?.charAt(0) ?? '').toUpperCase()
  );
}

function pickColumnDotColor(column: TaskStatusColumn) {
  return column.color || '#7e8fb4';
}

function formatTaskDuration(seconds?: number | null): string {
  if (typeof seconds !== 'number' || seconds <= 0) {
    return '0:00';
  }

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function isTaskFinal(task: Task, columnsById: Map<string, TaskStatusColumn>): boolean {
  return Boolean(columnsById.get(task.status_column_id ?? '')?.is_final);
}

function orderTasksWithFinalLast(
  tasks: Task[],
  columnsById: Map<string, TaskStatusColumn>,
): Task[] {
  return [...tasks].sort((left, right) => {
    const leftFinal = isTaskFinal(left, columnsById);
    const rightFinal = isTaskFinal(right, columnsById);
    if (leftFinal === rightFinal) return 0;
    return leftFinal ? 1 : -1;
  });
}

export default function ProjectTaskBoard({
  tasks,
  columns,
  members,
  isLoading,
  isTaskDragBlocked,
  isColumnDragBlocked,
  canCreateTasks,
  canMoveTasks,
  canCreateUpdateColumns,
  canDeleteColumns,
  onMoveTask,
  onMoveColumn,
  onOpenTask,
  onCreateTaskInColumn,
  onCreateColumn,
  onEditColumn,
  onDeleteColumn,
  clientView = false,
}: Props) {
  const [draggedTaskId, setDraggedTaskId] = useState('');
  const [draggedColumnId, setDraggedColumnId] = useState('');
  const [columnHoverIndex, setColumnHoverIndex] = useState<number | null>(null);
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [isAssigneeFilterOpen, setIsAssigneeFilterOpen] = useState(false);
  const assigneeFilterRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const taskViews = useTaskViews();
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);

  const { sort, toggleSort, directionOf } = useTableSort<SortKey>({
    initial: { key: 'title', direction: 'asc' },
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 200);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (!openColumnMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node)) {
        setOpenColumnMenuId(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openColumnMenuId]);

  useEffect(() => {
    if (!isAssigneeFilterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!assigneeFilterRef.current?.contains(event.target as Node)) {
        setIsAssigneeFilterOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isAssigneeFilterOpen]);

  useEffect(() => {
    if (!isGroupMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!groupMenuRef.current?.contains(event.target as Node)) {
        setIsGroupMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isGroupMenuOpen]);

  const orderedColumns = useMemo(
    () =>
      [...columns].sort(
        (left, right) =>
          (left.position ?? left.order ?? 0) - (right.position ?? right.order ?? 0),
      ),
    [columns],
  );

  const columnsWithoutDragged = useMemo(
    () =>
      draggedColumnId
        ? orderedColumns.filter((column) => column.id !== draggedColumnId)
        : orderedColumns,
    [draggedColumnId, orderedColumns],
  );

  const displayColumns = useMemo(() => {
    if (!draggedColumnId || columnHoverIndex === null) return orderedColumns;
    const dragged = orderedColumns.find((column) => column.id === draggedColumnId);
    if (!dragged) return orderedColumns;
    const clamped = Math.max(0, Math.min(columnHoverIndex, columnsWithoutDragged.length));
    return [
      ...columnsWithoutDragged.slice(0, clamped),
      dragged,
      ...columnsWithoutDragged.slice(clamped),
    ];
  }, [columnHoverIndex, columnsWithoutDragged, draggedColumnId, orderedColumns]);

  const statusColumnIds = useMemo(
    () => new Set(orderedColumns.map((column) => column.id)),
    [orderedColumns],
  );

  const columnsById = useMemo(() => {
    const map = new Map<string, TaskStatusColumn>();
    for (const column of orderedColumns) map.set(column.id, column);
    return map;
  }, [orderedColumns]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, User>();
    for (const member of members) {
      if (!map.has(member.user.id)) map.set(member.user.id, member.user);
    }
    for (const task of tasks) {
      for (const assignee of task.assignees ?? []) {
        if (!map.has(assignee.id)) map.set(assignee.id, assignee);
      }
    }
    return Array.from(map.values()).sort((left, right) =>
      formatName(left).localeCompare(formatName(right), 'ru'),
    );
  }, [members, tasks]);

  const filteredTasks = useMemo(() => {
    const assigneeSet = new Set(selectedAssigneeIds);
    const search = debouncedSearch;
    // "#123" или "123" находит задачу по номеру.
    const searchNumber = /^#?\d+$/.test(search) ? Number(search.replace('#', '')) : null;
    return tasks.filter((task) => {
      if (
        search &&
        task.number !== searchNumber &&
        !(task.title ?? '').toLowerCase().includes(search)
      ) {
        return false;
      }
      if (assigneeSet.size > 0) {
        const ids = task.assignee_ids ?? task.assignees?.map((u) => u.id) ?? [];
        if (!ids.some((id) => assigneeSet.has(id))) return false;
      }
      return true;
    });
  }, [debouncedSearch, selectedAssigneeIds, tasks]);

  const ganttTasks = useMemo(
    () =>
      viewMode === 'gantt'
        ? filteredTasks.filter((task) => !isTaskFinal(task, columnsById))
        : [],
    [columnsById, filteredTasks, viewMode],
  );

  const canDragTasks = viewMode === 'kanban' && groupBy === 'status' && canMoveTasks;

  type Bucket = {
    key: string;
    name: string;
    color?: string | null;
    column?: TaskStatusColumn;
    tasks: Task[];
  };

  const tasksByStatusColumn = useMemo(() => {
    const grouped = new Map<string, Task[]>([[NO_STATUS_COLUMN_ID, []]]);
    for (const column of orderedColumns) grouped.set(column.id, []);

    for (const task of filteredTasks) {
      const key = getResolvedTaskStatusKey(task, statusColumnIds);
      grouped.get(key)?.push(task);
    }

    for (const [, columnTasks] of grouped) {
      columnTasks.sort((left, right) => {
        const leftPos = Number(left.position ?? 0);
        const rightPos = Number(right.position ?? 0);
        if (leftPos !== rightPos) return leftPos - rightPos;
        return (left.title ?? '').localeCompare(right.title ?? '', 'ru-RU');
      });
    }

    const ordered = new Map<string, Task[]>();
    for (const [columnId, columnTasks] of grouped) {
      ordered.set(columnId, orderTasksByHierarchy(columnTasks));
    }

    return ordered;
  }, [filteredTasks, orderedColumns, statusColumnIds]);

  const kanbanBuckets = useMemo<Bucket[]>(() => {
    if (viewMode === 'due') {
      return groupTasksByDue(filteredTasks, (task) => isTaskFinal(task, columnsById)).map(
        (bucket) => ({
          key: bucket.key,
          name: bucket.name,
          color: bucket.color,
          tasks: bucket.tasks,
        }),
      );
    }

    if (groupBy === 'status') {
      const noStatusTasks = tasksByStatusColumn.get(NO_STATUS_COLUMN_ID) ?? [];
      const base: Bucket[] = displayColumns.map((column) => ({
        key: column.id,
        name: column.name ?? column.label,
        color: pickColumnDotColor(column),
        column,
        tasks: tasksByStatusColumn.get(column.id) ?? [],
      }));
      if (noStatusTasks.length > 0) {
        return [
          {
            key: NO_STATUS_COLUMN_ID,
            name: 'Без статуса',
            color: pickColumnDotColor(NO_STATUS_COLUMN),
            column: NO_STATUS_COLUMN,
            tasks: noStatusTasks,
          },
          ...base,
        ];
      }
      return base;
    }

    if (groupBy === 'assignee') {
      const byKey = new Map<string, Bucket>();
      const fallback: Bucket = {
        key: '__no_assignee__',
        name: 'Без исполнителя',
        color: '#7e8fb4',
        tasks: [],
      };
      for (const task of filteredTasks) {
        const assignees = task.assignees ?? [];
        if (assignees.length === 0) {
          fallback.tasks.push(task);
          continue;
        }
        for (const assignee of assignees) {
          let bucket = byKey.get(assignee.id);
          if (!bucket) {
            bucket = {
              key: assignee.id,
              name: formatName(assignee),
              color: '#7e8fb4',
              tasks: [],
            };
            byKey.set(assignee.id, bucket);
          }
          bucket.tasks.push(task);
        }
      }
      const result = Array.from(byKey.values()).sort((left, right) =>
        left.name.localeCompare(right.name, 'ru'),
      );
      if (fallback.tasks.length) result.push(fallback);
      return result;
    }

    const priorityBuckets: Bucket[] = [
      { key: 'HIGH', name: 'Высокий', color: PRIORITY_COLUMN_COLOR.HIGH, tasks: [] },
      { key: 'MEDIUM', name: 'Средний', color: PRIORITY_COLUMN_COLOR.MEDIUM, tasks: [] },
      { key: 'LOW', name: 'Низкий', color: PRIORITY_COLUMN_COLOR.LOW, tasks: [] },
    ];
    const fallback: Bucket = {
      key: '__no_priority__',
      name: 'Без приоритета',
      color: '#7e8fb4',
      tasks: [],
    };
    const byKey = new Map(priorityBuckets.map((bucket) => [bucket.key, bucket]));
    for (const task of filteredTasks) {
      if (task.priority && byKey.has(task.priority)) {
        byKey.get(task.priority)!.tasks.push(task);
      } else {
        fallback.tasks.push(task);
      }
    }
    return fallback.tasks.length ? [...priorityBuckets, fallback] : priorityBuckets;
  }, [
    columnsById,
    displayColumns,
    filteredTasks,
    groupBy,
    tasksByStatusColumn,
    viewMode,
  ]);

  const sortedTasks = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const compare = (left: Task, right: Task): number => {
      switch (sort.key) {
        case 'title':
          return (left.title ?? '').localeCompare(right.title ?? '', 'ru') * direction;
        case 'status': {
          const l = columnsById.get(left.status_column_id ?? '')?.name ?? '';
          const r = columnsById.get(right.status_column_id ?? '')?.name ?? '';
          return l.localeCompare(r, 'ru') * direction;
        }
        case 'priority': {
          const l = left.priority ? PRIORITY_ORDER[left.priority] : -1;
          const r = right.priority ? PRIORITY_ORDER[right.priority] : -1;
          return (l - r) * direction;
        }
        case 'assignees': {
          const l = (left.assignees ?? []).map((u) => formatName(u)).join(', ');
          const r = (right.assignees ?? []).map((u) => formatName(u)).join(', ');
          return l.localeCompare(r, 'ru') * direction;
        }
        case 'spent':
          return ((left.spent_seconds ?? 0) - (right.spent_seconds ?? 0)) * direction;
        default:
          return 0;
      }
    };
    return [...filteredTasks].sort(compare);
  }, [columnsById, filteredTasks, sort.key, sort.direction]);

  const toggleAssigneeId = (id: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const hasActiveFilter = Boolean(searchQuery) || selectedAssigneeIds.length > 0;

  const handleDrop = (target: DropTarget) => {
    if (!canDragTasks || !draggedTaskId || isTaskDragBlocked) return;
    if (target.statusColumnId === NO_STATUS_COLUMN_ID) return;

    const draggedTask = tasks.find((task) => task.id === draggedTaskId);
    if (!draggedTask) return;

    let destinationIndex = target.index;
    const sourceKey = getResolvedTaskStatusKey(draggedTask, statusColumnIds);

    if (sourceKey === target.statusColumnId) {
      const columnTasks = tasksByStatusColumn.get(target.statusColumnId) ?? [];
      const sourceIndex = columnTasks.findIndex((task) => task.id === draggedTaskId);
      if (sourceIndex >= 0 && sourceIndex < destinationIndex) {
        destinationIndex -= 1;
      }
    }

    const visibleTargetTasks = (
      tasksByStatusColumn.get(target.statusColumnId) ?? []
    ).filter((task) => task.id !== draggedTaskId);
    const beforeTaskId = visibleTargetTasks[destinationIndex]?.id;
    const afterTaskId = beforeTaskId
      ? undefined
      : visibleTargetTasks[destinationIndex - 1]?.id;
    onMoveTask(
      draggedTaskId,
      target.statusColumnId,
      Math.max(0, destinationIndex),
      beforeTaskId,
      afterTaskId,
    );
    setDraggedTaskId('');
  };

  const handleColumnDrop = () => {
    if (!canCreateUpdateColumns || !draggedColumnId || isColumnDragBlocked) {
      setDraggedColumnId('');
      setColumnHoverIndex(null);
      return;
    }

    if (columnHoverIndex !== null) {
      const sourceIndex = orderedColumns.findIndex(
        (column) => column.id === draggedColumnId,
      );
      const clamped = Math.max(
        0,
        Math.min(columnHoverIndex, columnsWithoutDragged.length),
      );
      if (sourceIndex !== clamped) {
        onMoveColumn(draggedColumnId, clamped);
      }
    }

    setDraggedColumnId('');
    setColumnHoverIndex(null);
  };

  const updateColumnHoverFromEvent = (
    event: React.DragEvent<HTMLDivElement>,
    overColumnId: string,
  ) => {
    if (!draggedColumnId || overColumnId === draggedColumnId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    const filteredIndex = columnsWithoutDragged.findIndex(
      (column) => column.id === overColumnId,
    );
    if (filteredIndex < 0) return;

    const nextIndex = isLeftHalf ? filteredIndex : filteredIndex + 1;
    setColumnHoverIndex((previous) => (previous === nextIndex ? previous : nextIndex));
  };

  const memberLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      map.set(member.user.id, formatName(member.user));
    }
    return map;
  }, [members]);

  return (
    <section className='flex min-h-0 min-w-0 flex-1 flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-3 empty:hidden'>
        {/* В кабинете клиента заголовок заменяет вкладка «Задачи». */}
        {!clientView ? (
          <h3 className='mr-auto hidden text-xl leading-none font-semibold text-[#10275a] sm:block sm:text-[22px]'>
            Задачи
          </h3>
        ) : null}

        {!clientView ? (
          <ViewModeTabs viewMode={viewMode} onViewModeChange={setViewMode} />
        ) : null}
      </div>

      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <label className='flex h-10 min-w-0 flex-1 basis-44 items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[14px] text-[#7e8fb4] sm:min-w-[220px]'>
          <svg
            className='size-5 shrink-0 fill-none stroke-current stroke-[1.8]'
            viewBox='0 0 24 24'
            aria-hidden='true'
          >
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder='Поиск по названию'
            className='min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-[#1f3565] outline-none placeholder:text-[#7e8fb4]'
          />
        </label>

        {!clientView ? (
          <FilterDropdown
            containerRef={assigneeFilterRef}
            label='Участники'
            isOpen={isAssigneeFilterOpen}
            onOpenChange={setIsAssigneeFilterOpen}
            selectedCount={selectedAssigneeIds.length}
            totalCount={assigneeOptions.length}
            onClear={() => setSelectedAssigneeIds([])}
            options={assigneeOptions.map((user) => ({
              id: user.id,
              label: formatName(user),
              avatar: (
                <span className='grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e8eef9] text-[11px] font-semibold text-[#1f3565]'>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=''
                      className='size-full object-cover'
                    />
                  ) : (
                    <span>{getUserInitials(user)}</span>
                  )}
                </span>
              ),
            }))}
            selectedIds={selectedAssigneeIds}
            onToggle={toggleAssigneeId}
          />
        ) : null}

        {!clientView && viewMode === 'kanban' ? (
          <div className='relative min-w-0' ref={groupMenuRef}>
            <button
              type='button'
              onClick={() => setIsGroupMenuOpen((prev) => !prev)}
              className={joinClassNames(
                'inline-flex h-10 w-full items-center justify-between gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors sm:w-auto',
                isGroupMenuOpen
                  ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
                  : 'border-[#c9d8f8] bg-white text-[#1f3565] hover:bg-[#f3f7ff]',
              )}
              aria-haspopup='listbox'
              aria-expanded={isGroupMenuOpen}
            >
              {GROUP_BY_LABEL[groupBy]}
              <Caret open={isGroupMenuOpen} />
            </button>

            {isGroupMenuOpen ? (
              <div
                role='listbox'
                className='absolute right-0 top-[calc(100%+4px)] z-30 min-w-56 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white py-1 shadow-lg shadow-slate-900/10'
              >
                <GroupByOption
                  isActive={groupBy === 'status'}
                  onClick={() => {
                    setGroupBy('status');
                    setIsGroupMenuOpen(false);
                  }}
                  icon={
                    <svg
                      viewBox='0 0 24 24'
                      className='size-4 fill-none stroke-current stroke-[1.8]'
                      aria-hidden='true'
                    >
                      <rect x='3' y='4' width='5' height='16' rx='1' />
                      <rect x='10' y='4' width='5' height='10' rx='1' />
                      <rect x='17' y='4' width='4' height='13' rx='1' />
                    </svg>
                  }
                >
                  По статусу{' '}
                  <span className='text-[12px] font-normal text-[#9aa8c7]'>
                    (по умолчанию)
                  </span>
                </GroupByOption>
                <GroupByOption
                  isActive={groupBy === 'assignee'}
                  onClick={() => {
                    setGroupBy('assignee');
                    setIsGroupMenuOpen(false);
                  }}
                  icon={
                    <svg
                      viewBox='0 0 24 24'
                      className='size-4 fill-none stroke-current stroke-[1.8]'
                      aria-hidden='true'
                    >
                      <circle cx='12' cy='8' r='4' />
                      <path d='M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8' strokeLinecap='round' />
                    </svg>
                  }
                >
                  По исполнителю
                </GroupByOption>
                <GroupByOption
                  isActive={groupBy === 'priority'}
                  onClick={() => {
                    setGroupBy('priority');
                    setIsGroupMenuOpen(false);
                  }}
                  icon={
                    <svg
                      viewBox='0 0 24 24'
                      className='size-4 fill-none stroke-current stroke-[1.8]'
                      aria-hidden='true'
                    >
                      <path d='M4 20V10M12 20V4M20 20v-6' strokeLinecap='round' />
                    </svg>
                  }
                >
                  По приоритету
                </GroupByOption>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className='text-[13px] text-[#7e8fb4]'>
        Найдено задач:{' '}
        <span className='font-semibold text-[#1f3565]'>
          {viewMode === 'due'
            ? kanbanBuckets.reduce((sum, bucket) => sum + bucket.tasks.length, 0)
            : viewMode === 'gantt'
              ? ganttTasks.length
              : filteredTasks.length}
        </span>
      </div>

      {isLoading ? (
        <div className='flex flex-1 items-center justify-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff] py-10'>
          <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
        </div>
      ) : viewMode === 'gantt' ? (
        <TasksGantt
          isLoading={false}
          scrollWithPageOnMobile
          tasks={ganttTasks}
          hasActiveFilter={hasActiveFilter}
          getStatus={(task) => {
            const statusColumn = columnsById.get(task.status_column_id ?? '');
            return {
              label:
                statusColumn?.name ??
                statusColumn?.label ??
                task.status_label ??
                'Без статуса',
              color: statusColumn?.color ?? task.status_color ?? '#7e8fb4',
            };
          }}
          getSubtitle={(task) =>
            (task.assignees ?? []).map((assignee) => formatName(assignee)).join(', ') ||
            null
          }
          onOpenTask={onOpenTask}
        />
      ) : viewMode === 'table' ? (
        <>
          <div className='grid gap-2 md:hidden'>
            {sortedTasks.length ? (
              orderTasksByHierarchy(sortedTasks).map((task) => {
                const assigneeNames = (task.assignees ?? [])
                  .map((assignee) => formatName(assignee))
                  .join(', ');
                const statusColumn = columnsById.get(task.status_column_id ?? '');
                const statusColor = statusColumn?.color ?? task.status_color ?? '#7e8fb4';
                const statusLabel =
                  statusColumn?.name ??
                  statusColumn?.label ??
                  task.status_label ??
                  'Без статуса';

                return (
                  <button
                    key={task.id}
                    type='button'
                    onClick={() => onOpenTask(task)}
                    className={`grid min-w-0 gap-3 rounded-xl border p-3 text-left ${
                      task.is_draft
                        ? 'border-amber-200 bg-amber-50/60'
                        : 'border-[#e3e9f3] bg-white'
                    }`}
                  >
                    <div className='flex min-w-0 items-start justify-between gap-2'>
                      <span className='min-w-0 break-words text-sm font-semibold text-[#10275a]'>
                        {task.parent_task_id ? '↳ ' : ''}
                        {task.title || 'Без названия'}
                      </span>
                      {task.is_draft ? (
                        <span className='shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700'>
                          Черновик
                        </span>
                      ) : null}
                    </div>
                    <div className='flex flex-wrap items-center gap-2 text-xs'>
                      <span className='inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[#f3f5f9] px-2 py-1 text-[#53617c]'>
                        <span
                          className='size-2 shrink-0 rounded-full'
                          style={{ backgroundColor: statusColor }}
                        />
                        <span className='truncate'>{statusLabel}</span>
                      </span>
                      {task.priority ? (
                        <span
                          className={joinClassNames(
                            'rounded-lg px-2 py-1 text-[11px] font-semibold',
                            PRIORITY_CHIP_CLASS[task.priority],
                          )}
                        >
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                      ) : null}
                    </div>
                    <div className='grid grid-cols-2 gap-2 text-xs'>
                      <span className='min-w-0 truncate text-[#66728d]'>
                        {assigneeNames || 'Без исполнителя'}
                      </span>
                      <span className='text-right font-medium text-[#53617c]'>
                        {formatDurationHms(task.spent_seconds ?? 0)}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-10 text-center text-sm text-[#7e8fb4]'>
                {hasActiveFilter
                  ? 'По выбранным фильтрам ничего не найдено.'
                  : 'Задач пока нет.'}
              </div>
            )}
          </div>

          <TableContainer className='hidden min-h-0 flex-1 md:block'>
            <Table className='min-w-215'>
              <THead sticky>
                <tr>
                  <Th
                    sortDirection={directionOf('title')}
                    onSort={() => toggleSort('title')}
                  >
                    Название
                  </Th>
                  <Th
                    sortDirection={directionOf('status')}
                    onSort={() => toggleSort('status')}
                  >
                    Статус
                  </Th>
                  <Th
                    sortDirection={directionOf('priority')}
                    onSort={() => toggleSort('priority')}
                  >
                    Приоритет
                  </Th>
                  <Th
                    sortDirection={directionOf('assignees')}
                    onSort={() => toggleSort('assignees')}
                  >
                    Исполнители
                  </Th>
                  <Th
                    numeric
                    className='whitespace-nowrap'
                    sortDirection={directionOf('spent')}
                    onSort={() => toggleSort('spent')}
                  >
                    Затрачено
                  </Th>
                </tr>
              </THead>
              <TBody>
                {sortedTasks.length ? (
                  orderTasksByHierarchy(sortedTasks).map((task) => {
                    const assigneeNames = (task.assignees ?? [])
                      .map((assignee) => formatName(assignee))
                      .join(', ');
                    const statusColumn = columnsById.get(task.status_column_id ?? '');
                    const statusColor =
                      statusColumn?.color ?? task.status_color ?? '#7e8fb4';
                    const statusLabel =
                      statusColumn?.name ??
                      statusColumn?.label ??
                      task.status_label ??
                      '—';
                    const title = task.title || 'Без названия';

                    return (
                      <Tr
                        key={task.id}
                        onClick={() => onOpenTask(task)}
                        background={task.is_draft ? 'bg-amber-50/60' : undefined}
                        className={joinClassNames(
                          'cursor-pointer',
                          task.is_draft && 'opacity-80',
                        )}
                      >
                        <Td className='min-w-0 font-semibold'>
                          <span className='flex max-w-105 min-w-0 items-center'>
                            <button
                              type='button'
                              className='min-w-0 truncate text-left hover:text-[#2d6ff7]'
                              title={task.title}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenTask(task);
                              }}
                            >
                              {task.parent_task_id ? `↳ ${title}` : title}
                            </button>
                            {task.is_draft ? (
                              <span className='ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700'>
                                Черновик
                              </span>
                            ) : null}
                          </span>
                        </Td>
                        <Td className='min-w-0'>
                          <span className='inline-flex items-center gap-2'>
                            <span
                              className='inline-block size-2 rounded-full'
                              style={{ backgroundColor: statusColor }}
                              aria-hidden='true'
                            />
                            <span className='truncate' title={statusLabel}>
                              {statusLabel}
                            </span>
                          </span>
                        </Td>
                        <Td>
                          {task.priority ? (
                            <span
                              className={joinClassNames(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold',
                                PRIORITY_CHIP_CLASS[task.priority],
                              )}
                            >
                              {PRIORITY_LABEL[task.priority]}
                            </span>
                          ) : (
                            <span className='text-[#7e8fb4]'>—</span>
                          )}
                        </Td>
                        <Td className='min-w-0'>
                          {assigneeNames ? (
                            <span
                              className='block max-w-65 truncate'
                              title={assigneeNames}
                            >
                              {assigneeNames}
                            </span>
                          ) : (
                            <span className='text-[#7e8fb4]'>—</span>
                          )}
                        </Td>
                        <Td numeric>{formatDurationHms(task.spent_seconds ?? 0)}</Td>
                      </Tr>
                    );
                  })
                ) : (
                  <TableEmptyRow>
                    {hasActiveFilter
                      ? 'По выбранным фильтрам ничего не найдено.'
                      : 'Задач пока нет.'}
                  </TableEmptyRow>
                )}
              </TBody>
            </Table>
          </TableContainer>
        </>
      ) : (
        <div
          className='flex h-[min(62dvh,520px)] min-h-80 flex-none snap-x snap-mandatory items-stretch gap-2 overflow-x-auto overscroll-x-contain pb-2 sm:h-full sm:min-h-105 sm:flex-1 sm:snap-none sm:gap-3'
          onDrop={() => {
            if (draggedColumnId) handleColumnDrop();
          }}
          onDragOver={(event) => {
            if (draggedColumnId) event.preventDefault();
          }}
        >
          {kanbanBuckets.map((bucket) => {
            const orderedBucketTasks = orderTasksByHierarchy(
              groupBy === 'status' || viewMode === 'due'
                ? bucket.tasks
                : orderTasksWithFinalLast(bucket.tasks, columnsById),
            );
            const column = bucket.column;
            const isStatusGroup =
              viewMode === 'kanban' && groupBy === 'status' && column !== undefined;
            const isNoStatusBucket = isStatusGroup && column?.id === NO_STATUS_COLUMN_ID;
            const isMenuOpen =
              isStatusGroup && column ? openColumnMenuId === column.id : false;
            const isBeingDragged =
              isStatusGroup && column ? draggedColumnId === column.id : false;
            const isDroppable = canDragTasks && isStatusGroup && !isNoStatusBucket;

            return (
              <div
                key={bucket.key}
                className={joinClassNames(
                  'flex h-full min-h-0 w-[calc(100vw-3.5rem)] max-w-[360px] shrink-0 snap-start flex-col gap-2 self-stretch rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 transition-transform duration-150 sm:min-h-full sm:w-[320px] sm:max-w-none sm:p-3',
                  isBeingDragged && 'opacity-40',
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedColumnId && isStatusGroup && column && !isNoStatusBucket) {
                    event.dataTransfer.dropEffect = 'move';
                    updateColumnHoverFromEvent(event, column.id);
                  }
                }}
                onDrop={(event) => {
                  if (draggedColumnId) {
                    event.stopPropagation();
                    if (!isNoStatusBucket) handleColumnDrop();
                    return;
                  }
                  if (isDroppable && column) {
                    handleDrop({
                      statusColumnId: column.id,
                      index: orderedBucketTasks.length,
                    });
                  }
                }}
              >
                <div
                  className={joinClassNames(
                    'flex items-center gap-2',
                    canCreateUpdateColumns &&
                      isStatusGroup &&
                      !isNoStatusBucket &&
                      !isColumnDragBlocked &&
                      'cursor-grab active:cursor-grabbing',
                  )}
                  draggable={
                    canCreateUpdateColumns &&
                    isStatusGroup &&
                    !isNoStatusBucket &&
                    !isColumnDragBlocked
                  }
                  onDragStart={(event) => {
                    if (!isStatusGroup || !column || isNoStatusBucket) return;
                    setDraggedColumnId(column.id);
                    const sourceIndex = orderedColumns.findIndex(
                      (item) => item.id === column.id,
                    );
                    setColumnHoverIndex(sourceIndex >= 0 ? sourceIndex : null);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggedColumnId('');
                    setColumnHoverIndex(null);
                  }}
                >
                  <span
                    className='inline-block size-3 shrink-0 rounded-full'
                    style={{ backgroundColor: bucket.color ?? '#7e8fb4' }}
                  />
                  <h4 className='min-w-0 flex-1 truncate text-[14px] font-semibold text-[#10275a]'>
                    {bucket.name}
                  </h4>
                  <span
                    className='inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] leading-none font-semibold'
                    style={{
                      color: bucket.color ?? '#7e8fb4',
                      backgroundColor: `${bucket.color ?? '#7e8fb4'}1f`,
                    }}
                  >
                    {orderedBucketTasks.length}
                  </span>

                  {isStatusGroup &&
                  column &&
                  !isNoStatusBucket &&
                  (canCreateUpdateColumns || canDeleteColumns) ? (
                    <div className='relative'>
                      <button
                        type='button'
                        onClick={() => setOpenColumnMenuId(isMenuOpen ? null : column.id)}
                        className='grid size-6 place-items-center rounded-md text-[#7e8fb4] transition-colors hover:bg-[#edf3ff] hover:text-[#1f3565]'
                        title='Действия'
                        aria-label='Меню колонки'
                      >
                        <span className='text-[16px] leading-none'>⋮</span>
                      </button>

                      {isMenuOpen ? (
                        <div
                          ref={columnMenuRef}
                          className='absolute right-0 top-7 z-20 min-w-45 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white py-1 shadow-lg shadow-slate-900/10'
                        >
                          {canCreateUpdateColumns ? (
                            <ColumnMenuItem
                              onClick={() => {
                                setOpenColumnMenuId(null);
                                onEditColumn(column);
                              }}
                            >
                              Редактировать
                            </ColumnMenuItem>
                          ) : null}
                          {canDeleteColumns ? (
                            <ColumnMenuItem
                              danger
                              disabled={orderedBucketTasks.length > 0}
                              onClick={() => {
                                if (orderedBucketTasks.length > 0) return;
                                setOpenColumnMenuId(null);
                                onDeleteColumn(column);
                              }}
                            >
                              Удалить
                            </ColumnMenuItem>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <span
                  className='block h-0.5 w-full rounded-full'
                  style={{ backgroundColor: bucket.color ?? '#7e8fb4' }}
                  aria-hidden='true'
                />

                {canCreateTasks && isStatusGroup && column && !isNoStatusBucket ? (
                  <button
                    type='button'
                    onClick={() => onCreateTaskInColumn(column)}
                    className='w-full rounded-lg border border-dashed border-[#c9d8f8] bg-white py-1.5 text-[12px] font-semibold text-[#2d6ff7] transition-colors hover:bg-[#edf3ff]'
                  >
                    + Новая задача
                  </button>
                ) : null}

                <div
                  className='flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto'
                  onDragOver={(event) => {
                    if (!draggedTaskId) return;
                    const list = event.currentTarget;
                    const rect = list.getBoundingClientRect();
                    const threshold = 60;
                    const speed = 14;
                    const distFromTop = event.clientY - rect.top;
                    const distFromBottom = rect.bottom - event.clientY;
                    if (distFromTop < threshold && list.scrollTop > 0) {
                      list.scrollTop -= speed;
                    } else if (
                      distFromBottom < threshold &&
                      list.scrollTop + list.clientHeight < list.scrollHeight
                    ) {
                      list.scrollTop += speed;
                    }
                  }}
                  onDrop={(event) => {
                    if (draggedColumnId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (!isDroppable || !column) return;
                    handleDrop({
                      statusColumnId: column.id,
                      index: orderedBucketTasks.length,
                    });
                  }}
                >
                  {orderedBucketTasks.length === 0 ? (
                    <div className='grid h-20 place-items-center text-[12px] text-[#7e8fb4]'>
                      Нет задач
                    </div>
                  ) : (
                    orderedBucketTasks.map((task, index) => {
                      const isTaskCompleted = isTaskFinal(task, columnsById);
                      const assignees = (task.assignees ?? []).slice(0, 2);
                      const extraAssignees = Math.max(
                        0,
                        (task.assignees?.length ?? 0) - assignees.length,
                      );

                      return (
                        <article
                          key={task.id}
                          draggable={!isTaskDragBlocked && isDroppable}
                          onDragStart={() => {
                            if (!isDroppable) return;
                            setDraggedTaskId(task.id);
                          }}
                          onDragEnd={() => setDraggedTaskId('')}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!isDroppable || !column) return;
                            handleDrop({ statusColumnId: column.id, index });
                          }}
                          onClick={() => onOpenTask(task)}
                          className={joinClassNames(
                            'min-w-0 cursor-pointer select-none rounded-lg border px-3 py-2 transition-colors',
                            task.is_draft
                              ? 'border-amber-200 bg-amber-50/60 opacity-80 hover:border-amber-300 hover:bg-amber-50'
                              : isTaskCompleted
                                ? 'border-[#dde4ee] bg-[#eef1f6] hover:border-[#c9d8f8] hover:bg-[#e6ecf4]'
                                : 'border-[#e3e9f3] bg-white hover:border-[#c9d8f8] hover:bg-[#f3f7ff]',
                          )}
                        >
                          <div className='flex items-center justify-between gap-2'>
                            <span className='text-[11px] font-semibold text-[#7e8fb4]'>
                              {task.number ? `#${task.number}` : null}
                            </span>
                            <span className='flex items-center gap-1.5'>
                              {!clientView && taskViews.hasChanges(task) ? (
                                <span className='rounded-full bg-[#edf3ff] px-2 py-0.5 text-[10px] font-semibold text-[#2d6ff7]'>
                                  Есть изменения
                                </span>
                              ) : null}
                              {task.is_draft ? (
                                <span className='rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700'>
                                  Черновик
                                </span>
                              ) : null}
                              {!clientView && task.priority ? (
                                <span
                                  className={joinClassNames(
                                    'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] leading-none font-semibold',
                                    PRIORITY_CHIP_CLASS[task.priority],
                                  )}
                                >
                                  {PRIORITY_LABEL[task.priority]}
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <p
                            className={joinClassNames(
                              'mt-1 line-clamp-2 text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]',
                              isTaskCompleted
                                ? 'text-[#7e8fb4] line-through'
                                : 'text-[#1f3565]',
                            )}
                          >
                            {task.title || 'Без названия'}
                          </p>
                          {viewMode === 'due' && formatTaskDueDates(task) ? (
                            <p className='mt-1 truncate text-[12px] font-medium text-[#7e8fb4]'>
                              {formatTaskDueDates(task)}
                            </p>
                          ) : null}
                          {(task.subtasks ?? []).length > 0 ? (
                            <div className='mt-2 border-t border-[#e3e9f3] pt-2'>
                              {/* minmax(0, 1fr): иначе длинное название подзадачи распирает колонку */}
                              <div className='grid grid-cols-1 gap-1.5'>
                                {(task.subtasks ?? []).slice(0, 3).map((subtask) => {
                                  const subtaskColumn = subtask.status_column_id
                                    ? columnsById.get(subtask.status_column_id)
                                    : null;
                                  const isSubtaskDone = Boolean(subtaskColumn?.is_final);
                                  const subtaskAssignees = (
                                    subtask.assignees ?? []
                                  ).slice(0, 1);

                                  return (
                                    <div
                                      key={subtask.id}
                                      className='flex items-center justify-between gap-2'
                                    >
                                      <span className='inline-flex min-w-0 items-center gap-2'>
                                        <span
                                          className={joinClassNames(
                                            'inline-block size-3 shrink-0 rounded-full border',
                                            isSubtaskDone
                                              ? 'border-emerald-500 bg-emerald-500/20'
                                              : 'border-[#7e8fb4]',
                                          )}
                                          aria-hidden='true'
                                        />
                                        <span
                                          className='truncate text-[12px] text-[#1f3565]'
                                          title={subtask.title}
                                        >
                                          {subtask.title || 'Без названия'}
                                          {subtask.is_draft ? ' · Черновик' : ''}
                                        </span>
                                      </span>
                                      <span className='inline-flex shrink-0 items-center gap-1'>
                                        {subtaskAssignees.map((user) => (
                                          <span
                                            key={user.id}
                                            title={
                                              formatName(user) ||
                                              memberLabelById.get(user.id) ||
                                              ''
                                            }
                                            className='grid size-5 place-items-center rounded-full border border-white bg-[#edf1f7] text-[9px] font-semibold text-[#1f3565]'
                                          >
                                            {memberInitial(
                                              formatName(user) ||
                                                memberLabelById.get(user.id) ||
                                                '',
                                            )}
                                          </span>
                                        ))}
                                        <span className='text-[12px] text-[#7e8fb4]'>
                                          →
                                        </span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          <div className='mt-2 flex items-end justify-between gap-2'>
                            <div className='flex min-w-0 items-center gap-2 text-[#7e8fb4]'>
                              {!clientView || task.estimation ? (
                                <TaskTimeBadge
                                  label='Оценка'
                                  value={formatTaskDuration(task.estimation)}
                                />
                              ) : null}
                              {!clientView ? (
                                <TaskTimeBadge
                                  label='Затрачено'
                                  value={formatTaskDuration(task.spent_seconds)}
                                />
                              ) : null}
                            </div>
                            {!clientView ? (
                              <div className='flex -space-x-1.5'>
                                {assignees.map((user) => (
                                  <span
                                    key={user.id}
                                    title={
                                      formatName(user) ||
                                      memberLabelById.get(user.id) ||
                                      ''
                                    }
                                    className='grid size-6 place-items-center rounded-full border border-white bg-[#edf1f7] text-[10px] font-semibold text-[#1f3565]'
                                  >
                                    {memberInitial(
                                      formatName(user) ||
                                        memberLabelById.get(user.id) ||
                                        '',
                                    )}
                                  </span>
                                ))}
                                {extraAssignees > 0 ? (
                                  <span className='grid size-6 place-items-center rounded-full border border-white bg-[#f3f7ff] text-[10px] font-semibold text-[#7e8fb4]'>
                                    +{extraAssignees}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {canCreateUpdateColumns && viewMode === 'kanban' && groupBy === 'status' ? (
            <button
              type='button'
              onClick={onCreateColumn}
              className='grid h-10 w-10 shrink-0 place-items-center self-start rounded-xl border border-[#c9d8f8] bg-white text-[18px] font-semibold text-[#2d6ff7] transition-colors hover:bg-[#edf3ff]'
              title='Добавить колонку'
              aria-label='Добавить колонку'
            >
              +
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

type FilterDropdownOption = {
  id: string;
  label: string;
  avatar?: ReactNode;
};

function FilterDropdown({
  containerRef,
  label,
  isOpen,
  onOpenChange,
  selectedCount,
  totalCount,
  onClear,
  options,
  selectedIds,
  onToggle,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  label: string;
  isOpen: boolean;
  onOpenChange: (_next: boolean) => void;
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  options: FilterDropdownOption[];
  selectedIds: string[];
  onToggle: (_id: string) => void;
}) {
  const isActive = selectedCount > 0;

  return (
    <div className='relative min-w-0' ref={containerRef}>
      <button
        type='button'
        onClick={() => onOpenChange(!isOpen)}
        className={joinClassNames(
          'inline-flex h-10 w-full items-center justify-between gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors sm:w-auto',
          isOpen || isActive
            ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
            : 'border-[#c9d8f8] bg-white text-[#1f3565] hover:bg-[#f3f7ff]',
        )}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
      >
        <span>{label}</span>
        {selectedCount > 0 ? (
          <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2d6ff7] px-1.5 text-[11px] font-semibold text-white'>
            {selectedCount}
          </span>
        ) : null}
        <Caret open={isOpen} />
      </button>

      {isOpen ? (
        <FilterDropdownPanel
          selectedCount={selectedCount}
          totalCount={totalCount}
          onClear={onClear}
          options={options}
          selectedIds={selectedIds}
          onToggle={onToggle}
        />
      ) : null}
    </div>
  );
}

function FilterDropdownPanel({
  selectedCount,
  totalCount,
  onClear,
  options,
  selectedIds,
  onToggle,
}: {
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  options: FilterDropdownOption[];
  selectedIds: string[];
  onToggle: (_id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredOptions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, search]);
  const allSelected = selectedCount === 0 || selectedCount === totalCount;

  return (
    <div
      role='listbox'
      className='absolute right-0 top-[calc(100%+4px)] z-30 w-[min(16rem,calc(100vw-2rem))] sm:right-auto sm:left-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white py-2 shadow-lg shadow-slate-900/10'
    >
      <div className='px-2 pb-2'>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Поиск...'
          className='h-9 w-full rounded-lg border border-[#e3e9f3] bg-white px-3 text-[13px] text-[#1f3565] outline-none transition-colors placeholder:text-[#9aa8c7] focus:border-[#2d6ff7]'
        />
      </div>
      <div className='max-h-64 overflow-auto'>
        <label className='flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#1f3565] transition-colors hover:bg-[#f3f7ff]'>
          <input
            type='checkbox'
            checked={allSelected}
            onChange={onClear}
            className='size-4 accent-[#2d6ff7]'
          />
          <span>Все</span>
        </label>
        {filteredOptions.length === 0 ? (
          <div className='px-3 py-3 text-[12px] text-[#9aa8c7]'>Ничего не найдено</div>
        ) : (
          filteredOptions.map((option) => {
            const isSelected = selectedSet.has(option.id);
            return (
              <label
                key={option.id}
                className='flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#1f3565] transition-colors hover:bg-[#f3f7ff]'
              >
                <input
                  type='checkbox'
                  checked={isSelected}
                  onChange={() => onToggle(option.id)}
                  className='size-4 accent-[#2d6ff7]'
                />
                {option.avatar ?? null}
                <span className='truncate' title={option.label}>
                  {option.label}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function GroupByOption({
  isActive,
  icon,
  onClick,
  children,
}: {
  isActive: boolean;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      role='option'
      aria-selected={isActive}
      onClick={onClick}
      className={joinClassNames(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors',
        isActive ? 'bg-[#edf3ff] text-[#2d6ff7]' : 'text-[#1f3565] hover:bg-[#f3f7ff]',
      )}
    >
      <span className='grid size-5 shrink-0 place-items-center text-[#7e8fb4]'>
        {icon}
      </span>
      <span className='flex-1'>{children}</span>
    </button>
  );
}

function ColumnMenuItem({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      className={joinClassNames(
        'flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        danger
          ? 'text-[#c83f52] hover:bg-[#fff1f3]'
          : 'text-[#1f3565] hover:bg-[#f3f7ff]',
      )}
    >
      {children}
    </button>
  );
}

function Caret({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox='0 0 12 12'
      className={joinClassNames(
        'size-2.5 fill-none stroke-current stroke-[1.8] transition-transform',
        open && 'rotate-180',
      )}
      aria-hidden='true'
    >
      <path d='m3 4.5 3 3 3-3' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

function TaskTimeBadge({ label, value }: { label: string; value: string }) {
  return (
    <span
      className='inline-flex max-w-18 items-center rounded-md border border-[#e3e9f3] bg-[#fbfcff] px-1.5 py-0.5 text-[10px] leading-none font-semibold text-[#7e8fb4]'
      title={`${label}: ${value}`}
    >
      {label}: {value}
    </span>
  );
}
