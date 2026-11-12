// Метка у пунктов меню и вкладок, которые открываются только на тарифе ПРО.
export default function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title='Доступно на тарифе ПРО'
      className={`inline-flex shrink-0 items-center rounded-md bg-[#fff4e0] px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-[#b45309] uppercase ${className}`}
    >
      ПРО
    </span>
  );
}

/**
 * Компактная метка-замок поверх иконки пункта: для узкого левого меню, где текстовая
 * метка «ПРО» не помещается рядом с названием. Родитель должен быть relative.
 */
export function ProLockMark({ className = '' }: { className?: string }) {
  return (
    <span
      title='Доступно на тарифе ПРО'
      className={`pointer-events-auto grid size-3.5 place-items-center rounded-full bg-[#fff4e0] text-[#b45309] ring-2 ring-white ${className}`}
    >
      <svg
        viewBox='0 0 24 24'
        className='size-2.5 fill-none stroke-current stroke-3 [stroke-linecap:round] [stroke-linejoin:round]'
        aria-hidden='true'
      >
        <rect x='5' y='11' width='14' height='10' rx='2' />
        <path d='M8 11V8a4 4 0 0 1 8 0v3' />
      </svg>
      <span className='sr-only'>Доступно на тарифе ПРО</span>
    </span>
  );
}
