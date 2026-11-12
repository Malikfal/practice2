import type {
  EmployeeCreateForm,
  EmployeeBlockPayload,
  EmployeePasswordForm,
  EmployeeUpdatePayload,
  RolePermissionMatrixResponse,
  User,
} from '../../types/app';

export function createAdminApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  const adminPrefix = '/admin';
  const employeesPrefix = `${adminPrefix}/employees`;
  const employeePrefix = (employeeId: string) => `${employeesPrefix}/${employeeId}`;

  return {
    admin: {
      roles: {
        getPermissionMatrix: () =>
          request<RolePermissionMatrixResponse>(`${adminPrefix}/roles/permissions`),

        create: (displayName: string) =>
          request<{
            value: string;
            display_name?: string;
            label: string;
            is_immutable?: boolean;
            available_permissions?: string[];
            permissions?: string[];
          }>(`${adminPrefix}/roles`, {
            method: 'POST',
            body: JSON.stringify({ display_name: displayName }),
          }),

        update: (currentRole: string, role: string, displayName: string) =>
          request<{
            value: string;
            display_name?: string;
            label: string;
            is_immutable?: boolean;
          }>(`${adminPrefix}/roles/${currentRole}`, {
            method: 'PATCH',
            body: JSON.stringify({ role, display_name: displayName }),
          }),

        remove: (role: string) =>
          request<{ message?: string }>(`${adminPrefix}/roles/${role}`, {
            method: 'DELETE',
          }),

        syncPermissions: (role: string, permissions: string[]) =>
          request<{ role: string; permissions: string[] }>(
            `${adminPrefix}/roles/${role}/permissions`,
            {
              method: 'PATCH',
              body: JSON.stringify({ permissions }),
            },
          ),
      },

      clientAccounts: {
        getMany: () =>
          request<{ data: User[] }>(`${adminPrefix}/client-accounts`).then(
            (response) => response.data ?? [],
          ),
      },

      employees: {
        create: (payload: EmployeeCreateForm) =>
          request<User>(employeesPrefix, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        updateRole: (employeeId: string, role: string) =>
          request<User>(`${employeePrefix(employeeId)}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
          }),

        updateProfile: (employeeId: string, payload: EmployeeUpdatePayload) =>
          request<User>(employeePrefix(employeeId), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        changePassword: (employeeId: string, payload: EmployeePasswordForm) =>
          request<{ message?: string }>(`${employeePrefix(employeeId)}/password`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (employeeId: string) =>
          request<{ message?: string }>(employeePrefix(employeeId), {
            method: 'DELETE',
          }),

        updateStatus: (employeeId: string, payload: EmployeeBlockPayload) =>
          request<User>(`${employeePrefix(employeeId)}/block`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        syncPermissions: (
          employeeId: string,
          permissions: string[],
          deniedPermissions: string[] = [],
        ) =>
          request<User>(`${employeePrefix(employeeId)}/permissions`, {
            method: 'PATCH',
            body: JSON.stringify({
              permissions,
              denied_permissions: deniedPermissions,
            }),
          }),
      },
    },
  };
}
