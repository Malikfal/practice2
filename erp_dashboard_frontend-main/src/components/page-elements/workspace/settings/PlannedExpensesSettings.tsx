import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type {
  FinanceArticle,
  PlannedExpense,
  PlannedExpensePayload,
} from '../../../../types/app';
import ConfirmDialog from '../../../modals/ConfirmDialog';
import PlannedExpenseModal from '../../../modals/PlannedExpenseModal';
import Button from '../../../ui/Button';

type Props = {
  canManage: boolean;
};

function flattenArticles(
  articles: FinanceArticle[],
  path: string[] = [],
): Array<{ value: string; label: string; searchText: string }> {
  return articles.flatMap((article) => {
    const nextPath = [...path, article.name];
    const label = nextPath.join(' / ');

    return [
      { value: article.id, label, searchText: `${article.name} ${label}` },
      ...flattenArticles(article.children ?? [], nextPath),
    ];
  });
}

function formatPercentage(value: number | null) {
  if (value === null) return 'Не задан';

  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(value);
}

function formatAmount(value: number | null) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0) / 100);
}

function formatIncomeBasis(articleIds: string[], labels: Map<string, string>) {
  if (articleIds.length === 0) return 'всех поступлений';

  const names = articleIds.map((articleId) => labels.get(articleId)).filter(Boolean);

  return names.length > 0 ? names.join(', ') : 'выбранных поступлений';
}

