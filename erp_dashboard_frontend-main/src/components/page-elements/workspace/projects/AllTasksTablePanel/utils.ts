import type { User, UserBoardTask } from '../../../../../types/app';

export function getTaskCreatorName(task: UserBoardTask): string {
  return task.creator?.name || 'Неизвестный автор';
}

export function getUserInitials(user: User): string {
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
