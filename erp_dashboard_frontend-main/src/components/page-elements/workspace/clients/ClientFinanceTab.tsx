import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type {
  Client,
  Finance,
  FinanceArticle,
  FinanceFilters,
  FinanceType,
  Project,
  User,
} from '../../../../types/app';
import { formatName } from '../../../../utils/formatters';
import ConfirmDialog from '../../../modals/ConfirmDialog';
import FinanceModal from '../../../modals/FinanceModal';
import Button from '../../../ui/Button';
import { useServerPagination } from '../../../ui/Pagination';
import { formatAnalyticsPeriod } from '../finance-analytics/financeAnalyticsUtils';
import FinanceBulkActions from '../finances/FinanceBulkActions';
import FinancePagination from '../finances/FinancePagination';
import FinanceSummaryStrip, {
  emptyFinanceSummary,
  type FinanceSummary,
} from '../finances/FinanceSummaryStrip';
import FinancesTable, { type FinanceTableGroupBy } from '../finances/FinancesTable';
import {
  currentMonthRange,
  emptyFinanceForm,
  financeFormToPayload,
  financeToForm,
  FINANCE_TYPE_LABELS,
  FINANCE_TYPE_NEW_TITLES,
  parseFinanceAmountInput,
} from '../finances/financeUtils';
import type { FinanceFilterState, FinanceForm } from '../finances/types';
import ProjectFinanceFilters from '../projects/ProjectFinanceFilters';
import FinanceArticlesSettings from '../settings/FinanceArticlesSettings';

function createFilters(clientId: string): FinanceFilterState {
  return {
    ...currentMonthRange(),
    amount_from: '',
    amount_to: '',
    type: '',
    sources: [],
    finance_article_ids: [],
    project_ids: [],
    client_ids: [clientId],
    employee_ids: [],
  };
}

function clientFiltersToApiParams(
  filters: FinanceFilterState,
  clientId: string,
): FinanceFilters {
  return {
    client_ids: [clientId],
    from: filters.from,
    to: filters.to,
    type: (filters.type || undefined) as FinanceType | undefined,
    sources: filters.sources,
    finance_article_ids: filters.finance_article_ids,
    project_ids: filters.project_ids,
    employee_ids: filters.employee_ids,
    amount_from: filters.amount_from
      ? Math.round(parseFinanceAmountInput(filters.amount_from) * 100)
      : undefined,
    amount_to: filters.amount_to
      ? Math.round(parseFinanceAmountInput(filters.amount_to) * 100)
      : undefined,
  };
}

function formatPeriod(filters: Pick<FinanceFilterState, 'from' | 'to'>): string {
  if (!filters.from && !filters.to) return 'За всё время';
  if (filters.from) return formatAnalyticsPeriod(filters.from, filters.to);
  return `Весь период до ${formatAnalyticsPeriod(filters.to, filters.to)}`;
}

