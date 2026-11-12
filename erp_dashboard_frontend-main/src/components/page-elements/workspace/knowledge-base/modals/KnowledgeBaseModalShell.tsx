import { useRef, type ReactNode } from 'react';

import Button from '../../../../ui/Button';

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
  description?: string;
  allowOverflow?: boolean;
};

export default function KnowledgeBaseModalShell({
  title,
  children,
  onClose,
  maxWidthClassName = 'max-w-md',
  description,
  allowOverflow = false,
}: Props) {
  const shouldCloseOnBackdropClickRef = useRef(false);

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-1000 grid place-items-center overflow-y-auto bg-slate-900/40 p-4 text-[#1f3565]'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose) onClose();
      }}
    >
      <section
        className={`max-h-[calc(100vh-2rem)] w-full rounded-2xl border border-[#e3e9f3] bg-white p-4 shadow-2xl shadow-slate-900/20 ${
          allowOverflow ? 'overflow-visible' : 'overflow-auto'
        } ${maxWidthClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-base font-semibold text-[#1f3565]'>{title}</h2>
            {description ? (
              <p className='mt-1 text-xs leading-5 text-[#7e8fb4]'>{description}</p>
            ) : null}
          </div>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>

        {children}
      </section>
    </div>
  );
}
