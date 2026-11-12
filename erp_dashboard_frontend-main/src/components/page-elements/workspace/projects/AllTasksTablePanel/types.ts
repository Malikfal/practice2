import type { ReactNode } from 'react';

import type {
  TaskPriority,
  TaskStatusColumn,
  User,
  UserBoardTask,
} from '../../../../../types/app';

export type SortKey = 'title' | 'project' | 'status' | 'priority' | 'assignees' | 'spent';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'table' | 'kanban' | 'due' | 'gantt';
export type GroupBy = 'status' | 'assignee' | 'priority';

export type Bucket = {
  key: string;
  name: string;
  color?: string | null;
  assignee?: User;
  priority?: TaskPriority | null;
  statusColumn?: TaskStatusColumn | null;
  tasks: UserBoardTask[];
};

export type DropTarget = {
  columnId: string;
  index: number;
};

export type DraggedTask = {
  taskId: string;
  sourceColumnKey: string;
};

export type FilterDropdownOption = {
  id: string;
  label: string;
  avatar?: ReactNode;
};
