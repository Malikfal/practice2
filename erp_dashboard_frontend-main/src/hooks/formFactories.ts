import { format } from 'date-fns';

import type {
  EmployeeDayTimelineForm,
  EmployeeCreateForm,
  EmployeePasswordForm,
  ManualTimeForm,
  ProjectForm,
  ReportForm,
  TaskStatusColumnForm,
  TemplateForm,
} from '../types/app';

export function createInitialReportForm(): ReportForm {
  const now = new Date();
  const currentDayOfWeek = now.getDay();

  // Вычисляем сколько дней нужно отнять, дабы получить понедельник
  const diffToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - diffToMonday);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // Локальная дата: toISOString() в UTC сдвигает неделю назад в ночь на понедельник.
  return {
    from: format(startOfWeek, 'yyyy-MM-dd'),
    to: format(endOfWeek, 'yyyy-MM-dd'),
    group_by: 'project',
    project_ids: [],
    project_kinds: [],
    task_ids: [],
    user_ids: [],
    manager_ids: [],
  };
}

export function createInitialEmployeeForm(defaultRole = 'WORKER'): EmployeeCreateForm {
  return {
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role: defaultRole,
    position: '',
    birthday: '',
    phone: '',
    socials: {
      additional_email: '',
      additional_phone: '',
      max_url: '',
      vk_url: '',
      telegram_url: '',
    },
    skills: '',
  };
}

export function createInitialEmployeePasswordForm(): EmployeePasswordForm {
  return {
    password: '',
    password_confirmation: '',
  };
}

export function createInitialProjectForm(template = ''): ProjectForm {
  return {
    name: '',
    description: '',
    status: 'ACTIVE',
    client_id: '',
    template,
    rate: '',
    rate_currency: 'RUB',
    rate_vat: '',
    is_internal: false,
    exclude_from_payroll: false,
    payroll_exclusion_scope: 'ALL',
    payroll_excluded_employee_ids: [],
  };
}

export function createDefaultTemplateStatusColumns(): TaskStatusColumnForm[] {
  return [
    { name: 'Сделать', color: '#4db6f2', is_default: true, is_final: false },
    { name: 'В работе', color: '#f29a3f', is_default: false, is_final: false },
    { name: 'На проверке', color: '#ef2d2d', is_default: false, is_final: false },
    { name: 'Завершено', color: '#60c94a', is_default: false, is_final: true },
  ];
}

export function isStandardTemplateStatus(
  status: Pick<TaskStatusColumnForm, 'name'>,
): boolean {
  const normalizedName = status.name.trim().toLowerCase();

  return createDefaultTemplateStatusColumns().some(
    (column) => column.name.trim().toLowerCase() === normalizedName,
  );
}

export function createInitialTemplateForm(): TemplateForm {
  return {
    name: '',
    manager_id: '',
    member_ids: [],
    is_default_template: false,
    status_columns: createDefaultTemplateStatusColumns(),
  };
}

export function createInitialManualTimeForm(): ManualTimeForm {
  return {
    task_id: '',
    task_title: '',
    user_id: '',
    project_id: '',
    started_at: '',
    ended_at: '',
    note: '',
  };
}

export function createInitialEmployeeDayTimelineForm(): EmployeeDayTimelineForm {
  const now = new Date();

  return {
    user_id: '',
    date: now.toISOString().slice(0, 10),
  };
}