export default function ClientFinanceTab({
  client,
  canManage,
}: {
  client: Client;
  canManage: boolean;
}) {
  const [form, setForm] = useState<FinanceForm | null>(null);
  const [editingFinanceId, setEditingFinanceId] = useState('');
  const [articles, setArticles] = useState<FinanceArticle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [articlesManagerType, setArticlesManagerType] = useState<FinanceType | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [groupBy, setGroupBy] = useState<FinanceTableGroupBy>('week');
  const [filters, setFilters] = useState<FinanceFilterState>(() =>
    createFilters(client.id),
  );
  const [finances, setFinances] = useState<Finance[]>([]);
  const [isLoadingFinances, setIsLoadingFinances] = useState(false);
  const [summary, setSummary] = useState<FinanceSummary>(emptyFinanceSummary);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Finance | null>(null);
  const [bulkAction, setBulkAction] = useState<'duplicate' | 'delete' | null>(null);
  const {
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    onPageSizeChange,
    applyMeta,
  } = useServerPagination(10);
  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({ value: employee.id, label: formatName(employee) })),
    [employees],
  );
  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );

  useEffect(() => {
    setFilters(createFilters(client.id));
    setCurrentPage(1);
    setSelectedIds([]);
  }, [client.id, setCurrentPage]);

  const loadOptions = useCallback(async () => {
    try {
      const [articleRows, projectResponse, employeeResponse] = await Promise.all([
        api.workspace.financeArticles.getMany(),
        api.workspace.projects.getMany({ status: 'all' }),
        api.workspace.employees.getMany({ status: 'active', per_page: 1000 }),
      ]);
      const clientProjectIds = new Set(
        (client.projects ?? []).map((project) => project.id),
      );
      setArticles(articleRows);
      setProjects(
        (projectResponse.data ?? []).filter((project) =>
          clientProjectIds.has(project.id),
        ),
      );
      setEmployees(employeeResponse.data ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить данные формы.',
      );
    }
  }, [client.projects]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const updateFilters = (next: Partial<FinanceFilterState>) => {
    setFilters((current) => ({ ...current, ...next }));
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const loadFinances = useCallback(async () => {
    try {
      setIsLoadingFinances(true);
      const response = await api.workspace.finances.getMany({
        ...clientFiltersToApiParams(filters, client.id),
        page: currentPage,
        per_page: pageSize,
      });
      const rows = response.data ?? [];
      setFinances(rows);
      setSelectedIds((current) =>
        current.filter((id) => rows.some((finance) => finance.id === id)),
      );
      applyMeta(response.meta);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить платежи.',
      );
    } finally {
      setIsLoadingFinances(false);
    }
  }, [applyMeta, client.id, currentPage, filters, pageSize]);

  useEffect(() => {
    void loadFinances();
  }, [loadFinances, refreshKey]);

  const loadSummary = useCallback(async () => {
    try {
      setIsLoadingSummary(true);
      const nextSummary = await api.workspace.finances.getSummary(
        clientFiltersToApiParams(filters, client.id),
      );
      setSummary(nextSummary ?? emptyFinanceSummary);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить финансовые итоги клиента.',
      );
    } finally {
      setIsLoadingSummary(false);
    }
  }, [client.id, filters]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, refreshKey]);

  const openCreateModal = async (type: FinanceType) => {
    setEditingFinanceId('');
    await loadOptions();
    setForm({ ...emptyFinanceForm(type), project_id: client.projects?.[0]?.id ?? '' });
  };

  const saveFinance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    const amount = parseFinanceAmountInput(form.amount);
    if (!form.dateOfPayment || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Заполните дату и положительную сумму.');
      return;
    }
    try {
      setIsSaving(true);
      if (editingFinanceId) {
        await api.workspace.finances.update(editingFinanceId, financeFormToPayload(form));
        toast.success('Платёж обновлён.');
      } else {
        await api.workspace.finances.create(financeFormToPayload(form));
        toast.success('Платеж добавлен.');
      }
      setForm(null);
      setEditingFinanceId('');
      setRefreshKey((current) => current + 1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить платеж.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteFinance = async () => {
    if (!deleteTarget) return;
    try {
      setIsSaving(true);
      await api.workspace.finances.delete(deleteTarget.id);
      toast.success('Платеж удален.');
      setDeleteTarget(null);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить платеж.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmBulkAction = async () => {
    if (!bulkAction) return;
    const selected = finances.filter((finance) => selectedIds.includes(finance.id));
    if (!selected.length) return;
    try {
      setIsSaving(true);
      if (bulkAction === 'delete') {
        await Promise.all(
          selected.map((finance) => api.workspace.finances.delete(finance.id)),
        );
        toast.success('Выбранные платежи удалены.');
      } else {
        await Promise.all(
          selected.map((finance) =>
            api.workspace.finances.create(financeFormToPayload(financeToForm(finance))),
          ),
        );
        toast.success('Выбранные платежи продублированы.');
      }
      setBulkAction(null);
      setSelectedIds([]);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось выполнить действие.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='grid gap-3'>
      <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 sm:p-4'>
        <div className='grid gap-3 xl:grid-cols-[minmax(320px,auto)_minmax(430px,1fr)_auto] xl:items-start'>
          <div className='grid gap-1'>
            <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
              <h3 className='text-[18px] font-semibold text-[#10275a]'>
                Платежи клиента
              </h3>
              <span className='text-sm font-medium text-[#6b7a99]'>
                {formatPeriod(filters)}
              </span>
            </div>
            <span className='text-xs text-[#7e8fb4]'>
              Фактическое движение денег с учётом выбранных фильтров
            </span>
          </div>
          <FinanceSummaryStrip
            summary={summary}
            isLoading={isLoadingSummary}
            className='xl:self-start'
          />
          <div className='flex flex-wrap items-end gap-2 xl:justify-end'>
            <div className='grid gap-1'>
              <span className='text-xs text-[#7e8fb4]'>Группировка</span>
              <div className='flex h-10 overflow-hidden rounded-lg border border-[#d3dcec] bg-white'>
                {(
                  [
                    { value: 'week', label: 'Недели' },
                    { value: 'month', label: 'Месяцы' },
                  ] as Array<{ value: FinanceTableGroupBy; label: string }>
                ).map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    className={`px-3 text-xs font-semibold transition-colors ${
                      groupBy === option.value
                        ? 'bg-[#2d6ff7] text-white'
                        : 'text-[#53617c] hover:bg-[#eef3fc]'
                    }`}
                    onClick={() => setGroupBy(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {canManage ? (
              <>
                <Button
                  type='button'
                  size='md'
                  className='h-10 rounded-xl border-transparent bg-emerald-500 text-white hover:bg-emerald-600'
                  onClick={() => void openCreateModal('ENTRANCE')}
                >
                  + Поступление
                </Button>
                <Button
                  type='button'
                  size='md'
                  variant='danger'
                  className='h-10 rounded-xl'
                  onClick={() => void openCreateModal('EXPENDITURE')}
                >
                  - Расход
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <ProjectFinanceFilters
          filters={filters}
          articles={articles}
          projectOptions={projectOptions}
          employeeOptions={employeeOptions}
          onChange={updateFilters}
        />
        {canManage ? (
          <FinanceBulkActions
            selectedCount={selectedIds.length}
            onDuplicate={() => setBulkAction('duplicate')}
            onDelete={() => setBulkAction('delete')}
          />
        ) : null}
        <FinancesTable
          density='compact'
          finances={finances}
          isLoading={isLoadingFinances}
          canManage={canManage}
          selectedFinanceIds={selectedIds}
          groupBy={groupBy}
          showTypeColumn
          onSelectedFinanceIdsChange={setSelectedIds}
          onEditFinance={(financeId, financeForm) => {
            setEditingFinanceId(financeId);
            setForm(financeForm);
            void loadOptions();
          }}
          onDeleteFinance={setDeleteTarget}
        />
        <FinancePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={onPageSizeChange}
        />
      </section>

      {form ? (
        <FinanceModal
          title={
            editingFinanceId ? 'Редактировать платеж' : FINANCE_TYPE_NEW_TITLES[form.type]
          }
          submitLabel={editingFinanceId ? 'Сохранить' : 'Добавить платеж'}
          isSaving={isSaving}
          form={form}
          articles={articles}
          projects={projects}
          employees={employees}
          onChange={setForm}
          onManageArticles={setArticlesManagerType}
          onClose={() => {
            setForm(null);
            setEditingFinanceId('');
          }}
          onSubmit={saveFinance}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title='Удалить платеж?'
        message='Платеж будет удален безвозвратно.'
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteFinance()}
      />
      <ConfirmDialog
        isOpen={Boolean(bulkAction)}
        isProcessing={isSaving}
        danger={bulkAction === 'delete'}
        title={
          bulkAction === 'delete' ? 'Удалить выбранные платежи?' : 'Дублировать платежи?'
        }
        message={
          bulkAction === 'delete'
            ? 'Выбранные платежи будут удалены безвозвратно.'
            : 'Будут созданы копии выбранных платежей.'
        }
        confirmLabel={bulkAction === 'delete' ? 'Удалить' : 'Дублировать'}
        processingLabel={bulkAction === 'delete' ? 'Удаление...' : 'Дублирование...'}
        onClose={() => setBulkAction(null)}
        onConfirm={() => void confirmBulkAction()}
      />

      {articlesManagerType ? (
        <div className='fixed inset-0 z-1100 grid place-items-center bg-slate-900/45 p-4 text-[#1f3565]'>
          <div className='flex max-h-[90vh] w-full max-w-220 flex-col overflow-hidden rounded-2xl border border-[#e3e9f3] bg-white p-4 shadow-2xl shadow-slate-900/25'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <h2 className='text-base font-semibold text-[#10275a]'>Настройка статей</h2>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => setArticlesManagerType(null)}
              >
                Закрыть
              </Button>
            </div>
            <FinanceArticlesSettings
              key={`client-finance-articles-${articlesManagerType}`}
              canManage={canManage}
              embedded
              initialType={articlesManagerType}
              onArticlesChange={setArticles}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
