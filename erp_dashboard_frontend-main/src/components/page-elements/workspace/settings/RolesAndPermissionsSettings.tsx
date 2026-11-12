import type {
  PermissionOption,
  RolePermissionMatrixRole,
  User,
} from '../../../../types/app';
import Button from '../../../ui/Button';
import type { PermissionGroup } from '../../../../utils/permissions';
import RolesPermissionsPanel from './RolesPermissionsPanel';
import UserPermissionsPanel from './UserPermissionsPanel';
import {
  joinClassNames,
  type AccessMode,
  type EmployeePermissionMode,
} from './settingsUtils';

type Props = {
  activeMode: AccessMode;
  roles: RolePermissionMatrixRole[];
  permissionGroups: PermissionGroup[];
  rolePermissionMap: Map<string, Set<string>>;
  savingRoles: Set<string>;
  isDeletingRole: boolean;
  employees: User[];
  personPermissionGroups: PermissionGroup[];
  selectedEmployee: User | null;
  selectedEmployeeId: string;
  selectedEmployeeRolePermissionSet: Set<string>;
  selectedDirectPermissionSet: Set<string>;
  selectedDeniedPermissionSet: Set<string>;
  isLoadingEmployees: boolean;
  isSavingEmployee: boolean;
  canDenySelectedEmployeePermissions: boolean;
  isSelectedEmployeeAdmin: boolean;
  isImmutableForAdmin: (_permission: string, _role?: string | null) => boolean;
  onActiveModeChange: (_mode: AccessMode) => void;
  onOpenCreateRole: () => void;
  onRenameRole: (_role: RolePermissionMatrixRole) => void;
  onDeleteRole: (_role: RolePermissionMatrixRole) => void;
  onTogglePermission: (_role: string, _permission: string) => void;
  onTogglePermissionGroup: (_role: string, _permissions: PermissionOption[]) => void;
  onSelectedEmployeeIdChange: (_employeeId: string) => void;
  onSetEmployeePermissionMode: (
    _permission: string,
    _mode: EmployeePermissionMode,
  ) => void;
  onSetEmployeePermissionGroupMode: (
    _permissions: PermissionOption[],
    _mode: EmployeePermissionMode,
  ) => void;
};

export default function RolesAndPermissionsSettings({
  activeMode,
  roles,
  permissionGroups,
  rolePermissionMap,
  savingRoles,
  isDeletingRole,
  employees,
  personPermissionGroups,
  selectedEmployee,
  selectedEmployeeId,
  selectedEmployeeRolePermissionSet,
  selectedDirectPermissionSet,
  selectedDeniedPermissionSet,
  isLoadingEmployees,
  isSavingEmployee,
  canDenySelectedEmployeePermissions,
  isSelectedEmployeeAdmin,
  isImmutableForAdmin,
  onActiveModeChange,
  onOpenCreateRole,
  onRenameRole,
  onDeleteRole,
  onTogglePermission,
  onTogglePermissionGroup,
  onSelectedEmployeeIdChange,
  onSetEmployeePermissionMode,
  onSetEmployeePermissionGroupMode,
}: Props) {
  const modes: Array<{ value: AccessMode; label: string }> = [
    { value: 'roles', label: 'Роли' },
    { value: 'users', label: 'Пользователи' },
    { value: 'clients', label: 'Клиенты' },
  ];

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-col overflow-auto rounded-2xl border border-[#e3e9f3] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_28%)] p-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55)] md:p-5'>
      <div className='mb-3 grid gap-1'>
        <h2 className='text-lg font-semibold tracking-tight text-[#1f3565]'>
          Роли и права
        </h2>
        <p className='max-w-4xl text-xs leading-5 text-slate-500'>
          Роли задают дефолтный доступ. Пользователи и клиенты могут получать личные
          исключения: дополнительные права или отключения прав роли.
        </p>
      </div>

      <div className='mb-3 flex flex-wrap items-center gap-2'>
        {/* Если вкладки и кнопка не помещаются в строку, кнопка уходит вниз вправо. */}
        <div className='flex flex-auto rounded-xl border border-[#d9e4fb] bg-[#f4f7ff] p-1 shadow-inner shadow-[#dce7ff]/60 md:flex-none'>
          {modes.map((mode) => (
            <button
              key={mode.value}
              type='button'
              aria-pressed={activeMode === mode.value}
              className={joinClassNames(
                'min-h-9 flex-auto rounded-lg px-2 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors sm:px-3 md:min-h-0 md:flex-none',
                activeMode === mode.value
                  ? 'bg-white text-[#1f3565] shadow-sm shadow-[#d7e2fb]'
                  : 'text-[#5f73a3] hover:text-[#1f3565]',
              )}
              onClick={() => onActiveModeChange(mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {activeMode === 'roles' ? (
          <Button
            type='button'
            size='sm'
            className='ml-auto shrink-0'
            onClick={onOpenCreateRole}
          >
            + Роль
          </Button>
        ) : null}
      </div>

      {activeMode === 'roles' ? (
        <RolesPermissionsPanel
          roles={roles}
          permissionGroups={permissionGroups}
          rolePermissionMap={rolePermissionMap}
          savingRoles={savingRoles}
          isDeletingRole={isDeletingRole}
          isImmutableForAdmin={isImmutableForAdmin}
          onRenameRole={onRenameRole}
          onDeleteRole={onDeleteRole}
          onTogglePermission={onTogglePermission}
          onTogglePermissionGroup={onTogglePermissionGroup}
        />
      ) : (
        <UserPermissionsPanel
          employees={employees}
          selectedEmployee={selectedEmployee}
          selectedEmployeeId={selectedEmployeeId}
          selectedEmployeeRolePermissionSet={selectedEmployeeRolePermissionSet}
          selectedDirectPermissionSet={selectedDirectPermissionSet}
          selectedDeniedPermissionSet={selectedDeniedPermissionSet}
          permissionGroups={personPermissionGroups}
          isLoadingEmployees={isLoadingEmployees}
          isSavingEmployee={isSavingEmployee}
          canDenySelectedEmployeePermissions={canDenySelectedEmployeePermissions}
          isSelectedEmployeeAdmin={isSelectedEmployeeAdmin}
          isImmutableForAdmin={isImmutableForAdmin}
          onSelectedEmployeeIdChange={onSelectedEmployeeIdChange}
          onSetEmployeePermissionMode={onSetEmployeePermissionMode}
          onSetEmployeePermissionGroupMode={onSetEmployeePermissionGroupMode}
          subjectLabel={activeMode === 'clients' ? 'Клиент' : 'Пользователь'}
          emptyText={
            activeMode === 'clients'
              ? 'Клиентских аккаунтов пока нет. Их создают в карточке клиента, во вкладке «Доступ в ФЛОУ».'
              : undefined
          }
        />
      )}
    </div>
  );
}
