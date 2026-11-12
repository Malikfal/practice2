import { useMemo, useState, type RefObject } from 'react';

import type { FilterDropdownOption } from '../types';

export default function FilterDropdown({
  containerRef,
  label,
  isOpen,
  onOpenChange,
  selectedCount,
  totalCount,
  onClear,
  options,
  selectedIds,
  onToggle,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  label: string;
  isOpen: boolean;
  onOpenChange: (_next: boolean) => void;
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  options: FilterDropdownOption[];
  selectedIds: string[];
  onToggle: (_id: string) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = selectedCount === 0 || selectedCount === totalCount;

  const isActive = selectedCount > 0;

  return (
    <div className='relative' ref={containerRef}>
      <button
        type='button'
        onClick={() => onOpenChange(!isOpen)}
        className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors ${
          isOpen || isActive
            ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
            : 'border-[#c9d8f8] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
        }`}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
      >
        <span>{label}</span>
        {selectedCount > 0 ? (
          <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2d6ff7] px-1.5 text-[11px] font-semibold text-white'>
            {selectedCount}
          </span>
        ) : null}
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
        <FilterDropdownContent
          options={options}
          selectedSet={selectedSet}
          allSelected={allSelected}
          onClear={onClear}
          onToggle={onToggle}
        />
      ) : null}
    </div>
  );
}

function FilterDropdownContent({
  options,
  selectedSet,
  allSelected,
  onClear,
  onToggle,
}: {
  options: FilterDropdownOption[];
  selectedSet: Set<string>;
  allSelected: boolean;
  onClear: () => void;
  onToggle: (_id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const filteredOptions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, search]);

  return (
    <div
      role='listbox'
      className='absolute left-0 top-[calc(100%+4px)] z-30 w-64 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white py-2 shadow-lg shadow-slate-900/10'
    >
      <div className='px-2 pb-2'>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Поиск...'
          className='h-9 w-full rounded-lg border border-[#e3e9f3] bg-white px-3 text-[13px] text-[#1f3565] outline-none transition-colors placeholder:text-[#9aa8c7] focus:border-[#2d6ff7]'
        />
      </div>
      <div className='max-h-64 overflow-auto'>
        <label className='flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#1f3565] transition-colors hover:bg-[#f3f7ff]'>
          <input
            type='checkbox'
            checked={allSelected}
            onChange={onClear}
            className='size-4 accent-[#2d6ff7]'
          />
          <span>Все</span>
        </label>
        {filteredOptions.length === 0 ? (
          <div className='px-3 py-3 text-[12px] text-[#9aa8c7]'>Ничего не найдено</div>
        ) : (
          filteredOptions.map((option) => {
            const isSelected = selectedSet.has(option.id);
            return (
              <label
                key={option.id}
                className='flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#1f3565] transition-colors hover:bg-[#f3f7ff]'
              >
                <input
                  type='checkbox'
                  checked={isSelected}
                  onChange={() => onToggle(option.id)}
                  className='size-4 accent-[#2d6ff7]'
                />
                {option.avatar ?? null}
                <span className='truncate' title={option.label}>
                  {option.label}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
