export default function ArchiveIcon({ restored = false }: { restored?: boolean }) {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <path d='M6 2h9l5 5v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z' />
      <path d='M14 2v6h6' />
      {restored ? <path d='m9 14 3-3 3 3M12 11v7' /> : <path d='m9 13 3 3 3-3M12 8v8' />}
    </svg>
  );
}
