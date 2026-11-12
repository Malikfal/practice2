import type { TaskPriority } from '../../../../../types/app';
import type { GroupBy } from './types';

export const GROUP_BY_LABEL: Record<GroupBy, string> = {
  status: 'По статусу',
  assignee: 'По исполнителю',
  priority: 'По приоритету',
};

export const PRIORITY_COLUMN_COLOR: Record<TaskPriority, string> = {
  HIGH: '#ef2d2d',
  MEDIUM: '#f29a3f',
  LOW: '#2d6ff7',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export const PRIORITY_CHIP_CLASS: Record<TaskPriority, string> = {
  LOW: 'bg-[#edf3ff] text-[#2d6ff7]',
  MEDIUM: 'bg-[#fff1e0] text-[#f29a3f]',
  HIGH: 'bg-[#fde8eb] text-[#ef2d2d]',
};
