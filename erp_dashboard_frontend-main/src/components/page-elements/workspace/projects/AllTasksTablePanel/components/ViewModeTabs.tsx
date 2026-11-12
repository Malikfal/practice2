import type { ReactNode } from 'react';

import type { ViewMode } from '../types';

const VIEW_MODES: ReadonlyArray<{ key: ViewMode; label: string; icon: ReactNode }> = [
  { key: 'table', label: 'Таблица', icon: <path d='M3 6h18M3 12h18M3 18h18' /> },
  {
    key: 'kanban',
    label: 'Канбан',
    icon: (
      <>
        <rect x='3' y='4' width='5' height='16' rx='1' />
        <rect x='10' y='4' width='5' height='10' rx='1' />
        <rect x='17' y='4' width='4' height='13' rx='1' />
      </>
    ),
  },
  {
    key: 'due',
    label: 'По срокам',
    icon: (
      <>
        <circle cx='12' cy='12' r='9' />
        <path d='M12 7v5l3 2' />
      </>
    ),
  },
  { key: 'gantt', label: 'Гант', icon: <path d='M4 6h8M8 12h10M6 18h7' /> },
];

/**
 * На телефоне у неактивных видов только иконки, чтобы все четыре помещались в строку.
 */
export default function ViewModeTabs({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (_viewMode: ViewMode) => void;
}) {
  return (
    <div
      role='tablist'
      aria-label='Режим отображения'
      className='inline-flex max-w-full items-center rounded-xl border border-[#e3e9f3] bg-white p-0.5 text-[13px] font-semibold whitespace-nowrap text-[#7e8fb4]'
    >
      {VIEW_MODES.map((mode) => {
        const isActive = viewMode === mode.key;
        return (
          <button
            key={mode.key}
            type='button'
            role='tab'
            aria-selected={isActive}
            title={mode.label}
            onClick={() => onViewModeChange(mode.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg py-1.5 transition-colors ${
              isActive
                ? 'bg-[#f3f7ff] px-3 text-[#2d6ff7]'
                : 'px-2.5 hover:text-[#1f3565] sm:px-3'
            }`}
          >
            <svg
              viewBox='0 0 24 24'
              className='size-4 shrink-0 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
              aria-hidden='true'
            >
              {mode.icon}
            </svg>
            <span className={isActive ? '' : 'sr-only sm:not-sr-only'}>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
