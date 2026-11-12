import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import Button from '../../../ui/Button';
import {
  formatDurationHms,
  formatName,
  formatProjectArchiveLabel,
  formatProjectStatus,
  isProjectArchived,
} from '../../../../utils/formatters';
import type { Project, User } from '../../../../types/app';

type Props = {
  projects: Project[];
  projectOrderIds?: string[];
  isLoading: boolean;
  searchQuery: string;
  statusFilter: string;
  selectedProjectId: string;
  activeCount: number;
  archivedCount: number;
  trackingProjectIds?: string[];
  onSearchQueryChange: (_value: string) => void;
  onStatusFilterChange: (_value: string) => void;
  onSelectProject: (_projectId: string) => void;
  onOpenCreateModal: () => void;
  onTogglePinProject?: (_project: Project) => void;
  onMoveProject?: (_projectId: string, _targetProjectId: string) => void;
  onArchiveProject?: (_project: Project) => void;
  onRestoreProject?: (_project: Project) => void;
  onOpenTemplates?: () => void;
  canManageProject?: boolean;
  onShowAllProjects?: () => void;
  isAllProjectsActive?: boolean;
  onShowAllTasks?: () => void;
  isAllTasksActive?: boolean;
  readOnly?: boolean;
  clientSidebar?: boolean;
};

