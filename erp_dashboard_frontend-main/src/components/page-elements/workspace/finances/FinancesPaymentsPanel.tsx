import type {
  Finance,
  FinanceArticle,
  PlannedExpensePayment,
} from '../../../../types/app';
import FinanceFiltersPanel from './FinanceFiltersPanel';
import FinancePagination from './FinancePagination';
import type { FinanceSummary } from './FinanceSummaryStrip';
import FinancesTable from './FinancesTable';
import type { FinanceFilterState, FinanceForm } from './types';

type FinanceSelectOption = {
  value: string;
  label: string;
};

type Props = {
  finances: Finance[];
  plannedExpenses: PlannedExpensePayment[];
  filters: FinanceFilterState;
  summary: FinanceSummary;
  articles: FinanceArticle[];
  projectOptions: FinanceSelectOption[];
  clientOptions: FinanceSelectOption[];
  employeeOptions: FinanceSelectOption[];
  isLoadingProjects: boolean;
  isLoadingClients: boolean;
  isLoadingEmployees: boolean;
  isLoading: boolean;
  isLoadingSummary: boolean;
  isLoadingPlannedExpenses: boolean;
  showPlannedExpenses: boolean;
  canManage: boolean;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  selectedFinanceIds: string[];
  onCreateEntrance: () => void;
  onCreateExpenditure: () => void;
  onImportFinances: () => void;
  onExportFinances: () => void;
  /** Без обработчика кнопки нет: планируемые расходы закрыты тарифом ФРИ. */
  onTogglePlannedExpenses?: () => void;
  onFiltersChange: (_next: Partial<FinanceFilterState>) => void;
  onOpenProjects: () => void;
  onOpenClients: () => void;
  onOpenEmployees: () => void;
  onSelectedFinanceIdsChange: (_ids: string[]) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onEditFinance: (_financeId: string, _form: FinanceForm) => void;
  onDeleteFinance: (_finance: Finance) => void;
  onPageChange: (_page: number) => void;
  onPageSizeChange: (_pageSize: number) => void;
};

export default function FinancesPaymentsPanel({
  finances,
  plannedExpenses,
  filters,
  summary,
  articles,
  projectOptions,
  clientOptions,
  employeeOptions,
  isLoadingProjects,
  isLoadingClients,
  isLoadingEmployees,
  isLoading,
  isLoadingSummary,
  isLoadingPlannedExpenses,
  showPlannedExpenses,
  canManage,
  currentPage,
  totalPages,
  pageSize,
  selectedFinanceIds,
  onCreateEntrance,
  onCreateExpenditure,
  onImportFinances,
  onExportFinances,
  onTogglePlannedExpenses,
  onFiltersChange,
  onOpenProjects,
  onOpenClients,
  onOpenEmployees,
  onSelectedFinanceIdsChange,
  onDuplicateSelected,
  onDeleteSelected,
  onEditFinance,
  onDeleteFinance,
  onPageChange,
  onPageSizeChange,
}: Props) {
  return (
    <section className='flex h-full min-h-0 flex-col overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] lg:overflow-hidden lg:p-4'>
      <h1 className='mb-4 text-[20px] leading-tight font-semibold text-[#10275a] lg:text-[22px] lg:leading-none'>
        Финансы - платежи
      </h1>

      <FinanceFiltersPanel
        filters={filters}
        summary={summary}
        articles={articles}
        projectOptions={projectOptions}
        clientOptions={clientOptions}
        employeeOptions={employeeOptions}
        isLoadingProjects={isLoadingProjects}
        isLoadingClients={isLoadingClients}
        isLoadingEmployees={isLoadingEmployees}
        isLoadingSummary={isLoadingSummary}
        isLoadingPlannedExpenses={isLoadingPlannedExpenses}
        showPlannedExpenses={showPlannedExpenses}
        plannedExpensesCount={plannedExpenses.length}
        canManage={canManage}
        onCreateEntrance={onCreateEntrance}
        onCreateExpenditure={onCreateExpenditure}
        onImportFinances={onImportFinances}
        onExportFinances={onExportFinances}
        onTogglePlannedExpenses={onTogglePlannedExpenses}
        onFiltersChange={onFiltersChange}
        onOpenProjects={onOpenProjects}
        onOpenClients={onOpenClients}
        onOpenEmployees={onOpenEmployees}
      />

      {canManage && selectedFinanceIds.length > 0 ? (
        <div className='mb-3 grid w-full gap-2 rounded-lg border border-[#dce7ff] bg-[#edf3ff] px-3 py-2 text-[13px] font-semibold text-[#1f3565] sm:grid-cols-2 lg:flex lg:w-fit lg:items-center'>
          <span>Выделено: {selectedFinanceIds.length}</span>
          <button
            type='button'
            className='inline-flex h-8 items-center gap-1.5 rounded-md border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#1f3565] transition-colors hover:bg-[#f8fbff]'
            onClick={onDuplicateSelected}
          >
            <svg
              className='size-4 fill-none stroke-current stroke-[1.8]'
              viewBox='0 0 24 24'
            >
              <rect x='8' y='8' width='10' height='10' rx='2' />
              <path d='M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
            </svg>
            Дублировать
          </button>
          <button
            type='button'
            className='inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50'
            onClick={onDeleteSelected}
          >
            <svg
              className='size-4 fill-none stroke-current stroke-[1.8]'
              viewBox='0 0 24 24'
            >
              <path d='M3 6h18' />
              <path d='M8 6V4h8v2' />
              <path d='M19 6l-1 14H6L5 6' />
            </svg>
            Удалить
          </button>
        </div>
      ) : null}

      <FinancesTable
        finances={finances}
        plannedExpenses={showPlannedExpenses ? plannedExpenses : []}
        isLoading={isLoading}
        isLoadingPlannedExpenses={showPlannedExpenses && isLoadingPlannedExpenses}
        canManage={canManage}
        selectedFinanceIds={selectedFinanceIds}
        onSelectedFinanceIdsChange={onSelectedFinanceIdsChange}
        onEditFinance={onEditFinance}
        onDeleteFinance={onDeleteFinance}
      />

      <FinancePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
