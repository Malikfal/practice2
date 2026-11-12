import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { FinanceArticle } from '../../../../types/app';
import { inputBaseClasses } from '../../../ui/FormField';
import useFinanceFilterDropdownStyle from './useFinanceFilterDropdownStyle';

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function renderDropdown(dropdown: ReactNode) {
  if (typeof document === 'undefined') return dropdown;

  return createPortal(dropdown, document.body);
}

type TreeNode = {
  article: FinanceArticle;
  children: TreeNode[];
};

function getDescendantIds(article: FinanceArticle): string[] {
  return (article.children ?? []).flatMap((child) => [
    child.id,
    ...getDescendantIds(child),
  ]);
}

function getSubtreeIds(article: FinanceArticle): string[] {
  return [article.id, ...getDescendantIds(article)];
}

function preferredArticleWidth(articles: FinanceArticle[], depth = 0): number {
  return articles.reduce(
    (width, article) =>
      Math.max(
        width,
        article.name.length * 7.5 + depth * 18 + 76,
        preferredArticleWidth(article.children ?? [], depth + 1),
      ),
    280,
  );
}

function getAncestorIds(
  articles: FinanceArticle[],
  targetId: string,
  parents: string[] = [],
): string[] {
  for (const article of articles) {
    if (article.id === targetId) return parents;

    const childParents = getAncestorIds(article.children ?? [], targetId, [
      ...parents,
      article.id,
    ]);
    if (childParents.length) return childParents;
  }

  return [];
}

function filterTree(articles: FinanceArticle[], searchValue: string): TreeNode[] {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return articles
    .map((article) => {
      const children = filterTree(article.children ?? [], searchValue);
      const isMatched =
        !normalizedSearch || article.name.trim().toLowerCase().includes(normalizedSearch);

      if (!isMatched && children.length === 0) return null;

      return { article, children };
    })
    .filter((node): node is TreeNode => Boolean(node));
}

export default function FinanceArticleTreeMultiSelect({
  articles,
  values,
  onValuesChange,
  placeholder = 'Все статьи',
  className = '',
}: {
  articles: FinanceArticle[];
  values: string[];
  onValuesChange: (_values: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const preferredWidth = useMemo(
    () => Math.min(440, preferredArticleWidth(articles)),
    [articles],
  );
  const dropdownStyle = useFinanceFilterDropdownStyle(
    containerRef,
    isOpen,
    preferredWidth,
  );
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setSearchValue('');
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);
  const selectedSet = useMemo(() => new Set(values), [values]);
  const filteredTree = useMemo(
    () => filterTree(articles, searchValue),
    [articles, searchValue],
  );

  const displayValue =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? 'Выбрана 1 статья'
        : `Выбрано: ${values.length}`;

  const toggleArticle = (article: FinanceArticle) => {
    const subtreeIds = getSubtreeIds(article);
    const isSelected = selectedSet.has(article.id);
    const nextSet = new Set(values);

    if (isSelected) {
      for (const id of subtreeIds) {
        nextSet.delete(id);
      }

      for (const ancestorId of getAncestorIds(articles, article.id)) {
        nextSet.delete(ancestorId);
      }
    } else {
      for (const id of subtreeIds) {
        nextSet.add(id);
      }
    }

    onValuesChange(Array.from(nextSet));
  };

  const renderNodes = (nodes: TreeNode[], depth = 0) =>
    nodes.map(({ article, children }) => {
      const isSelected = selectedSet.has(article.id);
      const selectedChildrenCount = getDescendantIds(article).filter((id) =>
        selectedSet.has(id),
      ).length;
      const isPartial = !isSelected && selectedChildrenCount > 0;

      return (
        <div key={article.id} className='grid gap-1'>
          <button
            type='button'
            className={joinClassNames(
              'flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              isSelected
                ? 'bg-blue-50 font-semibold text-blue-900'
                : 'text-slate-700 hover:bg-slate-100',
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => toggleArticle(article)}
          >
            {depth > 0 ? (
              <span
                className='shrink-0'
                style={{ width: `${depth * 18}px` }}
                aria-hidden='true'
              />
            ) : null}
            <span
              className={joinClassNames(
                'grid size-4 shrink-0 place-items-center rounded border text-[10px] font-bold',
                isSelected
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : isPartial
                    ? 'border-blue-500 bg-blue-50 text-blue-500'
                    : 'border-slate-300 bg-white text-transparent',
              )}
              aria-hidden='true'
            >
              {isSelected ? '✓' : isPartial ? '−' : '✓'}
            </span>
            <span
              className={joinClassNames(
                'h-px w-3 shrink-0 bg-slate-300',
                depth === 0 && 'opacity-0',
              )}
              aria-hidden='true'
            />
            <span className='min-w-0 flex-1 whitespace-normal break-words leading-5'>
              {article.name}
            </span>
          </button>
          {children.length ? renderNodes(children, depth + 1) : null}
        </div>
      );
    });

  return (
    <div ref={containerRef} className='relative'>
      <button
        type='button'
        className={joinClassNames(
          inputBaseClasses,
          'flex items-center justify-start truncate text-left',
          values.length === 0 && 'text-slate-400',
          className,
        )}
        onClick={() => setIsOpen((current) => !current)}
        onBlur={() => {
          window.setTimeout(() => {
            if (
              containerRef.current?.contains(document.activeElement) ||
              dropdownRef.current?.contains(document.activeElement)
            ) {
              return;
            }

            setSearchValue('');
            setIsOpen(false);
          }, 0);
        }}
      >
        <span className='truncate'>{displayValue}</span>
      </button>
      <button
        type='button'
        className='absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center text-slate-400'
        tabIndex={-1}
        aria-hidden='true'
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg
          viewBox='0 0 20 20'
          className={`size-4 fill-none stroke-current stroke-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d='M5 7.5L10 12.5L15 7.5' />
        </svg>
      </button>

      {isOpen && dropdownStyle
        ? renderDropdown(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className='z-[2000] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10'
            >
              <div className='sticky top-0 z-10 bg-white p-1'>
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder='Поиск...'
                  className='h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                  onMouseDown={(event) => event.stopPropagation()}
                />
              </div>

              {filteredTree.length ? (
                renderNodes(filteredTree)
              ) : (
                <div className='px-3 py-2 text-sm text-slate-500'>Ничего не найдено</div>
              )}
            </div>,
          )
        : null}
    </div>
  );
}
