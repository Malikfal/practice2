import { useCallback, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import type {
  Task,
  TaskCreateForm,
  TaskStatusColumn,
  TaskStatusColumnForm,
} from '../../../../../types/app';
import { insertSubtask, moveTaskInMemory, removeTask, upsertTask } from './taskUtils';

type TaskMove = {
  taskId: string;
  statusColumnId: string;
  destinationIndex: number;
  beforeTaskId?: string;
  afterTaskId?: string;
};

export type ProjectTasksSnapshot = {
  tasks: Task[];
  columns: TaskStatusColumn[];
  isLoading: boolean;
  hasLoaded: boolean;
  pendingMoveCount: number;
  isChangingColumns: boolean;
};

type ProjectEntry = {
  confirmedTasks: Task[];
  confirmedColumns: TaskStatusColumn[];
  pendingMoves: TaskMove[];
  queue: Promise<void>;
  loadPromise: Promise<void> | null;
  listeners: Set<() => void>;
  snapshot: ProjectTasksSnapshot;
  moveFailureMessage: string | null;
};

export class ProjectTasksStore {
  private readonly emptySnapshot: ProjectTasksSnapshot = {
    tasks: [],
    columns: [],
    isLoading: false,
    hasLoaded: false,
    pendingMoveCount: 0,
    isChangingColumns: false,
  };

  private readonly entries = new Map<string, ProjectEntry>();

  private entryFor(projectId: string): ProjectEntry {
    let entry = this.entries.get(projectId);
    if (!entry) {
      entry = {
        confirmedTasks: [],
        confirmedColumns: [],
        pendingMoves: [],
        queue: Promise.resolve(),
        loadPromise: null,
        listeners: new Set(),
        snapshot: this.emptySnapshot,
        moveFailureMessage: null,
      };
      this.entries.set(projectId, entry);
    }
    return entry;
  }

  private publish(entry: ProjectEntry, changes: Partial<ProjectTasksSnapshot> = {}) {
    entry.snapshot = {
      ...entry.snapshot,
      tasks: entry.pendingMoves.reduce(
        (tasks, move) =>
          moveTaskInMemory(
            tasks,
            move.taskId,
            move.statusColumnId,
            move.destinationIndex,
            move.beforeTaskId,
            move.afterTaskId,
          ),
        entry.confirmedTasks,
      ),
      columns: entry.confirmedColumns,
      pendingMoveCount: entry.pendingMoves.length,
      ...changes,
    };
    entry.listeners.forEach((listener) => listener());
  }

  private enqueue<TResult>(entry: ProjectEntry, operation: () => Promise<TResult>) {
    const result = entry.queue.then(operation);
    entry.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private applyBoard(
    entry: ProjectEntry,
    board: { columns?: TaskStatusColumn[]; data?: Task[] },
  ) {
    entry.confirmedColumns = board.columns ?? [];
    entry.confirmedTasks = Array.isArray(board.data) ? board.data : [];
    this.publish(entry, { hasLoaded: true, isLoading: false });
  }

  private moveToastId(projectId: string) {
    return `project-task-moves-${projectId}`;
  }
  subscribe(projectId: string, listener: () => void) {
    if (!projectId) return () => undefined;
    const entry = this.entryFor(projectId);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }

  getSnapshot(projectId: string) {
    return projectId ? this.entryFor(projectId).snapshot : this.emptySnapshot;
  }

  loadBoard(projectId: string, options: { worker?: boolean; force?: boolean } = {}) {
    if (!projectId) return Promise.resolve();
    const entry = this.entryFor(projectId);
    if (entry.loadPromise) return entry.loadPromise;
    if (entry.snapshot.hasLoaded && !options.force) return Promise.resolve();
    if (!entry.snapshot.hasLoaded) this.publish(entry, { isLoading: true });

    const request = this.enqueue(entry, async () => {
      const board = options.worker
        ? await api.worker.projects.getBoard(projectId)
        : await api.workspace.projects.getBoard(projectId);
      this.applyBoard(entry, board);
    });
    entry.loadPromise = request.finally(() => {
      entry.loadPromise = null;
      if (entry.snapshot.isLoading) this.publish(entry, { isLoading: false });
    });
    return entry.loadPromise;
  }

  async moveTask(
    projectId: string,
    taskId: string,
    statusColumnId: string,
    destinationIndex: number,
    beforeTaskId?: string,
    afterTaskId?: string,
  ): Promise<boolean> {
    const entry = this.entryFor(projectId);
    if (entry.pendingMoves.length === 0) {
      entry.moveFailureMessage = null;
      toast.loading('Задачи перемещаются…', { id: this.moveToastId(projectId) });
    }
    const move = { taskId, statusColumnId, destinationIndex, beforeTaskId, afterTaskId };
    entry.pendingMoves.push(move);
    this.publish(entry);

    return this.enqueue(entry, async () => {
      let succeeded = false;
      try {
        const targetTasks = entry.confirmedTasks
          .filter(
            (task) => task.id !== taskId && task.status_column_id === statusColumnId,
          )
          .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
        const anchorIndex = beforeTaskId
          ? targetTasks.findIndex((task) => task.id === beforeTaskId)
          : -1;
        const afterIndex = afterTaskId
          ? targetTasks.findIndex((task) => task.id === afterTaskId)
          : -1;
        const currentIndex = Math.max(
          0,
          Math.min(
            anchorIndex >= 0
              ? anchorIndex
              : afterIndex >= 0
                ? afterIndex + 1
                : destinationIndex,
            targetTasks.length,
          ),
        );
        const board = await api.workspace.projects.moveTask(projectId, taskId, {
          status_column_id: statusColumnId,
          destination_index: currentIndex,
        });
        entry.confirmedColumns = board.columns ?? [];
        entry.confirmedTasks = Array.isArray(board.data) ? board.data : [];
        succeeded = true;
      } catch (error) {
        entry.moveFailureMessage =
          error instanceof Error ? error.message : 'Не удалось переместить задачу.';
      } finally {
        entry.pendingMoves = entry.pendingMoves.filter((candidate) => candidate !== move);
        this.publish(entry);
        if (entry.pendingMoves.length === 0) {
          if (entry.moveFailureMessage) {
            toast.error(entry.moveFailureMessage, { id: this.moveToastId(projectId) });
          } else {
            toast.success('Все задачи перенесены.', { id: this.moveToastId(projectId) });
          }
        }
      }
      return succeeded;
    });
  }

  saveTask(
    projectId: string,
    taskId: string,
    form: TaskCreateForm,
    statusColumnId: string,
  ): Promise<Task> {
    const entry = this.entryFor(projectId);
    return this.enqueue(entry, async () => {
      let updated = await api.workspace.projects.updateTask(projectId, taskId, form);
      entry.confirmedTasks = upsertTask(entry.confirmedTasks, updated);
      this.publish(entry);
      if (statusColumnId && updated.status_column_id !== statusColumnId) {
        const destinationIndex = entry.confirmedTasks.filter(
          (task) => task.status_column_id === statusColumnId,
        ).length;
        const board = await api.workspace.projects.moveTask(projectId, taskId, {
          status_column_id: statusColumnId,
          destination_index: destinationIndex,
        });
        this.applyBoard(entry, board);
        updated = { ...updated, status_column_id: statusColumnId };
      }
      return updated;
    });
  }

  createTask(
    projectId: string,
    payload: { status_column_id: string | null; parent_task_id?: string },
  ): Promise<Task> {
    const entry = this.entryFor(projectId);
    return this.enqueue(entry, async () => {
      const draft = await api.workspace.projects.createTask(projectId, payload);
      entry.confirmedTasks = payload.parent_task_id
        ? insertSubtask(entry.confirmedTasks, payload.parent_task_id, draft)
        : upsertTask(entry.confirmedTasks, draft);
      this.publish(entry);
      return draft;
    });
  }

  deleteTask(projectId: string, taskId: string) {
    const entry = this.entryFor(projectId);
    return this.enqueue(entry, async () => {
      await api.workspace.projects.deleteTask(projectId, taskId);
      entry.confirmedTasks = removeTask(entry.confirmedTasks, taskId);
      this.publish(entry);
    });
  }

  reorderColumn(projectId: string, columnId: string, destinationIndex: number) {
    const entry = this.entryFor(projectId);
    return this.enqueue(entry, async () => {
      const sorted = [...entry.confirmedColumns].sort(
        (left, right) =>
          (left.position ?? left.order ?? 0) - (right.position ?? right.order ?? 0),
      );
      const sourceIndex = sorted.findIndex((column) => column.id === columnId);
      if (sourceIndex < 0) return;
      const [column] = sorted.splice(sourceIndex, 1);
      const clamped = Math.max(0, Math.min(destinationIndex, sorted.length));
      sorted.splice(clamped, 0, column);
      const previous = entry.confirmedColumns;
      entry.confirmedColumns = sorted.map((item, index) => ({
        ...item,
        position: index + 1,
      }));
      this.publish(entry, { isChangingColumns: true });
      try {
        const result = await api.workspace.projectTaskStatusColumns.reorder(
          projectId,
          sorted.map((item, index) => ({ id: item.id, position: index + 1 })),
        );
        if (Array.isArray(result) && result.length > 0) entry.confirmedColumns = result;
      } catch (error) {
        entry.confirmedColumns = previous;
        throw error;
      } finally {
        this.publish(entry, { isChangingColumns: false });
      }
    });
  }

  saveColumn(projectId: string, form: TaskStatusColumnForm, editingColumnId?: string) {
    const entry = this.entryFor(projectId);
    return this.enqueue(entry, async () => {
      this.publish(entry, { isChangingColumns: true });
      try {
        if (editingColumnId) {
          await api.workspace.projectTaskStatusColumns.update(
            projectId,
            editingColumnId,
            form,
          );
        } else {
          await api.workspace.projectTaskStatusColumns.create(projectId, form);
        }
        this.applyBoard(entry, await api.workspace.projects.getBoard(projectId));
      } finally {
        this.publish(entry, { isChangingColumns: false });
      }
    });
  }

  deleteColumn(projectId: string, columnId: string) {
    const entry = this.entryFor(projectId);
    return this.enqueue(entry, async () => {
      this.publish(entry, { isChangingColumns: true });
      try {
        await api.workspace.projectTaskStatusColumns.delete(projectId, columnId);
        this.applyBoard(entry, await api.workspace.projects.getBoard(projectId));
      } finally {
        this.publish(entry, { isChangingColumns: false });
      }
    });
  }
}

export const projectTasksStore = new ProjectTasksStore();

export function useProjectTasksStore(projectId: string): ProjectTasksSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => projectTasksStore.subscribe(projectId, listener),
    [projectId],
  );
  const getSnapshot = useCallback(
    () => projectTasksStore.getSnapshot(projectId),
    [projectId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () =>
    projectTasksStore.getSnapshot(''),
  );
}
