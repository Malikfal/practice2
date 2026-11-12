import { useMemo } from 'react';
import { Link } from 'react-router';

import {
  DATA_IMPORT_STATUS_CLASSES,
  DATA_IMPORT_STATUS_LABELS,
  DATA_IMPORT_TEMPLATES,
  DATA_IMPORT_TYPE_DESCRIPTIONS,
  DATA_IMPORT_TYPE_HINTS,
  DATA_IMPORT_TYPE_LABELS,
  dataImportDetailsPath,
  formatFileSize,
} from '../../../../constants/dataImports';
import type { DataImportUpload } from '../../../../hooks/useDataImportUpload';
import type { DataImportType } from '../../../../types/dataImport';
import Button from '../../../ui/Button';
import FileInput from '../../../ui/FileInput';
import Preloader from '../../../ui/Preloader';

type Props = {
  upload: DataImportUpload;
  /** Типы на выбор; если тип один, выбор не показывается. */
  typeOptions: DataImportType[];
  /** Типы выбираются карточками; на странице их до четырёх в ряд, в модалке до двух. */
  variant: 'page' | 'modal';
  onCancel?: () => void;
  /** Кнопка после запуска импорта: «Закрыть» в модалке, «Загрузить ещё файл» на странице. */
  onDone: () => void;
  doneLabel: string;
  /** Вызывается при переходе к подробностям импорта, например чтобы закрыть модалку. */
  onOpenDetails?: () => void;
};

/** Ссылки на шаблоны выбранного типа импорта. */
export function DataImportTemplateLinks({ type }: { type: DataImportType }) {
  return (
    <div className='flex flex-wrap items-center gap-2 text-sm'>
      <span className='py-2 font-semibold'>Скачать шаблон:</span>
      {DATA_IMPORT_TEMPLATES[type].map((template) => (
        <a
          key={template.href}
          className='rounded-lg border border-[#c9d8f8] px-3 py-2 font-semibold text-[#2d6ff7] transition-colors hover:bg-[#edf3ff]'
          href={template.href}
          download
          title={`Скачать шаблон ${template.label}`}
        >
          {template.label}
        </a>
      ))}
    </div>
  );
}

/**
 * Форма нового импорта: выбор типа, файл, шаблоны и прогресс серверной обработки.
 * Используется на вкладке «Импорт» в настройках и в модалке импорта разделов.
 */
