import { useMemo, useRef } from 'react';

import Button from '../ui/Button';

export type ImportErrorDetail = {
  row: number;
  errors: string[];
};

type ImportErrorsModalProps = {
  isOpen: boolean;
  title: string;
  errors: ImportErrorDetail[];
  warnings?: ImportErrorDetail[];
  fileName?: string;
  onClose: () => void;
};

function formatEntries(entries: ImportErrorDetail[]) {
  return entries.flatMap((entry) => [
    `Строка ${entry.row}:`,
    ...entry.errors.map((error) => `- ${error}`),
    '',
  ]);
}

function buildErrorsText(
  title: string,
  errors: ImportErrorDetail[],
  warnings: ImportErrorDetail[],
) {
  const lines = [
    title,
    `Ошибок: ${errors.length}`,
    `Предупреждений: ${warnings.length}`,
    '',
    ...(errors.length > 0 ? ['Ошибки:', ...formatEntries(errors)] : []),
    ...(warnings.length > 0 ? ['Предупреждения:', ...formatEntries(warnings)] : []),
  ];

  return lines.join('\n').trimEnd();
}

function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

export default function ImportErrorsModal({
  isOpen,
  title,
  errors,
  warnings = [],
  fileName = 'import_errors.txt',
  onClose,
}: ImportErrorsModalProps) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const errorsText = useMemo(
    () => buildErrorsText(title, errors, warnings),
    [errors, title, warnings],
  );

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-1100 grid place-items-center bg-slate-900/45 p-4 text-[#1f3565]'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose) onClose();
      }}
      role='dialog'
      aria-modal='true'
    >
      <div
        className='flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[#e3e9f3] bg-white p-4 shadow-2xl shadow-slate-900/20'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-3 flex items-start justify-between gap-4'>
          <div>
            <h2 className='text-base font-semibold text-[#10275a]'>{title}</h2>
            <p className='mt-1 text-sm text-[#7e8fb4]'>
              Ошибок: {errors.length}; предупреждений: {warnings.length}
            </p>
          </div>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className='min-h-0 flex-1 overflow-auto rounded-xl border border-[#e3e9f3] bg-[#f7f9fd] p-3'>
          <pre className='whitespace-pre-wrap break-words text-[13px] leading-5 text-[#1f3565]'>
            {errorsText}
          </pre>
        </div>

        <div className='mt-4 flex justify-end gap-2'>
          <Button type='button' variant='secondary' onClick={onClose}>
            Закрыть
          </Button>
          <Button
            type='button'
            variant='primary'
            onClick={() => downloadTextFile(fileName, errorsText)}
          >
            Скачать файл отчёта
          </Button>
        </div>
      </div>
    </div>
  );
}
