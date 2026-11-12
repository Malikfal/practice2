import type { TimelineSegment } from '../../../../../../../types/app';

export const HOURS = Array.from({ length: 24 }, (_, index) => index);
export const FIVE_MINUTE_MARKERS = Array.from({ length: 24 * 12 }, (_, index) => index);
export const MIN_ZOOM_PERCENT = 100;
export const MAX_ZOOM_PERCENT = 2400;
export const NON_CURRENT_DATE_FINANCE_WARNING =
  'Изменение времени не за текущую дату влияет на финансовые расчёты. После сохранения необходимо вручную запустить перерасчёт финансов.';

export function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatSegmentTask(segment: TimelineSegment, canViewDetails: boolean) {
  const taskName = segment.task_name || '—';

  if (!canViewDetails) {
    return taskName;
  }

  const details = [
    segment.note?.trim(),
    segment.created_by_name ? `добавил: ${segment.created_by_name}` : null,
  ].filter(Boolean);

  return details.length ? `${taskName} (${details.join(', ')})` : taskName;
}
