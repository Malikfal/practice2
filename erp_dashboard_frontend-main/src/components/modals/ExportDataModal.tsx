import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import Button from '../ui/Button';

type Props = {
  title: string;
  notice?: string;
  isOpen: boolean;
  isExportDisabled?: boolean;
  onClose: () => void;
  onExportXlsx: () => void;
  onExportCsv: () => void;
  /** Если передан, показывается кнопка выгрузки в PDF. */
  onExportPdf?: () => void;
};

export default function ExportDataModal({
  title,
  notice = 'Экспорт осуществляется на основе применённых фильтров',
  isOpen,
  isExportDisabled = false,
  onClose,
  onExportXlsx,
  onExportCsv,
  onExportPdf,
}: Props) {
  useEscapeToClose(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] sm:p-4'>
      <div className='max-h-[calc(100dvh-1rem)] w-full max-w-162.5 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 sm:rounded-2xl sm:p-5 md:overflow-auto'>
        <div className='mb-5 flex items-center justify-between gap-4'>
          <h2 className='text-[20px] leading-tight font-semibold text-[#10275a] sm:text-[24px]'>
            {title}
          </h2>
          <button
            type='button'
            aria-label='Закрыть'
            className='grid size-8 shrink-0 place-items-center rounded-lg text-[#7e8fb4] transition-colors hover:bg-[#edf3ff] hover:text-[#2d6ff7]'
            onClick={onClose}
          >
            <svg
              className='size-5 fill-none stroke-current stroke-2'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path d='M18 6 6 18' />
              <path d='m6 6 12 12' />
            </svg>
          </button>
        </div>

        <div className='mb-5 flex items-center gap-3 rounded-xl border border-[#dce7ff] bg-[#edf3ff] px-4 py-3 text-[14px] font-medium text-[#1f3565]'>
          <svg
            className='size-5 shrink-0 fill-none stroke-[#2d6ff7] stroke-[1.8]'
            viewBox='0 0 24 24'
            aria-hidden='true'
          >
            <circle cx='12' cy='12' r='9' />
            <path d='M12 11v5' />
            <path d='M12 8h.01' />
          </svg>
          <span>{notice}</span>
        </div>

        <div className='grid gap-3 sm:grid-cols-2'>
          <Button
            type='button'
            disabled={isExportDisabled}
            className='min-h-11 rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[14px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! sm:h-10 sm:min-h-0'
            onClick={onExportXlsx}
          >
            Экспортировать данные в XLSX
          </Button>
          <Button
            type='button'
            disabled={isExportDisabled}
            className='min-h-11 rounded-xl border-[#c9d8f8]! bg-white! px-4 text-[14px] font-semibold text-[#1f3565]! hover:bg-[#f3f7ff]! sm:h-10 sm:min-h-0'
            onClick={onExportCsv}
          >
            Экспортировать данные в CSV
          </Button>
          {onExportPdf ? (
            <Button
              type='button'
              disabled={isExportDisabled}
              className='min-h-11 rounded-xl border-[#c9d8f8]! bg-white! px-4 text-[14px] font-semibold text-[#1f3565]! hover:bg-[#f3f7ff]! sm:col-span-2 sm:h-10 sm:min-h-0'
              onClick={onExportPdf}
            >
              Экспортировать данные в PDF
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
