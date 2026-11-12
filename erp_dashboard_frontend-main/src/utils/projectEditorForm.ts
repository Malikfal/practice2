import type { Project, ProjectEditorForm } from '../types/app';
import {
  formatHoursCompact,
  isProjectArchived,
  normalizeProjectStatus,
} from './formatters';

// Как на бэкенде: не больше 1000 часов в неделю.
export const MAX_WEEKLY_LIMIT_HOURS = 1000;

/** Форма вкладки «О проекте» в исходном виде, как сохранено в проекте. */
export function projectToEditorForm(project: Project): ProjectEditorForm {
  return {
    projectId: project.id,
    name: project.name || '',
    description: project.description || '',
    status: isProjectArchived(project.status) ? 'ARCHIVED' : 'ACTIVE',
    client_id: project.client_id || '',
    manager_payment_method: project.manager_payment_method || 'ACCRUE_ALL',
    is_internal: Boolean(project.is_internal),
    exclude_from_payroll: Boolean(project.exclude_from_payroll),
    payroll_exclusion_scope:
      project.payroll_exclusion_scope === 'SELECTED' ? 'SELECTED' : 'ALL',
    payroll_excluded_employee_ids: Array.isArray(project.payroll_excluded_employee_ids)
      ? project.payroll_excluded_employee_ids
      : [],
    weekly_limit_hours: formatHoursCompact(project.weekly_limit_seconds),
  };
}

/** weeklyLimitSeconds: уже разобранное значение поля «Недельный лимит». */
export function hasProjectEditorChanges(
  form: ProjectEditorForm,
  project: Project,
  weeklyLimitSeconds: number | null,
) {
  return (
    weeklyLimitSeconds !== (project.weekly_limit_seconds ?? null) ||
    form.name !== (project.name || '') ||
    form.description !== (project.description || '') ||
    normalizeProjectStatus(form.status) !== normalizeProjectStatus(project.status) ||
    (form.client_id || '') !== (project.client_id || '') ||
    form.is_internal !== Boolean(project.is_internal) ||
    form.exclude_from_payroll !== Boolean(project.exclude_from_payroll) ||
    form.payroll_exclusion_scope !==
      (project.payroll_exclusion_scope === 'SELECTED' ? 'SELECTED' : 'ALL') ||
    JSON.stringify(form.payroll_excluded_employee_ids) !==
      JSON.stringify(project.payroll_excluded_employee_ids ?? [])
  );
}
