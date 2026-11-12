import { useRef, type ReactNode } from 'react';

import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import Button from '../ui/Button';

type Props = {
  isOpen: boolean;
  isProcessing?: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  processingLabel?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  maxWidth?: string;
  customActions?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  isOpen,
  isProcessing = false,
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  processingLabel = 'Удаление...',
  danger = true,
  confirmDisabled = false,
  maxWidth = 'max-w-[604px]',
  customActions,
  onClose,
  onConfirm,
}: Props) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  useEscapeToClose(() => {
    if (!isProcessing) onClose();
  }, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose && !isProcessing) onClose();
      }}
    >
      <div
        className={`max-h-[calc(100dvh-1rem)] w-full ${maxWidth} overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:rounded-2xl md:p-4`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-3'>
          <h2 className='text-base font-semibold text-[#10275a]'>{title}</h2>
        </div>

        <div className='mb-4 text-[14px] leading-6 text-[#1f3565]'>{message}</div>

        <div className='grid gap-2 sm:flex sm:justify-end'>
          {customActions ? (
            customActions
          ) : (
            <>
              <Button type='button' variant='secondary' size='sm' onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button
                type='button'
                variant={danger ? 'danger' : 'primary'}
                size='sm'
                disabled={isProcessing || confirmDisabled}
                onClick={onConfirm}
              >
                {isProcessing ? processingLabel : confirmLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
