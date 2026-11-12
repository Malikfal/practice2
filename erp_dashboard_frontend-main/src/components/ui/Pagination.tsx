import { useCallback, useMemo, useState } from 'react';

import { PER_PAGE_OPTIONS } from '../../constants/pagination';
import { Select } from './FormField';

type PaginationItem = number | 'left-ellipsis' | 'right-ellipsis';
type PaginationMeta = {
  current_page?: number;
  last_page?: number;
};

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: PaginationItem[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    items.push('left-ellipsis');
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push('right-ellipsis');
  }

  items.push(totalPages);

  return items;
}

export function usePagination<T>(items: T[]) {
  const [pageSize, setPageSize] = useState<number>(PER_PAGE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize],
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeCurrentPage, pageSize]);

  const onPageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  return {
    pageSize,
    currentPage: safeCurrentPage,
    totalPages,
    paginatedItems,
    setCurrentPage,
    onPageSizeChange,
  };
}

export function useServerPagination(
  initialPageSize: (typeof PER_PAGE_OPTIONS)[number] = PER_PAGE_OPTIONS[1],
) {
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const applyMeta = useCallback((meta: PaginationMeta = {}) => {
    const nextTotalPages = Math.max(1, Number(meta.last_page ?? 1));

    setTotalPages(nextTotalPages);
    setCurrentPage((prev) => Math.min(prev, nextTotalPages));
  }, []);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const onPageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    resetPage,
    onPageSizeChange,
    applyMeta,
  };
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  className = '',
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (_page: number) => void;
  pageSize: number;
  onPageSizeChange: (_pageSize: number) => void;
  className?: string;
}) {
  const items = totalPages > 1 ? buildPaginationItems(currentPage, totalPages) : [];

  return (
    <div
      className={`flex w-full flex-wrap items-center justify-start gap-2 ${className}`}
    >
      <span className='text-xs text-slate-500'>
        Страница {currentPage} из {totalPages}
      </span>
      {totalPages > 1 ? (
        <nav
          className='flex min-w-0 max-w-full flex-wrap items-center justify-start gap-1.5'
          aria-label='Пагинация'
        >
          <button
            type='button'
            className='grid size-7 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            aria-label='Предыдущая страница'
            title='Предыдущая страница'
          >
            <svg
              className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path d='m15 18-6-6 6-6' />
            </svg>
          </button>

          {items.map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type='button'
                className={`h-7 min-w-7 rounded-md border px-1 text-xs font-semibold transition-colors duration-150 ${
                  item === currentPage
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                }`}
                onClick={() => onPageChange(item)}
                aria-current={item === currentPage ? 'page' : undefined}
              >
                {item}
              </button>
            ) : (
              <span key={item} className='px-1 text-xs text-slate-500'>
                ...
              </span>
            ),
          )}

          <button
            type='button'
            className='grid size-7 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            aria-label='Следующая страница'
            title='Следующая страница'
          >
            <svg
              className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path d='m9 18 6-6-6-6' />
            </svg>
          </button>
        </nav>
      ) : null}

      <label className='inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600'>
        <span>Отображать по</span>
        <Select
          className='h-7! min-h-7! w-12! px-2! py-0! text-xs leading-none'
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.currentTarget.value))}
          aria-label='Количество элементов на странице'
        >
          {PER_PAGE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
