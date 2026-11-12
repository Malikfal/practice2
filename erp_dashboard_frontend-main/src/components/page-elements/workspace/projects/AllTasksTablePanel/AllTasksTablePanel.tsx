import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { UserBoardTask } from '../../../../../types/app';
import { groupTasksByDue } from '../../../../../utils/taskDueBuckets';
import ConfirmDialog from '../../../../modals/ConfirmDialog';
import { useTableSort } from '../../../../ui/table';
import TasksGantt from '../TasksGantt';
import {
  buildKanbanColumns,
  filterTasks,
  getAssigneeOptions,
  getProjectOptions,
  sortTasks,
} from './boardLogic';
import TasksKanban from './components/TasksKanban';
import TasksTable from './components/TasksTable';
import TasksToolbar from './components/TasksToolbar';
import ViewModeTabs from './components/ViewModeTabs';
import { useAllTasksBoardDnD } from './hooks/useAllTasksBoardDnD';
import type { GroupBy, SortKey, ViewMode } from './types';
import { allTasksBoardStore, useAllTasksBoardStore } from './allTasksBoardStore';

type Props = {
  onOpenTask: (_task: UserBoardTask) => void;
};

export default function AllTasksTablePanel({ onOpenTask }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const refreshedSearchRef = useRef<string | null>(null);
  const board = useAllTasksBoardStore(debouncedSearch);
  const boardColumns = board.columns;
  const tasks = board.tasks;
  const isLoading = board.isLoading && !board.hasLoaded;
  const { sort, toggleSort } = useTableSort<SortKey>({
    initial: { key: 'project', direction: 'asc' },
  });
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
  const [isAssigneeFilterOpen, setIsAssigneeFilterOpen] = useState(false);
  const projectFilterRef = useRef<HTMLDivElement | null>(null);
  const assigneeFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isGroupMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!groupMenuRef.current?.contains(event.target as Node)) {
        setIsGroupMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isGroupMenuOpen]);

  useEffect(() => {
    if (!isProjectFilterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!projectFilterRef.current?.contains(event.target as Node)) {
        setIsProjectFilterOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isProjectFilterOpen]);

  useEffect(() => {
    if (!isAssigneeFilterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!assigneeFilterRef.current?.contains(event.target as Node)) {
        setIsAssigneeFilterOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isAssigneeFilterOpen]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (refreshedSearchRef.current === debouncedSearch && !board.isStale) return;
    refreshedSearchRef.current = debouncedSearch;
    void allTasksBoardStore.load(debouncedSearch, true).catch((error) => {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить задачи.',
      );
    });
  }, [debouncedSearch, board.isStale]);

  const allTasks = tasks;

  const projectOptions = useMemo(() => getProjectOptions(allTasks), [allTasks]);

  const assigneeOptions = useMemo(() => getAssigneeOptions(allTasks), [allTasks]);

  const filteredTasks = useMemo(
    () => filterTasks(allTasks, selectedProjectIds, selectedAssigneeIds),
    [allTasks, selectedProjectIds, selectedAssigneeIds],
  );

  const kanbanColumns = useMemo(
    () =>
      buildKanbanColumns({
        allAssignees: assigneeOptions,
        boardColumns,
        groupBy,
        tasks: filteredTasks,
      }),
    [assigneeOptions, boardColumns, filteredTasks, groupBy],
  );

  const dueColumns = useMemo(
    () =>
      viewMode === 'due'
        ? groupTasksByDue(filteredTasks, (task) => Boolean(task.status_column?.is_final))
        : [],
    [filteredTasks, viewMode],
  );

  const ganttTasks = useMemo(
    () =>
      viewMode === 'gantt'
        ? filteredTasks.filter((task) => !task.status_column?.is_final)
        : [],
    [filteredTasks, viewMode],
  );

  const sortedTasks = useMemo(
    () => (sort.key ? sortTasks(filteredTasks, sort.key, sort.direction) : filteredTasks),
    [filteredTasks, sort.key, sort.direction],
  );

  const hasActiveFilter =
    Boolean(searchQuery) ||
    selectedProjectIds.length > 0 ||
    selectedAssigneeIds.length > 0;

  const toggleProjectId = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const toggleAssigneeId = (id: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const {
    canDragTasks,
    draggedTask,
    dropTarget,
    membershipPrompt,
    isAddingMember,
    confirmAddMember,
    dismissMembershipPrompt,
    setDraggedTask,
    setDropTarget,
    handleMoveTask,
  } = useAllTasksBoardDnD({
    search: debouncedSearch,
    groupBy,
    kanbanColumns,
    tasks,
  });

  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-2 text-[#1f3565] sm:p-4'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3'>
        <h1 className='text-[18px] leading-tight font-semibold text-[#10275a] sm:text-[22px] sm:leading-none'>
          Все задачи
        </h1>
        <ViewModeTabs viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      <TasksToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        projectFilterRef={projectFilterRef}
        assigneeFilterRef={assigneeFilterRef}
        groupMenuRef={groupMenuRef}
        projectOptions={projectOptions}
        assigneeOptions={assigneeOptions}
        selectedProjectIds={selectedProjectIds}
        selectedAssigneeIds={selectedAssigneeIds}
        isProjectFilterOpen={isProjectFilterOpen}
        isAssigneeFilterOpen={isAssigneeFilterOpen}
        isGroupMenuOpen={isGroupMenuOpen}
        groupBy={groupBy}
        showGroupBy={viewMode === 'table' || viewMode === 'kanban'}
        onProjectFilterOpenChange={setIsProjectFilterOpen}
        onAssigneeFilterOpenChange={setIsAssigneeFilterOpen}
        onGroupMenuOpenChange={setIsGroupMenuOpen}
        onClearProjects={() => setSelectedProjectIds([])}
        onClearAssignees={() => setSelectedAssigneeIds([])}
        onToggleProjectId={toggleProjectId}
        onToggleAssigneeId={toggleAssigneeId}
        onGroupByChange={setGroupBy}
      />

      <div className='mb-3 text-[13px] text-[#7e8fb4]'>
        Найдено задач:{' '}
        <span className='font-semibold text-[#1f3565]'>
          {viewMode === 'due'
            ? dueColumns.reduce((sum, column) => sum + column.tasks.length, 0)
            : viewMode === 'gantt'
              ? ganttTasks.length
              : sortedTasks.length}
        </span>
      </div>

      {viewMode === 'table' ? (
        <TasksTable
          isLoading={isLoading}
          tasks={sortedTasks}
          hasActiveFilter={hasActiveFilter}
          sort={sort}
          onSort={toggleSort}
          onOpenTask={onOpenTask}
        />
      ) : viewMode === 'gantt' ? (
        <TasksGantt
          isLoading={isLoading}
          tasks={ganttTasks}
          hasActiveFilter={hasActiveFilter}
          getStatus={(task) => ({
            label: task.status_column?.name ?? task.status_label ?? 'Без статуса',
            color: task.status_column?.color ?? task.status_color ?? '#7e8fb4',
          })}
          getSubtitle={(task) => task.project?.name ?? null}
          onOpenTask={onOpenTask}
        />
      ) : viewMode === 'due' ? (
        <TasksKanban
          isLoading={isLoading}
          columns={dueColumns}
          sortedTasksCount={sortedTasks.length}
          hasActiveFilter={hasActiveFilter}
          canDragTasks={false}
          draggedTask={null}
          dropTarget={null}
          onDropTargetChange={setDropTarget}
          onDraggedTaskChange={setDraggedTask}
          onMoveTask={handleMoveTask}
          onOpenTask={onOpenTask}
          showDueDates
        />
      ) : (
        <TasksKanban
          isLoading={isLoading}
          columns={kanbanColumns}
          sortedTasksCount={sortedTasks.length}
          hasActiveFilter={hasActiveFilter}
          canDragTasks={canDragTasks}
          draggedTask={draggedTask}
          dropTarget={dropTarget}
          onDropTargetChange={setDropTarget}
          onDraggedTaskChange={setDraggedTask}
          onMoveTask={handleMoveTask}
          onOpenTask={onOpenTask}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(membershipPrompt)}
        isProcessing={isAddingMember}
        danger={false}
        title='Исполнитель не в проекте'
        message={
          membershipPrompt
            ? `${getUserName(membershipPrompt.targetAssignee)} не состоит в проекте «${
                membershipPrompt.task.project?.name ?? 'без названия'
              }». Добавить исполнителя в проект и назначить на задачу?`
            : ''
        }
        confirmLabel='Добавить и назначить'
        cancelLabel='Отмена'
        processingLabel='Добавление...'
        onClose={dismissMembershipPrompt}
        onConfirm={() => void confirmAddMember()}
      />
    </section>
  );
}

function getUserName(user: { name?: string; first_name?: string; last_name?: string }) {
  if (user.name) return user.name;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Исполнитель';
}
