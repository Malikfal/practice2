import { useState } from 'react';

/** Набор раскрытых строк таблицы: раскрыть одну, раскрыть все, свернуть все. */
export function useExpandedRows<TId>(initial: Iterable<TId> = []) {
  const [expanded, setExpanded] = useState(() => new Set(initial));

  const isExpanded = (id: TId) => expanded.has(id);

  const toggle = (id: TId) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = (ids: Iterable<TId>) => setExpanded(new Set(ids));
  const collapseAll = () => setExpanded(new Set());

  return { expanded, isExpanded, toggle, expandAll, collapseAll };
}
