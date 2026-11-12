import { useRef, type FormEvent } from 'react';
import { useTariffAccess } from '../../hooks/useTariffAccess';
import type { FinanceArticle, Project, User, FinanceType } from '../../types/app';
import { formatName } from '../../utils/formatters';
import Button from '../ui/Button';
import DateRangeFields from '../ui/DateRangeFields';
import { HintToolTip } from '../ui/HintTooltip';
import {
  Field,
  Input,
  MultiSelect,
  SearchableSelect,
  Select,
  Textarea,
} from '../ui/FormField';
import FinanceArticleTreeSelect from './FinanceArticleTreeSelect';
import type { FinanceForm } from '../page-elements/workspace/finances/types';
import { financeDistributionRange } from '../page-elements/workspace/finances/financeUtils';

function findArticle(
  articles: FinanceArticle[],
  articleId: string,
): FinanceArticle | null {
  for (const article of articles) {
    if (article.id === articleId) return article;

    const child = findArticle(article.children ?? [], articleId);
    if (child) return child;
  }

  return null;
}

type Props = {
  title: string;
  submitLabel: string;
  isSaving: boolean;
  form: FinanceForm;
  articles: FinanceArticle[];
  projects: Project[];
  employees: User[];
  onChange: (_form: FinanceForm) => void;
  onManageArticles?: (_type: FinanceType) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
};

