import { type ReactNode } from 'react';

import Button from '../../../../ui/Button';
import { SearchableSelect } from '../../../../ui/FormField';
import TablePagination from '../../../../ui/TablePagination';
import {
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../../ui/table';
import {
  formatDateLocal,
  formatDurationHms,
  formatEmployeeArchiveLabel,
  formatName,
  formatTimeLocal,
  isEmployeeBlocked,
} from '../../../../../utils/formatters';
import type { Project, ProjectMember, User } from '../../../../../types/app';
import {
  EmployeeLimitChip,
  EmployeeLimitNotice,
  isEmployeeLimitReached,
  useEmployeeLimitHint,
} from '../../../../tariff/EmployeeLimit';

import Icon from '../components/Icon';

export type EmployeeSortKey =
  | 'last_name'
  | 'first_name'
  | 'role'
  | 'position'
  | 'created_at'
  | 'last_date_activity'
  | 'projects'
  | 'total_seconds_for_week';

const mobileSortOptions: Array<{ value: EmployeeSortKey; label: string }> = [
  { value: 'last_name', label: 'По фамилии' },
  { value: 'first_name', label: 'По имени' },
  { value: 'role', label: 'По роли' },
  { value: 'position', label: 'По должности' },
  { value: 'created_at', label: 'По дате добавления' },
  { value: 'last_date_activity', label: 'По активности' },
  { value: 'projects', label: 'По проектам' },
  { value: 'total_seconds_for_week', label: 'По времени за неделю' },
];

type Props = {
  employees: User[];
  projects: Project[];
  searchQuery: string;
  statusFilter: string;
  isLoading: boolean;
  tariffLimits: { maxEmployees: number | null; totalEmployees: number };
  activeCount: number;
  archivedCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  sortKey: EmployeeSortKey;
  sortDirection: 'asc' | 'desc';
  onSearchQueryChange: (_value: string) => void;
  onStatusFilterChange: (_value: string) => void;
  onPageChange: (_page: number) => void;
  onPageSizeChange: (_pageSize: number) => void;
  onSortChange: (_key: EmployeeSortKey) => void;
  onOpenCreateModal: () => void;
  onOpenEmployeeDay: (_employee: User) => void;
  onEditEmployee: (_employee: User) => void;
  onResetEmployeePassword: (_employee: User) => void;
  onArchiveEmployee: (_employee: User) => void;
  onRestoreEmployee: (_employee: User) => void;
  onDeleteEmployee: (_employee: User) => void;
  onImportEmployees?: () => void;
  onExportEmployees?: () => void;
  canCreateEmployee?: boolean;
  canViewEmployeeDay?: boolean;
  canEditEmployee?: boolean;
  canResetEmployeePassword?: boolean;
  canManageEmployee?: boolean;
  canDeleteEmployee?: boolean;
};

function getEmployeePosition(employee: User) {
  return employee.position || 'Не указано';
}

function employeeProjectStats(employee: User, projects: Project[]) {
  const employeeProjects = projects.filter((project) =>
    project.members.some((member: ProjectMember) => member.user.id === employee.id),
  );
  const activeProjects = employeeProjects.filter(
    (project) => String(project.status || '').toUpperCase() !== 'ARCHIVED',
  );

  return {
    total: employeeProjects.length,
    active: activeProjects.length,
  };
}

function getLastName(employee: User) {
  const parts = formatName(employee).split(' ');
  return employee.last_name || parts[1] || parts[0] || '—';
}

function getFirstName(employee: User) {
  const parts = formatName(employee).split(' ');
  return employee.first_name || parts[0] || '—';
}

function formatDateTime(value: string | number | null | undefined) {
  if (!value) return 'Не указано';

  const date = new Date(typeof value === 'number' ? value * 1000 : String(value));
  if (Number.isNaN(date.getTime())) return 'Не указано';

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) return `Сегодня в ${formatTimeLocal(date)}`;
  return `${formatDateLocal(date)} в ${formatTimeLocal(date)}`;
}

function formatWeekDuration(seconds: number | null | undefined) {
  if (seconds == null) return '—';
  return formatDurationHms(seconds);
}

