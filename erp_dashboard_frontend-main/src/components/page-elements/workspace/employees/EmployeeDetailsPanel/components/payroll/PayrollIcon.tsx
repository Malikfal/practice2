export type PayrollIconName =
  | 'clock'
  | 'shield'
  | 'calendar'
  | 'calculator'
  | 'correction'
  | 'swap'
  | 'check';

export function PayrollIcon({ name }: { name: PayrollIconName }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg viewBox='0 0 24 24' className='size-4' aria-hidden='true' {...commonProps}>
      {name === 'clock' ? (
        <>
          <circle cx='12' cy='12' r='8' />
          <path d='M12 8v5l3 2' />
        </>
      ) : null}
      {name === 'shield' ? (
        <path d='M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z' />
      ) : null}
      {name === 'calendar' ? (
        <>
          <path d='M7 3v3M17 3v3M5 9h14' />
          <rect x='5' y='5' width='14' height='16' rx='2' />
        </>
      ) : null}
      {name === 'calculator' ? (
        <>
          <rect x='6' y='3' width='12' height='18' rx='2' />
          <path d='M9 7h6M9 11h1M12 11h1M15 11h1M9 15h1M12 15h1M15 15h1M9 18h4' />
        </>
      ) : null}
      {name === 'correction' ? (
        <>
          <circle cx='12' cy='12' r='8' />
          <path d='M12 16V8M8 12l4-4 4 4' />
        </>
      ) : null}
      {name === 'swap' ? (
        <>
          <path d='M7 7h10M14 4l3 3-3 3M17 17H7M10 14l-3 3 3 3' />
        </>
      ) : null}
      {name === 'check' ? (
        <>
          <circle cx='12' cy='12' r='8' />
          <path d='m8.5 12.5 2.2 2.2 4.8-5.2' />
        </>
      ) : null}
    </svg>
  );
}
