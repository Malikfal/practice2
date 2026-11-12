import type { PermissionOption } from '../types/app';

export type PermissionGroup = {
  id: string;
  label: string;
  permissions: PermissionOption[];
  subgroups: PermissionSubgroup[];
};

export type PermissionSubgroup = {
  id: string;
  label: string;
  permissions: PermissionOption[];
};

const PERMISSION_GROUPS = [
  { id: 'projects', label: 'Проекты', prefixes: ['projects.', 'project.'] },
  { id: 'tasks', label: 'Задачи', prefixes: ['tasks.'] },
  { id: 'time', label: 'Время', prefixes: ['time.'] },
  { id: 'employees', label: 'Сотрудники', prefixes: ['employees.'] },
  { id: 'reports', label: 'Отчёты', prefixes: ['reports.'] },
  { id: 'finance', label: 'Финансы', prefixes: ['finance.'] },
  { id: 'clients', label: 'Клиенты', prefixes: ['clients.'] },
  { id: 'client_portal', label: 'Кабинет клиента', prefixes: ['client_portal.'] },
  { id: 'knowledge_base', label: 'База знаний', prefixes: ['knowledge_base.'] },
  { id: 'settings', label: 'Настройки', prefixes: ['settings.'] },
  { id: 'roles', label: 'Роли и права', prefixes: ['roles.'] },
] as const;

const PERMISSION_SUBGROUPS = {
  projects: [
    {
      id: 'access',
      label: 'Доступ к проектам',
      matches: ['projects.view_all', 'projects.view_assigned'],
    },
    {
      id: 'management',
      label: 'Управление проектом',
      matches: ['projects.create_update', 'projects.delete', 'project.members.'],
    },
    {
      id: 'money',
      label: 'Бюджет и ставки',
      matches: ['projects.budget.', 'projects.rate.'],
    },
    {
      id: 'client',
      label: 'Клиент',
      matches: ['projects.tabs.tasks.client.'],
    },
    {
      id: 'tabs',
      label: 'Вкладки проекта',
      matches: ['projects.tabs.'],
    },
    {
      id: 'notes',
      label: 'Заметки',
      matches: ['projects.notes.'],
    },
    {
      id: 'documents',
      label: 'Документы',
      matches: ['projects.documents.'],
    },
  ],
  tasks: [
    {
      id: 'access',
      label: 'Доступ к задачам',
      matches: ['tasks.view_all', 'tasks.view_project_assigned', 'tasks.view_assigned'],
    },
    {
      id: 'management',
      label: 'Управление задачами',
      matches: [
        'tasks.create_update',
        'tasks.delete',
        'tasks.assign',
        'tasks.status.',
        'tasks.move',
      ],
    },
  ],
  time: [
    {
      id: 'add',
      label: 'Добавление времени',
      matches: ['time.add_for_others', 'time.add_for_project_users', 'time.add_for_all'],
    },
    {
      id: 'view',
      label: 'Просмотр времени',
      matches: ['time.view_'],
    },
    {
      id: 'edit',
      label: 'Удаление времени',
      matches: ['time.delete_'],
    },
  ],
  employees: [
    {
      id: 'access',
      label: 'Доступ к сотрудникам',
      matches: ['employees.view_list'],
    },
    {
      id: 'management',
      label: 'Управление сотрудниками',
      matches: ['employees.create_update', 'employees.delete', 'employees.password.'],
    },
    {
      id: 'tabs',
      label: 'Вкладки сотрудника',
      matches: ['employees.tabs.'],
    },
  ],
  reports: [
    {
      id: 'reports',
      label: 'Отчёты',
      matches: ['reports.'],
    },
  ],
  finance: [
    {
      id: 'finance',
      label: 'Финансы',
      matches: ['finance.'],
    },
  ],
  clients: [
    {
      id: 'clients',
      label: 'Клиенты',
      matches: ['clients.'],
    },
  ],
  client_portal: [
    {
      id: 'task',
      label: 'Данные задачи',
      matches: ['client_portal.task.'],
    },
    {
      id: 'comments',
      label: 'Комментарии',
      matches: ['client_portal.attachments.'],
    },
  ],
  knowledge_base: [
    {
      id: 'access',
      label: 'Доступ к базе знаний',
      matches: ['knowledge_base.view_'],
    },
    {
      id: 'management',
      label: 'Управление базой знаний',
      matches: ['knowledge_base.create_update', 'knowledge_base.delete'],
    },
  ],
  settings: [
    {
      id: 'settings',
      label: 'Настройки',
      matches: ['settings.'],
    },
  ],
  roles: [
    {
      id: 'roles',
      label: 'Роли и права',
      matches: ['roles.'],
    },
  ],
} as const;

const OTHER_PERMISSION_GROUP = {
  id: 'other',
  label: 'Прочее',
} as const;

function resolvePermissionGroup(permission: PermissionOption) {
  return (
    PERMISSION_GROUPS.find((group) =>
      group.prefixes.some((prefix) => permission.value.startsWith(prefix)),
    ) ?? OTHER_PERMISSION_GROUP
  );
}

function matchesPermission(value: string, match: string): boolean {
  return value === match || value.startsWith(match);
}

function resolvePermissionSubgroup(groupId: string, permission: PermissionOption) {
  const subgroups = PERMISSION_SUBGROUPS[groupId as keyof typeof PERMISSION_SUBGROUPS];
  const matchedSubgroup = subgroups?.find((subgroup) =>
    subgroup.matches.some((match) => matchesPermission(permission.value, match)),
  );

  return matchedSubgroup ?? { id: 'general', label: 'Общее' };
}

export function groupPermissions(permissions: PermissionOption[]): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();

  for (const permission of permissions) {
    const group = resolvePermissionGroup(permission);
    const existingGroup = groups.get(group.id);

    if (existingGroup) {
      existingGroup.permissions.push(permission);
      continue;
    }

    groups.set(group.id, {
      id: group.id,
      label: group.label,
      permissions: [permission],
      subgroups: [],
    });
  }

  const orderedGroups = [...PERMISSION_GROUPS, OTHER_PERMISSION_GROUP]
    .map((group) => groups.get(group.id))
    .filter((group): group is PermissionGroup => Boolean(group));

  for (const group of orderedGroups) {
    const subgroups = new Map<string, PermissionSubgroup>();

    for (const permission of group.permissions) {
      const subgroup = resolvePermissionSubgroup(group.id, permission);
      const existingSubgroup = subgroups.get(subgroup.id);

      if (existingSubgroup) {
        existingSubgroup.permissions.push(permission);
        continue;
      }

      subgroups.set(subgroup.id, {
        id: subgroup.id,
        label: subgroup.label,
        permissions: [permission],
      });
    }

    const configuredSubgroups =
      PERMISSION_SUBGROUPS[group.id as keyof typeof PERMISSION_SUBGROUPS] ?? [];

    group.subgroups = [...configuredSubgroups, { id: 'general', label: 'Общее' }]
      .map((subgroup) => subgroups.get(subgroup.id))
      .filter((subgroup): subgroup is PermissionSubgroup => Boolean(subgroup));
  }

  return orderedGroups;
}
