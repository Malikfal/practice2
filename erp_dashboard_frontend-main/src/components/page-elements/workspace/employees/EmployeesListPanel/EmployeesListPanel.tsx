import { useMemo } from 'react';
import { Link } from 'react-router';

import Button from '../../../../ui/Button';
import {
  formatDurationHms,
  formatEmployeeArchiveLabel,
  formatName,
  isEmployeeBlocked,
} from '../../../../../utils/formatters';
import type { User } from '../../../../../types/app';
import {
  EmployeeLimitNotice,
  isEmployeeLimitReached,
  useEmployeeLimitHint,
} from '../../../../tariff/EmployeeLimit';

import ArchiveIcon from './components/ArchiveIcon';

type Props = {
  employees: User[];
  searchQuery: string;
  statusFilter: string;
  isLoading: boolean;
  tariffLimits: { maxEmployees: number | null; totalEmployees: number };
  showLimitNotice?: boolean;
  activeSelectedEmployeeId: string;
  activeCount: number;
  archivedCount: number;
  trackingUserIds?: string[];
  onlineUserIds?: string[];
  onSearchQueryChange: (_value: string) => void;
  onStatusFilterChange: (_value: string) => void;
  onSelectEmployee: (_employeeId: string) => void;
  onOpenCreateModal: () => void;
  onArchiveEmployee: (_employee: User) => void;
  onRestoreEmployee: (_employee: User) => void;
  onDeleteEmployee: (_employee: User) => void;
  canCreateEmployee?: boolean;
  canManageEmployee?: boolean;
  canDeleteEmployee?: boolean;
};

function getEmployeeRoleLabel(employee: User) {
  return employee.role_label || employee.role || 'Не указано';
}

function formatWeekDuration(seconds: number | null | undefined) {
  if (seconds == null) return '—';
  return formatDurationHms(seconds);
}

function hasExtraHours(employee: User) {
  return (
    employee.supervised_seconds_for_week != null ||
    employee.company_seconds_for_week != null
  );
}

/**
 * Собственные часы скрываем, если они нулевые у того, кому важны часы под контролем
 * или часы всей компании (менеджер, РПО). Остальным нули показываем как раньше.
 */
function shouldShowOwnHours(employee: User) {
  if (!hasExtraHours(employee)) return true;

  return (
    (employee.total_seconds_for_day ?? 0) > 0 ||
    (employee.total_seconds_for_week ?? 0) > 0
  );
}

function ExtraHoursBlock({
  label,
  daySeconds,
  weekSeconds,
}: {
  label: string;
  daySeconds: number | null | undefined;
  weekSeconds: number | null | undefined;
}) {
  return (
    <div className='grid gap-0.5 text-[10px] text-[#7e8fb4]'>
      <span>{label}:</span>
      <div className='flex justify-between gap-2'>
        <span>За день: {formatWeekDuration(daySeconds)}</span>
        <span>За неделю: {formatWeekDuration(weekSeconds)}</span>
      </div>
    </div>
  );
}

function hasTrackedTime(employee: User) {
  return (employee.total_seconds ?? 0) > 0;
}

function compareEmployeesByName(left: User, right: User) {
  const lastNameComparison = (left.last_name || '').localeCompare(
    right.last_name || '',
    'ru',
  );
  if (lastNameComparison !== 0) return lastNameComparison;

  const firstNameComparison = (left.first_name || '').localeCompare(
    right.first_name || '',
    'ru',
  );
  if (firstNameComparison !== 0) return firstNameComparison;

  return formatName(left).localeCompare(formatName(right), 'ru');
}

