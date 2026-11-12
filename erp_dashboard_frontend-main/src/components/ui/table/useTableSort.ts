import { useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export type SortState<TKey extends string> = {
  key: TKey | null;
  direction: SortDirection;
};

type SortOptions<TKey extends string> = {
  initial?: SortState<TKey>;
  /** Третий клик по колонке снимает сортировку (возр. → убыв. → без сортировки). */
  resettable?: boolean;
  /** С какого направления начинать новую колонку; по умолчанию по возрастанию. */
  firstDirection?: SortDirection | ((key: TKey) => SortDirection);
};

export function nextSortState<TKey extends string>(
  current: SortState<TKey>,
  key: TKey,
  { resettable = false, firstDirection = 'asc' }: SortOptions<TKey> = {},
): SortState<TKey> {
  const first =
    typeof firstDirection === 'function' ? firstDirection(key) : firstDirection;
  const second: SortDirection = first === 'asc' ? 'desc' : 'asc';

  if (current.key !== key) return { key, direction: first };
  if (current.direction === first) return { key, direction: second };
  return resettable ? { key: null, direction: first } : { key, direction: first };
}

// Повторный клик по той же колонке меняет направление, клик по другой — сортирует её
// с начального направления.
export function useTableSort<TKey extends string>(options: SortOptions<TKey> = {}) {
  const [sort, setSort] = useState<SortState<TKey>>(
    options.initial ?? { key: null, direction: 'asc' },
  );

  const toggleSort = (key: TKey) =>
    setSort((current) => nextSortState(current, key, options));

  const directionOf = (key: TKey): SortDirection | null =>
    sort.key === key ? sort.direction : null;

  return { sort, setSort, toggleSort, directionOf };
}

function isEmptySortValue(value: unknown) {
  return (
    value == null || value === '' || (typeof value === 'number' && Number.isNaN(value))
  );
}

/** Числа — по величине, остальное — как строки по-русски, с учётом чисел внутри строки. */
export function compareSortValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

  return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' });
}

/** Сортирует копию массива; пустые значения всегда в конце, при любом направлении. */
export function sortRows<TRow, TKey extends string>(
  rows: readonly TRow[],
  sort: SortState<TKey>,
  getValue: (row: TRow, key: TKey) => unknown,
): TRow[] {
  const { key } = sort;
  if (!key) return [...rows];

  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const a = getValue(left, key);
    const b = getValue(right, key);
    const aEmpty = isEmptySortValue(a);
    const bEmpty = isEmptySortValue(b);

    if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
    return factor * compareSortValues(a, b);
  });
}
