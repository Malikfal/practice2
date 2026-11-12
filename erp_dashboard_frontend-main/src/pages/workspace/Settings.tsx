import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../api/api';
import ConfirmDialog from '../../components/modals/ConfirmDialog';
import RoleCreateModal from '../../components/modals/RoleCreateModal';
import DataImportsSettings from '../../components/page-elements/workspace/settings/DataImportsSettings';
import RolesAndPermissionsSettings from '../../components/page-elements/workspace/settings/RolesAndPermissionsSettings';
import SettingsSidebar from '../../components/page-elements/workspace/settings/SettingsSidebar';
import BillingSettings from '../../components/page-elements/workspace/settings/BillingSettings';
import WorkspaceSettings from '../../components/page-elements/workspace/settings/WorkspaceSettings';
import {
  ADMIN_IMMUTABLE_PERMISSIONS,
  roleAvailablePermissions,
  SETTINGS_SECTION_PATHS,
  type AccessMode,
  type EmployeePermissionMode,
  type SettingsSection,
  sectionFromSettingsPath,
  WORKSPACE_SETTINGS_TAB_PATHS,
  workspaceTabFromSettingsPath,
} from '../../components/page-elements/workspace/settings/settingsUtils';
import { useSerialSaveQueue } from '../../components/page-elements/workspace/settings/useSerialSaveQueue';
import { useAppControllerContext } from '../../context/AppControllerContext';
import type { PermissionOption, RolePermissionMatrixRole, User } from '../../types/app';
import { groupPermissions } from '../../utils/permissions';

type PersonPermissionOverrides = { direct: string[]; denied: string[] };

