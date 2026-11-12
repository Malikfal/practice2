import { useRef, useState, type FormEvent } from 'react';

import type { PlannedExpense, PlannedExpensePayload } from '../../types/app';
import Button from '../ui/Button';
import { Field, Input, MultiSelect, SearchableSelect, Select } from '../ui/FormField';

type Props = {
  plannedExpense: PlannedExpense | null;
  articleOptions: Array<{ value: string; label: string; searchText: string }>;
  incomeArticleOptions: Array<{ value: string; label: string }>;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (_payload: PlannedExpensePayload) => void;
};

export default function PlannedExpenseModal({
  plannedExpense,
  articleOptions,
  incomeArticleOptions,
  isSaving,
  onClose,
  onSubmit,
}: Props) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [form, setForm] = useState<PlannedExpensePayload>({
    finance_article_id: plannedExpense?.finance_article_id ?? '',
    formula: plannedExpense?.formula ?? 'PERCENT_OF_INCOME',
    percentage: plannedExpense?.percentage ?? 0,
    fixed_amount: plannedExpense?.fixed_amount ?? null,
    income_article_ids: plannedExpense?.income_article_ids ?? [],
    calculation_period: plannedExpense?.calculation_period ?? 'MONTH',
    is_active: plannedExpense?.is_active ?? true,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;
        if (shouldClose && !isSaving) onClose();
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-170 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:max-h-[90vh] md:overflow-auto md:rounded-2xl md:p-4'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-base font-semibold text-[#10275a]'>
            {plannedExpense
              ? 'Редактировать планируемый расход'
              : 'Новый планируемый расход'}
          </h2>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <form className='grid gap-4' onSubmit={submit}>
          <Field label='Статья расходов *'>
            <SearchableSelect
              value={form.finance_article_id}
              onValueChange={(financeArticleId) =>
                setForm((current) => ({
                  ...current,
                  finance_article_id: financeArticleId,
                }))
              }
              options={articleOptions}
              placeholder='Найдите и выберите статью'
              required
            />
          </Field>

          <Field label='Формула расчёта *'>
            <Select
              value={form.formula}
              onChange={(event) => {
                const formula = event.target.value as PlannedExpensePayload['formula'];
                setForm((current) => ({
                  ...current,
                  formula,
                  percentage:
                    formula === 'PERCENT_OF_INCOME' ? (current.percentage ?? 0) : null,
                  fixed_amount: formula === 'FIXED_AMOUNT' ? current.fixed_amount : null,
                }));
              }}
              required
            >
              <option value='PERCENT_OF_INCOME'>Процент от доходов</option>
              <option value='FIXED_AMOUNT'>Фиксированная сумма</option>
            </Select>
          </Field>

          {form.formula === 'PERCENT_OF_INCOME' ? (
            <>
              <Field label='Процент *'>
                <div className='relative'>
                  <Input
                    type='number'
                    inputMode='decimal'
                    min='0.0001'
                    max='100'
                    step='0.0001'
                    value={form.percentage ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        percentage: Number(event.target.value),
                      }))
                    }
                    className='pr-10'
                    placeholder='6'
                    required
                  />
                  <span className='pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500'>
                    %
                  </span>
                </div>
              </Field>

              <Field label='Статьи поступлений'>
                <MultiSelect
                  values={form.income_article_ids}
                  onValuesChange={(incomeArticleIds) =>
                    setForm((current) => ({
                      ...current,
                      income_article_ids: incomeArticleIds,
                    }))
                  }
                  options={incomeArticleOptions}
                  placeholder='Все статьи поступлений'
                  emptyText='Нет статей поступлений'
                  searchPlaceholder='Найти статью...'
                  searchable
                />
                <p className='mt-1.5 text-xs text-[#7082a8]'>
                  Если ничего не выбрано, процент считается от всех поступлений.
                </p>
              </Field>
            </>
          ) : (
            <Field label='Сумма, руб. *'>
              <Input
                type='number'
                inputMode='decimal'
                min='0.01'
                step='0.01'
                value={form.fixed_amount === null ? '' : form.fixed_amount / 100}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fixed_amount: event.target.value
                      ? Math.round(Number(event.target.value) * 100)
                      : null,
                  }))
                }
                placeholder='60 000'
                required
              />
            </Field>
          )}

          <Field label='Период расчёта *'>
            <Select
              value={form.calculation_period}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  calculation_period: event.target
                    .value as PlannedExpensePayload['calculation_period'],
                }))
              }
              required
            >
              <option value='MONTH'>Месяц</option>
              <option value='QUARTER'>Квартал</option>
              <option value='HALF_YEAR'>Полгода</option>
              <option value='YEAR'>Год</option>
            </Select>
          </Field>

          <div className='rounded-xl border border-[#dce7fb] bg-[#f6f9ff] px-4 py-3 text-sm text-[#52688f]'>
            {form.formula === 'PERCENT_OF_INCOME' ? (
              <>
                Пример: при доходе 1 000 000 ₽ планируемый расход составит{' '}
                <strong className='text-[#1f3565]'>
                  {new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                    maximumFractionDigits: 2,
                  }).format((1_000_000 * (form.percentage ?? 0)) / 100)}
                </strong>
                .
              </>
            ) : (
              <>
                За каждый выбранный период будет запланировано{' '}
                <strong className='text-[#1f3565]'>
                  {new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                    maximumFractionDigits: 2,
                  }).format((form.fixed_amount ?? 0) / 100)}
                </strong>
                .
              </>
            )}
          </div>

          <label className='flex items-center gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-4 py-3 text-sm font-medium text-[#1f3565]'>
            <input
              type='checkbox'
              checked={form.is_active}
              onChange={(event) =>
                setForm((current) => ({ ...current, is_active: event.target.checked }))
              }
              className='size-4 accent-[#2d6ff7]'
            />
            Планируемый расход активен
          </label>

          <div className='mt-2 grid gap-2 sm:flex sm:justify-end'>
            <Button
              type='button'
              variant='secondary'
              disabled={isSaving}
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
