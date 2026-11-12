import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type {
  FinanceArticle,
  FinanceSettings as FinanceSettingsData,
} from '../../../../types/app';
import Button from '../../../ui/Button';
import { Field, SearchableSelect } from '../../../ui/FormField';
import { clearEmployeePayrollSettingsCache } from '../employees/EmployeeDetailsPanel/components/payroll/payrollSettingsHooks';

type Props = {
  settings: FinanceSettingsData | null;
  canManage: boolean;
  onSaved: (_settings: FinanceSettingsData) => void;
};

function flattenArticles(
  articles: FinanceArticle[],
  path: string[] = [],
): Array<{ value: string; label: string; searchText: string }> {
  return articles.flatMap((article) => {
    const nextPath = [...path, article.name];
    const label = nextPath.join(' / ');
    const current = {
      value: article.id,
      label,
      searchText: `${article.name} ${label}`,
    };

    return [current, ...flattenArticles(article.children ?? [], nextPath)];
  });
}

// Статьи расходов для начисления зарплат и отсутствий, расчёт дневных начислений.
export default function SalaryArticleSettings({ settings, canManage, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [salaryArticles, setSalaryArticles] = useState<FinanceArticle[]>([]);
  const [draftArticleId, setDraftArticleId] = useState<string | null>(null);
  const [draftAbsenceArticleId, setDraftAbsenceArticleId] = useState<string | null>(null);
  const [draftCalculateDailyPayroll, setDraftCalculateDailyPayroll] = useState<
    boolean | null
  >(null);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  useEffect(() => {
    const loadSalaryArticles = async () => {
      try {
        setIsLoadingArticles(true);
        setSalaryArticles(
          await api.workspace.financeArticles.getMany({ type: 'EXPENDITURE' }),
        );
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoadingArticles(false);
      }
    };

    void loadSalaryArticles();
  }, [handleError]);

  const articleOptions = useMemo(() => flattenArticles(salaryArticles), [salaryArticles]);

  const currentArticleId = settings?.default_salary_finance_article_id ?? '';
  const effectiveDraftArticleId = draftArticleId ?? currentArticleId;
  const currentAbsenceArticleId =
    settings?.default_fixed_absence_finance_article_id ?? '';
  const effectiveDraftAbsenceArticleId = draftAbsenceArticleId ?? currentAbsenceArticleId;
  const currentCalculateDailyPayroll = settings?.calculate_daily_payroll ?? false;
  const effectiveCalculateDailyPayroll =
    draftCalculateDailyPayroll ?? currentCalculateDailyPayroll;
  const selectedArticle = useMemo(
    () =>
      articleOptions.find((option) => option.value === effectiveDraftArticleId) ?? null,
    [articleOptions, effectiveDraftArticleId],
  );
  let selectedArticleLabel = 'Не выбрана';
  if (effectiveDraftArticleId !== '') {
    selectedArticleLabel =
      selectedArticle?.label ??
      settings?.default_salary_finance_article?.name ??
      'Не выбрана';
  }
  const selectedAbsenceArticle = useMemo(
    () =>
      articleOptions.find((option) => option.value === effectiveDraftAbsenceArticleId) ??
      null,
    [articleOptions, effectiveDraftAbsenceArticleId],
  );
  let selectedAbsenceArticleLabel = 'Не выбрана';
  if (effectiveDraftAbsenceArticleId !== '') {
    selectedAbsenceArticleLabel =
      selectedAbsenceArticle?.label ??
      settings?.default_fixed_absence_finance_article?.name ??
      'Не выбрана';
  }
  const isDirty =
    effectiveDraftArticleId !== currentArticleId ||
    effectiveDraftAbsenceArticleId !== currentAbsenceArticleId ||
    effectiveCalculateDailyPayroll !== currentCalculateDailyPayroll;
  const hasSalaryArticle = effectiveDraftArticleId !== '';
  // Без статьи дневные начисления создавались бы без статьи, поэтому включить галку нельзя.
  // Уже включённую можно только выключить.
  const isDailyPayrollLocked = !hasSalaryArticle && !effectiveCalculateDailyPayroll;
  let statusText = 'Есть несохранённые изменения. После сохранения они применятся сразу.';
  if (!isDirty) {
    statusText = currentArticleId
      ? 'Настройки сохранены.'
      : 'Статья не выбрана: начисления оплаты труда будут без статьи.';
  }

  const saveSalarySettings = async () => {
    try {
      setIsSaving(true);
      const response = await api.workspace.settings.updateFinance({
        default_salary_finance_article_id: effectiveDraftArticleId || null,
        default_fixed_absence_finance_article_id: effectiveDraftAbsenceArticleId || null,
        calculate_daily_payroll: effectiveCalculateDailyPayroll,
      });
      setDraftArticleId(null);
      setDraftAbsenceArticleId(null);
      setDraftCalculateDailyPayroll(null);
      // Карточки сотрудников кешируют статью компании по умолчанию.
      clearEmployeePayrollSettingsCache();
      onSaved(response);
      toast.success('Настройки оплаты труда сохранены.');
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className='grid gap-4 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:p-4'>
      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)]'>
        <div className='grid gap-4'>
          <div className='grid gap-1'>
            <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
              Статья для автоматического начисления зарплат
            </h2>
            <p className='text-[13px] leading-6 text-[#7082a8]'>
              Выберите статью расходов, которая будет подставляться по умолчанию при
              оформлении зарплатных начислений.
            </p>
          </div>

          <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-end'>
            <Field label='Статья расходов' className='text-[#1f3565]'>
              <SearchableSelect
                value={effectiveDraftArticleId}
                onValueChange={(nextValue) => {
                  if (nextValue !== '') {
                    setDraftArticleId(nextValue);
                  }
                }}
                options={articleOptions}
                placeholder='Найдите и выберите статью'
                isLoading={isLoadingArticles}
                className='h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] disabled:bg-[#f7f9fc] md:h-10 md:text-[14px]'
              />
            </Field>

            <Button
              type='button'
              variant='secondary'
              className='h-11 w-full rounded-xl border-[#dce7ff] text-[#1f3565] hover:bg-[#f3f7ff] md:h-10 md:w-auto'
              disabled={!canManage || isSaving || !hasSalaryArticle}
              onClick={() => setDraftArticleId('')}
            >
              Сбросить выбор
            </Button>
          </div>

          <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-end'>
            <Field
              label='Статья фиксированных оплачиваемых отсутствий'
              className='text-[#1f3565]'
            >
              <SearchableSelect
                value={effectiveDraftAbsenceArticleId}
                onValueChange={setDraftAbsenceArticleId}
                options={articleOptions}
                placeholder='Найдите и выберите статью'
                isLoading={isLoadingArticles}
                className='h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] disabled:bg-[#f7f9fc] md:h-10 md:text-[14px]'
              />
            </Field>

            <Button
              type='button'
              variant='secondary'
              className='h-11 w-full rounded-xl border-[#dce7ff] text-[#1f3565] hover:bg-[#f3f7ff] md:h-10 md:w-auto'
              disabled={!canManage || isSaving || effectiveDraftAbsenceArticleId === ''}
              onClick={() => setDraftAbsenceArticleId('')}
            >
              Сбросить выбор
            </Button>
          </div>

          <label
            className={`flex items-center justify-between gap-4 rounded-xl border border-[#dce7ff] bg-white px-4 py-3 ${
              isDailyPayrollLocked ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <span>
              <span
                className={`block text-[14px] font-semibold ${
                  isDailyPayrollLocked ? 'text-[#7e8fb4]' : 'text-[#10275a]'
                }`}
              >
                Рассчитывать дневные расходы
              </span>
              <span className='mt-1 block text-[12px] leading-5 text-[#7e8fb4]'>
                Создавать ежедневные начисления оплаты труда.
              </span>
              {!hasSalaryArticle ? (
                <span
                  id='daily-payroll-article-hint'
                  className='mt-1 block text-[12px] leading-5 text-amber-700'
                >
                  {effectiveCalculateDailyPayroll
                    ? 'Статья для автоматического начисления зарплат не выбрана: дневные начисления будут без статьи. Выберите статью или выключите расчёт.'
                    : 'Чтобы включить, сначала выберите статью для автоматического начисления зарплат.'}
                </span>
              ) : null}
            </span>
            <input
              type='checkbox'
              className='size-5 shrink-0 accent-[#2d6ff7] disabled:cursor-not-allowed'
              checked={effectiveCalculateDailyPayroll}
              disabled={!canManage || isSaving || isDailyPayrollLocked}
              aria-describedby={
                !hasSalaryArticle ? 'daily-payroll-article-hint' : undefined
              }
              onChange={(event) => setDraftCalculateDailyPayroll(event.target.checked)}
            />
          </label>
        </div>

        <div className='grid gap-3'>
          <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
            Выбор
          </h2>

          <div className='rounded-xl border border-[#dce7ff] bg-white px-4 py-4'>
            <span className='mb-1 block text-[12px] font-semibold text-[#7e8fb4] uppercase tracking-[0.14em]'>
              Выбранная статья
            </span>
            <p className='text-[14px] leading-6 text-[#10275a]'>{selectedArticleLabel}</p>
          </div>

          <div className='rounded-xl border border-[#dce7ff] bg-white px-4 py-4'>
            <span className='mb-1 block text-[12px] font-semibold text-[#7e8fb4] uppercase tracking-[0.14em]'>
              Статья отсутствий
            </span>
            <p className='text-[14px] leading-6 text-[#10275a]'>
              {selectedAbsenceArticleLabel}
            </p>
          </div>

          <div className='rounded-lg border border-[#e3e9f3] bg-white px-3 py-3'>
            <p className='text-[13px] leading-5 text-[#5f7095]'>
              Для выбора доступны только статьи типа «Расходы», чтобы зарплатные
              начисления сразу попадали в корректную финансовую категорию.
            </p>
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-3 border-t border-[#e8eef8] pt-4 md:flex-row md:items-center md:justify-between'>
        <p
          className={`text-[13px] leading-5 ${
            !isDirty && !currentArticleId ? 'text-amber-700' : 'text-[#7e8fb4]'
          }`}
        >
          {statusText}
        </p>
        <Button
          type='button'
          variant='primary'
          size='sm'
          className='h-11 w-full rounded-xl px-4 text-[13px] md:h-10 md:w-auto'
          disabled={!canManage || isSaving || !isDirty}
          onClick={() => void saveSalarySettings()}
        >
          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
        </Button>
      </div>
    </section>
  );
}
