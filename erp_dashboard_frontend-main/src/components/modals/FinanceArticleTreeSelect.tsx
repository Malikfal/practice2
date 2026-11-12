import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import type { FinanceArticle } from '../../types/app';
import { inputBaseClasses } from '../ui/FormField';

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function useDropdownStyle(anchorRef: RefObject<HTMLElement | null>, isOpen: boolean) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const margin = 8;
      const width = Math.min(rect.width, window.innerWidth - margin * 2);
      const left = Math.max(
        margin,
        Math.min(rect.left, window.innerWidth - width - margin),
      );
      const spaceBelow = window.innerHeight - rect.bottom - 6 - margin;
      const spaceAbove = rect.top - 6 - margin;
      const openAbove = spaceBelow < 288 && spaceAbove > spaceBelow;
      setStyle({
        position: 'fixed',
        top: openAbove ? undefined : rect.bottom + 6,
        bottom: openAbove ? window.innerHeight - rect.top + 6 : undefined,
        left,
        width,
        maxHeight: Math.min(288, Math.max(0, openAbove ? spaceAbove : spaceBelow)),
      });
    };

    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, isOpen]);

  return style;
}

function renderDropdown(dropdown: ReactNode) {
  if (typeof document === 'undefined') return dropdown;

  return createPortal(dropdown, document.body);
}

type ArticleTreeNode = {
  article: FinanceArticle;
  children: ArticleTreeNode[];
};

function filterArticleTree(
  articles: FinanceArticle[],
  searchValue: string,
): ArticleTreeNode[] {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return articles
    .map((article) => {
      const children = filterArticleTree(article.children ?? [], searchValue);
      const isMatched =
        !normalizedSearch || article.name.trim().toLowerCase().includes(normalizedSearch);

      if (!isMatched && children.length === 0) return null;

      return { article, children };
    })
    .filter((node): node is ArticleTreeNode => Boolean(node));
}

function findArticleName(articles: FinanceArticle[], articleId: string): string {
  for (const article of articles) {
    if (article.id === articleId) return article.name;

    const childName = findArticleName(article.children ?? [], articleId);
    if (childName) return childName;
  }

  return '';
}

export default function FinanceArticleTreeSelect({
  value,
  articles,
  placeholder = 'Выберите статью',
  onValueChange,
}: {
  value: string;
  articles: FinanceArticle[];
  placeholder?: string;
  onValueChange: (_value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const dropdownStyle = useDropdownStyle(containerRef, isOpen);

  const selectedLabel = useMemo(
    () => (value ? findArticleName(articles, value) : ''),
    [articles, value],
  );
  const filteredTree = useMemo(
    () => filterArticleTree(articles, searchValue),
    [articles, searchValue],
  );
  const displayValue = isOpen ? searchValue : selectedLabel;

  const renderNodes = (nodes: ArticleTreeNode[], depth = 0) =>
    nodes.map(({ article, children }) => (
      <div key={article.id} className='grid gap-1'>
        <button
          type='button'
          className={joinClassNames(
            'flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            value === article.id
              ? 'bg-blue-50 font-semibold text-blue-900'
              : 'text-slate-700 hover:bg-slate-100',
          )}
          style={{ paddingLeft: `${8 + depth * 18}px` }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onValueChange(article.id);
            setSearchValue('');
            setIsOpen(false);
          }}
        >
          <span
            className={joinClassNames(
              'h-px w-3 shrink-0 bg-slate-300',
              depth === 0 && 'opacity-0',
            )}
            aria-hidden='true'
          />
          <span className='min-w-0 truncate'>{article.name}</span>
        </button>
        {children.length ? renderNodes(children, depth + 1) : null}
      </div>
    ));

  return (
    <div ref={containerRef} className='relative'>
      <input
        value={displayValue}
        onChange={(event) => {
          setSearchValue(event.target.value);
          if (value) onValueChange('');
          setIsOpen(true);
        }}
        onFocus={() => {
          setSearchValue('');
          setIsOpen(true);
        }}
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
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (isOpen) event.preventDefault();
            setSearchValue('');
            setIsOpen(false);
          }
        }}
        placeholder={placeholder}
        className={inputBaseClasses}
      />
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
              className='z-[2000] max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10'
            >
              {value && !searchValue.trim() ? (
                <button
                  type='button'
                  className='flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[#2d6ff7] hover:bg-blue-50'
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onValueChange('');
                    setSearchValue('');
                    setIsOpen(false);
                  }}
                >
                  <span className='h-px w-3 shrink-0 opacity-0' aria-hidden='true' />
                  <span className='min-w-0 truncate'>Без статьи (сбросить выбор)</span>
                </button>
              ) : null}
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