export default function DataImportForm({
  upload,
  typeOptions,
  variant,
  onCancel,
  onDone,
  doneLabel,
  onOpenDetails,
}: Props) {
  const {
    type,
    setType,
    file,
    setFile,
    fileInputKey,
    isUploading,
    currentImport,
    isActive,
  } = upload;
  const hints = DATA_IMPORT_TYPE_HINTS[type] ?? [];
  const showTypeChooser = typeOptions.length > 1;
  const fileSize = useMemo(() => (file ? formatFileSize(file.size) : ''), [file]);

  if (currentImport) {
    // Пока сервер не прочитал файл, строк ещё нет: показываем ожидание без пустых счётчиков.
    const isWaiting =
      isActive && (currentImport.status === 'QUEUED' || currentImport.total_rows === 0);
    const hasRows = currentImport.total_rows > 0;
    const waitingText =
      currentImport.status === 'QUEUED'
        ? 'Файл в очереди, обработка начнётся через несколько секунд.'
        : 'Читаем файл, обработка начнётся через несколько секунд.';
    let progressLabel = 'Обработка завершена';
    if (currentImport.status === 'FAILED') progressLabel = 'Обработка прервана';
    else if (currentImport.status === 'CANCELLED') progressLabel = 'Импорт отменён';
    else if (isWaiting) progressLabel = waitingText;
    else if (isActive) progressLabel = `Обработка: ${currentImport.progress}%`;

    return (
      <div className='rounded-xl border border-[#dce7ff] bg-[#f6f9ff] p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='font-semibold text-[#10275a]'>
              {DATA_IMPORT_TYPE_LABELS[currentImport.type]}
            </div>
            <div
              className='mt-1 truncate text-sm text-[#63759c]'
              title={currentImport.original_name}
            >
              {currentImport.original_name}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${DATA_IMPORT_STATUS_CLASSES[currentImport.status]}`}
          >
            {DATA_IMPORT_STATUS_LABELS[currentImport.status]}
          </span>
        </div>
        <div
          className='mt-4 flex items-center gap-2 text-sm font-semibold'
          role='status'
          aria-live='polite'
        >
          {isActive ? <Preloader size='sm' /> : null}
          {progressLabel}
        </div>
        <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#dce7ff]'>
          <div
            className={`h-full bg-[#2d6ff7] transition-all ${isWaiting ? 'w-1/3 animate-pulse' : ''}`}
            style={{
              width: isWaiting
                ? undefined
                : `${Math.max(0, Math.min(100, currentImport.progress))}%`,
            }}
          />
        </div>
        {!isWaiting && hasRows ? (
          <div className='mt-2 text-sm text-[#63759c]'>
            Обработано {currentImport.processed_rows} из {currentImport.total_rows} строк
            · успешно {currentImport.successful_rows} · ошибок {currentImport.failed_rows}{' '}
            · пропущено {currentImport.skipped_rows}
          </div>
        ) : null}
        {currentImport.status === 'COMPLETED' && !hasRows ? (
          <div className='mt-2 text-sm text-[#63759c]'>
            В файле нет строк для импорта.
          </div>
        ) : null}
        {currentImport.error_message ? (
          <div className='mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700'>
            {currentImport.error_message}
          </div>
        ) : null}
        <div className='mt-4 grid gap-2 sm:flex sm:justify-end'>
          <Link
            to={dataImportDetailsPath(currentImport.id)}
            onClick={onOpenDetails}
            className='inline-flex h-11 items-center justify-center rounded-lg border border-[#c9d8f8] bg-white px-3 text-sm font-semibold text-[#2d6ff7] transition-colors hover:bg-[#edf3ff]'
          >
            Подробнее в статистике
          </Link>
          <Button type='button' className='w-full sm:w-auto' onClick={onDone}>
            {doneLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='grid gap-4'>
      {showTypeChooser ? (
        // Одинаковые карточки на странице и в модалке; в модалке их меньше и они уже.
        <fieldset className='grid gap-2'>
          <legend className='mb-2 text-sm font-semibold'>Что импортируем</legend>
          <div
            className={`grid gap-2 sm:grid-cols-2 ${variant === 'page' ? 'xl:grid-cols-4' : ''}`}
          >
            {typeOptions.map((option) => (
              <button
                key={option}
                type='button'
                aria-pressed={type === option}
                disabled={isUploading}
                onClick={() => setType(option)}
                className={`grid content-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${
                  type === option
                    ? 'border-[#2d6ff7] bg-[#edf3ff] ring-2 ring-[#dce7ff]'
                    : 'border-[#e3e9f3] bg-white hover:border-[#c9d8f8]'
                }`}
              >
                <span className='text-sm font-semibold text-[#10275a]'>
                  {DATA_IMPORT_TYPE_LABELS[option]}
                </span>
                <span className='text-xs leading-5 text-[#63759c]'>
                  {DATA_IMPORT_TYPE_DESCRIPTIONS[option]}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div>
        <FileInput
          key={fileInputKey}
          onFileSelect={setFile}
          acceptedFormats={['.csv', '.xls', '.xlsx']}
          disabled={isUploading}
        />
        {file ? (
          <div className='mt-3 rounded-xl bg-[#f5f8fe] p-3 text-sm'>
            <div className='font-semibold'>{file.name}</div>
            <div className='text-[#7e8fb4]'>{fileSize}</div>
            <div className='mt-2 text-amber-700'>
              {type === 'EMPLOYEE_PAYROLL'
                ? 'Повторная загрузка обновит ставки с той же датой начала действия.'
                : 'Повторная загрузка этого файла может создать повторные записи.'}
            </div>
          </div>
        ) : null}
      </div>

      <DataImportTemplateLinks type={type} />

      {hints.length ? (
        <ul className='grid list-disc gap-1 rounded-xl bg-[#f7f9fd] py-3 pr-3 pl-7 text-xs leading-5 text-[#5f7095]'>
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}

      {isUploading ? (
        <div className='flex items-center gap-2 rounded-xl bg-[#edf3ff] p-3 text-sm'>
          <Preloader size='sm' /> Загрузка файла на сервер…
        </div>
      ) : null}

      <div className='grid gap-2 sm:flex sm:justify-end'>
        {onCancel ? (
          <Button
            type='button'
            variant='secondary'
            className='w-full sm:w-auto'
            onClick={onCancel}
            disabled={isUploading}
          >
            Отмена
          </Button>
        ) : null}
        <Button
          type='button'
          className='w-full sm:w-auto'
          onClick={() => void upload.upload()}
          disabled={!file || isUploading}
        >
          Загрузить
        </Button>
      </div>
    </div>
  );
}
