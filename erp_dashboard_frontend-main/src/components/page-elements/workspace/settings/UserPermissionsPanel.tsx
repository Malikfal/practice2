import { Fragment } from 'react';

import { SearchableSelect } from '../../../ui/FormField';
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from '../../../ui/table';
import type { PermissionOption, User } from '../../../../types/app';
import type { PermissionGroup } from '../../../../utils/permissions';
import {
  ADMIN_IMMUTABLE_PERMISSIONS,
  joinClassNames,
  type EmployeePermissionMode,
} from './settingsUtils';

type Props = {
  employees: User[];
  selectedEmployee: User | null;
  selectedEmployeeId: string;
  selectedEmployeeRolePermissionSet: Set<string>;
  selectedDirectPermissionSet: Set<string>;
  selectedDeniedPermissionSet: Set<string>;
  permissionGroups: PermissionGroup[];
  isLoadingEmployees: boolean;
  isSavingEmployee: boolean;
  canDenySelectedEmployeePermissions: boolean;
  isSelectedEmployeeAdmin: boolean;
  isImmutableForAdmin: (_permission: string, _role?: string | null) => boolean;
  onSelectedEmployeeIdChange: (_employeeId: string) => void;
  onSetEmployeePermissionMode: (
    _permission: string,
    _mode: EmployeePermissionMode,
  ) => void;
  onSetEmployeePermissionGroupMode: (
    _permissions: PermissionOption[],
    _mode: EmployeePermissionMode,
  ) => void;
  subjectLabel?: string;
  emptyText?: string;
};

function personName(person: User): string {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
}

