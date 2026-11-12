import type { ReactNode } from 'react';

import { Field, Input, Select } from '../../../ui/FormField';
import type { FinanceArticle, FinanceSource } from '../../../../types/app';
import FinanceArticleTreeMultiSelect from './FinanceArticleTreeMultiSelect';
import FinanceFilterMultiSelect from './FinanceFilterMultiSelect';
import FinanceSummaryStrip, { type FinanceSummary } from './FinanceSummaryStrip';
import type { FinanceFilterState } from './types';
import Icon from '../employees/components/Icon';
import DateRangeFields from '../../../ui/DateRangeFields';

type SelectOption = {
  value: string;
  label: string;
};

function HeaderIconButton({
  label,
  tone = 'secondary',
  tooltipAlign = 'center',
  children,
  onClick,
}: {
  label: string;
  tone?: 'income' | 'expense' | 'secondary';
  tooltipAlign?: 'center' | 'right';
  children: ReactNode;
  onClick: () => void;
}) {
  const toneClassName =
    tone === 'income'
      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-600'
      : tone === 'expense'
        ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/25 hover:bg-rose-700'
        : 'border border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff] hover:text-[#2d6ff7]';

  return (
    <span className='group relative inline-grid'>
      <button
        type='button'
        className={`grid size-9 place-items-center rounded-lg transition-colors ${toneClassName}`}
        title={label}
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </button>
      <span
        className={`pointer-events-none absolute bottom-full z-30 mb-1 whitespace-nowrap rounded-md bg-[#10275a] px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg shadow-slate-900/15 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
          tooltipAlign === 'right' ? 'left-0' : 'left-1/2 -translate-x-1/2'
        }`}
      >
        {label}
      </span>
    </span>
  );
}

function PlusIcon() {
  return (
    <svg
      className='size-5 fill-none stroke-current stroke-3 [stroke-linecap:round]'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path d='M12 5v14' />
      <path d='M5 12h14' />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      className='size-5 fill-none stroke-current stroke-3 [stroke-linecap:round]'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path d='M5 12h14' />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg
      className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path d='M12 3v12' />
      <path d='m8 11 4 4 4-4' />
      <path d='M5 21h14' />
      <path d='M5 17v4' />
      <path d='M19 17v4' />
    </svg>
  );
}

const sourceOptions: Array<{ value: FinanceSource; label: string }> = [
  { value: 'MANUAL', label: 'Ручное создание' },
  { value: 'IMPORT', label: 'Импорт' },
  { value: 'PAYROLL_DAILY', label: 'Ежедневное начисление зарплаты' },
  { value: 'PAYROLL_RECALCULATION', label: 'Перерасчёт зарплаты' },
];

type Props = {
  filters: FinanceFilterState;
  summary: FinanceSummary;
  articles: FinanceArticle[];
  projectOptions: SelectOption[];
  clientOptions: SelectOption[];
  employeeOptions: SelectOption[];
  isLoadingProjects?: boolean;
  isLoadingClients?: boolean;
  isLoadingEmployees?: boolean;
  isLoadingSummary: boolean;
  isLoadingPlannedExpenses?: boolean;
  showPlannedExpenses: boolean;
  plannedExpensesCount: number;
  canManage: boolean;
  onCreateEntrance: () => void;
  onCreateExpenditure: () => void;
  onImportFinances: () => void;
  onExportFinances: () => void;
  /** Без обработчика кнопки нет: планируемые расходы закрыты тарифом ФРИ. */
  onTogglePlannedExpenses?: () => void;
  onFiltersChange: (_next: Partial<FinanceFilterState>) => void;
  onOpenProjects?: () => void;
  onOpenClients?: () => void;
  onOpenEmployees?: () => void;
};

