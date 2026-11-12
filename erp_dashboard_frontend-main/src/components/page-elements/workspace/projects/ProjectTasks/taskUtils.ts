import type { Task, TaskStatusColumn } from '../../../../../types/app';

export function findTaskById(tasks: Task[], taskId: string): Task | null {
  for (const task of tasks) {
    if (task.id === taskId) return task;
    const nested = findTaskById(task.subtasks ?? [], taskId);
    if (nested) return nested;
  }
  return null;
}

export function upsertTask(tasks: Task[], nextTask: Task): Task[] {
  if (!findTaskById(tasks, nextTask.id)) return [...tasks, nextTask];
  return tasks.map((task) => {
    if (task.id === nextTask.id) return nextTask;
    if (task.subtasks && findTaskById(task.subtasks, nextTask.id)) {
      return { ...task, subtasks: upsertTask(task.subtasks, nextTask) };
    }
    return task;
  });
}

export function removeTask(tasks: Task[], taskId: string): Task[] {
  return tasks
    .filter((task) => task.id !== taskId)
    .map((task) => ({
      ...task,
      subtasks: task.subtasks ? removeTask(task.subtasks, taskId) : task.subtasks,
    }));
}

export function insertSubtask(
  tasks: Task[],
  parentTaskId: string,
  subtask: Task,
): Task[] {
  return tasks.map((task) => {
    if (task.id === parentTaskId) {
      return { ...task, subtasks: upsertTask(task.subtasks ?? [], subtask) };
    }
    return task.subtasks
      ? { ...task, subtasks: insertSubtask(task.subtasks, parentTaskId, subtask) }
      : task;
  });
}

export function pickDefaultColumnId(
  columns: TaskStatusColumn[],
  trackerDefaultStatusName?: string,
): string {
  const normalized = (trackerDefaultStatusName || 'В работе').trim().toLowerCase();
  return (
    columns.find(
      (column) => (column.name ?? column.label ?? '').trim().toLowerCase() === normalized,
    )?.id ?? ''
  );
}

export function moveTaskInMemory(
  tasks: Task[],
  taskId: string,
  statusColumnId: string,
  destinationIndex: number,
  beforeTaskId?: string,
  afterTaskId?: string,
): Task[] {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return tasks;

  const sourceColumnId = task.status_column_id ?? '';
  const others = tasks.filter((candidate) => candidate.id !== taskId);
  const ordered = (columnId: string) =>
    others
      .filter((candidate) => (candidate.status_column_id ?? '') === columnId)
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const target = ordered(statusColumnId);
  const anchoredIndex = beforeTaskId
    ? target.findIndex((candidate) => candidate.id === beforeTaskId)
    : -1;
  const afterIndex = afterTaskId
    ? target.findIndex((candidate) => candidate.id === afterTaskId)
    : -1;
  const clamped = Math.max(
    0,
    Math.min(
      anchoredIndex >= 0
        ? anchoredIndex
        : afterIndex >= 0
          ? afterIndex + 1
          : destinationIndex,
      target.length,
    ),
  );
  target.splice(clamped, 0, { ...task, status_column_id: statusColumnId });
  const targetTasks = target.map((candidate, index) => ({
    ...candidate,
    position: index + 1,
  }));

  if (sourceColumnId === statusColumnId) {
    return [
      ...others.filter(
        (candidate) => (candidate.status_column_id ?? '') !== statusColumnId,
      ),
      ...targetTasks,
    ];
  }

  const sourceTasks = ordered(sourceColumnId).map((candidate, index) => ({
    ...candidate,
    position: index + 1,
  }));
  return [
    ...others.filter((candidate) => {
      const columnId = candidate.status_column_id ?? '';
      return columnId !== sourceColumnId && columnId !== statusColumnId;
    }),
    ...sourceTasks,
    ...targetTasks,
  ];
}
