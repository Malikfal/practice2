import { useCallback, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import type {
  TaskPriority,
  TaskStatusColumn,
  User,
  UserBoardColumn,
  UserBoardResponse,
  UserBoardTask,
} from '../../../../../types/app';

const MOVE_TOAST_ID = 'all-tasks-board-move';

type Snapshot = {
  columns: UserBoardColumn[];
  tasks: UserBoardTask[];
  isLoading: boolean;
  hasLoaded: boolean;
  isStale: boolean;
  pendingMoveCount: number;
};

type Entry = {
  confirmedColumns: UserBoardColumn[];
  confirmedTasks: UserBoardTask[];
  snapshot: Snapshot;
  listeners: Set<() => void>;
  request: Promise<void> | null;
};

type MoveBase = {
  task: UserBoardTask;
  search: string;
};

type StatusMove = MoveBase & {
  kind: 'status';
  column: TaskStatusColumn;
  destinationIndex: number;
  beforeTaskId?: string;
  afterTaskId?: string;
};

type AssigneeMove = MoveBase & {
  kind: 'assignee';
  sourceAssigneeId: string;
  targetAssignee: User | null;
  addMember: boolean;
};

type PriorityMove = MoveBase & {
  kind: 'priority';
  priority: TaskPriority | null;
};

type BoardMove = StatusMove | AssigneeMove | PriorityMove;

function projectIdOf(task: UserBoardTask) {
  return task.project?.id ?? task.project_id;
}

function statusIndex(tasks: UserBoardTask[], move: StatusMove) {
  const targetTasks = tasks
    .filter(
      (task) =>
        task.id !== move.task.id &&
        projectIdOf(task) === projectIdOf(move.task) &&
        task.status_column?.slug === move.column.slug,
    )
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const before = targetTasks.findIndex((task) => task.id === move.beforeTaskId);
  const after = targetTasks.findIndex((task) => task.id === move.afterTaskId);
  const requested = before >= 0 ? before : after >= 0 ? after + 1 : move.destinationIndex;
  return Math.max(0, Math.min(requested, targetTasks.length));
}

function applyMove(
  tasks: UserBoardTask[],
  move: BoardMove,
  columns: UserBoardColumn[],
  knownColumns: Map<string, TaskStatusColumn>,
): UserBoardTask[] {
  const current = tasks.find((task) => task.id === move.task.id);
  if (!current) return tasks;

  if (move.kind === 'assignee') {
    const assigneeIds = new Set(
      current.assignee_ids ?? current.assignees?.map((user) => user.id) ?? [],
    );
    if (move.sourceAssigneeId) assigneeIds.delete(move.sourceAssigneeId);
    if (move.targetAssignee) assigneeIds.add(move.targetAssignee.id);
    const assignees = (current.assignees ?? []).filter(
      (user) => user.id !== move.sourceAssigneeId,
    );
    if (
      move.targetAssignee &&
      !assignees.some((user) => user.id === move.targetAssignee?.id)
    ) {
      assignees.push(move.targetAssignee);
    }
    return tasks.map((task) =>
      task.id === current.id
        ? { ...task, assignee_ids: [...assigneeIds], assignees }
        : task,
    );
  }

  if (move.kind === 'priority') {
    return tasks.map((task) =>
      task.id === current.id ? { ...task, priority: move.priority ?? undefined } : task,
    );
  }

  const index = statusIndex(tasks, move);
  const targetTasks = tasks
    .filter(
      (task) =>
        task.id !== current.id &&
        projectIdOf(task) === projectIdOf(current) &&
        task.status_column?.slug === move.column.slug,
    )
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const projectId = projectIdOf(current);
  const projectColumn =
    columns.find(
      (column) => column.project_id === projectId && column.slug === move.column.slug,
    ) ?? knownColumns.get(`${projectId}:${move.column.slug}`);
  const updated = {
    ...current,
    status_column_id: projectColumn?.id ?? null,
    status_column: {
      ...move.column,
      id: projectColumn?.id ?? '',
      project_id: projectId,
    },
    status_slug: move.column.slug,
    status_label: move.column.name ?? move.column.label,
    status_color: move.column.color ?? null,
  };
  targetTasks.splice(index, 0, updated);
  const positioned = new Map(
    targetTasks.map((task, taskIndex) => [task.id, { ...task, position: taskIndex + 1 }]),
  );
  return [...tasks.filter((task) => task.id !== current.id), updated]
    .map((task) => positioned.get(task.id) ?? task)
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
}

export class AllTasksBoardStore {
  private readonly entries = new Map<string, Entry>();
  private readonly knownColumns = new Map<string, TaskStatusColumn>();
  private readonly pendingMoves: BoardMove[] = [];
  private queue: Promise<void> = Promise.resolve();
  private moveFailure: string | null = null;

  private entryFor(search: string): Entry {
    let entry = this.entries.get(search);
    if (!entry) {
      entry = {
        confirmedColumns: [],
        confirmedTasks: [],
        snapshot: {
          columns: [],
          tasks: [],
          isLoading: false,
          hasLoaded: false,
          isStale: false,
          pendingMoveCount: 0,
        },
        listeners: new Set(),
        request: null,
      };
      this.entries.set(search, entry);
    }
    return entry;
  }

  private publish(entry: Entry, changes: Partial<Snapshot> = {}) {
    entry.snapshot = {
      ...entry.snapshot,
      columns: entry.confirmedColumns,
      tasks: this.pendingMoves.reduce(
        (tasks, move) =>
          applyMove(tasks, move, entry.confirmedColumns, this.knownColumns),
        entry.confirmedTasks,
      ),
      pendingMoveCount: this.pendingMoves.length,
      ...changes,
    };
    entry.listeners.forEach((listener) => listener());
  }

  private publishAll() {
    this.entries.forEach((entry) => this.publish(entry));
  }

  private enqueue<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private applyBoard(search: string, board: UserBoardResponse, invalidateOthers = false) {
    const entry = this.entryFor(search);
    entry.confirmedColumns = board.columns ?? [];
    entry.confirmedTasks = board.data ?? [];
    this.publish(entry, { hasLoaded: true, isStale: false, isLoading: false });
    if (invalidateOthers) {
      this.entries.forEach((other, key) => {
        if (key !== search && other.snapshot.hasLoaded) {
          this.publish(other, { isStale: true });
        }
      });
    }
  }

  private async refresh(search: string, invalidateOthers = false) {
    this.applyBoard(
      search,
      await api.workspace.userTaskBoard.get({ search }),
      invalidateOthers,
    );
  }

  subscribe(search: string, listener: () => void) {
    const entry = this.entryFor(search);
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  }

  getSnapshot(search: string) {
    return this.entryFor(search).snapshot;
  }

  load(search: string, force = false) {
    const entry = this.entryFor(search);
    if (entry.request) return entry.request;
    if (entry.snapshot.hasLoaded && !entry.snapshot.isStale && !force) {
      return Promise.resolve();
    }
    if (!entry.snapshot.hasLoaded) this.publish(entry, { isLoading: true });
    const request = this.enqueue(() => this.refresh(search));
    entry.request = request.finally(() => {
      entry.request = null;
      if (entry.snapshot.isLoading) this.publish(entry, { isLoading: false });
    });
    return entry.request;
  }

  moveByStatus(move: Omit<StatusMove, 'kind'>) {
    return this.queueMove({ ...move, kind: 'status' });
  }

  moveByAssignee(move: Omit<AssigneeMove, 'kind'>) {
    return this.queueMove({ ...move, kind: 'assignee' });
  }

  moveByPriority(move: Omit<PriorityMove, 'kind'>) {
    return this.queueMove({ ...move, kind: 'priority' });
  }

  private queueMove(move: BoardMove): Promise<boolean> {
    if (this.pendingMoves.length === 0) {
      this.moveFailure = null;
      toast.loading('Задачи перемещаются…', { id: MOVE_TOAST_ID });
    }
    this.pendingMoves.push(move);
    this.publishAll();

    return this.enqueue(async () => {
      let succeeded = false;
      try {
        await this.executeMove(move);
        succeeded = true;
      } catch (error) {
        this.moveFailure =
          error instanceof Error ? error.message : 'Не удалось переместить задачу.';
        try {
          await this.refresh(move.search, true);
        } catch {
          this.publish(this.entryFor(move.search), { isStale: true });
        }
      } finally {
        this.pendingMoves.splice(this.pendingMoves.indexOf(move), 1);
        this.publishAll();
        if (this.pendingMoves.length === 0) {
          if (this.moveFailure) {
            toast.error(this.moveFailure, { id: MOVE_TOAST_ID });
          } else {
            toast.success('Все задачи перенесены.', { id: MOVE_TOAST_ID });
          }
        }
      }
      return succeeded;
    });
  }

  private async executeMove(move: BoardMove) {
    const entry = this.entryFor(move.search);
    if (!entry.snapshot.hasLoaded || entry.snapshot.isStale) {
      await this.refresh(move.search);
    }
    const current = entry.confirmedTasks.find((task) => task.id === move.task.id);
    if (!current) throw new Error('Задача больше не найдена на доске.');
    const projectId = projectIdOf(current);

    if (move.kind === 'status') {
      const slug = move.column.slug;
      if (!slug) throw new Error('У целевой колонки нет статуса.');
      const columnKey = `${projectId}:${slug}`;
      const existing =
        entry.confirmedColumns.find(
          (column) => column.project_id === projectId && column.slug === slug,
        ) ?? this.knownColumns.get(columnKey);
      if (!existing) {
        const created = await api.workspace.projectTaskStatusColumns.create(projectId, {
          name: move.column.name ?? move.column.label,
          slug,
          color: move.column.color ?? '',
          is_default: false,
          is_final: Boolean(move.column.is_final),
        });
        if (created.slug !== slug) {
          throw new Error('Новая колонка получила другой статус.');
        }
        this.knownColumns.set(columnKey, created);
        entry.confirmedColumns = [
          ...entry.confirmedColumns,
          {
            id: created.id,
            project_id: projectId,
            slug,
            name: created.name ?? move.column.name ?? move.column.label,
            label: created.label ?? created.name ?? move.column.label,
            color: created.color,
            position: created.position,
            is_default: created.is_default,
            is_final: created.is_final,
          },
        ];
        this.publish(entry);
      }
      this.applyBoard(
        move.search,
        await api.workspace.userTaskBoard.move(current.id, {
          status_slug: slug,
          destination_index: statusIndex(entry.confirmedTasks, move),
          search: move.search,
        }),
        true,
      );
      return;
    }

    if (move.kind === 'assignee') {
      if (move.addMember && move.targetAssignee) {
        await api.workspace.projects.assignEmployee(projectId, move.targetAssignee.id);
      }
      const assigneeIds = new Set(
        current.assignee_ids ?? current.assignees?.map((user) => user.id) ?? [],
      );
      if (move.sourceAssigneeId) assigneeIds.delete(move.sourceAssigneeId);
      if (move.targetAssignee) assigneeIds.add(move.targetAssignee.id);
      await api.workspace.projects.updateTask(projectId, current.id, {
        title: current.title,
        parent_task_id: current.parent_task_id ?? null,
        assignee_ids: [...assigneeIds],
        priority: current.priority ?? null,
      });
    } else {
      await api.workspace.projects.updateTask(projectId, current.id, {
        title: current.title,
        parent_task_id: current.parent_task_id ?? null,
        priority: move.priority,
      });
    }
    await this.refresh(move.search, true);
  }
}

export const allTasksBoardStore = new AllTasksBoardStore();

export function useAllTasksBoardStore(search: string): Snapshot {
  const subscribe = useCallback(
    (listener: () => void) => allTasksBoardStore.subscribe(search, listener),
    [search],
  );
  const getSnapshot = useCallback(() => allTasksBoardStore.getSnapshot(search), [search]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
