import type { RefObject } from 'react';

import { formatName } from '../../../../../../utils/formatters';
import type { User } from '../../../../../../types/app';
import type { GroupBy } from '../types';
import { getUserInitials } from '../utils';
import FilterDropdown from './FilterDropdown';
import GroupByDropdown from './GroupByDropdown';

export default function TasksToolbar({
  searchQuery,
  onSearchQueryChange,
  projectFilterRef,
  assigneeFilterRef,
  groupMenuRef,
  projectOptions,
  assigneeOptions,
  selectedProjectIds,
  selectedAssigneeIds,
  isProjectFilterOpen,
  isAssigneeFilterOpen,
  isGroupMenuOpen,
  groupBy,
  showGroupBy = true,
  onProjectFilterOpenChange,
  onAssigneeFilterOpenChange,
  onGroupMenuOpenChange,
  onClearProjects,
  onClearAssignees,
  onToggleProjectId,
  onToggleAssigneeId,
  onGroupByChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (_query: string) => void;
  projectFilterRef: RefObject<HTMLDivElement | null>;
  assigneeFilterRef: RefObject<HTMLDivElement | null>;
  groupMenuRef: RefObject<HTMLDivElement | null>;
  projectOptions: Array<{ id: string; name: string }>;
  assigneeOptions: User[];
  selectedProjectIds: string[];
  selectedAssigneeIds: string[];
  isProjectFilterOpen: boolean;
  isAssigneeFilterOpen: boolean;
  isGroupMenuOpen: boolean;
  groupBy: GroupBy;
  showGroupBy?: boolean;
  onProjectFilterOpenChange: (_next: boolean) => void;
  onAssigneeFilterOpenChange: (_next: boolean) => void;
  onGroupMenuOpenChange: (_next: boolean) => void;
  onClearProjects: () => void;
  onClearAssignees: () => void;
  onToggleProjectId: (_id: string) => void;
  onToggleAssigneeId: (_id: string) => void;
  onGroupByChange: (_groupBy: GroupBy) => void;
}) {
  return (
    <div className='mb-3 flex min-w-0 flex-wrap items-center gap-2'>
      <label className='flex h-11 w-full min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[#7e8fb4] sm:h-10 sm:min-w-55'>
        <svg
          className='size-5 shrink-0 fill-none stroke-current stroke-[1.8]'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </svg>
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder='Поиск по названию'
          className='min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-[#1f3565] outline-none placeholder:text-[#7e8fb4] sm:text-[14px]'
        />
      </label>

      <FilterDropdown
        containerRef={projectFilterRef}
        label='Проекты'
        isOpen={isProjectFilterOpen}
        onOpenChange={onProjectFilterOpenChange}
        selectedCount={selectedProjectIds.length}
        totalCount={projectOptions.length}
        onClear={onClearProjects}
        options={projectOptions.map((project) => ({
          id: project.id,
          label: project.name,
        }))}
        selectedIds={selectedProjectIds}
        onToggle={onToggleProjectId}
      />

      <FilterDropdown
        containerRef={assigneeFilterRef}
        label='Участники'
        isOpen={isAssigneeFilterOpen}
        onOpenChange={onAssigneeFilterOpenChange}
        selectedCount={selectedAssigneeIds.length}
        totalCount={assigneeOptions.length}
        onClear={onClearAssignees}
        options={assigneeOptions.map((user) => ({
          id: user.id,
          label: formatName(user),
          avatar: (
            <span className='grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e8eef9] text-[11px] font-semibold text-[#1f3565]'>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt='' className='size-full object-cover' />
              ) : (
                <span>{getUserInitials(user)}</span>
              )}
            </span>
          ),
        }))}
        selectedIds={selectedAssigneeIds}
        onToggle={onToggleAssigneeId}
      />

      {showGroupBy ? (
        <GroupByDropdown
          containerRef={groupMenuRef}
          groupBy={groupBy}
          isOpen={isGroupMenuOpen}
          onOpenChange={onGroupMenuOpenChange}
          onGroupByChange={onGroupByChange}
        />
      ) : null}
    </div>
  );
}
