import type { ReactNode } from 'react';

export default function DialogShell({
  children,
  onClose,
  maxWidthClassName = 'max-w-2xl',
}: {
  children: ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
}) {
  return (
    <div className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'>
      <div
        className={`max-h-[calc(100dvh-1rem)] w-full overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:max-h-[90vh] md:rounded-2xl md:p-6 ${maxWidthClassName}`}
      >
        {children}
        <button
          type='button'
          className='sr-only'
          onClick={onClose}
          aria-label='Закрыть'
        />
      </div>
    </div>
  );
}
