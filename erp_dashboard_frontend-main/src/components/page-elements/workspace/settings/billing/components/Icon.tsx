import { joinClassNames } from '../../settingsUtils';

type IconName = 'eye' | 'document' | 'download' | 'envelope' | 'close';

export default function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common =
    'fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]';
  const finalClass = joinClassNames('h-4 w-4', common, className);

  return (
    <svg viewBox='0 0 24 24' className={finalClass} aria-hidden='true'>
      {name === 'eye' ? (
        <>
          <path d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
          <path d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
        </>
      ) : null}
      {name === 'document' ? (
        <path d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
      ) : null}
      {name === 'download' ? (
        <path d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
      ) : null}
      {name === 'envelope' ? (
        <path d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
      ) : null}
      {name === 'close' ? <path d='M6 18L18 6M6 6l12 12' /> : null}
    </svg>
  );
}
