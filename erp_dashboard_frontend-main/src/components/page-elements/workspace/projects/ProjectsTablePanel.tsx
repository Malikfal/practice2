import { Link } from 'react-router';

import Button from '../../../ui/Button';
import TablePagination from '../../../ui/TablePagination';
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
} from '../../../ui/table';
import {
  formatDateLocal,
  formatDurationHms,
  formatName,
  formatProjectStatus,
  isProjectArchived,
} from '../../../../utils/formatters';
import Icon from '../employees/components/Icon';
import type { Project, ProjectMember, User } from '../../../../types/app';

export type ProjectSortKey =
  | 'name'
  | 'client'
  | 'status'
  | 'manager'
  | 'weekly_seconds'
  | 'total_seconds';

type ExtendedProject = Project & {
  client?: { id: string; name: string } | null;
  client_name?: string | null;
  manager?: User | null;
  amount?: number | null;
  budget?: number | null;
  is_pinned?: boolean;
  isPinned?: boolean;
};

type Props = {
  projects: Project[];
  searchQuery: string;
  statusFilter: string;
  isLoading: boolean;
  activeCount: number;
  archivedCount: number;
  sortKey: ProjectSortKey | '';
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  totalPages: number;
  pageSize: number;
  showPagination: boolean;
  onSearchQueryChange: (_value: string) => void;
  onStatusFilterChange: (_value: string) => void;
  onSortChange: (_key: ProjectSortKey) => void;
  onPageChange: (_page: number) => void;
  onPageSizeChange: (_pageSize: number) => void;
  onOpenCreateModal: () => void;
  onOpenProject: (_project: Project) => void;
  onEditProject: (_project: Project) => void;
  onArchiveProject: (_project: Project) => void;
  onRestoreProject: (_project: Project) => void;
  onDeleteProject: (_project: Project) => void;
  onImportProjects?: () => void;
  onExportProjects?: () => void;
  onTogglePinProject?: (_project: Project) => void;
  onEditTeam?: (_project: Project) => void;
  canManageProject?: boolean;
  canArchiveProject?: boolean;
  canManageProjectMembers?: boolean;
};

function MembersCount({ members }: { members: ProjectMember[] }) {
  const membersCount = members?.length ?? 0;

  return (
    <div
      className='flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#2d6ff7]'
      title={`Количество сотрудников: ${membersCount}`}
    >
      <svg
        viewBox='0 0 24 24'
        className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
        aria-hidden='true'
      >
        <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
        <circle cx='12' cy='7' r='4' />
      </svg>
      <span>{membersCount}</span>
    </div>
  );
}

function getProjectManagers(project: Project): User[] {
  return (project.members || [])
    .filter((member) => member.is_pm)
    .map((member) => member.user)
    .filter((user): user is User => Boolean(user));
}

function ProjectManagersLinks({ project }: { project: Project }) {
  const managers = getProjectManagers(project);

  if (!managers.length) return <span>—</span>;

  return (
    <div className='grid min-w-0 gap-0.5'>
      {managers.map((manager) => (
        <a
          key={manager.id}
          href={`/employees?user_id=${manager.id}`}
          className='block truncate font-semibold text-[#1f3565] hover:text-[#2d6ff7] hover:underline'
          onClick={(event) => event.stopPropagation()}
          title={formatName(manager)}
        >
          {formatName(manager)}
        </a>
      ))}
    </div>
  );
}

function formatPeriod(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Не указано';
  const s = start ? formatDateLocal(new Date(start)) : '...';
  const e = end ? formatDateLocal(new Date(end)) : '...';
  return `${s} - ${e}`;
}

