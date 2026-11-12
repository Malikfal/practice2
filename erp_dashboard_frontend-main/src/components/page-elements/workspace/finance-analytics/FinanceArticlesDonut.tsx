import { useMemo, useState } from 'react';

import type { FinanceAnalyticsArticle } from '../../../../types/financeAnalytics';
import { formatAnalyticsMoney, formatAnalyticsNumber } from './financeAnalyticsUtils';

const incomeColors = [
  '#8bb9f9',
  '#5b9bf7',
  '#6f8fd8',
  '#8c91c6',
  '#5b638a',
  '#7e8fb4',
  '#a9c9fb',
  '#7384b7',
  '#4f6fa7',
];

const expenseColors = [
  '#ff9791',
  '#ef625b',
  '#efaaa7',
  '#f39b45',
  '#f6b36c',
  '#d95f52',
  '#f7c08a',
  '#c94d45',
];

const plannedColors = [
  '#f3b347',
  '#f59e0b',
  '#f7c76d',
  '#d98b12',
  '#ffd894',
  '#c8790a',
  '#e9aa3b',
  '#b66d08',
];

const emptyArticles: FinanceAnalyticsArticle[] = [];

type VisibleSlice = { key: string; name: string; amount: number };

function articleKey(article: FinanceAnalyticsArticle, path: string): string {
  return article.article_id ?? `${path}-${article.name}`;
}

function buildVisibleSlices(
  articles: FinanceAnalyticsArticle[],
  expanded: Set<string>,
  path = 'root',
): VisibleSlice[] {
  return articles.flatMap((article, index) => {
    const key = articleKey(article, `${path}-${index}`);
    const children = Array.isArray(article.children) ? article.children : [];
    if (!expanded.has(key) || children.length === 0) {
      return [{ key, name: article.name, amount: article.amount }];
    }

    const visibleChildren = buildVisibleSlices(children, expanded, key);
    return article.own_amount > 0
      ? [
          {
            key: `${key}-own`,
            name: `${article.name} (прямые)`,
            amount: article.own_amount,
          },
          ...visibleChildren,
        ]
      : visibleChildren;
  });
}

function ArticleRows({
  articles,
  expanded,
  onToggle,
  path = 'root',
  level = 0,
}: {
  articles: FinanceAnalyticsArticle[];
  expanded: Set<string>;
  onToggle: (_key: string) => void;
  path?: string;
  level?: number;
}) {
  return articles.map((article, index) => {
    const key = articleKey(article, `${path}-${index}`);
    const children = Array.isArray(article.children) ? article.children : [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(key);

    return (
      <div key={key}>
        <button
          type='button'
          disabled={!hasChildren}
          className='grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left text-xs text-[#66728d] transition-colors hover:bg-[#f5f8fd] disabled:cursor-default disabled:hover:bg-transparent'
          style={{ paddingLeft: 8 + level * 16 }}
          onClick={() => hasChildren && onToggle(key)}
        >
          <span className='flex min-w-0 items-center gap-2'>
            {hasChildren ? (
              <svg
                className={`size-3 shrink-0 fill-none stroke-current stroke-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                viewBox='0 0 16 16'
              >
                <path d='m6 3 5 5-5 5' />
              </svg>
            ) : (
              <span className='ml-1 size-1.5 shrink-0 rounded-full bg-current opacity-55' />
            )}
            <span className='truncate'>{article.name}</span>
          </span>
          <span className='whitespace-nowrap font-medium text-[#53617c]'>
            {formatAnalyticsMoney(article.amount)} (
            {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(
              article.percent,
            )}
            %)
          </span>
        </button>
        {hasChildren && isExpanded ? (
          <ArticleRows
            articles={children}
            expanded={expanded}
            onToggle={onToggle}
            path={key}
            level={level + 1}
          />
        ) : null}
      </div>
    );
  });
}

export default function FinanceArticlesDonut({
  title,
  periodLabel,
  total,
  articles,
  tone,
}: {
  title: string;
  periodLabel: string;
  total: number;
  articles: FinanceAnalyticsArticle[];
  tone: 'income' | 'expense' | 'planned';
}) {
  const safeArticles = Array.isArray(articles) ? articles : emptyArticles;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const slices = useMemo(
    () => buildVisibleSlices(safeArticles, expanded),
    [safeArticles, expanded],
  );
  const colors =
    tone === 'income' ? incomeColors : tone === 'planned' ? plannedColors : expenseColors;
  const chartTotal = slices.reduce((sum, slice) => sum + Math.max(0, slice.amount), 0);
  const gradient = useMemo(() => {
    if (chartTotal <= 0) return '#e8edf5';
    let position = 0;
    const stops = slices.map((slice, index) => {
      const start = position;
      position += (Math.max(0, slice.amount) / chartTotal) * 100;
      return `${colors[index % colors.length]} ${start}% ${position}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [chartTotal, colors, slices]);

  return (
    <section className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-sm shadow-slate-900/3 md:p-4'>
      <h2 className='text-sm font-semibold text-[#27324b]'>{title}, ₽</h2>
      <p className='mt-1 text-[11px] text-[#7e8fb4]'>{periodLabel}</p>
      <div className='mt-4 grid min-w-0 items-center gap-4 md:grid-cols-[190px_minmax(0,1fr)] md:gap-5'>
        <div
          className='relative mx-auto size-36 shrink-0 rounded-full sm:size-42'
          style={{ background: gradient }}
        >
          <div className='absolute inset-6 grid place-items-center rounded-full bg-white text-center shadow-inner sm:inset-7'>
            <div>
              <div className='text-[11px] text-[#7e8fb4]'>
                {tone === 'income'
                  ? 'Поступления'
                  : tone === 'planned'
                    ? 'Планируемые'
                    : 'Расходы'}
              </div>
              <div className='mt-1 text-base font-semibold text-[#27324b]'>
                {formatAnalyticsNumber(total)}
              </div>
            </div>
          </div>
        </div>
        <div className='min-w-0 max-h-56 overflow-auto pr-1'>
          {safeArticles.length ? (
            <ArticleRows
              articles={safeArticles}
              expanded={expanded}
              onToggle={(key) =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
            />
          ) : (
            <div className='py-10 text-center text-sm text-[#7e8fb4]'>
              Нет данных по статьям
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
