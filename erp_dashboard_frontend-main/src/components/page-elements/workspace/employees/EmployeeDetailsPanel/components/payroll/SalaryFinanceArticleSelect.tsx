import { Link } from 'react-router';

import type {
  FinanceSettings,
  SalaryFinanceArticle,
} from '../../../../../../../types/app';
import { SearchableSelect } from '../../../../../../ui/FormField';

const COMPANY_DEFAULT_VALUE = '__company_default__';

function flattenSalaryArticleTree(
  article: SalaryFinanceArticle,
  path: string[] = [],
): Array<{ value: string; label: string; searchText: string }> {
  const nextPath = [...path, article.name];
  const label = nextPath.join(' / ');

  return [
    {
      value: article.id,
      label,
      searchText: `${article.name} ${label}`,
    },
    ...(article.children ?? []).flatMap((child) =>
      flattenSalaryArticleTree(child, nextPath),
    ),
  ];
}

export function SalaryFinanceArticleSelect({
  value,
  settings,
  isLoading = false,
  isSaving = false,
  disabled = false,
  compact = false,
  error,
  onChange,
}: {
  value: string | null;
  settings: FinanceSettings | null;
  isLoading?: boolean;
  isSaving?: boolean;
  disabled?: boolean;
  compact?: boolean;
  error?: string;
  onChange: (_value: string | null) => void;
}) {
  const rootArticle = settings?.default_salary_finance_article ?? null;
  const options = rootArticle
    ? [
        {
          value: COMPANY_DEFAULT_VALUE,
          label: 'Общая статья компании',
          searchText: `общая статья ${rootArticle.name}`,
        },
        ...flattenSalaryArticleTree(rootArticle),
      ]
    : [];

  if (!isLoading && !rootArticle) {
    return (
      <div
        className={`rounded-lg border border-amber-200 bg-amber-50 text-amber-800 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-[13px]'}`}
      >
        Общая зарплатная статья не настроена.{' '}
        <Link
          className='font-semibold text-[#2d6ff7] underline underline-offset-2'
          to='/payroll?view=settings'
        >
          Перейти к настройкам
        </Link>
      </div>
    );
  }

  return (
    <div className='grid min-w-0 gap-1'>
      <SearchableSelect
        value={value ?? COMPANY_DEFAULT_VALUE}
        onValueChange={(nextValue) => {
          if (!nextValue) return;
          onChange(nextValue === COMPANY_DEFAULT_VALUE ? null : nextValue);
        }}
        options={options}
        placeholder='Выберите финансовую статью'
        isLoading={isLoading}
        disabled={disabled || isLoading || isSaving || !rootArticle}
        className={
          compact
            ? 'h-9 w-full min-w-0 truncate rounded-lg border-[#d7e1f1] bg-white text-xs'
            : 'h-11 rounded-xl border-[#c9d8f8] bg-white text-[14px] text-[#1f3565]'
        }
      />
      {error ? (
        <span className='text-[12px] leading-tight text-rose-600'>{error}</span>
      ) : null}
    </div>
  );
}
