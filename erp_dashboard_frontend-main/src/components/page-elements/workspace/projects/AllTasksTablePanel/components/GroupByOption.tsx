import type { ReactNode } from 'react';

export default function GroupByOption({
  isActive,
  icon,
  onClick,
  children,
}: {
  isActive: boolean;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      role='option'
      aria-selected={isActive}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
        isActive ? 'bg-[#edf3ff] text-[#2d6ff7]' : 'text-[#1f3565] hover:bg-[#f3f7ff]'
      }`}
    >
      <span className='grid size-5 shrink-0 place-items-center text-[#7e8fb4]'>
        {icon}
      </span>
      <span className='flex-1'>{children}</span>
    </button>
  );
}
