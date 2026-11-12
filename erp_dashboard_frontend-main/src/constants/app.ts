import type { AppMenuItem } from '../types/app';

function resolveApiUrl() {
  const fallbackUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000/api`
      : 'http://localhost:8000/api';

  const rawUrl = String(import.meta.env.VITE_API_URL ?? '').trim();
  if (!rawUrl) {
    return fallbackUrl;
  }

  try {
    const resolvedUrl = new URL(
      rawUrl,
      typeof window !== 'undefined' ? window.location.origin : fallbackUrl,
    );
    const normalizedPath = resolvedUrl.pathname.replace(/\/+$/, '');

    if (
      typeof window !== 'undefined' &&
      resolvedUrl.origin === window.location.origin &&
      (normalizedPath === '' || normalizedPath === '/')
    ) {
      return fallbackUrl;
    }

    return `${resolvedUrl.origin}${normalizedPath || ''}`;
  } catch {
    return fallbackUrl;
  }
}

export const API_URL = resolveApiUrl();
export const WS_URL = String(import.meta.env.VITE_WS_URL ?? '').trim();
export const TOKEN_KEY = 'admin_token';
export const REFRESH_TOKEN_KEY = 'admin_refresh_token';

const HOME_MENU_ITEM: AppMenuItem = {
  id: 'home',
  label: 'Главная',
  path: '/home',
};

const PROJECTS_MENU_ITEM: AppMenuItem = {
  id: 'projects',
  label: 'Проекты',
  path: '/projects',
};

const EMPLOYEES_MENU_ITEM: AppMenuItem = {
  id: 'employees',
  label: 'Сотрудники',
  path: '/employees',
};

const CLIENTS_MENU_ITEM: AppMenuItem = {
  id: 'clients',
  label: 'Клиенты',
  path: '/clients',
};

const FINANCES_MENU_ITEM: AppMenuItem = {
  id: 'finances',
  label: 'Финансы',
  path: '/finances',
};

const PAYROLL_MENU_ITEM: AppMenuItem = {
  id: 'payroll',
  label: 'Оплата труда',
  path: '/payroll',
};

const REPORTS_MENU_ITEM: AppMenuItem = {
  id: 'reports',
  label: 'Отчёты',
  path: '/reports',
};

const REPORTS_VIEW_PERMISSIONS = [
  'reports.view',
  'reports.tasks.view',
  'reports.managers.view',
  'reports.overrun.view',
  'reports.stale_tasks.view',
  'reports.limits.view',
  'reports.hours_chart.view',
] as const;
const PROJECTS_VIEW_PERMISSIONS = [
  'projects.manage',
  'projects.view_all',
  'projects.view_assigned',
] as const;

const KNOWLEDGE_BASE_MENU_ITEM: AppMenuItem = {
  id: 'knowledge-base',
  label: 'База знаний',
  path: '/knowledge-base',
};

const SETTINGS_MENU_ITEM: AppMenuItem = {
  id: 'role-permissions',
  label: 'Настройки',
  path: '/settings',
};

const KNOWLEDGE_BASE_VIEW_PERMISSIONS = [
  'knowledge_base.view_all',
  'knowledge_base.view_assigned',
] as const;

const STAFF_EXTRA_ROUTES: string[] = ['/projects/templates'];
const SETTINGS_EXTRA_ROUTES: string[] = [
  '/settings/roles',
  '/settings/workspace',
  '/settings/workspace/company',
  '/settings/workspace/tracker',
  '/settings/workspace/client-tasks',
  '/settings/workspace/notifications',
  '/settings/tracker',
  '/settings/imports',
  '/settings/imports/new',
  '/settings/imports/history',
  '/settings/billing',
  '/settings/company',
];

function isAdminRole(role?: string) {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

function hasPermission(permissions: string[], permission: string): boolean {
  return permissions.includes(permission);
}

function canViewKnowledgeBase(permissions: string[]): boolean {
  return KNOWLEDGE_BASE_VIEW_PERMISSIONS.some((permission) =>
    hasPermission(permissions, permission),
  );
}

function canViewReports(permissions: string[]): boolean {
  return REPORTS_VIEW_PERMISSIONS.some((permission) =>
    hasPermission(permissions, permission),
  );
}

function canViewProjects(permissions: string[]): boolean {
  return PROJECTS_VIEW_PERMISSIONS.some((permission) =>
    hasPermission(permissions, permission),
  );
}

function canViewEmployees(permissions: string[]): boolean {
  return hasPermission(permissions, 'employees.view_list');
}

function canViewClients(role: string | undefined, permissions: string[]): boolean {
  return (
    isAdminRole(role) ||
    role === 'MANAGER' ||
    hasPermission(permissions, 'clients.view') ||
    hasPermission(permissions, 'clients.create_update') ||
    hasPermission(permissions, 'clients.delete')
  );
}

export function canViewFinances(
  role: string | undefined,
  permissions: string[],
): boolean {
  return (
    hasPermission(permissions, 'finance.view') ||
    hasPermission(permissions, 'finance.manage')
  );
}

export function canViewSettings(
  role: string | undefined,
  permissions: string[],
): boolean {
  return (
    isAdminRole(role) ||
    hasPermission(permissions, 'settings.view') ||
    hasPermission(permissions, 'settings.manage')
  );
}

function buildOrderedMenu(
  role: string | undefined,
  permissions: string[],
): AppMenuItem[] {
  const pages: AppMenuItem[] = [];

  if (canViewProjects(permissions)) {
    pages.push(PROJECTS_MENU_ITEM);
  }
  if (canViewEmployees(permissions)) {
    pages.push(EMPLOYEES_MENU_ITEM);
  }
  if (canViewClients(role, permissions)) {
    pages.push(CLIENTS_MENU_ITEM);
  }
  if (canViewReports(permissions)) {
    pages.push(REPORTS_MENU_ITEM);
  }
  if (canViewFinances(role, permissions)) {
    // Оплата труда вынесена из финансов, но видна тем же, кто видит финансы.
    pages.push(FINANCES_MENU_ITEM, PAYROLL_MENU_ITEM);
  }
  if (canViewKnowledgeBase(permissions)) {
    pages.push(KNOWLEDGE_BASE_MENU_ITEM);
  }
  if (canViewSettings(role, permissions)) {
    pages.push(SETTINGS_MENU_ITEM);
  }

  return pages;
}

export function getMenuItemsForRole(
  role?: string,
  permissions: string[] = [],
): AppMenuItem[] {
  if (role === 'CLIENT') return [PROJECTS_MENU_ITEM];
  return [HOME_MENU_ITEM, ...buildOrderedMenu(role, permissions)];
}

export function getExtraAllowedPathsForRole(
  role?: string,
  permissions: string[] = [],
): string[] {
  if (role === 'CLIENT') return [];
  const routes: string[] = ['/tasks/direct/:taskId', '/public/task/:token'];

  if (isAdminRole(role) || role === 'MANAGER') {
    routes.push(...STAFF_EXTRA_ROUTES);
  }

  if (canViewSettings(role, permissions)) {
    routes.push(...SETTINGS_EXTRA_ROUTES);
  }

  return routes;
}

export function getDefaultPathForRole(role?: string, permissions: string[] = []): string {
  if (role === 'CLIENT') return '/projects';
  const menuItems = getMenuItemsForRole(role, permissions);
  if (menuItems.length > 0) return menuItems[0].path;
  return '/home';
}
