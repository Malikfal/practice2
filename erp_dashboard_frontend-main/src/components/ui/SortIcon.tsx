type SortIconProps = {
  direction?: 'asc' | 'desc' | null;
  activeClassName?: string;
  className?: string;
};

// Единая иконка сортировки: два треугольника, активное направление выделено цветом,
// остальное приглушено. Без направления колонка просто помечена как сортируемая.
export default function SortIcon({
  direction = null,
  activeClassName = 'text-[#2d6ff7]',
  className = '',
}: SortIconProps) {
  const arrowClass = (arrow: 'asc' | 'desc') =>
    `fill-current ${direction === arrow ? activeClassName : 'opacity-35'}`;

  return (
    <svg
      viewBox='0 0 8 12'
      className={`h-3 w-2 shrink-0 ${className}`}
      aria-hidden='true'
    >
      <path d='M4 1 7.5 5h-7z' className={arrowClass('asc')} />
      <path d='M4 11 .5 7h7z' className={arrowClass('desc')} />
    </svg>
  );
}
