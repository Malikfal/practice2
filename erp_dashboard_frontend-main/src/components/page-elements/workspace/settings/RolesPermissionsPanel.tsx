import { Fragment, useState } from 'react';

import { SearchableSelect } from '../../../ui/FormField';
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from '../../../ui/table';
import type { PermissionOption, RolePermissionMatrixRole } from '../../../../types/app';
import type { PermissionGroup } from '../../../../utils/permissions';
import {
  ADMIN_IMMUTABLE_PERMISSIONS,
  isPermissionAvailable,
  roleAvailablePermissions,
} from './settingsUtils';
import RoleActionsMenu from './RoleActionsMenu';

// Ячейка с флажком: крупнее на планшете, системный размер — на десктопе.
const CHECKBOX_CELL_CLASS = '[&_input]:size-5 md:[&_input]:size-auto';

type Props = {
  roles: RolePermissionMatrixRole[];
  permissionGroups: PermissionGroup[];
  rolePermissionMap: Map<string, Set<string>>;
  savingRoles: Set<string>;
  isDeletingRole: boolean;
  isImmutableForAdmin: (_permission: string, _role?: string | null) => boolean;
  onRenameRole: (_role: RolePermissionMatrixRole) => void;
  onDeleteRole: (_role: RolePermissionMatrixRole) => void;
  onTogglePermission: (_role: string, _permission: string) => void;
  onTogglePermissionGroup: (_role: string, _permissions: PermissionOption[]) => void;
};