export default function PlannedExpensesSettings({ canManage }: Props) {
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  const [articles, setArticles] = useState<FinanceArticle[]>([]);
  const [incomeArticles, setIncomeArticles] = useState<FinanceArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PlannedExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlannedExpense | null>(null);

  const handleError = useCallback((error: unknown) => {
    toast.error(error instanceof Error ? error.message : 'Произошла ошибка.');
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [expenseRows, expenseArticles, entranceArticles] = await Promise.all([
        api.workspace.plannedExpenses.getMany(),
        api.workspace.financeArticles.getMany({ type: 'EXPENDITURE' }),
        api.workspace.financeArticles.getMany({ type: 'ENTRANCE' }),
      ]);
      setPlannedExpenses(expenseRows);
      setArticles(expenseArticles);
      setIncomeArticles(entranceArticles);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const articleOptions = useMemo(() => flattenArticles(articles), [articles]);
  const incomeArticleOptions = useMemo(
    () => flattenArticles(incomeArticles),
    [incomeArticles],
  );
  const incomeArticleLabels = useMemo(
    () => new Map(incomeArticleOptions.map((option) => [option.value, option.label])),
    [incomeArticleOptions],
  );

  const openModal = (plannedExpense: PlannedExpense | null) => {
    setEditingExpense(plannedExpense);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const savePlannedExpense = async (payload: PlannedExpensePayload) => {
    if (
      !payload.finance_article_id ||
      !payload.formula ||
      (payload.formula === 'PERCENT_OF_INCOME' &&
        ((payload.percentage ?? 0) <= 0 || (payload.percentage ?? 0) > 100)) ||
      (payload.formula === 'FIXED_AMOUNT' && (payload.fixed_amount ?? 0) <= 0) ||
      !payload.calculation_period
    ) {
      toast.error('Заполните статью, сумму или процент и период расчёта.');
      return;
    }

    try {
      setIsSaving(true);
      if (editingExpense) {
        await api.workspace.plannedExpenses.update(editingExpense.id, payload);
        toast.success('Планируемый расход обновлён.');
      } else {
        await api.workspace.plannedExpenses.create(payload);
        toast.success('Планируемый расход добавлен.');
      }
      setIsModalOpen(false);
      setEditingExpense(null);
      await loadData();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (plannedExpense: PlannedExpense) => {
    try {
      setIsSaving(true);
      await api.workspace.plannedExpenses.update(plannedExpense.id, {
        finance_article_id: plannedExpense.finance_article_id,
        formula: plannedExpense.formula,
        percentage: plannedExpense.percentage,
        fixed_amount: plannedExpense.fixed_amount,
        income_article_ids: plannedExpense.income_article_ids,
        calculation_period: plannedExpense.calculation_period,
        is_active: !plannedExpense.is_active,
      });
      await loadData();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlannedExpense = async () => {
    if (!deleteTarget) return;

    try {
      setIsSaving(true);
      await api.workspace.plannedExpenses.delete(deleteTarget.id);
      toast.success('Планируемый расход удалён.');
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <section className='grid gap-4'>
        <div className='flex flex-col gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:flex-row md:items-center md:justify-between md:p-4'>
          <div className='grid gap-1'>
            <h2 className='text-[18px] font-semibold text-[#10275a] md:text-[20px]'>
              Планируемые расходы
            </h2>
            <p className='text-[13px] leading-5 text-[#7082a8]'>
              Создавайте правила будущих расходов и временно отключайте их без удаления.
            </p>
          </div>
          {canManage ? (
            <Button
              type='button'
              size='sm'
              className='w-full md:w-auto'
              onClick={() => openModal(null)}
            >
              Добавить расход
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className='grid min-h-52 place-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff]'>
            <div className='h-7 w-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          </div>
        ) : plannedExpenses.length === 0 ? (
          <div className='rounded-xl border border-dashed border-[#c9d8f8] bg-[#fbfcff] px-4 py-12 text-center text-sm text-[#7e8fb4]'>
            Планируемые расходы ещё не добавлены.
          </div>
        ) : (
          <div className='grid gap-3'>
            {plannedExpenses.map((plannedExpense) => (
              <article
                key={plannedExpense.id}
                className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 md:p-4 lg:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1.4fr)_minmax(150px,0.7fr)_auto] lg:items-center lg:gap-4'
              >
                <div className='grid gap-1'>
                  <span className='text-[11px] font-semibold tracking-[0.12em] text-[#7e8fb4] uppercase'>
                    Статья
                  </span>
                  <span className='text-sm font-semibold text-[#10275a]'>
                    {plannedExpense.article?.name ?? 'Без статьи'}
                  </span>
                </div>
                <div className='grid gap-1'>
                  <span className='text-[11px] font-semibold tracking-[0.12em] text-[#7e8fb4] uppercase'>
                    Формула
                  </span>
                  <span className='whitespace-pre-wrap text-sm text-[#1f3565]'>
                    {plannedExpense.formula === 'FIXED_AMOUNT'
                      ? formatAmount(plannedExpense.fixed_amount)
                      : `${formatPercentage(plannedExpense.percentage)}% от ${formatIncomeBasis(
                          plannedExpense.income_article_ids,
                          incomeArticleLabels,
                        )}`}
                  </span>
                </div>
                <div className='grid gap-1'>
                  <span className='text-[11px] font-semibold tracking-[0.12em] text-[#7e8fb4] uppercase'>
                    Период
                  </span>
                  <span className='text-sm text-[#1f3565]'>
                    {plannedExpense.calculation_period_label}
                  </span>
                </div>
                <div className='grid grid-cols-2 items-center gap-2 lg:flex lg:flex-wrap lg:justify-end'>
                  <button
                    type='button'
                    disabled={!canManage || isSaving}
                    onClick={() => void toggleActive(plannedExpense)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      plannedExpense.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    {plannedExpense.is_active ? 'Активен' : 'Выключен'}
                  </button>
                  {canManage ? (
                    <>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        disabled={isSaving}
                        onClick={() => openModal(plannedExpense)}
                      >
                        Изменить
                      </Button>
                      <Button
                        type='button'
                        variant='danger'
                        size='sm'
                        disabled={isSaving}
                        onClick={() => setDeleteTarget(plannedExpense)}
                      >
                        Удалить
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isModalOpen ? (
        <PlannedExpenseModal
          key={editingExpense?.id ?? 'new-planned-expense'}
          plannedExpense={editingExpense}
          articleOptions={articleOptions}
          incomeArticleOptions={incomeArticleOptions}
          isSaving={isSaving}
          onClose={closeModal}
          onSubmit={(payload) => void savePlannedExpense(payload)}
        />
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        isProcessing={isSaving}
        title='Удалить планируемый расход?'
        message='Правило будет удалено без возможности восстановления.'
        onClose={() => {
          if (!isSaving) setDeleteTarget(null);
        }}
        onConfirm={() => void deletePlannedExpense()}
      />
    </>
  );
}
