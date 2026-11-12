import { useMemo } from 'react';

import { formatDurationHms, formatName } from '../../../../../../utils/formatters';
import type { UserBoardTask } from '../../../../../../types/app';
import { PRIORITY_CHIP_CLASS, PRIORITY_LABEL } from '../constants';
import type { Bucket, DraggedTask, DropTarget } from '../types';
import { getTaskCreatorName } from '../utils';
import { formatTaskDueDates } from '../../../../../../utils/taskDueBuckets';
import { useTaskViews } from '../../../../../../notifications/taskViewsStore';

export default function TasksKanban({
  isLoading,
  columns,
  sortedTasksCount,
  hasActiveFilter,
  canDragTasks,
  draggedTask,
  dropTarget,
  onDropTargetChange,
  onDraggedTaskChange,
  onMoveTask,
  onOpenTask,
  showDueDates = false,
}: {
  isLoading: boolean;
  columns: Bucket[];
  sortedTasksCount: number;
  hasActiveFilter: boolean;
  canDragTasks: boolean;
  draggedTask: DraggedTask | null;
  dropTarget: DropTarget | null;
  onDropTargetChange: (
    _next: DropTarget | null | ((_prev: DropTarget | null) => DropTarget | null),
  ) => void;
  onDraggedTaskChange: (_task: DraggedTask | null) => void;
  onMoveTask: (
    _taskId: string,
    _sourceColumnKey: string,
    _targetColumnKey: string,
    _dropIndex: number,
  ) => void;
  onOpenTask: (_task: UserBoardTask) => void;
  showDueDates?: boolean;
}) {
  return (
    <div className='min-h-0 flex-1 overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-3'>
      {isLoading ? (
        <div className='grid h-full place-items-center'>
          <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
        </div>
      ) : sortedTasksCount === 0 ? (
        <div className='grid h-full place-items-center px-4 py-10 text-center text-[#7e8fb4]'>
          {hasActiveFilter
            ? 'По выбранным фильтрам ничего не найдено.'
            : 'Задач пока нет.'}
        </div>
      ) : (
        <div className='flex h-full min-h-0 items-stretch gap-3'>
          {columns.map((column) => (
            <TasksKanbanColumn
              key={column.key}
              column={column}
              canDragTasks={canDragTasks}
              draggedTask={draggedTask}
              dropTarget={dropTarget}
              onDropTargetChange={onDropTargetChange}
              onDraggedTaskChange={onDraggedTaskChange}
              onMoveTask={onMoveTask}
              onOpenTask={onOpenTask}
              showDueDates={showDueDates}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TasksKanbanColumn({
  column,
  canDragTasks,
  draggedTask,
  dropTarget,
  onDropTargetChange,
  onDraggedTaskChange,
  onMoveTask,
  onOpenTask,
  showDueDates,
}: {
  column: Bucket;
  canDragTasks: boolean;
  draggedTask: DraggedTask | null;
  dropTarget: DropTarget | null;
  onDropTargetChange: (
    _next: DropTarget | null | ((_prev: DropTarget | null) => DropTarget | null),
  ) => void;
  onDraggedTaskChange: (_task: DraggedTask | null) => void;
  onMoveTask: (
    _taskId: string,
    _sourceColumnKey: string,
    _targetColumnKey: string,
    _dropIndex: number,
  ) => void;
  onOpenTask: (_task: UserBoardTask) => void;
  showDueDates: boolean;
}) {
  const orderedColumnTasks = useMemo(
    () => orderTasksByHierarchy(column.tasks),
    [column.tasks],
  );
  const isDroppable = canDragTasks && column.key !== '__no_status__';
  const isDragOverColumn = isDroppable && dropTarget?.columnId === column.key;

  return (
    <div
      className={`flex min-h-0 w-72 shrink-0 flex-col rounded-xl border bg-[#f8fbff] transition-colors ${
        isDragOverColumn ? 'border-[#2d6ff7] bg-[#edf3ff]' : 'border-[#e3e9f3]'
      }`}
    >
      <div className='flex items-center justify-between gap-2 border-b border-[#e3e9f3] px-3 py-2'>
        <span className='inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[#1f3565]'>
          <span
            className='inline-block size-2 shrink-0 rounded-full'
            style={{ backgroundColor: column.color ?? '#7e8fb4' }}
            aria-hidden='true'
          />
          <span className='truncate' title={column.name}>
            {column.name}
          </span>
        </span>
        <span className='shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#7e8fb4]'>
          {orderedColumnTasks.length}
        </span>
      </div>
      <div
        className='flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2'
        onDragOver={(event) => {
          if (!isDroppable || !draggedTask) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          onDropTargetChange((prev) =>
            prev?.columnId === column.key && prev.index === column.tasks.length
              ? prev
              : { columnId: column.key, index: orderedColumnTasks.length },
          );
        }}
        onDrop={(event) => {
          if (!isDroppable || !draggedTask) return;
          event.preventDefault();
          event.stopPropagation();
          onMoveTask(
            draggedTask.taskId,
            draggedTask.sourceColumnKey,
            column.key,
            orderedColumnTasks.length,
          );
        }}
      >
        {orderedColumnTasks.length === 0 ? (
          <div className='grid h-20 place-items-center text-[12px] text-[#7e8fb4]'>
            Нет задач
          </div>
        ) : (
          orderedColumnTasks.map((task, taskIndex) => (
            <TasksKanbanCard
              key={task.id}
              task={task}
              taskIndex={taskIndex}
              columnKey={column.key}
              canDrag={canDragTasks}
              isDroppable={isDroppable}
              isDragging={draggedTask?.taskId === task.id}
              draggedTask={draggedTask}
              onDropTargetChange={onDropTargetChange}
              onDraggedTaskChange={onDraggedTaskChange}
              onMoveTask={onMoveTask}
              onOpenTask={onOpenTask}
              showDueDates={showDueDates}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TasksKanbanCard({
  task,
  taskIndex,
  columnKey,
  canDrag,
  isDroppable,
  isDragging,
  draggedTask,
  onDropTargetChange,
  onDraggedTaskChange,
  onMoveTask,
  onOpenTask,
  showDueDates,
}: {
  task: UserBoardTask;
  taskIndex: number;
  columnKey: string;
  canDrag: boolean;
  isDroppable: boolean;
  isDragging: boolean;
  draggedTask: DraggedTask | null;
  onDropTargetChange: (
    _next: DropTarget | null | ((_prev: DropTarget | null) => DropTarget | null),
  ) => void;
  onDraggedTaskChange: (_task: DraggedTask | null) => void;
  onMoveTask: (
    _taskId: string,
    _sourceColumnKey: string,
    _targetColumnKey: string,
    _dropIndex: number,
  ) => void;
  onOpenTask: (_task: UserBoardTask) => void;
  showDueDates: boolean;
}) {
  const dueDates = showDueDates ? formatTaskDueDates(task) : null;
  const taskViews = useTaskViews();
  const assigneeNames = (task.assignees ?? [])
    .map((assignee) => formatName(assignee))
    .join(', ');

  return (
    <button
      type='button'
      draggable={canDrag}
      onDragStart={(event) => {
        if (!canDrag) return;
        onDraggedTaskChange({ taskId: task.id, sourceColumnKey: columnKey });
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        onDraggedTaskChange(null);
        onDropTargetChange(null);
      }}
      onDragOver={(event) => {
        if (!isDroppable || !draggedTask) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        const rect = event.currentTarget.getBoundingClientRect();
        const isUpperHalf = event.clientY - rect.top < rect.height / 2;
        const nextIndex = isUpperHalf ? taskIndex : taskIndex + 1;
        onDropTargetChange((prev) =>
          prev?.columnId === columnKey && prev.index === nextIndex
            ? prev
            : { columnId: columnKey, index: nextIndex },
        );
      }}
      onDrop={(event) => {
        if (!isDroppable || !draggedTask) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const isUpperHalf = event.clientY - rect.top < rect.height / 2;
        const dropIndex = isUpperHalf ? taskIndex : taskIndex + 1;
        onMoveTask(draggedTask.taskId, draggedTask.sourceColumnKey, columnKey, dropIndex);
      }}
      onClick={() => onOpenTask(task)}
      className={`flex w-full select-none flex-col gap-1.5 rounded-lg border p-2.5 text-left shadow-sm transition-colors ${task.is_draft ? 'border-amber-200 bg-amber-50/60 opacity-80 hover:border-amber-300' : 'border-[#e3e9f3] bg-white hover:border-[#2d6ff7] hover:bg-[#f3f7ff]'} ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <span
        className='line-clamp-2 text-[13px] font-semibold text-[#10275a] [overflow-wrap:anywhere]'
        title={task.title}
      >
        {task.parent_task_id
          ? `↳ ${task.title || 'Без названия'}`
          : task.title || 'Без названия'}
      </span>
      {task.project?.name ? (
        <span className='truncate text-[12px] text-[#7e8fb4]' title={task.project.name}>
          {task.project.name}
        </span>
      ) : null}
      <span
        className='truncate text-[12px] text-[#7e8fb4]'
        title={getTaskCreatorName(task)}
      >
        Автор: {getTaskCreatorName(task)}
      </span>
      {dueDates ? (
        <span
          className='truncate text-[12px] font-medium text-[#1f3565]'
          title={dueDates}
        >
          {dueDates}
        </span>
      ) : null}
      <div className='mt-0.5 flex flex-wrap items-center gap-1.5'>
        {taskViews.hasChanges(task) ? (
          <span className='rounded-full bg-[#edf3ff] px-2 py-0.5 text-[11px] font-semibold text-[#2d6ff7]'>
            Есть изменения
          </span>
        ) : null}
        {task.is_draft ? (
          <span className='rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700'>
            Черновик
          </span>
        ) : null}
        {task.priority ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CHIP_CLASS[task.priority]}`}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
        ) : null}
        <span className='ml-auto text-[11px] text-[#7e8fb4]'>
          {formatDurationHms(task.spent_seconds ?? 0)}
        </span>
      </div>
      {assigneeNames ? (
        <span className='truncate text-[12px] text-[#1f3565]' title={assigneeNames}>
          {assigneeNames}
        </span>
      ) : null}
    </button>
  );
}

function orderTasksByHierarchy(tasks: UserBoardTask[]): UserBoardTask[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  const childrenByParent = new Map<string, UserBoardTask[]>();
  const roots: UserBoardTask[] = [];

  for (const task of tasks) {
    const parentId = task.parent_task_id ?? null;
    if (!parentId || !taskIds.has(parentId)) {
      roots.push(task);
      continue;
    }
    const list = childrenByParent.get(parentId) ?? [];
    list.push(task);
    childrenByParent.set(parentId, list);
  }

  const result: UserBoardTask[] = [];
  const visit = (task: UserBoardTask) => {
    result.push(task);
    const children = childrenByParent.get(task.id) ?? [];
    children.forEach(visit);
  };

  roots.forEach(visit);
  return result;
}