export default function RolesPermissionsPanel({
  roles,
  permissionGroups,
  rolePermissionMap,
  savingRoles,
  isDeletingRole,
  isImmutableForAdmin,
  onRenameRole,
  onDeleteRole,
  onTogglePermission,
  onTogglePermissionGroup,
}: Props) {
  const [selectedMobileRoleValue, setSelectedMobileRoleValue] = useState('');
  const selectedMobileRole =
    roles.find((role) => role.value === selectedMobileRoleValue) ?? roles[0] ?? null;
  const selectedMobileRolePermissions = selectedMobileRole
    ? rolePermissionMap.get(selectedMobileRole.value)
    : undefined;

  return (
    <div className='grid gap-3 md:flex md:min-h-0 md:flex-1 md:flex-col'>
      {selectedMobileRole ? (
        <div className='grid gap-3 md:hidden'>
          <section className='grid gap-3 rounded-xl border border-[#dce7ff] bg-white p-3 shadow-[0_10px_28px_-24px_rgba(30,64,175,0.75)]'>
            <label className='grid gap-1.5 text-[13px] font-semibold text-[#35568f]'>
              Роль
              <SearchableSelect
                value={selectedMobileRole.value}
                onValueChange={(value) => {
                  if (value) setSelectedMobileRoleValue(value);
                }}
                options={roles.map((role) => ({
                  value: role.value,
                  label: role.label,
                  searchText: role.value,
                }))}
                placeholder='Выберите роль'
                className='h-11 rounded-xl border-[#c9d8f8] bg-[#f7faff] pr-10 text-base font-semibold text-[#10275a] focus:border-[#2d6ff7] focus:ring-[#dce7ff]'
              />
            </label>

            <div className='flex items-center justify-between gap-2 rounded-lg bg-[#f7faff] py-1 pr-1 pl-3'>
              <span className='min-w-0 truncate text-sm font-semibold text-[#1f3565]'>
                {selectedMobileRole.label}
              </span>
              <div className='flex shrink-0 items-center gap-2'>
                {savingRoles.has(selectedMobileRole.value) ? (
                  <RoleSavingIndicator />
                ) : (
                  <span className='text-[11px] tracking-wide text-[#8090b8] uppercase'>
                    {selectedMobileRole.value}
                  </span>
                )}
                <RoleActionsMenu
                  role={selectedMobileRole}
                  disabled={isDeletingRole}
                  onRename={onRenameRole}
                  onDelete={onDeleteRole}
                />
              </div>
            </div>
          </section>

          <div className='grid gap-3'>
            {permissionGroups.map((group) => {
              const editableGroupPermissions = roleAvailablePermissions(
                selectedMobileRole,
                group.permissions,
              );
              const groupLocked = editableGroupPermissions.length === 0;
              const groupChecked =
                editableGroupPermissions.length > 0 &&
                editableGroupPermissions.every(
                  (permission) =>
                    selectedMobileRolePermissions?.has(permission.value) ?? false,
                );
              const groupPartial =
                !groupChecked &&
                editableGroupPermissions.some(
                  (permission) =>
                    selectedMobileRolePermissions?.has(permission.value) ?? false,
                );
              const isAdminGroupImmutable =
                selectedMobileRole.value === 'ADMIN' &&
                editableGroupPermissions.some((permission) =>
                  ADMIN_IMMUTABLE_PERMISSIONS.has(permission.value),
                );

              return (
                <section
                  key={group.id}
                  className='overflow-hidden rounded-xl border border-[#dce7ff] bg-white'
                >
                  <label className='flex min-h-11 items-center justify-between gap-3 bg-[#eff4ff] px-3 py-2 text-sm font-semibold text-[#35568f]'>
                    <span>{group.label}</span>
                    {groupLocked ? (
                      <span className='shrink-0 text-[11px] text-slate-400'>—</span>
                    ) : (
                      <input
                        type='checkbox'
                        className='size-5 shrink-0 accent-[#2d6ff7]'
                        checked={groupChecked}
                        disabled={isAdminGroupImmutable}
                        aria-checked={groupPartial ? 'mixed' : groupChecked}
                        ref={(input) => {
                          if (input) input.indeterminate = groupPartial;
                        }}
                        onChange={() =>
                          onTogglePermissionGroup(
                            selectedMobileRole.value,
                            editableGroupPermissions,
                          )
                        }
                      />
                    )}
                  </label>

                  <div className='grid gap-3 p-3'>
                    {group.subgroups.map((subgroup) => {
                      const editableSubgroupPermissions = roleAvailablePermissions(
                        selectedMobileRole,
                        subgroup.permissions,
                      );
                      const subgroupLocked = editableSubgroupPermissions.length === 0;
                      const subgroupChecked =
                        editableSubgroupPermissions.length > 0 &&
                        editableSubgroupPermissions.every(
                          (permission) =>
                            selectedMobileRolePermissions?.has(permission.value) ?? false,
                        );
                      const subgroupPartial =
                        !subgroupChecked &&
                        editableSubgroupPermissions.some(
                          (permission) =>
                            selectedMobileRolePermissions?.has(permission.value) ?? false,
                        );
                      const isAdminSubgroupImmutable =
                        selectedMobileRole.value === 'ADMIN' &&
                        editableSubgroupPermissions.some((permission) =>
                          ADMIN_IMMUTABLE_PERMISSIONS.has(permission.value),
                        );

                      return (
                        <div
                          key={`${group.id}-${subgroup.id}`}
                          className='overflow-hidden rounded-lg border border-[#e7eefc]'
                        >
                          <label className='flex min-h-11 items-center justify-between gap-3 bg-[#f8faff] px-3 py-2 text-xs font-semibold text-[#667cab]'>
                            <span>{subgroup.label}</span>
                            {subgroupLocked ? (
                              <span className='shrink-0 text-[11px] text-slate-400'>
                                —
                              </span>
                            ) : (
                              <input
                                type='checkbox'
                                className='size-5 shrink-0 accent-[#2d6ff7]'
                                checked={subgroupChecked}
                                disabled={isAdminSubgroupImmutable}
                                aria-checked={subgroupPartial ? 'mixed' : subgroupChecked}
                                ref={(input) => {
                                  if (input) input.indeterminate = subgroupPartial;
                                }}
                                onChange={() =>
                                  onTogglePermissionGroup(
                                    selectedMobileRole.value,
                                    editableSubgroupPermissions,
                                  )
                                }
                              />
                            )}
                          </label>

                          <div className='divide-y divide-[#e7eefc]'>
                            {subgroup.permissions.map((permission) => {
                              const checked =
                                selectedMobileRolePermissions?.has(permission.value) ??
                                false;
                              const isImmutable = isImmutableForAdmin(
                                permission.value,
                                selectedMobileRole.value,
                              );

                              return (
                                <label
                                  key={permission.value}
                                  className='flex min-h-11 items-start justify-between gap-3 px-3 py-2.5 text-sm text-slate-700'
                                >
                                  <span>{permission.label}</span>
                                  {!isPermissionAvailable(
                                    selectedMobileRole,
                                    permission.value,
                                  ) ? (
                                    <span className='shrink-0 text-[11px] text-slate-400'>
                                      —
                                    </span>
                                  ) : (
                                    <input
                                      type='checkbox'
                                      className='mt-0.5 size-5 shrink-0 accent-[#2d6ff7]'
                                      checked={checked}
                                      disabled={isImmutable}
                                      onChange={() =>
                                        onTogglePermission(
                                          selectedMobileRole.value,
                                          permission.value,
                                        )
                                      }
                                    />
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Вертикальный и горизонтальный скролл в одном блоке: иначе sticky-шапка
          не держится или разъезжается с колонками. */}
      <TableContainer className='hidden min-h-0 flex-1 overscroll-contain max-lg:max-h-[75dvh] md:block'>
        <Table striped={false} className='min-w-max md:min-w-full'>
          <THead sticky>
            <tr>
              <Th pin='left' className='min-w-52'>
                Права
              </Th>
              {roles.map((role) => (
                <Th key={role.value} align='center' className='px-1.5!'>
                  <div className='relative grid gap-0.5 rounded-xl border border-[#dce7ff] bg-white px-6 py-1.5 tracking-normal whitespace-nowrap normal-case shadow-[0_8px_20px_-18px_rgba(30,64,175,0.7)]'>
                    {savingRoles.has(role.value) ? (
                      <span className='absolute top-1/2 left-2 -translate-y-1/2'>
                        <RoleSavingIndicator compact />
                      </span>
                    ) : null}
                    <span className='text-sm font-semibold text-[#1f3565]'>
                      {role.label}
                    </span>
                    <span className='text-[11px] tracking-wide text-[#8090b8] uppercase'>
                      {role.value}
                    </span>
                    <span className='absolute top-1/2 right-0.5 -translate-y-1/2'>
                      <RoleActionsMenu
                        role={role}
                        disabled={isDeletingRole}
                        onRename={onRenameRole}
                        onDelete={onDeleteRole}
                      />
                    </span>
                  </div>
                </Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {permissionGroups.map((group) => (
              <Fragment key={group.id}>
                <Tr background='bg-[#eff4ff]' hoverable={false}>
                  <Td
                    pin='left'
                    className='pl-4! text-xs font-semibold tracking-wide text-[#5a6f9f] uppercase'
                  >
                    {group.label}
                  </Td>
                  {roles.map((role) => {
                    const editableGroupPermissions = roleAvailablePermissions(
                      role,
                      group.permissions,
                    );
                    const locked = editableGroupPermissions.length === 0;
                    const rolePermissions = rolePermissionMap.get(role.value);
                    const checked =
                      editableGroupPermissions.length > 0 &&
                      editableGroupPermissions.every(
                        (permission) => rolePermissions?.has(permission.value) ?? false,
                      );
                    const isAdminGroupImmutable =
                      role.value === 'ADMIN' &&
                      editableGroupPermissions.some((permission) =>
                        ADMIN_IMMUTABLE_PERMISSIONS.has(permission.value),
                      );
                    const partial =
                      !checked &&
                      editableGroupPermissions.some(
                        (permission) => rolePermissions?.has(permission.value) ?? false,
                      );

                    return (
                      <Td
                        key={`${group.id}-${role.value}`}
                        align='center'
                        className={CHECKBOX_CELL_CLASS}
                      >
                        {locked ? (
                          <span className='text-[11px] text-slate-400'>—</span>
                        ) : (
                          <input
                            type='checkbox'
                            checked={checked}
                            disabled={isAdminGroupImmutable}
                            aria-checked={partial ? 'mixed' : checked}
                            ref={(input) => {
                              if (input) input.indeterminate = partial;
                            }}
                            title={
                              checked
                                ? `Убрать весь раздел "${group.label}"`
                                : `Выдать весь раздел "${group.label}"`
                            }
                            onChange={() =>
                              onTogglePermissionGroup(
                                role.value,
                                editableGroupPermissions,
                              )
                            }
                          />
                        )}
                      </Td>
                    );
                  })}
                </Tr>
                {group.subgroups.map((subgroup) => (
                  <Fragment key={`${group.id}-${subgroup.id}`}>
                    <Tr background='bg-[#f8faff]' hoverable={false}>
                      <Td
                        pin='left'
                        className='pl-6! text-xs font-semibold text-[#667cab]'
                      >
                        {subgroup.label}
                      </Td>
                      {roles.map((role) => {
                        const editableSubgroupPermissions = roleAvailablePermissions(
                          role,
                          subgroup.permissions,
                        );
                        const locked = editableSubgroupPermissions.length === 0;
                        const rolePermissions = rolePermissionMap.get(role.value);
                        const checked =
                          editableSubgroupPermissions.length > 0 &&
                          editableSubgroupPermissions.every(
                            (permission) =>
                              rolePermissions?.has(permission.value) ?? false,
                          );
                        const isAdminSubgroupImmutable =
                          role.value === 'ADMIN' &&
                          editableSubgroupPermissions.some((permission) =>
                            ADMIN_IMMUTABLE_PERMISSIONS.has(permission.value),
                          );
                        const partial =
                          !checked &&
                          editableSubgroupPermissions.some(
                            (permission) =>
                              rolePermissions?.has(permission.value) ?? false,
                          );

                        return (
                          <Td
                            key={`${group.id}-${subgroup.id}-${role.value}`}
                            align='center'
                            className={CHECKBOX_CELL_CLASS}
                          >
                            {locked ? (
                              <span className='text-[11px] text-slate-400'>—</span>
                            ) : (
                              <input
                                type='checkbox'
                                checked={checked}
                                disabled={isAdminSubgroupImmutable}
                                aria-checked={partial ? 'mixed' : checked}
                                ref={(input) => {
                                  if (input) input.indeterminate = partial;
                                }}
                                title={
                                  checked
                                    ? `Убрать подпункт "${subgroup.label}"`
                                    : `Выдать подпункт "${subgroup.label}"`
                                }
                                onChange={() =>
                                  onTogglePermissionGroup(
                                    role.value,
                                    editableSubgroupPermissions,
                                  )
                                }
                              />
                            )}
                          </Td>
                        );
                      })}
                    </Tr>
                    {subgroup.permissions.map((permission) => (
                      <Tr key={permission.value}>
                        <Td pin='left' className='pl-8!'>
                          {permission.label}
                        </Td>
                        {roles.map((role) => {
                          const checked =
                            rolePermissionMap.get(role.value)?.has(permission.value) ??
                            false;
                          const isAdminPermissionImmutable = isImmutableForAdmin(
                            permission.value,
                            role.value,
                          );

                          return (
                            <Td
                              key={`${permission.value}-${role.value}`}
                              align='center'
                              className={CHECKBOX_CELL_CLASS}
                            >
                              {!isPermissionAvailable(role, permission.value) ? (
                                <span className='text-[11px] text-slate-400'>—</span>
                              ) : (
                                <input
                                  type='checkbox'
                                  checked={checked}
                                  disabled={isAdminPermissionImmutable}
                                  onChange={() =>
                                    onTogglePermission(role.value, permission.value)
                                  }
                                />
                              )}
                            </Td>
                          );
                        })}
                      </Tr>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </TBody>
        </Table>
      </TableContainer>
    </div>
  );
}

function RoleSavingIndicator({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className='inline-flex items-center gap-1.5 text-[11px] text-[#8090b8]'
      role='status'
      title='Сохраняется…'
    >
      <span className='size-3 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
      <span className={compact ? 'sr-only' : undefined}>Сохраняется…</span>
    </span>
  );
}