export default function FinanceFiltersPanel({
  filters,
  summary,
  articles,
  projectOptions,
  clientOptions,
  employeeOptions,
  isLoadingProjects = false,
  isLoadingClients = false,
  isLoadingEmployees = false,
  isLoadingSummary,
  isLoadingPlannedExpenses = false,
  showPlannedExpenses,
  plannedExpensesCount,
  canManage,
  onCreateEntrance,
  onCreateExpenditure,
  onImportFinances,
  onExportFinances,
  onTogglePlannedExpenses,
  onFiltersChange,
  onOpenProjects,
  onOpenClients,
  onOpenEmployees,
}: Props) {
  return (
    <div className='mb-3 grid gap-2'>
      <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          {canManage ? (
            <>
              <HeaderIconButton
                label='Поступление'
                tone='income'
                tooltipAlign='right'
                onClick={onCreateEntrance}
              >
                <PlusIcon />
              </HeaderIconButton>
              <HeaderIconButton
                label='Расход'
                tone='expense'
                tooltipAlign='right'
                onClick={onCreateExpenditure}
              >
                <MinusIcon />
              </HeaderIconButton>
            </>
          ) : null}

          {onTogglePlannedExpenses ? (
            <button
              type='button'
              aria-pressed={showPlannedExpenses}
              onClick={onTogglePlannedExpenses}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                showPlannedExpenses
                  ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : 'border-[#c9d8f8] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
            >
              <svg
                className='size-4 fill-none stroke-current stroke-[1.8]'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                {showPlannedExpenses ? (
                  <>
                    <path d='M3 3l18 18' />
                    <path d='M10.6 10.7a2 2 0 0 0 2.7 2.7' />
                    <path d='M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a15.5 15.5 0 0 1-2.1 2.5M6.6 6.6C4.3 8 3 10 3 10s3.5 5 9 5a10.5 10.5 0 0 0 3-.4' />
                  </>
                ) : (
                  <>
                    <path d='M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z' />
                    <circle cx='12' cy='12' r='2.5' />
                  </>
                )}
              </svg>
              {showPlannedExpenses
                ? 'Скрыть планируемые расходы'
                : 'Показать планируемые расходы'}
            </button>
          ) : null}

          {showPlannedExpenses && !isLoadingPlannedExpenses ? (
            <span className='text-xs text-[#7e8fb4]'>
              Расчётных строк: {plannedExpensesCount}
            </span>
          ) : null}

          <div className='flex shrink-0 gap-2'>
            <HeaderIconButton label='Импорт' onClick={onImportFinances}>
              <ImportIcon />
            </HeaderIconButton>
            <HeaderIconButton label='Экспорт' onClick={onExportFinances}>
              <Icon name='export' />
            </HeaderIconButton>
          </div>
        </div>

        <FinanceSummaryStrip
          summary={summary}
          isLoading={isLoadingSummary}
          className='w-full sm:ml-auto sm:w-auto sm:min-w-120'
        />
      </div>

      <div className='flex min-w-0 w-full flex-wrap items-start gap-2.5'>
        <DateRangeFields
          from={filters.from}
          to={filters.to}
          fromLabel='Период'
          toLabel='До'
          className='min-w-0 basis-full grow sm:min-w-[180px] sm:basis-[180px] sm:grow-[2] [&_button]:h-9! [&_button]:px-2.5 [&_button]:text-xs'
          onChange={(from, to) => onFiltersChange({ from, to })}
        />
        <Field
          label='Сумма от'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[70px] sm:basis-[70px]'
        >
          <Input
            value={filters.amount_from}
            onChange={(event) => onFiltersChange({ amount_from: event.target.value })}
            placeholder='0'
            className='h-9! px-2.5 text-xs'
          />
        </Field>
        <Field
          label='Сумма до'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[70px] sm:basis-[70px]'
        >
          <Input
            value={filters.amount_to}
            onChange={(event) => onFiltersChange({ amount_to: event.target.value })}
            placeholder='0'
            className='h-9! px-2.5 text-xs'
          />
        </Field>
        <Field
          label='Тип'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[85px] sm:basis-[85px]'
        >
          <Select
            value={filters.type}
            onChange={(event) =>
              onFiltersChange({ type: event.target.value, finance_article_ids: [] })
            }
            className='h-9! px-2.5 text-xs'
          >
            <option value=''>Все</option>
            <option value='ENTRANCE'>Поступление</option>
            <option value='EXPENDITURE'>Расход</option>
          </Select>
        </Field>
        <Field
          label='Источники'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[125px] sm:basis-[125px]'
        >
          <FinanceFilterMultiSelect
            values={filters.sources}
            onValuesChange={(values) =>
              onFiltersChange({ sources: values as FinanceSource[] })
            }
            options={sourceOptions}
            placeholder='Все источники'
          />
        </Field>
        <Field
          label='Статьи'
          className='min-w-0 basis-full grow sm:min-w-[160px] sm:basis-[160px]'
        >
          <FinanceArticleTreeMultiSelect
            articles={articles}
            values={filters.finance_article_ids}
            onValuesChange={(values) => onFiltersChange({ finance_article_ids: values })}
            className='h-9! px-2.5 text-xs'
          />
        </Field>
        <Field
          label='Проекты'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[125px] sm:basis-[125px]'
        >
          <FinanceFilterMultiSelect
            values={filters.project_ids}
            onValuesChange={(values) => onFiltersChange({ project_ids: values })}
            options={projectOptions}
            placeholder='Все проекты'
            isLoading={isLoadingProjects}
            searchable
            onOpen={onOpenProjects}
          />
        </Field>
        <Field
          label='Клиенты'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[115px] sm:basis-[115px]'
        >
          <FinanceFilterMultiSelect
            values={filters.client_ids}
            onValuesChange={(values) => onFiltersChange({ client_ids: values })}
            options={clientOptions}
            placeholder='Все клиенты'
            isLoading={isLoadingClients}
            searchable
            onOpen={onOpenClients}
          />
        </Field>
        <Field
          label='Участники'
          className='min-w-0 basis-full grow sm:min-w-[125px] sm:basis-[125px]'
        >
          <FinanceFilterMultiSelect
            values={filters.employee_ids}
            onValuesChange={(values) => onFiltersChange({ employee_ids: values })}
            options={employeeOptions}
            placeholder='Все участники'
            isLoading={isLoadingEmployees}
            searchable
            onOpen={onOpenEmployees}
          />
        </Field>
      </div>
    </div>
  );
}
