import { toast } from 'sonner';
import { api } from '../../../../api/api';
import type { RolePermissionMatrixRole } from '../../../../types/app';

export type AccessMode = 'roles' | 'users' | 'clients';
export type SettingsSection = 'roles' | 'workspace' | 'imports' | 'billing';
export type WorkspaceSettingsTab =
  | 'company'
  | 'tracker'
  | 'client-tasks'
  | 'notifications';
export type EmployeePermissionMode = 'default' | 'grant' | 'deny';

export const COMPANY_REQUISITES_PATH = '/settings/workspace/company';
export const COMPANY_REQUISITES_MISSING_MESSAGE =
  'Чтобы скачать счёт, заполните реквизиты компании: название, адрес, ИНН и телефон.';

/** Есть ли у компании реквизиты, без которых не выписать счёт и УПД. */
export const hasCompanyRequisites = async (): Promise<boolean> => {
  const req = await api.workspace.settings.getCompanyRequisites();
  return Boolean(req?.legal_name && req.address && req.inn && req.phone);
};

export const verifyRequisites = async (onMissing?: () => void): Promise<boolean> => {
  try {
    if (await hasCompanyRequisites()) return true;
    if (onMissing) {
      onMissing();
    } else {
      toast.error(COMPANY_REQUISITES_MISSING_MESSAGE, {
        duration: 8000,
        action: {
          label: 'Заполнить',
          onClick: () => window.location.assign(COMPANY_REQUISITES_PATH),
        },
      });
    }
    return false;
  } catch {
    toast.error('Ошибка при проверке реквизитов компании');
    return false;
  }
};

export const handleDownloadInvoice = async (
  invoiceId: string,
  invoiceNumber: string,
  onMissingRequisites?: () => void,
) => {
  const isValid = await verifyRequisites(onMissingRequisites);
  if (!isValid) return;

  toast.promise(
    api.workspace.billing.downloadInvoice(invoiceId).then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Счет_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }),
    {
      loading: 'Подготовка счета...',
      success: 'Счет успешно скачан',
      error: 'Ошибка при скачивании счета',
    },
  );
};

export const handleDownloadUpd = async (invoiceId: string, invoiceNumber: string) => {
  const isValid = await verifyRequisites();
  if (!isValid) return;

  toast.promise(
    api.workspace.billing.downloadUpd(invoiceId).then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `УПД_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }),
    {
      loading: 'Подготовка УПД...',
      success: 'УПД успешно скачан',
      error: 'Ошибка при скачивании УПД',
    },
  );
};

export const SETTINGS_SECTION_PATHS: Record<SettingsSection, string> = {
  roles: '/settings/roles',
  workspace: '/settings/workspace',
  imports: '/settings/imports',
  billing: '/settings/billing',
};

export const WORKSPACE_SETTINGS_TAB_PATHS: Record<WorkspaceSettingsTab, string> = {
  company: '/settings/workspace/company',
  tracker: '/settings/workspace/tracker',
  'client-tasks': '/settings/workspace/client-tasks',
  notifications: '/settings/workspace/notifications',
};

// Настройки финансов переехали в «Финансы» и «Оплату труда»: см. utils/legacyRoutes.ts.
export function sectionFromSettingsPath(pathname: string): SettingsSection {
  if (pathname === '/settings' || pathname === '/settings/') return 'roles';

  const section = pathname.replace(/^\/settings\/?/, '').split('/')[0];

  if (
    section === 'roles' ||
    section === 'workspace' ||
    section === 'imports' ||
    section === 'billing'
  ) {
    return section;
  }

  // Прежние адреса отдельных разделов теперь ведут во вкладки рабочего пространства.
  if (section === 'tracker' || section === 'company') return 'workspace';

  return 'roles';
}

export function workspaceTabFromSettingsPath(pathname: string): WorkspaceSettingsTab {
  const [section, tab] = pathname.replace(/^\/settings\/?/, '').split('/');

  if (section === 'tracker') return 'tracker';
  if (
    section === 'workspace' &&
    (tab === 'tracker' || tab === 'client-tasks' || tab === 'notifications')
  ) {
    return tab;
  }

  return 'company';
}

export const ADMIN_IMMUTABLE_PERMISSIONS = new Set([
  'roles.view',
  'roles.manage',
  'settings.view',
  'settings.manage',
]);

/**
 * Права, которые можно настроить у роли. Бэкенд отдаёт их в `available_permissions`:
 * роли «Клиент» доступны только клиентские права, ролям сотрудников — все, кроме клиентских.
 */
export function roleAvailablePermissions<T extends { value: string }>(
  role: Pick<RolePermissionMatrixRole, 'available_permissions'> | null | undefined,
  permissions: T[],
): T[] {
  if (!role?.available_permissions) return permissions;
  const available = new Set(role.available_permissions);
  return permissions.filter((permission) => available.has(permission.value));
}

export function isPermissionAvailable(
  role: Pick<RolePermissionMatrixRole, 'available_permissions'> | null | undefined,
  permission: string,
): boolean {
  return !role?.available_permissions || role.available_permissions.includes(permission);
}

export function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}