export default function EmployeesListPanel({
  employees,
  searchQuery,
  isLoading,
  tariffLimits,
  showLimitNotice = false,
  statusFilter,
  activeSelectedEmployeeId,
  activeCount,
  archivedCount,
  trackingUserIds = [],
  onlineUserIds = [],
  onSearchQueryChange,
  onStatusFilterChange,
  onSelectEmployee,
  onOpenCreateModal,
  onArchiveEmployee,
  onRestoreEmployee,
  onDeleteEmployee,
  canCreateEmployee = true,
  canManageEmployee = true,
  canDeleteEmployee = false,
}: Props) {
  const trackingUserIdSet = new Set(trackingUserIds);
  const onlineUserIdSet = new Set(onlineUserIds);
  const sortedEmployees = useMemo(() => {
    const currentTrackingUserIdSet = new Set(trackingUserIds);
    const currentOnlineUserIdSet = new Set(onlineUserIds);

    const getEmployeeIndicatorPriority = (employee: User) => {
      if (isEmployeeBlocked(employee.status)) return 3;
      if (currentTrackingUserIdSet.has(employee.id)) return 0;
      if (currentOnlineUserIdSet.has(employee.id)) return 1;
      return 2;
    };

    return [...employees].sort((left, right) => {
      const priorityDiff =
        getEmployeeIndicatorPriority(left) - getEmployeeIndicatorPriority(right);

      return priorityDiff || compareEmployeesByName(left, right);
    });
  }, [employees, trackingUserIds, onlineUserIds]);

  const isLimitedReached = isEmployeeLimitReached(tariffLimits);
  const limitHint = useEmployeeLimitHint(tariffLimits);

  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-4 text-[#1f3565]'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <h2 className='text-[12px] leading-none font-semibold'>Сотрудники</h2>
        {canCreateEmployee ? (
          <Button
            type='button'
            disabled={isLimitedReached}
            title={limitHint}
            variant='secondary'
            size='sm'
            className='h-auto! min-h-0! rounded-xl border-[#bad0ff] bg-[#edf3ff] px-2! py-1! text-[12px] leading-normal font-semibold text-[#2d6ff7] hover:bg-[#edf3ff]'
            onClick={onOpenCreateModal}
          >
            + Добавить
          </Button>
        ) : null}
      </div>

      {canCreateEmployee && showLimitNotice ? (
        <EmployeeLimitNotice {...tariffLimits} className='mb-3 text-[12px]!' />
      ) : null}

      <label className='mb-3 flex h-9 items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white px-2 text-[12px] text-[#7e8fb4]'>
        <svg
          className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </svg>
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder='Поиск по: ФИО, email, роли или должности'
          className='min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-[#1f3565] outline-none placeholder:text-[#7e8fb4]'
        />
      </label>

      <button
        type='button'
        className={`mb-3 flex h-8 w-full items-center gap-2 rounded-xl border px-2 text-left text-[12px] font-semibold transition-colors ${
          statusFilter === 'ALL'
            ? 'border-[#c9d8f8] bg-[#edf2fb] text-[#1f3565]'
            : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
        }`}
        onClick={() => onStatusFilterChange('ALL')}
      >
        <svg
          className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
          <circle cx='8.5' cy='7' r='3' />
          <path d='M20 8v6M23 11h-6' />
        </svg>
        Все сотрудники
      </button>

      <div className='mb-3 grid grid-cols-2 gap-1 text-[10px] font-semibold'>
        <button
          type='button'
          className={`min-w-0 truncate rounded-xl px-2 py-1 text-center transition-colors ${
            statusFilter === 'ACTIVE'
              ? 'bg-[#2d6ff7] text-white'
              : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
          }`}
          onClick={() => onStatusFilterChange('ACTIVE')}
        >
          Активные ({activeCount})
        </button>
        <button
          type='button'
          className={`min-w-0 truncate rounded-xl px-2 py-1 text-center transition-colors ${
            statusFilter === 'BLOCKED'
              ? 'bg-[#2d6ff7] text-white'
              : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
          }`}
          onClick={() => onStatusFilterChange('BLOCKED')}
        >
          Архив ({archivedCount})
        </button>
      </div>

      <ul className='grid min-h-0 flex-1 content-start gap-1 overflow-x-hidden overflow-y-auto p-0'>
        {isLoading ? (
          <li className='flex items-center justify-center py-8'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#2d6ff7]' />
          </li>
        ) : sortedEmployees.length === 0 ? (
          <li className='py-4 text-center text-[14px] font-medium text-[#7e8fb4]'>
            Сотрудники не найдены
          </li>
        ) : (
          sortedEmployees.map((employee) => {
            const blocked = isEmployeeBlocked(employee.status);
            const archiveLabel = formatEmployeeArchiveLabel(employee);
            const employeeHasTrackedTime = hasTrackedTime(employee);
            const canUnarchivedEmployee = blocked && isLimitedReached;
            const isTracking = trackingUserIdSet.has(employee.id);
            const isOnline = onlineUserIdSet.has(employee.id);
            const indicatorColor = blocked
              ? 'bg-[#f2324c]'
              : isTracking
                ? 'bg-[#0ea04a]'
                : isOnline
                  ? 'bg-[#2d6ff7]'
                  : 'bg-[#9aa8bf]';
            const indicatorTitle = blocked
              ? 'Архивирован'
              : isTracking
                ? 'Трекает'
                : isOnline
                  ? 'Онлайн, не трекает'
                  : 'Офлайн';

            return (
              <li
                key={employee.id}
                className={`relative rounded-xl border p-2 transition-colors ${
                  activeSelectedEmployeeId === employee.id
                    ? 'border-[#c9d8f8] bg-[#edf2fb]'
                    : 'border-[#e3e9f3] bg-white hover:border-[#c9d8f8] hover:bg-[#fbfcff]'
                }`}
              >
                <Link
                  to={`/employees?user_id=${encodeURIComponent(employee.id)}`}
                  className='grid w-full cursor-pointer gap-2 pr-8 text-left'
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onSelectEmployee(employee.id);
                  }}
                >
                  <div className='flex min-w-0 items-start gap-2'>
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${indicatorColor}`}
                      title={indicatorTitle}
                      aria-hidden='true'
                    />
                    <strong className='min-w-0 text-[13px] leading-tight font-semibold text-[#1f3565]'>
                      {formatName(employee)}
                    </strong>
                  </div>

                  <div className='flex flex-wrap gap-2'>
                    <span className='rounded-lg bg-[#edf1f7] px-2 py-1 text-[10px] leading-none font-semibold text-[#1f3565]/70'>
                      {getEmployeeRoleLabel(employee)}
                    </span>
                    {blocked ? (
                      <span className='rounded-lg bg-[#edf1f7] px-2 py-1 text-[10px] leading-none font-semibold text-[#1f3565]/70'>
                        {archiveLabel || 'Архив'}
                      </span>
                    ) : null}
                  </div>

                  {shouldShowOwnHours(employee) ? (
                    <div className='flex justify-between gap-2 text-[10px] text-[#7e8fb4]'>
                      <span>
                        За день: {formatWeekDuration(employee.total_seconds_for_day)}
                      </span>
                      <span>
                        За неделю: {formatWeekDuration(employee.total_seconds_for_week)}
                      </span>
                    </div>
                  ) : null}
                  {employee.supervised_seconds_for_week != null ? (
                    <ExtraHoursBlock
                      label='Под контролем'
                      daySeconds={employee.supervised_seconds_for_day}
                      weekSeconds={employee.supervised_seconds_for_week}
                    />
                  ) : null}
                  {employee.company_seconds_for_week != null ? (
                    <ExtraHoursBlock
                      label='Часы всей компании'
                      daySeconds={employee.company_seconds_for_day}
                      weekSeconds={employee.company_seconds_for_week}
                    />
                  ) : null}
                </Link>

                {canManageEmployee ? (
                  <div className='absolute top-2 right-2 flex items-center gap-1'>
                    <button
                      type='button'
                      disabled={canUnarchivedEmployee}
                      className='grid size-7 place-items-center rounded-lg border border-transparent text-[#7e8fb4] transition-colors enabled:hover:border-[#c9d8f8] enabled:hover:bg-[#f3f7ff] enabled:hover:text-[#2d6ff7] disabled:opacity-50 disabled:cursor-not-allowed'
                      onClick={(event) => {
                        event.stopPropagation();
                        if (blocked) {
                          onRestoreEmployee(employee);
                        } else {
                          onArchiveEmployee(employee);
                        }
                      }}
                      aria-label={
                        blocked
                          ? 'Вернуть сотрудника из архива'
                          : 'Архивировать сотрудника'
                      }
                      title={blocked ? 'Вернуть из архива' : 'Архивировать'}
                    >
                      <ArchiveIcon restored={blocked} />
                    </button>
                    {blocked && statusFilter === 'BLOCKED' && canDeleteEmployee ? (
                      <button
                        type='button'
                        className='grid size-7 place-items-center rounded-lg border border-transparent text-[#f2324c] transition-colors hover:bg-[#fff0f3]'
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteEmployee(employee);
                        }}
                        aria-label='Удалить сотрудника'
                        title={
                          employeeHasTrackedTime
                            ? 'Нельзя удалить сотрудника: есть учтённое время'
                            : 'Удалить сотрудника'
                        }
                      >
                        <svg
                          className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                          viewBox='0 0 24 24'
                          aria-hidden='true'
                        >
                          <path d='M3 6h18' />
                          <path d='M8 6V4h8v2' />
                          <path d='M19 6l-1 14H6L5 6' />
                          <path d='M10 11v6M14 11v6' />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