function personPermissionOverrides(person: User | null): PersonPermissionOverrides {
  return {
    direct: Array.isArray(person?.direct_permissions) ? person.direct_permissions : [],
    denied: Array.isArray(person?.denied_permissions) ? person.denied_permissions : [],
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Произошла ошибка.';
}

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppControllerContext();
  const userPermissions = user?.permissions ?? [];
  const canManageSettings = userPermissions.includes('settings.manage');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [activeMode, setActiveMode] = useState<AccessMode>('roles');
  const [roles, setRoles] = useState<RolePermissionMatrixRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [clientAccounts, setClientAccounts] = useState<User[]>([]);
  const [selectedClientAccountId, setSelectedClientAccountId] = useState('');
  const [isLoadingClientAccounts, setIsLoadingClientAccounts] = useState(false);
  const roleSaveQueue = useSerialSaveQueue<string[]>();
  const personSaveQueue = useSerialSaveQueue<PersonPermissionOverrides>();
  const savingRoles = roleSaveQueue.savingKeys;
  // Права роли меняют личные исключения её пользователей, список нужно перечитать.
  const employeesStaleRef = useRef(false);
  const [isRoleCreateModalOpen, setIsRoleCreateModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<'create' | 'edit'>('create');
  const [editingRoleValue, setEditingRoleValue] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<RolePermissionMatrixRole | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleDisplayName, setNewRoleDisplayName] = useState('');
  const [newRoleError, setNewRoleError] = useState('');
  const permissionGroups = groupPermissions(permissions);
  const activeSection = useMemo(
    () => sectionFromSettingsPath(location.pathname),
    [location.pathname],
  );

  const rolePermissionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const role of roles) {
      map.set(role.value, new Set(role.permissions));
    }

    return map;
  }, [roles]);

  const isClientsMode = activeMode === 'clients';
  const accessPeople = isClientsMode ? clientAccounts : employees;
  const selectedPersonId = isClientsMode ? selectedClientAccountId : selectedEmployeeId;
  const selectedEmployee = useMemo(
    () => accessPeople.find((person) => person.id === selectedPersonId) ?? null,
    [accessPeople, selectedPersonId],
  );
  const selectedPersonRole = roles.find((role) => role.value === selectedEmployee?.role);
  const personPermissionGroups = groupPermissions(
    roleAvailablePermissions(selectedPersonRole, permissions),
  );

  const selectedEmployeeRolePermissions = Array.isArray(
    selectedEmployee?.role_permissions,
  )
    ? selectedEmployee.role_permissions
    : [];
  const selectedEmployeeMatrixRolePermissions = selectedEmployee?.role
    ? Array.from(rolePermissionMap.get(selectedEmployee.role) ?? new Set<string>())
    : [];
  const selectedEmployeeRolePermissionSet = new Set([
    ...selectedEmployeeRolePermissions,
    ...selectedEmployeeMatrixRolePermissions,
  ]);
  const selectedOverrides = personPermissionOverrides(selectedEmployee);
  const selectedDirectPermissionSet = new Set(selectedOverrides.direct);
  const selectedDeniedPermissionSet = new Set(selectedOverrides.denied);
  const isSavingEmployee = selectedEmployee
    ? personSaveQueue.savingKeys.has(selectedEmployee.id)
    : false;
  const canDenySelectedEmployeePermissions = Boolean(selectedEmployee);
  const isSelectedEmployeeAdmin = selectedEmployee?.role === 'ADMIN';

  const isImmutableForAdmin = useCallback(
    (permission: string, role?: string | null) =>
      role === 'ADMIN' && ADMIN_IMMUTABLE_PERMISSIONS.has(permission),
    [],
  );

  const handleError = useCallback((err: unknown) => {
    toast.error(errorMessage(err));
  }, []);

  const fetchMatrix = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.admin.roles.getPermissionMatrix();
      setRoles(Array.isArray(response.roles) ? response.roles : []);
      setPermissions(Array.isArray(response.permissions) ? response.permissions : []);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoadingEmployees(true);
      const response = await api.workspace.employees.getMany({
        status: 'all',
        per_page: 1000,
      });
      const employeeList = Array.isArray(response.data) ? response.data : [];

      setEmployees(employeeList);
      setSelectedEmployeeId((prev) => {
        if (prev && employeeList.some((employee) => employee.id === prev)) {
          return prev;
        }

        return employeeList[0]?.id ?? '';
      });
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [handleError]);

  const fetchClientAccounts = useCallback(async () => {
    try {
      setIsLoadingClientAccounts(true);
      const accounts = await api.admin.clientAccounts.getMany();

      setClientAccounts(accounts);
      setSelectedClientAccountId((prev) =>
        prev && accounts.some((account) => account.id === prev)
          ? prev
          : (accounts[0]?.id ?? ''),
      );
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingClientAccounts(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (activeSection !== 'roles' || activeMode !== 'clients') return;
    void fetchClientAccounts();
  }, [activeSection, activeMode, fetchClientAccounts]);

  useEffect(() => {
    const expectedPath = SETTINGS_SECTION_PATHS[activeSection];

    // Подпути импорта (/settings/imports/new, /history) переключает сам раздел импорта.
    if (
      (activeSection === 'imports' || activeSection === 'workspace') &&
      location.pathname.startsWith(`${expectedPath}/`)
    ) {
      return;
    }

    if (activeSection === 'workspace') {
      const tabPath =
        WORKSPACE_SETTINGS_TAB_PATHS[workspaceTabFromSettingsPath(location.pathname)];
      navigate(tabPath, { replace: true });
      return;
    }

    if (location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true });
    }
  }, [activeSection, location.pathname, navigate]);

  const changeActiveSection = (section: SettingsSection) => {
    navigate(SETTINGS_SECTION_PATHS[section]);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMatrix();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchMatrix]);

  useEffect(() => {
    if (activeSection !== 'roles') return;

    const timer = setTimeout(() => {
      fetchEmployees();
    }, 0);

    return () => clearTimeout(timer);
  }, [activeSection, fetchEmployees]);

  useEffect(() => {
    if (activeSection !== 'roles' || activeMode !== 'users') return;
    if (!employeesStaleRef.current) return;

    employeesStaleRef.current = false;
    void fetchEmployees();
  }, [activeSection, activeMode, fetchEmployees]);

  // Права роли сохраняются сразу по клику на галку, без отдельной кнопки.
  const saveRolePermissions = (
    roleEntry: RolePermissionMatrixRole,
    nextPermissions: string[],
  ) => {
    const role = roleEntry.value;

    roleSaveQueue.enqueue(role, {
      previous: roleEntry.permissions,
      next: nextPermissions,
      send: async (permissions) => {
        const response = await api.admin.roles.syncPermissions(role, permissions);
        employeesStaleRef.current = true;
        return Array.isArray(response.permissions) ? response.permissions : permissions;
      },
      apply: (permissions) =>
        setRoles((prev) =>
          prev.map((entry) => (entry.value === role ? { ...entry, permissions } : entry)),
        ),
      onError: (err) =>
        toast.error(`Права роли ${roleEntry.label} не сохранены: ${errorMessage(err)}`),
    });
  };

  const togglePermission = (role: string, permission: string) => {
    if (isImmutableForAdmin(permission, role)) return;

    const roleEntry = roles.find((entry) => entry.value === role);
    if (!roleEntry) return;

    saveRolePermissions(
      roleEntry,
      roleEntry.permissions.includes(permission)
        ? roleEntry.permissions.filter((name) => name !== permission)
        : [...roleEntry.permissions, permission],
    );
  };

  const togglePermissionGroup = (role: string, groupPermissions: PermissionOption[]) => {
    if (
      role === 'ADMIN' &&
      groupPermissions.some((item) => ADMIN_IMMUTABLE_PERMISSIONS.has(item.value))
    ) {
      return;
    }

    const roleEntry = roles.find((entry) => entry.value === role);
    if (!roleEntry) return;

    const groupPermissionValues = groupPermissions.map((permission) => permission.value);
    const rolePermissionSet = new Set(roleEntry.permissions);
    const hasEveryGroupPermission = groupPermissionValues.every((permission) =>
      rolePermissionSet.has(permission),
    );

    saveRolePermissions(
      roleEntry,
      hasEveryGroupPermission
        ? roleEntry.permissions.filter(
            (permission) => !groupPermissionValues.includes(permission),
          )
        : Array.from(new Set([...roleEntry.permissions, ...groupPermissionValues])),
    );
  };

  const submitRoleModal = async () => {
    const nextDisplayName = newRoleDisplayName.trim();
    if (!nextDisplayName) {
      setNewRoleError('Введите отображаемое имя роли.');
      return;
    }

    try {
      setIsCreatingRole(true);
      setNewRoleError('');
      if (roleModalMode === 'create') {
        const response = await api.admin.roles.create(nextDisplayName);
        const roleValue = response.value;
        const roleDisplayName = response.display_name || response.label;

        if (!roleValue) {
          await fetchMatrix();
          return;
        }

        setRoles((prev) => [
          ...prev,
          {
            value: roleValue,
            display_name: roleDisplayName || roleValue,
            label: roleDisplayName || roleValue,
            permissions: Array.isArray(response.permissions) ? response.permissions : [],
            available_permissions: response.available_permissions,
            is_immutable: Boolean(response.is_immutable),
          },
        ]);
        toast.success('Роль добавлена.');
      } else {
        if (!editingRoleValue) return;

        const response = await api.admin.roles.update(
          editingRoleValue,
          editingRoleValue,
          nextDisplayName,
        );
        const nextValue = response.value || editingRoleValue;
        const updatedDisplayName = response.display_name || response.label || nextValue;

        setRoles((prev) =>
          prev.map((entry) =>
            entry.value === editingRoleValue
              ? {
                  ...entry,
                  value: nextValue,
                  display_name: updatedDisplayName,
                  label: updatedDisplayName,
                  is_immutable: Boolean(response.is_immutable),
                }
              : entry,
          ),
        );
        await fetchEmployees();
        toast.success('Роль обновлена.');
      }

      setIsRoleCreateModalOpen(false);
      setNewRoleDisplayName('');
      setEditingRoleValue(null);
    } catch (err) {
      handleError(err);
    } finally {
      setIsCreatingRole(false);
    }
  };

  const openCreateRoleModal = () => {
    setNewRoleError('');
    setNewRoleDisplayName('');
    setRoleModalMode('create');
    setEditingRoleValue(null);
    setIsRoleCreateModalOpen(true);
  };

  const renameRole = (role: RolePermissionMatrixRole) => {
    setRoleModalMode('edit');
    setEditingRoleValue(role.value);
    setNewRoleDisplayName(role.display_name || role.label || role.value);
    setNewRoleError('');
    setIsRoleCreateModalOpen(true);
  };

  const deleteRole = (role: RolePermissionMatrixRole) => {
    if (role.is_immutable) return;
    setDeletingRole(role);
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;

    try {
      setIsDeletingRole(true);
      await api.admin.roles.remove(deletingRole.value);
      setRoles((prev) => prev.filter((entry) => entry.value !== deletingRole.value));
      await fetchEmployees();
      toast.success('Роль удалена.');
      setDeletingRole(null);
    } catch (err) {
      handleError(err);
    } finally {
      setIsDeletingRole(false);
    }
  };

  // Личные исключения тоже сохраняются сразу: API принимает их целиком.
  const savePersonOverrides = (person: User, next: PersonPermissionOverrides) => {
    const previous = personPermissionOverrides(person);
    if (
      previous.direct.length === next.direct.length &&
      previous.denied.length === next.denied.length &&
      next.direct.every((permission) => previous.direct.includes(permission)) &&
      next.denied.every((permission) => previous.denied.includes(permission))
    ) {
      return;
    }

    const isClient = isClientsMode;
    const updatePerson = (patch: Partial<User>) => {
      const update = (people: User[]) =>
        people.map((entry) => (entry.id === person.id ? { ...entry, ...patch } : entry));
      if (isClient) setClientAccounts(update);
      else setEmployees(update);
    };

    personSaveQueue.enqueue(person.id, {
      previous,
      next,
      send: async ({ direct, denied }) => {
        const response = await api.admin.employees.syncPermissions(
          person.id,
          direct,
          denied,
        );
        updatePerson({
          permissions: response.permissions,
          role_permissions: response.role_permissions,
        });
        return {
          direct: Array.isArray(response.direct_permissions)
            ? response.direct_permissions
            : direct,
          denied: Array.isArray(response.denied_permissions)
            ? response.denied_permissions
            : denied,
        };
      },
      apply: ({ direct, denied }) =>
        updatePerson({ direct_permissions: direct, denied_permissions: denied }),
      onError: (err) =>
        toast.error(
          `${isClient ? 'Права клиента' : 'Права пользователя'} не сохранены: ${errorMessage(err)}`,
        ),
    });
  };

  const applyEmployeePermissionMode = (
    permissions: string[],
    mode: EmployeePermissionMode,
  ) => {
    if (!selectedEmployee) return;

    const nextDirectPermissions = new Set(selectedOverrides.direct);
    const nextDeniedPermissions = new Set(selectedOverrides.denied);

    for (const permission of permissions) {
      if (mode === 'grant') {
        nextDirectPermissions.add(permission);
        nextDeniedPermissions.delete(permission);
      } else if (mode === 'deny') {
        nextDirectPermissions.delete(permission);
        nextDeniedPermissions.add(permission);
      } else {
        nextDirectPermissions.delete(permission);
        nextDeniedPermissions.delete(permission);
      }
    }

    savePersonOverrides(selectedEmployee, {
      direct: Array.from(nextDirectPermissions),
      denied: Array.from(nextDeniedPermissions),
    });
  };

  const setEmployeePermissionMode = (
    permission: string,
    mode: EmployeePermissionMode,
  ) => {
    if (isImmutableForAdmin(permission, selectedEmployee?.role ?? null)) return;
    if (mode === 'deny' && !canDenySelectedEmployeePermissions) return;

    applyEmployeePermissionMode([permission], mode);
  };

  const setEmployeePermissionGroupMode = (
    groupPermissions: PermissionOption[],
    mode: EmployeePermissionMode,
  ) => {
    if (
      isSelectedEmployeeAdmin &&
      groupPermissions.some((permission) =>
        ADMIN_IMMUTABLE_PERMISSIONS.has(permission.value),
      )
    ) {
      return;
    }
    if (mode === 'deny' && !canDenySelectedEmployeePermissions) return;

    applyEmployeePermissionMode(
      groupPermissions.map((permission) => permission.value),
      mode,
    );
  };

  if (isLoading) {
    return (
      <div className='flex h-full min-h-0 items-center justify-center rounded-2xl border border-[#e3e9f3] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_28%)]'>
        <div className='h-7 w-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
      </div>
    );
  }

  return (
    <section className='grid h-full min-h-0 grid-rows-[auto_auto] content-start gap-2 overflow-x-hidden overflow-y-auto lg:grid-cols-[210px_minmax(0,1fr)] lg:grid-rows-1 lg:content-stretch lg:overflow-hidden'>
      <SettingsSidebar
        activeSection={activeSection}
        onSectionChange={changeActiveSection}
      />

      {activeSection === 'roles' ? (
        <RolesAndPermissionsSettings
          activeMode={activeMode}
          roles={roles}
          permissionGroups={permissionGroups}
          rolePermissionMap={rolePermissionMap}
          savingRoles={savingRoles}
          isDeletingRole={isDeletingRole}
          employees={accessPeople}
          personPermissionGroups={personPermissionGroups}
          selectedEmployee={selectedEmployee}
          selectedEmployeeId={selectedPersonId}
          selectedEmployeeRolePermissionSet={selectedEmployeeRolePermissionSet}
          selectedDirectPermissionSet={selectedDirectPermissionSet}
          selectedDeniedPermissionSet={selectedDeniedPermissionSet}
          isLoadingEmployees={
            isClientsMode ? isLoadingClientAccounts : isLoadingEmployees
          }
          isSavingEmployee={isSavingEmployee}
          canDenySelectedEmployeePermissions={canDenySelectedEmployeePermissions}
          isSelectedEmployeeAdmin={isSelectedEmployeeAdmin}
          isImmutableForAdmin={isImmutableForAdmin}
          onActiveModeChange={setActiveMode}
          onOpenCreateRole={openCreateRoleModal}
          onRenameRole={renameRole}
          onDeleteRole={deleteRole}
          onTogglePermission={togglePermission}
          onTogglePermissionGroup={togglePermissionGroup}
          onSelectedEmployeeIdChange={
            isClientsMode ? setSelectedClientAccountId : setSelectedEmployeeId
          }
          onSetEmployeePermissionMode={setEmployeePermissionMode}
          onSetEmployeePermissionGroupMode={setEmployeePermissionGroupMode}
        />
      ) : activeSection === 'workspace' ? (
        <WorkspaceSettings canManage={canManageSettings} />
      ) : activeSection === 'imports' ? (
        <DataImportsSettings />
      ) : (
        <BillingSettings />
      )}

      <RoleCreateModal
        isOpen={isRoleCreateModalOpen}
        isSaving={isCreatingRole}
        mode={roleModalMode}
        displayName={newRoleDisplayName}
        error={newRoleError}
        onDisplayNameChange={(value) => {
          setNewRoleDisplayName(value);
          if (newRoleError) setNewRoleError('');
        }}
        onClose={() => {
          if (isCreatingRole) return;
          setIsRoleCreateModalOpen(false);
          setNewRoleError('');
          setEditingRoleValue(null);
        }}
        onSubmit={submitRoleModal}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingRole)}
        isProcessing={isDeletingRole}
        title='Удаление роли'
        message={
          deletingRole
            ? `Удалить роль "${deletingRole.label}"? Действие необратимо. Если роль назначена сотрудникам, удаление будет отклонено.`
            : ''
        }
        confirmLabel='Удалить'
        onClose={() => setDeletingRole(null)}
        onConfirm={confirmDeleteRole}
      />
    </section>
  );
}