export default function FinanceModal({
  title,
  submitLabel,
  isSaving,
  form,
  articles,
  projects,
  employees,
  onChange,
  onManageArticles,
  onClose,
  onSubmit,
}: Props) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  // Диапазон и способ распределения нужны только аналитике, а на ФРИ она закрыта.
  // Даты распределения при этом идут по умолчанию от даты платежа и статьи.
  const showAnalyticsRange = !useTariffAccess().isFeatureLocked('finance_analytics');
  const filteredArticles = articles.filter((article) => article.type === form.type);
  const hasInvalidProjectDistribution =
    form.distribution_project_mode === 'SELECTED' &&
    form.distribution_project_ids.length === 0;
  const distributionRange = (paymentDate: string, articleId: string) =>
    financeDistributionRange(
      paymentDate,
      findArticle(filteredArticles, articleId)?.default_distribution_period ??
        'CURRENT_DAY',
    );

  const selectProject = (projectId: string) => {
    const nextForm = { ...form, project_id: projectId };
    const articleId =
      nextForm.type === 'ENTRANCE'
        ? projects.find((project) => project.id === projectId)
            ?.default_entrance_finance_article_id
        : null;
    if (!articleId) {
      onChange(nextForm);
      return;
    }
    const article = findArticle(filteredArticles, articleId);
    const projectMode = article?.default_distribution_project_mode ?? 'ALL';
    const range = distributionRange(nextForm.dateOfPayment, articleId);
    onChange({
      ...nextForm,
      finance_article_id: articleId,
      distribution_from: range.from,
      distribution_to: range.to,
      distribution_method: article?.distribution_method ?? 'BY_TERM',
      distribution_project_mode: projectMode,
      distribution_project_ids:
        projectMode === 'SELECTED'
          ? (article?.default_distribution_project_ids ?? [])
          : [],
    });
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
        className='max-h-[calc(100dvh-1rem)] w-full max-w-180 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:max-h-[90vh] md:overflow-auto md:rounded-2xl md:p-4'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-base font-semibold text-[#10275a]'>{title}</h2>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <form onSubmit={onSubmit} className='grid gap-3'>
          <div className='grid gap-3 md:grid-cols-2'>
            <Field label='Тип *'>
              <Select
                value={form.type}
                onChange={(event) => {
                  const range = financeDistributionRange(
                    form.dateOfPayment,
                    'CURRENT_DAY',
                  );
                  onChange({
                    ...form,
                    type: event.target.value as FinanceType,
                    finance_article_id: '',
                    distribution_from: range.from,
                    distribution_to: range.to,
                    distribution_method: 'BY_TERM',
                    distribution_project_mode: 'ALL',
                    distribution_project_ids: [],
                  });
                }}
              >
                <option value='ENTRANCE'>Поступление</option>
                <option value='EXPENDITURE'>Расход</option>
              </Select>
            </Field>

            <Field label='Дата платежа *'>
              <Input
                type='date'
                value={form.dateOfPayment}
                onChange={(event) => {
                  const dateOfPayment = event.target.value;
                  const range = distributionRange(dateOfPayment, form.finance_article_id);
                  onChange({
                    ...form,
                    dateOfPayment,
                    distribution_from: range.from,
                    distribution_to: range.to,
                  });
                }}
                required
              />
            </Field>
          </div>

          <div className='grid gap-3 md:grid-cols-2'>
            <Field label='Сумма, руб. *'>
              <Input
                type='text'
                inputMode='decimal'
                value={form.amount}
                onChange={(event) => onChange({ ...form, amount: event.target.value })}
                placeholder='0,00'
                required
              />
            </Field>

            <div className='grid gap-1.5'>
              <span className='inline-flex items-center gap-1.5 text-[13px] leading-tight font-medium text-slate-700'>
                Статья
                <HintToolTip content='При выборе проекта по умолчанию подставляется статья поступления, выбранная для него в разделе «Финансы → Настройки → Свод по ставкам». Статью в этом платеже можно изменить.' />
              </span>
              <div className='grid grid-cols-[minmax(0,1fr)_44px] gap-2'>
                <FinanceArticleTreeSelect
                  value={form.finance_article_id}
                  articles={filteredArticles}
                  onValueChange={(value) => {
                    const range = distributionRange(form.dateOfPayment, value);
                    const article = findArticle(filteredArticles, value);
                    const projectMode =
                      article?.default_distribution_project_mode ?? 'ALL';
                    onChange({
                      ...form,
                      finance_article_id: value,
                      distribution_from: range.from,
                      distribution_to: range.to,
                      distribution_method: article?.distribution_method ?? 'BY_TERM',
                      distribution_project_mode: projectMode,
                      distribution_project_ids:
                        projectMode === 'SELECTED'
                          ? (article?.default_distribution_project_ids ?? [])
                          : [],
                    });
                  }}
                  placeholder='Выберите статью'
                />
                {onManageArticles ? (
                  <button
                    type='button'
                    className='grid h-11 w-11 place-items-center rounded-lg border border-[#c9d8f8] bg-white text-[#2d6ff7] transition-colors hover:bg-[#edf3ff]'
                    title='Настроить статьи'
                    onClick={() => onManageArticles(form.type)}
                  >
                    <svg
                      className='size-4 fill-none stroke-current stroke-[1.8]'
                      viewBox='0 0 24 24'
                    >
                      <path d='M12 5v14' />
                      <path d='M5 12h14' />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className='grid gap-3 md:grid-cols-2'>
            <Field label='Проект'>
              <SearchableSelect
                value={form.project_id || '__none__'}
                onValueChange={(value) => {
                  if (!value) return;
                  selectProject(value === '__none__' ? '' : value);
                }}
                options={[
                  {
                    value: '__none__',
                    label: 'Без проекта',
                    searchText: 'сбросить проект',
                  },
                  ...projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                    searchText: project.client?.name,
                  })),
                ]}
                placeholder='Выберите проект'
              />
            </Field>

            <Field label='Участник'>
              <SearchableSelect
                value={form.employee_id}
                onValueChange={(value) => onChange({ ...form, employee_id: value })}
                options={employees.map((employee) => ({
                  value: employee.id,
                  label: formatName(employee),
                  searchText: employee.email,
                }))}
                placeholder='Выберите участника'
              />
            </Field>
          </div>

          <Field label='Комментарий'>
            <Textarea
              value={form.comment}
              onChange={(event) => onChange({ ...form, comment: event.target.value })}
              placeholder='Комментарий к платежу'
            />
          </Field>

          <section className='grid gap-4 rounded-xl border border-[#e3e9f3] bg-[#f8fbff] p-3'>
            {showAnalyticsRange ? (
              <div className='grid gap-3'>
                <h3 className='text-sm font-semibold text-[#10275a]'>
                  Диапазон распределения для аналитики
                </h3>
                <DateRangeFields
                  from={form.distribution_from}
                  to={form.distribution_to}
                  fromLabel='Дата начала распределения'
                  toLabel='Дата окончания распределения'
                  required
                  onChange={(distribution_from, distribution_to) =>
                    onChange({ ...form, distribution_from, distribution_to })
                  }
                />

                <Field label='Способ распределения *'>
                  <Select
                    value={form.distribution_method}
                    onChange={(event) =>
                      onChange({
                        ...form,
                        distribution_method: event.target
                          .value as FinanceForm['distribution_method'],
                      })
                    }
                    required
                  >
                    <option value='BY_TERM'>По сроку</option>
                    <option value='PROPORTIONAL_TO_EXPENSES'>
                      Пропорционально расходам
                    </option>
                    <option value='BY_VOLUME'>По объёму</option>
                  </Select>
                </Field>
              </div>
            ) : null}

            <div
              className={
                showAnalyticsRange
                  ? 'grid gap-3 border-t border-[#e3e9f3] pt-4'
                  : 'grid gap-3'
              }
            >
              <h3 className='text-sm font-semibold text-[#10275a]'>
                Проекты для распределения
              </h3>
              <Field label='Режим распределения по проектам'>
                <Select
                  value={form.distribution_project_mode ?? 'LEGACY'}
                  onChange={(event) => {
                    const mode = event.target.value as 'ALL' | 'SELECTED' | 'LEGACY';
                    onChange({
                      ...form,
                      distribution_project_mode: mode === 'LEGACY' ? null : mode,
                      distribution_project_ids:
                        mode !== 'SELECTED' ? [] : form.distribution_project_ids,
                    });
                  }}
                >
                  {form.distribution_project_mode === null ? (
                    <option value='LEGACY'>Не распределять (старый платеж)</option>
                  ) : null}
                  <option value='ALL'>Все проекты</option>
                  <option value='SELECTED'>Выбранные проекты</option>
                </Select>
              </Field>

              {form.distribution_project_mode === 'SELECTED' ? (
                <Field label='Выберите проекты *'>
                  <MultiSelect
                    values={form.distribution_project_ids}
                    onValuesChange={(values) =>
                      onChange({ ...form, distribution_project_ids: values })
                    }
                    options={projects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    }))}
                    searchable
                    placeholder='Выберите проекты'
                    emptyText='Нет доступных проектов'
                  />
                  {form.distribution_project_ids.length === 0 ? (
                    <span className='text-xs text-rose-600'>
                      Выберите хотя бы один проект.
                    </span>
                  ) : null}
                </Field>
              ) : (
                <p className='text-xs leading-5 text-[#7082a8]'>
                  Новые проекты будут автоматически участвовать в распределении.
                </p>
              )}
              <p className='text-xs leading-5 text-[#7082a8]'>
                Если выше выбран один проект, платеж относится напрямую к нему, а эта
                настройка не применяется.
              </p>
            </div>
          </section>

          <div className='mt-2 grid grid-cols-2 gap-2 sm:flex sm:justify-end'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Отмена
            </Button>
            <Button
              type='submit'
              disabled={isSaving || hasInvalidProjectDistribution}
              variant={
                isSaving || hasInvalidProjectDistribution ? 'secondary' : 'primary'
              }
            >
              {isSaving ? 'Сохранение...' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
