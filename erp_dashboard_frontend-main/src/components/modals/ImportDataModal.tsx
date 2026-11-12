import { useEffect, useMemo } from 'react';

import {
  DATA_IMPORT_TYPES,
  RELATED_DATA_IMPORT_TYPES,
} from '../../constants/dataImports';
import {
  useAllowedImportTypes,
  useDataImportUpload,
} from '../../hooks/useDataImportUpload';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import type { DataImport, DataImportType } from '../../types/dataImport';
import DataImportForm from '../page-elements/workspace/imports/DataImportForm';

type Props = {
  isOpen: boolean;
  title?: string;
  importType?: DataImportType;
  onClose: () => void;
  onAccepted?: (_dataImport: DataImport) => void;
  /** @deprecated Legacy client-side import props are accepted during migration but ignored. */
  isImportDisabled?: boolean;
  acceptedFormats?: string[];
  tplFileName?: string;
  templateFiles?: Array<{ label: string; fileName: string }>;
  isLoading?: boolean;
  onImport?: (_rows: unknown[]) => Promise<void>;
  onLoadFile?: (_ext: string, _file: File) => Promise<'' | unknown[]>;
};

export default function ImportDataModal({
  isOpen,
  title = 'Новый импорт',
  importType,
  onClose,
  onAccepted,
}: Props) {
  const upload = useDataImportUpload({
    initialType: importType ?? 'FINANCES',
    onAccepted,
  });
  const { reset, isUploading } = upload;
  // Связанные типы (например, оба импорта сотрудников) показываем выбором внутри модалки.
  const candidateTypes = useMemo(
    () =>
      importType
        ? (RELATED_DATA_IMPORT_TYPES[importType] ?? [importType])
        : DATA_IMPORT_TYPES,
    [importType],
  );
  const allowedTypes = useAllowedImportTypes(isOpen && candidateTypes.length > 1);
  const typeOptions = useMemo(() => {
    const allowed = candidateTypes.filter((type) => allowedTypes.includes(type));
    return allowed.length ? allowed : candidateTypes;
  }, [allowedTypes, candidateTypes]);

  useEffect(() => {
    if (isOpen) reset(importType ?? 'FINANCES');
  }, [importType, isOpen, reset]);

  // Пока файл загружается, окно не закрывается ни крестиком, ни по Esc.
  const close = () => {
    if (isUploading) return;
    reset();
    onClose();
  };

  useEscapeToClose(close, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] sm:p-4'
      onClick={close}
      role='dialog'
      aria-modal='true'
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-162.5 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl sm:rounded-2xl sm:p-5 md:overflow-auto'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-5 flex items-center justify-between gap-4'>
          <h2 className='text-xl leading-tight font-semibold text-[#10275a] sm:text-2xl'>
            {title}
          </h2>
          <button
            type='button'
            aria-label='Закрыть'
            className='text-2xl text-[#7e8fb4]'
            onClick={close}
          >
            ×
          </button>
        </div>

        <DataImportForm
          upload={upload}
          typeOptions={typeOptions}
          variant='modal'
          onCancel={close}
          onDone={close}
          doneLabel='Закрыть'
          onOpenDetails={close}
        />
      </div>
    </div>
  );
}
