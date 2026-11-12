import { PER_PAGE_OPTIONS } from '../../constants/pagination';

type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

type Props = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  onPageChange: (_page: number) => void;
  onPageSizeChange: (_pageSize: number) => void;
};

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  const safeTotal = Math.max(totalPages || 1, 1);
  const safeCurrent = Math.min(Math.max(currentPage || 1, 1), safeTotal);

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, safeTotal]);

  for (let page = safeCurrent - 1; page <= safeCurrent + 1; page += 1) {
    if (page > 1 && page < safeTotal) {
      pages.add(page);
    }
  }

  if (safeCurrent <= 4) {
    [2, 3, 4, 5].forEach((page) => pages.add(page));
  }

  if (safeCurrent >= safeTotal - 3) {
    [safeTotal - 4, safeTotal - 3, safeTotal - 2, safeTotal - 1].forEach((page) => {
      if (page > 1) pages.add(page);
    });
  }

  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  const items: PageItem[] = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push(previousPage === 1 ? 'ellipsis-start' : 'ellipsis-end');
    }

    items.push(page);
  });

  return items;
}

export default function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = PER_PAGE_OPTIONS as unknown as number[],
  showPageSizeSelector = true,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), safeTotalPages);
  const pageItems = getPageItems(safeCurrentPage, safeTotalPages);

  return (
    <div className='mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px] font-semibold text-[#1f3565]'>
      <nav className='flex min-w-0 flex-wrap items-center gap-1.5' aria-label='Пагинация'>
        <span className='mr-1'>Страница</span>
        {pageItems.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type='button'
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-semibold transition-colors ${
                item === safeCurrentPage
                  ? 'border-[#2d6ff7] bg-[#2d6ff7] text-white'
                  : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:border-[#c9d8f8] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => onPageChange(item)}
              disabled={item === safeCurrentPage}
              aria-current={item === safeCurrentPage ? 'page' : undefined}
            >
              {item}
            </button>
          ) : (
            <span
              key={item}
              className='inline-flex h-8 min-w-8 items-center justify-center px-1 text-[#7e8fb4]'
            >
              ...
            </span>
          ),
        )}
        <span className='ml-1 whitespace-nowrap'>из {safeTotalPages}</span>
      </nav>

      <div className='flex flex-wrap items-center gap-3'>
        {safeTotalPages > 1 ? (
          <label className='flex items-center gap-2'>
            <span>Перейти на</span>
            <select
              className='rounded-lg border border-[#e3e9f3] bg-white px-2 py-1 outline-none transition-colors hover:border-[#c9d8f8] hover:bg-[#f3f7ff]'
              value={safeCurrentPage}
              onChange={(event) => onPageChange(Number(event.target.value))}
              aria-label='Выбор страницы'
            >
              {Array.from({ length: safeTotalPages }, (_, index) => index + 1).map(
                (page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}

        {showPageSizeSelector ? (
          <label className='flex items-center gap-2'>
            <span>Отображать по</span>
            <select
              className='rounded-lg border border-[#e3e9f3] bg-white px-2 py-1 outline-none transition-colors hover:border-[#c9d8f8] hover:bg-[#f3f7ff]'
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label='Количество элементов на странице'
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
