import type { Task } from '../../../../types/app';

export type StatusScope = 'active' | 'archived' | 'all';

export type DisplayOptions = {
  showEmployees: boolean;
  showProjects: boolean;
  showTaskStatus: boolean;
  showUpdatedAt: boolean;
  showRemainingTime: boolean;
};

export type TaskReportAssignee = {
  id: string;
  name: string;
  last_name: string;
  status?: string;
};

export type TaskReportSpentUser = {
  user_id: string;
  name: string;
  last_name: string;
  spent_seconds: number;
};

export type TaskReportRow = Task & {
  project_name: string;
  client_id: string;
  assignee_names: string[];
  assignees?: TaskReportAssignee[];
  spent_by_users?: TaskReportSpentUser[];
};

export const INITIAL_DISPLAY_OPTIONS: DisplayOptions = {
  showEmployees: true,
  showProjects: true,
  showTaskStatus: true,
  showUpdatedAt: true,
  showRemainingTime: true,
};

const UTF8_BOM = '\uFEFF';

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatHoursMinutes(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours} ч ${minutes} мин`;
}

export function formatRemainingHoursMinutes(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${formatHoursMinutes(Math.abs(value))}`;
}

function sanitizeFileNamePart(value: string): string {
  return value
    .replaceAll(/[<>:"/\\|?*]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function formatFileDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export function buildTaskReportsFileBaseName(
  projectNames: string[],
  periodFrom?: string,
  periodTo?: string,
): string {
  const projectPart =
    projectNames.length === 0
      ? 'Все проекты'
      : projectNames.length === 1
        ? projectNames[0]
        : `Несколько проектов (${projectNames.length})`;

  const safeProjectPart = sanitizeFileNamePart(projectPart) || 'Отчёт по задачам';

  if (!periodFrom || !periodTo) {
    return safeProjectPart;
  }

  return `${safeProjectPart}_${formatFileDate(periodFrom)}-${formatFileDate(periodTo)}`;
}

export function downloadCsvFile(contents: string, fileName: string) {
  const blob = new Blob([UTF8_BOM, contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function toCsvLine(values: string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',');
}

export function buildTaskReportExportHeaders(displayOptions: DisplayOptions): string[] {
  const headers: string[] = [];

  if (displayOptions.showProjects) headers.push('Проект');
  headers.push('Задача');
  if (displayOptions.showEmployees) headers.push('Сотрудники');
  if (displayOptions.showTaskStatus) headers.push('Статус задачи');
  if (displayOptions.showUpdatedAt) headers.push('Дата обновления');
  headers.push('Время');
  if (displayOptions.showRemainingTime) headers.push('Оставшееся время');

  return headers;
}

export function buildTaskReportExportRows(
  rows: TaskReportRow[],
  displayOptions: DisplayOptions,
  showSpentBreakdown = false,
): string[][] {
  return rows.map((row) => {
    const estimation = row.estimation ?? 0;
    const spent = row.spent_seconds ?? 0;
    const remaining = Math.max(0, estimation - spent);
    const nextRow: string[] = [];

    if (displayOptions.showProjects) {
      nextRow.push(row.project_name || '—');
    }

    nextRow.push(row.title);

    if (displayOptions.showEmployees) {
      nextRow.push(
        row.assignees && row.assignees.length > 0
          ? row.assignees
              .map((assignee) =>
                [assignee.name, assignee.last_name].filter(Boolean).join(' ').trim(),
              )
              .filter(Boolean)
              .join(', ')
          : row.assignee_names.length > 0
            ? row.assignee_names.join(', ')
            : '—',
      );
    }

    if (displayOptions.showTaskStatus) {
      nextRow.push(row.status_label || row.status || '—');
    }

    if (displayOptions.showUpdatedAt) {
      nextRow.push(row.updated_at ?? '—');
    }

    const spentByUsers = Array.isArray(row.spent_by_users) ? row.spent_by_users : [];
    const shouldShowSpentBreakdown = showSpentBreakdown && spentByUsers.length > 1;
    nextRow.push(
      shouldShowSpentBreakdown
        ? `${formatHoursMinutes(spent)} (${spentByUsers
            .map((spentByUser) => {
              const name = [spentByUser.name, spentByUser.last_name]
                .filter(Boolean)
                .join(' ')
                .trim();

              return `${name || '—'}: ${formatHoursMinutes(spentByUser.spent_seconds ?? 0)}`;
            })
            .join(', ')})`
        : formatHoursMinutes(spent),
    );

    if (displayOptions.showRemainingTime) {
      nextRow.push(formatHoursMinutes(remaining));
    }

    return nextRow;
  });
}
