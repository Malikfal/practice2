import type { RefObject } from 'react';

import { GROUP_BY_LABEL } from '../constants';
import type { GroupBy } from '../types';
import GroupByOption from './GroupByOption';

export default function GroupByDropdown({
  containerRef,
  groupBy,
  isOpen,
  onOpenChange,
  onGroupByChange,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  groupBy: GroupBy;
  isOpen: boolean;
  onOpenChange: (_next: boolean) => void;
  onGroupByChange: (_groupBy: GroupBy) => void;
}) {
  const selectGroupBy = (nextGroupBy: GroupBy) => {
    onGroupByChange(nextGroupBy);
    onOpenChange(false);
  };

  return (
    <div className='relative' ref={containerRef}>
      <button
        type='button'
        onClick={() => onOpenChange(!isOpen)}
        className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors ${
          isOpen
            ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
            : 'border-[#c9d8f8] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
        }`}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
      >
        {GROUP_BY_LABEL[groupBy]}
        <svg
          viewBox='0 0 12 12'
          className={`size-2.5 fill-none stroke-current stroke-[1.8] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden='true'
        >
          <path d='m3 4.5 3 3 3-3' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </button>

      {isOpen ? (
        <div
          role='listbox'
          className='absolute right-0 top-[calc(100%+4px)] z-30 min-w-56 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white py-1 shadow-lg shadow-slate-900/10'
        >
          <GroupByOption
            isActive={groupBy === 'status'}
            onClick={() => selectGroupBy('status')}
            icon={
              <svg
                viewBox='0 0 24 24'
                className='size-4 fill-none stroke-current stroke-[1.8]'
                aria-hidden='true'
              >
                <rect x='3' y='4' width='5' height='16' rx='1' />
                <rect x='10' y='4' width='5' height='10' rx='1' />
                <rect x='17' y='4' width='4' height='13' rx='1' />
              </svg>
            }
          >
            По статусу{' '}
            <span className='text-[12px] font-normal text-[#9aa8c7]'>(по умолчанию)</span>
          </GroupByOption>
          <GroupByOption
            isActive={groupBy === 'assignee'}
            onClick={() => selectGroupBy('assignee')}
            icon={
              <svg
                viewBox='0 0 24 24'
                className='size-4 fill-none stroke-current stroke-[1.8]'
                aria-hidden='true'
              >
                <circle cx='12' cy='8' r='4' />
                <path d='M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8' strokeLinecap='round' />
              </svg>
            }
          >
            По исполнителю
          </GroupByOption>
          <GroupByOption
            isActive={groupBy === 'priority'}
            onClick={() => selectGroupBy('priority')}
            icon={
              <svg
                viewBox='0 0 24 24'
                className='size-4 fill-none stroke-current stroke-[1.8]'
                aria-hidden='true'
              >
                <path d='M4 20V10M12 20V4M20 20v-6' strokeLinecap='round' />
              </svg>
            }
          >
            По приоритету
          </GroupByOption>
        </div>
      ) : null}
    </div>
  );
}