function formatCurrency(value?: number | null) {
  if (value == null) return 'Не указано';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function formatWeekDuration(seconds?: number | null) {
  if (seconds == null) return '0:00:00';
  return formatDurationHms(seconds);
}

function formatTotalDuration(seconds?: number | null) {
  if (seconds == null) return '0:00:00';
  return formatDurationHms(seconds);
}

function hasTrackedTime(project: Project) {
  return (project.total_seconds ?? 0) > 0;
}

export default function ProjectsTablePanel({
  projects,
  searchQuery,
  statusFilter,
  isLoading,
  activeCount,
  archivedCount,
  sortKey,
  sortDirection,
  currentPage,
  totalPages,
  pageSize,
  showPagination,
  onSearchQueryChange,
  onStatusFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onOpenCreateModal,
  onOpenProject,
  onEditProject,
  onArchiveProject,
  onRestoreProject,
  onDeleteProject,
  onImportProjects,
  onExportProjects,
  onTogglePinProject,
  onEditTeam,
  canManageProject = true,
  canArchiveProject = false,
  canManageProjectMembers = false,
}: Props) {
  const sortOf = (key: ProjectSortKey) => (sortKey === key ? sortDirection : null);

  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] sm:p-4'>
      <h1 className='mb-3 text-[18px] leading-tight font-semibold text-[#10275a] sm:mb-4 sm:text-[22px] sm:leading-none'>
        Проекты
      </h1>

      <div className='mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-4 sm:gap-4'>
        <label className='flex h-11 w-full max-w-150 flex-1 items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[#7e8fb4] sm:h-10'>
          <svg
            className='size-5 shrink-0 fill-none stroke-current stroke-[1.8]'
            viewBox='0 0 24 24'
          >
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder='Поиск'
            className='min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-[#1f3565] outline-none placeholder:text-[#7e8fb4] sm:text-[14px]'
          />
        </label>

        <div className='grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto'>
          {canManageProject && (
            <Button
              type='button'
              variant='secondary'
              className='min-h-11 w-full rounded-xl border border-[#e3e9f3] bg-white px-4 text-[14px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff] sm:h-10 sm:min-h-0 sm:w-auto'
              onClick={onOpenCreateModal}
            >
              + Добавить
            </Button>
          )}
          <Button
            type='button'
            variant='secondary'
            className='min-h-11 w-full rounded-xl border border-[#e3e9f3] bg-white px-4 text-[14px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff] sm:h-10 sm:min-h-0 sm:w-auto'
            onClick={onImportProjects}
          >
            Импорт
          </Button>
          <Button
            type='button'
            variant='secondary'
            className='min-h-11 w-full rounded-xl border border-[#e3e9f3] bg-white px-4 text-[14px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff] sm:h-10 sm:min-h-0 sm:w-auto'
            onClick={onExportProjects}
          >
            <span className='inline-flex items-center gap-2'>
              <Icon name='export' />
              Экспорт
            </span>
          </Button>
        </div>
      </div>

      <div className='mb-3 flex min-w-0 flex-col items-stretch gap-2 text-[13px] font-semibold text-[#1f3565] sm:mb-4 sm:flex-row sm:items-center sm:gap-4 sm:text-[15px]'>
        <span className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 sm:py-1.5'>
          Количество проектов: {activeCount + archivedCount}
        </span>
        <div className='flex overflow-x-auto rounded-xl border border-[#e3e9f3] bg-white'>
          <button
            type='button'
            className={`px-4 py-1.5 text-[14px] transition-colors border-r border-[#e3e9f3] ${
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
            className={`px-4 py-1.5 text-[14px] transition-colors border-r border-[#e3e9f3] ${
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
            className={`px-4 py-1.5 text-[14px] transition-colors ${
              statusFilter === 'ARCHIVED'
                ? 'bg-[#2d6ff7] text-white'
                : 'text-[#1f3565] hover:bg-[#f3f7ff]'
            }`}
            onClick={() => onStatusFilterChange('ARCHIVED')}
          >
            Архив ({archivedCount})
          </button>
        </div>
      </div>

      <TableContainer className='min-h-0 flex-1'>
        <Table className='min-w-337.5'>
          <THead sticky>
            <tr>
              <Th
                pin='left'
                sortDirection={sortOf('name')}
                onSort={() => onSortChange('name')}
              >
                Название
              </Th>
              <Th sortDirection={sortOf('client')} onSort={() => onSortChange('client')}>
                Клиент
              </Th>
              <Th sortDirection={sortOf('status')} onSort={() => onSortChange('status')}>
                Статус
              </Th>
              <Th
                sortDirection={sortOf('manager')}
                onSort={() => onSortChange('manager')}
              >
                Менеджер
              </Th>
              <Th align='center'>Участники</Th>
              <Th
                numeric
                className='whitespace-nowrap'
                sortDirection={sortOf('weekly_seconds')}
                onSort={() => onSortChange('weekly_seconds')}
              >
                Часы за неделю
              </Th>
              <Th
                numeric
                className='whitespace-nowrap'
                sortDirection={sortOf('total_seconds')}
                onSort={() => onSortChange('total_seconds')}
              >
                Часы всего
              </Th>
              <Th numeric>Затрачено</Th>
              <Th numeric>Получено</Th>
              <Th numeric>Бюджет</Th>
              <Th>Сроки</Th>
              <Th align='center' className='w-25 whitespace-nowrap'>
                Действия
              </Th>
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : projects.length ? (
              projects.map((project) => {
                const archived = isProjectArchived(project.status);
                const extProject = project as ExtendedProject;
                const client = extProject.client;
                const isPinned = extProject.isPinned ?? extProject.is_pinned;
                const projectHasTrackedTime = hasTrackedTime(project);

                return (
                  <Tr key={project.id}>
                    <Td pin='left' className='min-w-0'>
                      <button
                        type='button'
                        className='block max-w-45 truncate text-left font-semibold hover:text-[#2d6ff7] hover:underline'
                        title={project.name}
                        onClick={() => onOpenProject(project)}
                      >
                        {project.name}
                      </button>
                    </Td>
                    <Td className='min-w-0'>
                      {client ? (
                        <Link
                          to={`/clients?client_id=${client.id}`}
                          className='block w-full truncate font-semibold text-[#1f3565] hover:text-[#2d6ff7] hover:underline'
                          title={client.name}
                        >
                          {client.name}
                        </Link>
                      ) : (
                        <span className='block w-full truncate'>—</span>
                      )}
                    </Td>
                    <Td className='min-w-0'>
                      <span
                        className='block w-full truncate'
                        title={formatProjectStatus(project.status)}
                      >
                        {formatProjectStatus(project.status)}
                      </span>
                    </Td>
                    <Td className='min-w-0'>
                      <ProjectManagersLinks project={project} />
                    </Td>
                    <Td align='center'>
                      {canManageProjectMembers && onEditTeam ? (
                        <button
                          type='button'
                          className='inline-flex w-full items-center justify-center rounded-lg px-1 py-1 transition-colors hover:bg-[#edf3ff]'
                          title='Изменить состав команды'
                          onClick={() => onEditTeam(project)}
                        >
                          <MembersCount members={project.members || []} />
                        </button>
                      ) : (
                        <MembersCount members={project.members || []} />
                      )}
                    </Td>
                    <Td numeric>{formatWeekDuration(project.weekly_seconds)}</Td>
                    <Td numeric className='text-[#7e8fb4]'>
                      {formatTotalDuration(project.total_seconds)}
                    </Td>
                    <Td numeric>{formatCurrency(extProject.amount)}</Td>
                    <Td numeric className='text-[#7e8fb4]'>
                      —
                    </Td>
                    <Td numeric>{formatCurrency(extProject.budget)}</Td>
                    <Td className='min-w-0'>
                      <span
                        className='block w-full truncate'
                        title={formatPeriod(project.starts_at, project.ends_at)}
                      >
                        {formatPeriod(project.starts_at, project.ends_at)}
                      </span>
                    </Td>
                    <Td align='center'>
                      <TableActions>
                        <TableActionButton
                          label={isPinned ? 'Открепить' : 'Закрепить'}
                          active={Boolean(isPinned)}
                          onClick={() => onTogglePinProject?.(project)}
                        >
                          <svg
                            className='fill-none stroke-current stroke-[1.8]'
                            viewBox='0 0 24 24'
                            aria-hidden='true'
                          >
                            <line x1='12' y1='17' x2='12' y2='22'></line>
                            <path d='M5 17h14v-1.5c0-1.8-1-3-2-4.5V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5c-1 1.5-2 2.7-2 4.5z'></path>
                            {isPinned && <line x1='3' y1='3' x2='21' y2='21'></line>}
                          </svg>
                        </TableActionButton>

                        {canManageProject && (
                          <TableActionButton
                            label='Редактировать проект'
                            onClick={() => onEditProject(project)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M12 20h9' />
                              <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' />
                            </svg>
                          </TableActionButton>
                        )}

                        {!archived && canArchiveProject ? (
                          <TableActionButton
                            label='Архивировать'
                            tone='danger'
                            onClick={() => onArchiveProject(project)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path>
                              <polyline points='14 2 14 8 20 8'></polyline>
                              <line x1='16' y1='13' x2='8' y2='13'></line>
                              <line x1='16' y1='17' x2='8' y2='17'></line>
                              <polyline points='10 9 9 9 8 9'></polyline>
                            </svg>
                          </TableActionButton>
                        ) : archived && canArchiveProject ? (
                          <>
                            <TableActionButton
                              label='Вернуть из архива'
                              onClick={() => onRestoreProject(project)}
                            >
                              <svg
                                className='fill-none stroke-current stroke-[1.8]'
                                viewBox='0 0 24 24'
                                aria-hidden='true'
                              >
                                <path d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' />
                                <path d='M3 3v5h5' />
                              </svg>
                            </TableActionButton>
                            <TableActionButton
                              label={
                                projectHasTrackedTime
                                  ? 'Нельзя удалить проект: есть учтённое время'
                                  : 'Удалить проект'
                              }
                              tone='danger'
                              onClick={() => onDeleteProject(project)}
                            >
                              <Icon name='trash' />
                            </TableActionButton>
                          </>
                        ) : null}
                      </TableActions>
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <TableEmptyRow>Проекты не найдены</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>

      {showPagination ? (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50, 100, 1000]}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </section>
  );
}
