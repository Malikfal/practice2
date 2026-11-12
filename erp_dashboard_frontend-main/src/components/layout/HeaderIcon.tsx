import type { ReactNode } from 'react';

/**
 * Кнопка-иконка шапки. children — контуры для svg 24×24, badge — счётчик в правом верхнем углу.
 */
export default function HeaderIcon({
  children,
  label,
  onClick,
  isActive,
  badge,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  badge?: ReactNode;
}) {
  return (
    <button
      type='button'
      className={`relative grid size-9 place-items-center rounded-xl border text-[#1f3565]/90 transition-colors duration-150 hover:border-[#c9d8f8] hover:bg-[#f3f7ff] sm:size-10 ${
        isActive ? 'border-[#c9d8f8] bg-[#f3f7ff]' : 'border-[#e3e9f3]'
      }`}
      aria-label={label}
      aria-expanded={onClick ? Boolean(isActive) : undefined}
      onClick={onClick}
    >
      <svg
        className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
        viewBox='0 0 24 24'
        aria-hidden='true'
      >
        {children}
      </svg>
      {badge}
    </button>
  );
}
