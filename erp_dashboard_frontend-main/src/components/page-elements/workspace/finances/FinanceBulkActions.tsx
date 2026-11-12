export default function FinanceBulkActions({
  selectedCount,
  onDuplicate,
  onDelete,
}: {
  selectedCount: number;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (!selectedCount) return null;

  return (
    <div className='flex w-fit items-center gap-2 rounded-lg border border-[#dce7ff] bg-[#edf3ff] px-3 py-2 text-[13px] font-semibold text-[#1f3565]'>
      <span>Выделено: {selectedCount}</span>
      <button
        type='button'
        className='inline-flex h-8 items-center gap-1.5 rounded-md border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#1f3565] transition-colors hover:bg-[#f8fbff]'
        onClick={onDuplicate}
      >
        <svg className='size-4 fill-none stroke-current stroke-[1.8]' viewBox='0 0 24 24'>
          <rect x='8' y='8' width='10' height='10' rx='2' />
          <path d='M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
        </svg>
        Дублировать
      </button>
      <button
        type='button'
        className='inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50'
        onClick={onDelete}
      >
        <svg className='size-4 fill-none stroke-current stroke-[1.8]' viewBox='0 0 24 24'>
          <path d='M3 6h18' />
          <path d='M8 6V4h8v2' />
          <path d='M19 6l-1 14H6L5 6' />
        </svg>
        Удалить
      </button>
    </div>
  );
}