export default function ProjectsListPanel({
  projects,
  projectOrderIds = [],
  isLoading,
  searchQuery,
  statusFilter,
  selectedProjectId,
  onSearchQueryChange,
  onStatusFilterChange,
  onSelectProject,
  onOpenCreateModal,
  onTogglePinProject,
  onMoveProject,
  onOpenTemplates,
  canManageProject = true,
  onShowAllProjects,
  isAllProjectsActive = false,
  onShowAllTasks,
  isAllTasksActive = false,
  readOnly = false,
  clientSidebar = false,
  activeCount,
  archivedCount,
  trackingProjectIds = [],
}: Props) {
  const activeProjectCount = activeCount;
  const archivedProjectCount = archivedCount;
  const totalProjectCount = activeProjectCount + archivedProjectCount;
  const trackingProjectIdSet = new Set(trackingProjectIds);
  const [draggedProjectId, setDraggedProjectId] = useState('');
  const [dragOverProjectId, setDragOverProjectId] = useState('');
  const projectOrderIndex = useMemo(
    () => new Map(projectOrderIds.map((id, index) => [id, index])),
    [projectOrderIds],
  );

  const sortedProjects = useMemo(() => {
    const currentTrackingProjectIdSet = new Set(trackingProjectIds);

    const getProjectIndicatorPriority = (project: Project) => {
      if (isProjectArchived(project.status)) return 2;
      if (currentTrackingProjectIdSet.has(project.id)) return 0;
      return 1;
    };

    return [...projects].sort((left, right) => {
      const indicatorPriorityDiff =
        getProjectIndicatorPriority(left) - getProjectIndicatorPriority(right);
      if (indicatorPriorityDiff !== 0) {
        return indicatorPriorityDiff;
      }

      const l = left as Project & { is_pinned?: boolean; isPinned?: boolean };
      const r = right as Project & { is_pinned?: boolean; isPinned?: boolean };
      const lPinned = l.isPinned ?? l.is_pinned;
      const rPinned = r.isPinned ?? r.is_pinned;
      if (lPinned !== rPinned) {
        return lPinned ? -1 : 1;
      }

      const leftOrder = projectOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = projectOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name, 'ru');
    });
  }, [projectOrderIndex, projects, trackingProjectIds]);

  const getProjectGroupKey = (project: Project) => {
    const extProject = project as Project & { is_pinned?: boolean; isPinned?: boolean };
    const isPinned = extProject.isPinned ?? extProject.is_pinned;

    return `${isProjectArchived(project.status) ? 'archived' : 'active'}:${isPinned ? 'pinned' : 'regular'}`;
  };

  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] sm:p-4'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <h2 className='text-[12px] leading-none font-semibold'>Проекты</h2>
        {canManageProject && !readOnly && (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='min-h-10 rounded-xl border-[#bad0ff] bg-[#edf3ff] px-3! py-1! text-[12px] leading-normal font-semibold text-[#2d6ff7] hover:bg-[#edf3ff] sm:h-auto! sm:min-h-0! sm:px-2!'
            onClick={onOpenCreateModal}
          >
            + Добавить
          </Button>
        )}
      </div>

      <label className='mb-3 flex min-h-11 items-center gap-2 rounded-xl border border-[#e3e9f3] px-3 py-1 text-[#7e8fb4]'>
        <svg
          className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </svg>
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder='Поиск'
          className='min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-[#1f3565] outline-none placeholder:text-[#7e8fb4] sm:text-[12px]'
        />
      </label>

      {!readOnly && onShowAllTasks ? (
        <Button
          type='button'
          variant='secondary'
          size='sm'
          className={`${onShowAllProjects ? 'mb-2' : 'mb-3'} min-h-10 w-full rounded-xl py-1 text-[12px] font-semibold transition-colors ${
            isAllTasksActive
              ? 'border-[#2d6ff7]! bg-[#2d6ff7]! text-white! hover:bg-[#245fd8]!'
              : 'border-[#c9d8f8] bg-[#edf2fb] text-[#1f3565] hover:bg-[#e7eefc]'
          }`}
          onClick={onShowAllTasks}
          title='Открыть таблицу со всеми задачами'
        >
          <span className='inline-flex items-center gap-2'>
            <svg
              className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <rect x='4' y='5' width='16' height='15' rx='2' />
              <path d='M8 3v4M16 3v4M8 11h8' />
            </svg>
            Все задачи
          </span>
        </Button>
      ) : null}

      {!readOnly && onShowAllProjects ? (
        <Button
          type='button'
          variant='secondary'
          size='sm'
          className={`mb-3 min-h-10 w-full rounded-xl py-1 text-[12px] font-semibold transition-colors ${
            isAllProjectsActive
              ? 'border-[#2d6ff7]! bg-[#2d6ff7]! text-white! hover:bg-[#245fd8]!'
              : 'border-[#c9d8f8] bg-[#edf2fb] text-[#1f3565] hover:bg-[#e7eefc]'
          }`}
          onClick={onShowAllProjects}
          title='Открыть таблицу со всеми проектами'
        >
          <span className='inline-flex items-center gap-2'>
            <svg
              className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <rect x='3' y='4' width='18' height='16' rx='2' />
              <path d='M3 10h18' />
              <path d='M9 4v16' />
            </svg>
            Все проекты
          </span>
        </Button>
      ) : null}

      {!readOnly && !clientSidebar ? (
        <div className='mb-3 grid grid-cols-3 gap-1 text-[10px] font-semibold'>
          <button
            type='button'
            className={`min-h-9 min-w-0 truncate rounded-xl px-2 py-1 text-center transition-colors duration-150 ${
              statusFilter === 'ACTIVE'
                ? 'bg-[#2d6ff7] text-white'
                : 'border border-[#e3e9f3] text-[#1f3565] hover:bg-[#f3f7ff]'
            }`}
            onClick={() => onStatusFilterChange('ACTIVE')}
            title={`Активных проектов: ${activeProjectCount}`}
          >
            Активные ({activeProjectCount})
          </button>
          <button
            type='button'
            title={`Архивных проектов: ${archivedProjectCount}`}
            className={`min-h-9 min-w-0 truncate rounded-xl px-2 py-1 text-center transition-colors duration-150 ${
              statusFilter === 'ARCHIVED'
                ? 'bg-[#2d6ff7] text-white'
                : 'border border-[#e3e9f3] text-[#1f3565] hover:bg-[#f3f7ff]'
            }`}
            onClick={() => onStatusFilterChange('ARCHIVED')}
          >
            Архив ({archivedProjectCount})
          </button>
          <button
            type='button'
            title={`Всего проектов: ${totalProjectCount}`}
            className={`min-h-9 min-w-0 truncate rounded-xl px-2 py-1 text-center transition-colors duration-150 ${
              statusFilter === 'ALL'
                ? 'bg-[#2d6ff7] text-white'
                : 'border border-[#e3e9f3] text-[#1f3565] hover:bg-[#f3f7ff]'
            }`}
            onClick={() => onStatusFilterChange('ALL')}
          >
            Все ({totalProjectCount})
          </button>
        </div>
      ) : null}

      <ul className='grid min-h-0 flex-1 content-start gap-1 overflow-x-hidden overflow-y-auto p-0'>
        {isLoading ? (
          <li className='flex items-center justify-center py-8'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
          </li>
        ) : !sortedProjects.length ? (
          <li className='py-1 text-center text-sm font-medium text-slate-500'>
            Проекты не найдены
          </li>
        ) : (
          sortedProjects.map((project) => {
            const extProject = project as Project & {
              is_pinned?: boolean;
              isPinned?: boolean;
            };
            const isPinned = extProject.isPinned ?? extProject.is_pinned;
            const manager = (project as Project & { manager?: User | null }).manager;
            const archived = isProjectArchived(project.status);
            const archiveLabel = formatProjectArchiveLabel(project);
            const isTracking = trackingProjectIdSet.has(project.id);
            const indicatorColor = archived
              ? 'bg-[#f2324c]'
              : isTracking
                ? 'bg-[#0ea04a]'
                : 'bg-[#9aa8bf]';
            const indicatorTitle = archived
              ? 'Архивирован'
              : isTracking
                ? 'Трекается'
                : 'Не трекается';
            const projectGroupKey = getProjectGroupKey(project);
            const draggedProject = draggedProjectId
              ? sortedProjects.find((item) => item.id === draggedProjectId)
              : null;
            const canDropOnProject =
              !!draggedProject &&
              draggedProject.id !== project.id &&
              getProjectGroupKey(draggedProject) === projectGroupKey;

            return (
              <li
                key={project.id}
                draggable={Boolean(onMoveProject)}
                className={`relative grid min-w-0 cursor-pointer gap-2 rounded-xl border p-2 transition-colors duration-150 ${
                  dragOverProjectId === project.id && canDropOnProject
                    ? 'border-[#2d6ff7] bg-[#f3f7ff]'
                    : selectedProjectId === project.id
                      ? 'border-[#c9d8f8] bg-[#edf2fb]'
                      : 'border-[#e3e9f3] bg-white hover:border-[#c9d8f8] hover:bg-[#fbfcff]'
                } ${draggedProjectId === project.id ? 'opacity-60' : ''}`}
                onDragStart={() => {
                  if (!onMoveProject) return;
                  setDraggedProjectId(project.id);
                }}
                onDragEnd={() => {
                  setDraggedProjectId('');
                  setDragOverProjectId('');
                }}
                onDragOver={(event) => {
                  if (!canDropOnProject) return;
                  event.preventDefault();
                }}
                onDragEnter={() => {
                  if (!canDropOnProject) return;
                  setDragOverProjectId(project.id);
                }}
                onDragLeave={() => {
                  if (dragOverProjectId === project.id) {
                    setDragOverProjectId('');
                  }
                }}
                onDrop={(event) => {
                  if (!onMoveProject || !canDropOnProject || !draggedProjectId) return;
                  event.preventDefault();
                  setDragOverProjectId('');
                  onMoveProject(draggedProjectId, project.id);
                }}
              >
                <Link
                  to={`/projects?project_id=${encodeURIComponent(project.id)}`}
                  draggable={false}
                  aria-label={`Открыть проект ${project.name}`}
                  className='absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d6ff7]'
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
                    onSelectProject(project.id);
                  }}
                />

                <div className='pointer-events-none relative flex min-w-0 items-start justify-between gap-2'>
                  <div className='flex min-w-0 flex-1 items-start gap-2 pt-0.5'>
                    {!readOnly ? (
                      <span
                        className={`mt-1 size-2 shrink-0 rounded-full ${indicatorColor}`}
                        title={indicatorTitle}
                        aria-hidden='true'
                      />
                    ) : null}
                    <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                      <h3
                        className='w-full truncate text-[13px] leading-snug font-semibold'
                        title={project.name}
                      >
                        {project.name}
                      </h3>
                      {!readOnly && !clientSidebar ? (
                        <div className='flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-snug text-[#7e8fb4]'>
                          <span className='truncate'>
                            {formatProjectStatus(project.status)}
                          </span>
                          {archiveLabel ? (
                            <>
                              <span aria-hidden='true'>•</span>
                              <span className='truncate'>{archiveLabel}</span>
                            </>
                          ) : null}
                          {manager && (
                            <>
                              <span aria-hidden='true'>•</span>
                              <span className='truncate'>{formatName(manager)}</span>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className='pointer-events-auto flex shrink-0 items-center gap-1 text-[#7e8fb4]'>
                    {onMoveProject ? (
                      <span
                        className='cursor-grab rounded p-0.5 text-[#9aa8bf] active:cursor-grabbing'
                        title='Перетащите, чтобы изменить порядок'
                        aria-hidden='true'
                      >
                        <svg
                          className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                          viewBox='0 0 24 24'
                        >
                          <path d='M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01' />
                        </svg>
                      </span>
                    ) : null}
                    {onTogglePinProject ? (
                      <button
                        type='button'
                        className={`rounded p-0.5 transition-colors hover:bg-[#f3f7ff] ${
                          isPinned ? 'text-[#2d6ff7]' : 'hover:text-[#2d6ff7]'
                        }`}
                        aria-label={isPinned ? 'Открепить' : 'Закрепить'}
                        title={isPinned ? 'Открепить' : 'Закрепить'}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePinProject(project);
                        }}
                      >
                        <svg
                          className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                          viewBox='0 0 24 24'
                          aria-hidden='true'
                        >
                          <line x1='12' y1='17' x2='12' y2='22'></line>
                          <path d='M5 17h14v-1.5c0-1.8-1-3-2-4.5V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5c-1 1.5-2 2.7-2 4.5z'></path>
                          {isPinned && <line x1='3' y1='3' x2='21' y2='21'></line>}
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>

                {!readOnly && !clientSidebar ? (
                  <div className='pointer-events-none relative flex items-center justify-between gap-2 text-[10px] text-[#7e8fb4]'>
                    <span>
                      За день:{' '}
                      <span className='font-semibold'>
                        {project.daily_seconds
                          ? formatDurationHms(project.daily_seconds)
                          : '—'}
                      </span>
                    </span>
                    <span>
                      За неделю:{' '}
                      <span className='font-semibold'>
                        {project.weekly_seconds
                          ? formatDurationHms(project.weekly_seconds)
                          : '—'}
                      </span>
                    </span>
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      {!readOnly && !clientSidebar ? (
        <div className='mt-auto pt-3'>
          <Button
            type='button'
            variant='secondary'
            className='w-full rounded-xl border-[#e3e9f3] py-3 text-[14px] font-medium text-[#1f3565] hover:bg-[#f3f7ff]'
            onClick={onOpenTemplates}
          >
            <span className='inline-flex items-center gap-2'>
              <svg
                className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <rect x='3' y='4' width='18' height='16' rx='2' />
                <path d='M7 8h10M7 12h10M7 16h6' />
              </svg>
              Шаблоны
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
