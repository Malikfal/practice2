import { formatName } from '../../../../../utils/formatters';
import type {
  TaskStatusColumn,
  User,
  UserBoardColumn,
  UserBoardTask,
} from '../../../../../types/app';
import { PRIORITY_COLUMN_COLOR, PRIORITY_ORDER } from './constants';
import type { Bucket, GroupBy, SortDirection, SortKey } from './types';

export function getProjectOptions(tasks: UserBoardTask[]) {
  const map = new Map<string, string>();
  for (const task of tasks) {
    const project = task.project;
    if (!project?.id) continue;
    if (!map.has(project.id)) {
      map.set(project.id, project.name ?? 'Без названия');
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

export function getAssigneeOptions(tasks: UserBoardTask[]): User[] {
  const map = new Map<string, User>();
  for (const task of tasks) {
    for (const assignee of task.assignees ?? []) {
      if (!map.has(assignee.id)) map.set(assignee.id, assignee);
    }
  }
  return Array.from(map.values()).sort((left, right) =>
    formatName(left).localeCompare(formatName(right), 'ru'),
  );
}

export function filterTasks(
  tasks: UserBoardTask[],
  selectedProjectIds: string[],
  selectedAssigneeIds: string[],
) {
  if (selectedProjectIds.length === 0 && selectedAssigneeIds.length === 0) {
    return tasks;
  }
  const projectSet = new Set(selectedProjectIds);
  const assigneeSet = new Set(selectedAssigneeIds);
  return tasks.filter((task) => {
    if (projectSet.size > 0) {
      const projectId = task.project?.id;
      if (!projectId || !projectSet.has(projectId)) return false;
    }
    if (assigneeSet.size > 0) {
      const assignees = task.assignees ?? [];
      if (!assignees.some((assignee) => assigneeSet.has(assignee.id))) return false;
    }
    return true;
  });
}

export function buildKanbanColumns({
  allAssignees,
  boardColumns,
  groupBy,
  tasks,
}: {
  allAssignees: User[];
  boardColumns: UserBoardColumn[];
  groupBy: GroupBy;
  tasks: UserBoardTask[];
}): Bucket[] {
  if (groupBy === 'status') return buildStatusBuckets(tasks, boardColumns);
  if (groupBy === 'assignee') return buildAssigneeBuckets(tasks, allAssignees);
  return buildPriorityBuckets(tasks);
}

export function sortTasks(
  tasks: UserBoardTask[],
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  const direction = sortDirection === 'asc' ? 1 : -1;
  return [...tasks].sort((left, right) => {
    switch (sortKey) {
      case 'title':
        return (left.title ?? '').localeCompare(right.title ?? '', 'ru') * direction;
      case 'project':
        return (
          (left.project?.name ?? '').localeCompare(right.project?.name ?? '', 'ru') *
          direction
        );
      case 'status':
        return (
          (left.status_label ?? '').localeCompare(right.status_label ?? '', 'ru') *
          direction
        );
      case 'priority': {
        const leftPriority = left.priority ? PRIORITY_ORDER[left.priority] : -1;
        const rightPriority = right.priority ? PRIORITY_ORDER[right.priority] : -1;
        return (leftPriority - rightPriority) * direction;
      }
      case 'assignees': {
        const leftAssignees = (left.assignees ?? [])
          .map((user) => formatName(user))
          .join(', ');
        const rightAssignees = (right.assignees ?? [])
          .map((user) => formatName(user))
          .join(', ');
        return leftAssignees.localeCompare(rightAssignees, 'ru') * direction;
      }
      case 'spent':
        return ((left.spent_seconds ?? 0) - (right.spent_seconds ?? 0)) * direction;
      default:
        return 0;
    }
  });
}

function buildStatusBuckets(tasks: UserBoardTask[], boardColumns: UserBoardColumn[]) {
  const fallback: Bucket = { key: '__no_status__', name: 'Без статуса', tasks: [] };
  const byKey = new Map<string, Bucket>();

  for (const column of boardColumns) {
    if (!column.slug || column.slug === 'without_status' || byKey.has(column.slug)) {
      continue;
    }
    byKey.set(column.slug, {
      key: column.slug,
      name: column.name || column.label || column.slug,
      color: column.color,
      statusColumn: toTaskStatusColumn(column),
      tasks: [],
    });
  }

  for (const task of tasks) {
    const statusColumn = task.status_column;
    const slug = statusColumn?.slug ?? '';
    if (!statusColumn || !slug) {
      fallback.tasks.push(task);
      continue;
    }

    let bucket = byKey.get(slug);
    if (!bucket) {
      bucket = {
        key: slug,
        name: statusColumn.name || statusColumn.label || slug,
        color: statusColumn.color,
        statusColumn,
        tasks: [],
      };
      byKey.set(slug, bucket);
    }
    bucket.tasks.push(task);
  }

  const buckets = Array.from(byKey.values()).sort((left, right) => {
    const leftOrder = left.statusColumn?.order ?? left.statusColumn?.position ?? 0;
    const rightOrder = right.statusColumn?.order ?? right.statusColumn?.position ?? 0;
    return leftOrder - rightOrder;
  });
  return fallback.tasks.length ? [fallback, ...buckets] : buckets;
}

function toTaskStatusColumn(column: UserBoardColumn): TaskStatusColumn {
  return {
    id: column.id,
    project_id: column.project_id,
    label: column.label,
    order: column.order ?? column.position ?? 0,
    name: column.name,
    slug: column.slug,
    color: column.color,
    position: column.position,
    is_default: column.is_default,
    is_final: column.is_final,
  };
}

function buildAssigneeBuckets(tasks: UserBoardTask[], allAssignees: User[]) {
  const byKey = new Map<string, Bucket>();
  const fallback: Bucket = {
    key: '__no_assignee__',
    name: 'Без исполнителя',
    tasks: [],
  };

  for (const assignee of allAssignees) {
    byKey.set(assignee.id, {
      key: assignee.id,
      name: formatName(assignee),
      assignee,
      tasks: [],
    });
  }

  for (const task of tasks) {
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
          assignee,
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
  return fallback.tasks.length ? [fallback, ...result] : result;
}

function buildPriorityBuckets(tasks: UserBoardTask[]) {
  const priorityBuckets: Bucket[] = [
    {
      key: 'HIGH',
      name: 'Высокий',
      color: PRIORITY_COLUMN_COLOR.HIGH,
      priority: 'HIGH',
      tasks: [],
    },
    {
      key: 'MEDIUM',
      name: 'Средний',
      color: PRIORITY_COLUMN_COLOR.MEDIUM,
      priority: 'MEDIUM',
      tasks: [],
    },
    {
      key: 'LOW',
      name: 'Низкий',
      color: PRIORITY_COLUMN_COLOR.LOW,
      priority: 'LOW',
      tasks: [],
    },
  ];
  const fallback: Bucket = {
    key: '__no_priority__',
    name: 'Без приоритета',
    priority: null,
    tasks: [],
  };
  const byKey = new Map(priorityBuckets.map((bucket) => [bucket.key, bucket]));

  for (const task of tasks) {
    if (task.priority && byKey.has(task.priority)) {
      byKey.get(task.priority)!.tasks.push(task);
    } else {
      fallback.tasks.push(task);
    }
  }

  return fallback.tasks.length ? [fallback, ...priorityBuckets] : priorityBuckets;
}