export default function UserPermissionsPanel({
  employees,
  selectedEmployee,
  selectedEmployeeId,
  selectedEmployeeRolePermissionSet,
  selectedDirectPermissionSet,
  selectedDeniedPermissionSet,
  permissionGroups,
  isLoadingEmployees,
  isSavingEmployee,
  canDenySelectedEmployeePermissions,
  isSelectedEmployeeAdmin,
  isImmutableForAdmin,
  onSelectedEmployeeIdChange,
  onSetEmployeePermissionMode,
  onSetEmployeePermissionGroupMode,
  subjectLabel = 'Пользователь',
  emptyText,
}: Props) {
  return (
    <div className='grid gap-3'>
      <div className='rounded-2xl border border-[#dce7ff] bg-white p-3 shadow-[0_10px_28px_-24px_rgba(30,64,175,0.75)] md:p-4'>
        <div className='grid gap-2 md:grid-cols-[minmax(260px,420px)_auto] md:items-end'>
          <div className='grid gap-1.5'>
            <span className='text-[13px] leading-tight font-semibold text-[#35568f]'>
              {subjectLabel}
            </span>
            <SearchableSelect
              value={selectedEmployeeId}
              onValueChange={onSelectedEmployeeIdChange}
              options={employees.map((employee) => ({
                value: employee.id,
                label: [
                  personName(employee) || employee.email || employee.id,
                  employee.client_name,
                ]
                  .filter(Boolean)
                  .join(' · '),
                searchText: [
                  personName(employee),
                  employee.email ?? '',
                  employee.client_name ?? '',
                ].join(' '),
              }))}
              placeholder={`Выберите: ${subjectLabel.toLowerCase()}`}
              isLoading={isLoadingEmployees}
            />
          </div>

          {selectedEmployee ? (
            <span
              className='inline-flex items-center gap-1.5 text-xs text-[#8090b8] md:pb-2.5'
              role='status'
            >
              {isSavingEmployee ? (
                <>
                  <span className='size-3 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
                  Сохраняется…
                </>
              ) : (
                'Изменения применяются сразу'
              )}
            </span>
          ) : null}
        </div>
      </div>

      {!isLoadingEmployees && employees.length === 0 && emptyText ? (
        <p className='rounded-2xl border border-dashed border-[#dce7ff] bg-white px-4 py-6 text-center text-sm text-slate-500'>
          {emptyText}
        </p>
      ) : null}

      {selectedEmployee ? (
        <TableContainer>
          <Table striped={false} className='min-w-[760px] md:min-w-full'>
            <THead>
              <tr>
                <Th pin='left' className='min-w-52 md:min-w-0'>
                  Право
                </Th>
                <Th>Сейчас</Th>
                <Th>Настройка</Th>
              </tr>
            </THead>
            <TBody>
              {permissionGroups.map((group) => (
                <Fragment key={group.id}>
                  <Tr background='bg-[#eff4ff]' hoverable={false}>
                    <Td
                      colSpan={2}
                      pin='left'
                      className='pl-4! text-xs font-semibold tracking-wide text-[#5a6f9f] uppercase'
                    >
                      {group.label}
                    </Td>
                    <Td>
                      <div className='flex flex-wrap gap-1.5'>
                        {(() => {
                          const isImmutableGroupForSelectedAdmin =
                            isSelectedEmployeeAdmin &&
                            group.permissions.some((permission) =>
                              ADMIN_IMMUTABLE_PERMISSIONS.has(permission.value),
                            );

                          return (
                            <>
                              <button
                                type='button'
                                className={joinClassNames(
                                  'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                  isImmutableGroupForSelectedAdmin
                                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                    : 'border-[#cdd9f5] bg-white text-[#425f95] hover:bg-[#f4f8ff]',
                                )}
                                disabled={isImmutableGroupForSelectedAdmin}
                                onClick={() =>
                                  onSetEmployeePermissionGroupMode(
                                    group.permissions,
                                    'default',
                                  )
                                }
                              >
                                Наследовать раздел
                              </button>
                              <button
                                type='button'
                                className={joinClassNames(
                                  'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                  isImmutableGroupForSelectedAdmin
                                    ? 'cursor-not-allowed border-blue-100 bg-white text-blue-300'
                                    : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50',
                                )}
                                disabled={isImmutableGroupForSelectedAdmin}
                                onClick={() =>
                                  onSetEmployeePermissionGroupMode(
                                    group.permissions,
                                    'grant',
                                  )
                                }
                              >
                                Выдать раздел лично
                              </button>
                              <button
                                type='button'
                                className={joinClassNames(
                                  'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                  canDenySelectedEmployeePermissions &&
                                    !isImmutableGroupForSelectedAdmin
                                    ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                                    : 'cursor-not-allowed border-red-100 bg-white text-red-300',
                                )}
                                disabled={
                                  !canDenySelectedEmployeePermissions ||
                                  isImmutableGroupForSelectedAdmin
                                }
                                onClick={() =>
                                  onSetEmployeePermissionGroupMode(
                                    group.permissions,
                                    'deny',
                                  )
                                }
                              >
                                Запретить раздел
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </Td>
                  </Tr>

                  {group.subgroups.map((subgroup) => (
                    <Fragment key={`${group.id}-${subgroup.id}`}>
                      <Tr background='bg-[#f8faff]' hoverable={false}>
                        <Td
                          colSpan={3}
                          pin='left'
                          className='pl-6! text-xs font-semibold text-[#667cab]'
                        >
                          {subgroup.label}
                        </Td>
                      </Tr>

                      {subgroup.permissions.map((permission) => {
                        const fromRole = selectedEmployeeRolePermissionSet.has(
                          permission.value,
                        );
                        const isDirect = selectedDirectPermissionSet.has(
                          permission.value,
                        );
                        const isDenied = selectedDeniedPermissionSet.has(
                          permission.value,
                        );
                        const statusLabel = isDenied
                          ? 'Отключено'
                          : isDirect
                            ? 'Добавлено лично'
                            : fromRole
                              ? 'По роли'
                              : 'Нет доступа';
                        const statusClass = isDenied
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : isDirect
                            ? 'border-blue-200 bg-blue-50 text-blue-800'
                            : fromRole
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-slate-50 text-slate-500';
                        const isImmutablePermissionForSelectedAdmin = isImmutableForAdmin(
                          permission.value,
                          selectedEmployee.role ?? null,
                        );

                        return (
                          <Tr key={permission.value}>
                            <Td pin='left' className='pl-8!'>
                              {permission.label}
                            </Td>
                            <Td>
                              <span
                                className={joinClassNames(
                                  'inline-flex rounded-full border px-2 py-1 text-xs whitespace-nowrap',
                                  statusClass,
                                )}
                              >
                                {statusLabel}
                              </span>
                            </Td>
                            <Td>
                              <div className='flex flex-wrap gap-1.5'>
                                <button
                                  type='button'
                                  className={joinClassNames(
                                    'rounded-md border px-2 py-1 text-xs transition-colors',
                                    !isDirect && !isDenied
                                      ? 'border-[#1f3565] bg-[#1f3565] text-white'
                                      : 'border-[#cdd9f5] bg-white text-[#425f95] hover:bg-[#f4f8ff]',
                                    isImmutablePermissionForSelectedAdmin &&
                                      'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400',
                                  )}
                                  disabled={isImmutablePermissionForSelectedAdmin}
                                  onClick={() =>
                                    onSetEmployeePermissionMode(
                                      permission.value,
                                      'default',
                                    )
                                  }
                                >
                                  Наследовать
                                </button>
                                <button
                                  type='button'
                                  className={joinClassNames(
                                    'rounded-md border px-2 py-1 text-xs transition-colors',
                                    isDirect
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50',
                                    isImmutablePermissionForSelectedAdmin &&
                                      'cursor-not-allowed border-blue-100 bg-white text-blue-300',
                                  )}
                                  disabled={isImmutablePermissionForSelectedAdmin}
                                  onClick={() =>
                                    onSetEmployeePermissionMode(permission.value, 'grant')
                                  }
                                >
                                  Выдать лично
                                </button>
                                <button
                                  type='button'
                                  className={joinClassNames(
                                    'rounded-md border px-2 py-1 text-xs transition-colors',
                                    !canDenySelectedEmployeePermissions &&
                                      'cursor-not-allowed opacity-50',
                                    isImmutablePermissionForSelectedAdmin &&
                                      'cursor-not-allowed border-red-100 bg-white text-red-300',
                                    isDenied
                                      ? 'border-red-600 bg-red-600 text-white'
                                      : 'border-red-200 bg-white text-red-700 hover:bg-red-50',
                                  )}
                                  disabled={
                                    !canDenySelectedEmployeePermissions ||
                                    isImmutablePermissionForSelectedAdmin
                                  }
                                  onClick={() =>
                                    onSetEmployeePermissionMode(permission.value, 'deny')
                                  }
                                >
                                  Запретить
                                </button>
                              </div>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      ) : (
        <div className='rounded-2xl border border-[#dce7ff] bg-[#f7faff] px-3 py-6 text-center text-sm text-[#667cab]'>
          Пользователи не найдены.
        </div>
      )}
    </div>
  );
}