// Время и план в одном формате, полоска показывает выполнение плана за неделю.
function WeekWithPlan({ employee }: { employee: User }) {
  const weekSeconds = employee.total_seconds_for_week ?? 0;
  const planSeconds = employee.weekly_plan_seconds ?? 0;
  const hasPlan = planSeconds > 0;
  const percent = hasPlan ? Math.round((weekSeconds / planSeconds) * 100) : 0;
  const isOverPlan = hasPlan && weekSeconds > planSeconds;

  return (
    <div className='grid gap-1'>
      <span className='tabular-nums'>
        {formatWeekDuration(employee.total_seconds_for_week)} /{' '}
        {hasPlan ? formatDurationHms(planSeconds) : '—'}
      </span>
      {hasPlan ? (
        <div
          className='h-1.5 overflow-hidden rounded-full bg-[#eef2f8]'
          role='progressbar'
          aria-label={`Выполнение плана: ${percent}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percent, 100)}
          title={`Выполнение плана: ${percent}%`}
        >
          <div
            className={`h-full rounded-full ${isOverPlan ? 'bg-amber-500' : 'bg-[#2d6ff7]'}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function hasTrackedTime(employee: User) {
  return (employee.total_seconds ?? 0) > 0;
}

export default function EmployeesTablePanel({
  employees,
  projects,
  searchQuery,
  statusFilter,
  isLoading,
  tariffLimits,
  activeCount,
  archivedCount,
  currentPage,
  totalPages,
  pageSize,
  sortKey,
  sortDirection,
  onSearchQueryChange,
  onStatusFilterChange,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onOpenCreateModal,
  onOpenEmployeeDay,
  onEditEmployee,
  onResetEmployeePassword,
  onArchiveEmployee,
  onRestoreEmployee,
  onDeleteEmployee,
  onImportEmployees,
  onExportEmployees,
  canCreateEmployee = true,
  canViewEmployeeDay = true,
  canEditEmployee = true,
  canResetEmployeePassword = true,
  canManageEmployee = true,
  canDeleteEmployee = false,
}: Props) {
  const hasRowActions =
    canManageEmployee ||
    canViewEmployeeDay ||
    canEditEmployee ||
    canResetEmployeePassword;
  const isLimitedReached = isEmployeeLimitReached(tariffLimits);
  const limitHint = useEmployeeLimitHint(tariffLimits);

  const sortOf = (key: EmployeeSortKey) => (sortKey === key ? sortDirection : null);

  return (
    <section className='flex h-full min-h-0 min-w-0 flex-col overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-2 text-[#1f3565] lg:overflow-hidden lg:p-4'>
      <h1 className='mb-3 text-xl leading-none font-semibold text-[#10275a] lg:mb-4 lg:text-[22px]'>
        Сотрудники компании
      </h1>

      <div className='mb-3 grid gap-3 lg:mb-4 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-4'>
        <label className='flex h-10 w-full max-w-[600px] flex-1 items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[14px] text-[#7e8fb4]'>
          <Icon name='search' />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder='Поиск по: ФИО, email, роли или должности'
            className='min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-[#1f3565] outline-none placeholder:text-[#7e8fb4]'
          />
        </label>

        <div
          className={`grid gap-2 sm:flex ${canCreateEmployee ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          {canCreateEmployee ? (
            <Button
              type='button'
              disabled={isLimitedReached}
              title={limitHint}
              variant='secondary'
              className='h-10 min-w-0 rounded-xl border border-[#e3e9f3] bg-white px-2 text-xs font-semibold text-[#1f3565] hover:bg-[#f3f7ff] lg:px-4 lg:text-[14px]'
              onClick={onOpenCreateModal}
            >
              + Добавить
            </Button>
          ) : null}
          <Button
            type='button'
            variant='secondary'
            className='h-10 min-w-0 rounded-xl border border-[#e3e9f3] bg-white px-2 text-xs font-semibold text-[#1f3565] outline-none hover:bg-[#f3f7ff] lg:px-4 lg:text-[14px]'
            onClick={onImportEmployees}
          >
            Импорт
          </Button>
          <Button
            type='button'
            variant='secondary'
            className='h-10 min-w-0 rounded-xl border border-[#e3e9f3] bg-white px-2 text-xs font-semibold text-[#1f3565] outline-none hover:bg-[#f3f7ff] lg:px-4 lg:text-[14px]'
            onClick={onExportEmployees}
          >
            <span className='inline-flex items-center gap-2'>
              <Icon name='export' />
              Экспорт
            </span>
          </Button>
        </div>
      </div>

      {canCreateEmployee ? (
        <EmployeeLimitNotice {...tariffLimits} className='mb-3 lg:mb-4' />
      ) : null}

      <div className='mb-3 grid gap-2 text-sm font-semibold text-[#1f3565] lg:mb-4 lg:flex lg:flex-wrap lg:items-center lg:gap-4 lg:text-[15px]'>
        <span className='w-fit rounded-xl border border-[#e3e9f3] bg-white px-3 py-1.5'>
          Количество сотрудников: {activeCount + archivedCount}
        </span>
        <EmployeeLimitChip {...tariffLimits} />
        <div className='grid w-full grid-cols-3 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white lg:flex lg:w-auto'>
          <button
            type='button'
            className={`min-w-0 border-r border-[#e3e9f3] px-2 py-2 text-xs transition-colors lg:px-4 lg:py-1.5 lg:text-[14px] ${
              statusFilter === 'ALL'
                ? 'bg-[#2d6ff7] text-white'
                : 'text-[#1f3565] hover:bg-[#f3f7ff]'
            }`}
            onClick={() => onStatusFilterChange('ALL')}
          >
            Все ({activeCount + archivedCount})
          </button>
          <button
            type='button'
            className={`min-w-0 border-r border-[#e3e9f3] px-2 py-2 text-xs transition-colors lg:px-4 lg:py-1.5 lg:text-[14px] ${
              statusFilter === 'ACTIVE'
                ? 'bg-[#2d6ff7] text-white'
                : 'text-[#1f3565] hover:bg-[#f3f7ff]'
            }`}
            onClick={() => onStatusFilterChange('ACTIVE')}
          >
            Активные ({activeCount})
          </button>
          <button
            type='button'
            className={`min-w-0 px-2 py-2 text-xs transition-colors lg:px-4 lg:py-1.5 lg:text-[14px] ${
              statusFilter === 'BLOCKED'
                ? 'bg-[#2d6ff7] text-white'
                : 'text-[#1f3565] hover:bg-[#f3f7ff]'
            }`}
            onClick={() => onStatusFilterChange('BLOCKED')}
          >
            Архив ({archivedCount})
          </button>
        </div>
      </div>

      <div className='mb-2 grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2 lg:hidden'>
        <SearchableSelect
          value={sortKey}
          options={mobileSortOptions}
          searchable={false}
          className='h-10 rounded-xl border-[#e3e9f3] bg-white pr-10 text-sm font-semibold text-[#1f3565]'
          onValueChange={(value) => {
            if (!value || value === sortKey) return;
            onSortChange(value as EmployeeSortKey);
          }}
        />
        <button
          type='button'
          className='grid size-11 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-lg font-semibold text-[#2d6ff7]'
          onClick={() => onSortChange(sortKey)}
          aria-label='Изменить направление сортировки'
          title='Изменить направление сортировки'
        >
          {sortDirection === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div className='grid gap-2 lg:hidden'>
        {isLoading ? (
          <div className='grid min-h-32 place-items-center rounded-xl border border-[#e3e9f3] bg-white'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          </div>
        ) : employees.length ? (
          employees.map((employee) => {
            const stats = employeeProjectStats(employee, projects);
            const blocked = isEmployeeBlocked(employee.status);
            const archiveLabel = formatEmployeeArchiveLabel(employee);
            const employeeHasTrackedTime = hasTrackedTime(employee);

            return (
              <article
                key={employee.id}
                className='grid min-w-0 gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-sm shadow-[#10275a]/3'
              >
                <div className='flex min-w-0 items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    {canEditEmployee ? (
                      <button
                        type='button'
                        className='break-words text-left text-base font-semibold text-[#10275a]'
                        onClick={() => onEditEmployee(employee)}
                      >
                        {formatName(employee)}
                      </button>
                    ) : (
                      <p className='break-words text-base font-semibold text-[#10275a]'>
                        {formatName(employee)}
                      </p>
                    )}
                    <p className='mt-1 break-all text-xs text-[#7e8fb4]'>
                      {employee.email}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${
                      blocked
                        ? 'bg-[#edf1f7] text-[#7e8fb4]'
                        : 'bg-[#e8f6eb] text-[#3e8d59]'
                    }`}
                  >
                    {blocked ? archiveLabel || 'Архив' : 'Активный'}
                  </span>
                </div>

                <div className='flex flex-wrap gap-1.5 text-[11px] font-medium'>
                  <span className='rounded-lg bg-[#edf3ff] px-2 py-1 text-[#315eae]'>
                    {employee.role_label || employee.role || 'Роль не указана'}
                  </span>
                  <span className='rounded-lg bg-[#f3f5f9] px-2 py-1 text-[#66728d]'>
                    {getEmployeePosition(employee)}
                  </span>
                </div>

                <dl className='grid grid-cols-2 gap-x-3 gap-y-2 text-xs'>
                  <EmployeeMobileDetail
                    label='Проекты / активные'
                    value={`${stats.total} / ${stats.active}`}
                  />
                  <EmployeeMobileDetail
                    label='Время за неделю / план'
                    value={<WeekWithPlan employee={employee} />}
                  />
                  <EmployeeMobileDetail
                    label='Добавлен'
                    value={formatDateTime(employee.created_at)}
                  />
                  <EmployeeMobileDetail
                    label='Последняя активность'
                    value={formatDateTime(employee.last_date_activity)}
                  />
                </dl>

                {!blocked && hasRowActions ? (
                  <div className='grid grid-cols-2 gap-2'>
                    {canViewEmployeeDay ? (
                      <EmployeeMobileAction
                        label='Рабочий день'
                        icon={<Icon name='chart' />}
                        onClick={() => onOpenEmployeeDay(employee)}
                      />
                    ) : null}
                    {canEditEmployee ? (
                      <EmployeeMobileAction
                        label='Карточка'
                        icon={<Icon name='edit' />}
                        onClick={() => onEditEmployee(employee)}
                      />
                    ) : null}
                    {canResetEmployeePassword ? (
                      <EmployeeMobileAction
                        label='Сбросить пароль'
                        icon={<Icon name='key' />}
                        onClick={() => onResetEmployeePassword(employee)}
                      />
                    ) : null}
                    {canManageEmployee ? (
                      <EmployeeMobileAction
                        label='В архив'
                        icon={<Icon name='archive' />}
                        onClick={() => onArchiveEmployee(employee)}
                      />
                    ) : null}
                  </div>
                ) : blocked && (canManageEmployee || canDeleteEmployee) ? (
                  <div className='grid grid-cols-2 gap-2'>
                    {canManageEmployee ? (
                      <EmployeeMobileAction
                        label='Восстановить'
                        icon={<Icon name='restore' />}
                        disabled={isLimitedReached}
                        onClick={() => onRestoreEmployee(employee)}
                      />
                    ) : null}
                    {canDeleteEmployee && statusFilter === 'BLOCKED' ? (
                      <EmployeeMobileAction
                        label='Удалить'
                        icon={<Icon name='trash' />}
                        danger
                        title={
                          employeeHasTrackedTime
                            ? 'Нельзя удалить сотрудника с учтённым временем'
                            : 'Удалить сотрудника'
                        }
                        onClick={() => onDeleteEmployee(employee)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-10 text-center text-sm text-[#7e8fb4]'>
            Сотрудники не найдены
          </div>
        )}
      </div>

      <TableContainer className='hidden min-h-0 flex-1 lg:block'>
        <Table className='min-w-300'>
          <THead sticky>
            <tr>
              <Th
                pin='left'
                sortDirection={sortOf('last_name')}
                onSort={() => onSortChange('last_name')}
              >
                Фамилия
              </Th>
              <Th
                sortDirection={sortOf('first_name')}
                onSort={() => onSortChange('first_name')}
              >
                Имя
              </Th>
              <Th sortDirection={sortOf('role')} onSort={() => onSortChange('role')}>
                Роль
              </Th>
              <Th
                sortDirection={sortOf('position')}
                onSort={() => onSortChange('position')}
              >
                Должность
              </Th>
              <Th
                sortDirection={sortOf('created_at')}
                onSort={() => onSortChange('created_at')}
              >
                Дата добавления
              </Th>
              <Th
                sortDirection={sortOf('last_date_activity')}
                onSort={() => onSortChange('last_date_activity')}
              >
                Дата последней активности
              </Th>
              <Th
                numeric
                sortDirection={sortOf('projects')}
                onSort={() => onSortChange('projects')}
              >
                Количество проектов/активных
              </Th>
              <Th
                numeric
                sortDirection={sortOf('total_seconds_for_week')}
                onSort={() => onSortChange('total_seconds_for_week')}
              >
                Время за неделю / план
              </Th>
              <Th align='center' className='w-35 whitespace-nowrap'>
                Действия
              </Th>
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : employees.length ? (
              employees.map((employee) => {
                const stats = employeeProjectStats(employee, projects);
                const blocked = isEmployeeBlocked(employee.status);
                const archiveLabel = formatEmployeeArchiveLabel(employee);
                const employeeHasTrackedTime = hasTrackedTime(employee);

                return (
                  <Tr key={employee.id}>
                    <Td pin='left' className='font-semibold'>
                      <div>
                        {canEditEmployee ? (
                          <button
                            type='button'
                            className='cursor-pointer text-left hover:text-[#2d6ff7] hover:underline'
                            onClick={() => onEditEmployee(employee)}
                          >
                            {getLastName(employee)}
                          </button>
                        ) : (
                          getLastName(employee)
                        )}
                        {archiveLabel ? (
                          <p className='mt-0.5 text-[10px] font-medium text-[#7e8fb4]'>
                            {archiveLabel}
                          </p>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      {canEditEmployee ? (
                        <button
                          type='button'
                          className='cursor-pointer text-left hover:text-[#2d6ff7] hover:underline'
                          onClick={() => onEditEmployee(employee)}
                        >
                          {getFirstName(employee)}
                        </button>
                      ) : (
                        getFirstName(employee)
                      )}
                    </Td>
                    <Td>{employee.role_label || employee.role || 'Не указано'}</Td>
                    <Td>{getEmployeePosition(employee)}</Td>
                    <Td className='whitespace-nowrap'>
                      {formatDateTime(employee.created_at)}
                    </Td>
                    <Td className='whitespace-nowrap'>
                      {formatDateTime(employee.last_date_activity)}
                    </Td>
                    <Td numeric>
                      {stats.total}/{stats.active}
                    </Td>
                    <Td numeric>
                      <WeekWithPlan employee={employee} />
                    </Td>
                    <Td align='center'>
                      {hasRowActions ? (
                        <TableActions>
                          {!blocked ? (
                            <>
                              {canViewEmployeeDay ? (
                                <TableActionButton
                                  label='День сотрудника'
                                  onClick={() => onOpenEmployeeDay(employee)}
                                >
                                  <Icon name='chart' />
                                </TableActionButton>
                              ) : null}
                              {canEditEmployee ? (
                                <TableActionButton
                                  label='Редактировать сотрудника'
                                  onClick={() => onEditEmployee(employee)}
                                >
                                  <Icon name='edit' />
                                </TableActionButton>
                              ) : null}
                              {canResetEmployeePassword ? (
                                <TableActionButton
                                  label='Сбросить пароль'
                                  onClick={() => onResetEmployeePassword(employee)}
                                >
                                  <Icon name='key' />
                                </TableActionButton>
                              ) : null}
                              {canManageEmployee ? (
                                <TableActionButton
                                  label='Архивировать'
                                  tone='danger'
                                  onClick={() => onArchiveEmployee(employee)}
                                >
                                  <Icon name='archive' />
                                </TableActionButton>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {canManageEmployee ? (
                                <TableActionButton
                                  label='Вернуть из архива'
                                  disabled={isLimitedReached}
                                  onClick={() => onRestoreEmployee(employee)}
                                >
                                  <Icon name='restore' />
                                </TableActionButton>
                              ) : null}
                              {canDeleteEmployee && statusFilter === 'BLOCKED' ? (
                                <TableActionButton
                                  label={
                                    employeeHasTrackedTime
                                      ? 'Нельзя удалить сотрудника: есть учтённое время'
                                      : 'Удалить сотрудника'
                                  }
                                  tone='danger'
                                  onClick={() => onDeleteEmployee(employee)}
                                >
                                  <Icon name='trash' />
                                </TableActionButton>
                              ) : null}
                            </>
                          )}
                        </TableActions>
                      ) : (
                        <span className='text-[#7e8fb4]'>—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <TableEmptyRow>Сотрудники не найдены</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}

function EmployeeMobileDetail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='min-w-0'>
      <dt className='text-[#7e8fb4]'>{label}</dt>
      <dd className='mt-0.5 break-words font-medium text-[#1f3565]'>{value}</dd>
    </div>
  );
}

function EmployeeMobileAction({
  label,
  icon,
  danger = false,
  disabled = false,
  title,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? 'border-[#ffd7dd] bg-white text-[#c83f52]'
          : 'border-[#c9d8f8] bg-white text-[#2d6ff7]'
      }`}
      onClick={onClick}
      title={title ?? label}
    >
      <span className='shrink-0'>{icon}</span>
      <span className='min-w-0 truncate'>{label}</span>
    </button>
  );
}
