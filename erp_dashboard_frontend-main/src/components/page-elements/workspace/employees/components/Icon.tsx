type IconName =
  | 'chart'
  | 'edit'
  | 'key'
  | 'archive'
  | 'restore'
  | 'trash'
  | 'download'
  | 'export'
  | 'search';

export default function Icon({ name }: { name: IconName }) {
  const common =
    'size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]';

  return (
    <svg viewBox='0 0 24 24' className={common} aria-hidden='true'>
      {name === 'chart' ? (
        <>
          <path d='M4 19V9' />
          <path d='M9 19V5' />
          <path d='M14 19v-7' />
          <path d='M19 19V3' />
          <path d='m4 14 5-5 5 3 5-7' />
        </>
      ) : null}
      {name === 'edit' ? (
        <>
          <path d='m3 21 3.8-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L3 21Z' />
          <path d='m14.5 6.5 3 3' />
        </>
      ) : null}
      {name === 'key' ? (
        <>
          <circle cx='7.5' cy='14.5' r='3.5' />
          <path d='m10 12 9-9' />
          <path d='m15 7 2 2' />
          <path d='m17 5 2 2' />
        </>
      ) : null}
      {name === 'archive' || name === 'restore' ? (
        <>
          <path d='M6 2h9l5 5v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z' />
          <path d='M14 2v6h6' />
          {name === 'restore' ? (
            <path d='m9 14 3-3 3 3M12 11v7' />
          ) : (
            <path d='m9 13 3 3 3-3M12 8v8' />
          )}
        </>
      ) : null}
      {name === 'trash' ? (
        <>
          <path d='M3 6h18' />
          <path d='M8 6V4h8v2' />
          <path d='M19 6l-1 14H6L5 6' />
          <path d='M10 11v6M14 11v6' />
        </>
      ) : null}
      {name === 'download' ? (
        <>
          <path d='M6 2h9l5 5v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z' />
          <path d='M14 2v6h6' />
          <path d='m9 15 3 3 3-3' />
          <path d='M12 11v7' />
        </>
      ) : null}
      {name === 'export' ? (
        <>
          <path d='M14 4h6v6' />
          <path d='M10 14 20 4' />
          <path d='M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5' />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </>
      ) : null}
    </svg>
  );
}
