import { useRef, useState, type FormEvent } from 'react';

import type {
  FinanceArticle,
  FinanceDistributionMethod,
  FinanceDistributionProjectMode,
  FinanceDistributionPeriod,
  FinanceType,
  Project,
} from '../../types/app';
import Button from '../ui/Button';
import { Field, Input, MultiSelect, SearchableSelect, Select } from '../ui/FormField';

export type FinanceArticleForm = {
  name: string;
  type: FinanceType;
  parent_id: string | null;
  distribution_method: FinanceDistributionMethod;
  default_distribution_period: FinanceDistributionPeriod;
  default_distribution_project_mode: FinanceDistributionProjectMode;
  default_distribution_project_ids: string[];
};

type Props = {
  article: FinanceArticle | null;
  articles: FinanceArticle[];
  projects: Project[];
  defaultType: FinanceType;
  defaultParentId?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (_form: FinanceArticleForm) => void;
};

const distributionMethodDescriptions: Record<FinanceDistributionMethod, string> = {
  PROPORTIONAL_TO_EXPENSES:
    'Сумма распределяется пропорционально фактическим расходам внутри периода.',
  BY_TERM: 'Сумма равномерно распределяется по календарным дням внутри периода.',
  BY_VOLUME: 'Сумма распределяется пропорционально часам по проекту внутри периода.',
};

function getParentOptions(
  articles: FinanceArticle[],
  type: FinanceType,
  excludedIds: Set<string>,
  depth = 0,
): Array<{ value: string; label: string }> {
  return articles.flatMap((article) => {
    if (article.type !== type || excludedIds.has(article.id)) {
      return getParentOptions(article.children ?? [], type, excludedIds, depth + 1);
    }

    return [
      {
        value: article.id,
        label: `${'  '.repeat(depth)}${article.name}`,
      },
      ...getParentOptions(article.children ?? [], type, excludedIds, depth + 1),
    ];
  });
}

function getCopyOptions(
  articles: FinanceArticle[],
  depth = 0,
): Array<{ article: FinanceArticle; label: string }> {
  return articles.flatMap((item) => [
    {
      article: item,
      label: `${'— '.repeat(depth)}${item.name}`,
    },
    ...getCopyOptions(item.children ?? [], depth + 1),
  ]);
}

export default function FinanceArticleModal({
  article,
  articles,
  projects,
  defaultType,
  defaultParentId = null,
  isSaving,
  onClose,
  onSubmit,
}: Props) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [isCopyPickerOpen, setIsCopyPickerOpen] = useState(false);
  const [form, setForm] = useState<FinanceArticleForm>({
    name: article?.name ?? '',
    type: article?.type ?? defaultType,
    parent_id: article?.parent_id ?? defaultParentId,
    distribution_method: article?.distribution_method ?? 'BY_TERM',
    default_distribution_period: article?.default_distribution_period ?? 'CURRENT_DAY',
    default_distribution_project_mode:
      article?.default_distribution_project_mode ?? 'ALL',
    default_distribution_project_ids: article?.default_distribution_project_ids ?? [],
  });

  const excludedIds = new Set([article?.id].filter(Boolean) as string[]);
  const collectDescendants = (items: FinanceArticle[]) => {
    for (const item of items) {
      excludedIds.add(item.id);
      collectDescendants(item.children ?? []);
    }
  };
  collectDescendants(article?.children ?? []);

  const parentOptions = getParentOptions(articles, form.type, excludedIds);
  const hasInvalidProjectDistribution =
    form.default_distribution_project_mode === 'SELECTED' &&
    form.default_distribution_project_ids.length === 0;
  const copyOptions = getCopyOptions(articles);

  const copyFromArticle = (sourceId: string) => {
    const source = copyOptions.find((option) => option.article.id === sourceId)?.article;
    if (!source) return;

    setForm({
      name: source.name,
      type: source.type,
      parent_id: source.parent_id,
      distribution_method: source.distribution_method,
      default_distribution_period: source.default_distribution_period,
      default_distribution_project_mode: source.default_distribution_project_mode,
      default_distribution_project_ids: [...source.default_distribution_project_ids],
    });
    setIsCopyPickerOpen(false);
  };

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
            {article ? 'Редактировать статью' : 'Новая статья'}
          </h2>
          <div className='flex shrink-0 items-center gap-2'>
            {!article ? (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={isSaving || copyOptions.length === 0}
                onClick={() => setIsCopyPickerOpen((current) => !current)}
              >
                Копировать из
              </Button>
            ) : null}
            <Button type='button' variant='secondary' size='sm' onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>

        <form className='grid gap-3' onSubmit={submit}>
          {!article && isCopyPickerOpen ? (
            <section className='grid gap-2 rounded-xl border border-[#c9d8f8] bg-[#f8fbff] p-3'>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-semibold text-[#10275a]'>
                  Выберите статью для копирования
                </span>
                <button
                  type='button'
                  className='text-xs font-medium text-[#7082a8] hover:text-[#2d6ff7]'
                  onClick={() => setIsCopyPickerOpen(false)}
                >
                  Скрыть
                </button>
              </div>
              <SearchableSelect
                value=''
                onValueChange={copyFromArticle}
                options={copyOptions.map(({ article: source, label }) => ({
                  value: source.id,
                  label,
                  searchText: `${source.name} ${source.type === 'EXPENDITURE' ? 'Расход' : 'Поступление'}`,
                }))}
                placeholder='Найдите и выберите статью'
              />
              <p className='text-xs leading-5 text-[#7082a8]'>
                Все настройки выбранной статьи будут перенесены в форму. Перед сохранением
                их можно изменить.
              </p>
            </section>
          ) : null}
          <div className='grid gap-3 md:grid-cols-2'>
            <Field label='Название статьи *'>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder='Введите название'
                required
              />
            </Field>

            <Field label='Тип *'>
              <Select
                value={form.type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    type: event.target.value as FinanceType,
                    parent_id: null,
                    distribution_method:
                      event.target.value === 'EXPENDITURE'
                        ? form.distribution_method
                        : 'BY_TERM',
                  })
                }
              >
                <option value='ENTRANCE'>Поступление</option>
                <option value='EXPENDITURE'>Расход</option>
              </Select>
            </Field>
          </div>

          <Field label='Родительская статья'>
            <Select
              value={form.parent_id ?? ''}
              onChange={(event) =>
                setForm({ ...form, parent_id: event.target.value || null })
              }
            >
              <option value=''>Без родителя</option>
              {parentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          {form.type === 'EXPENDITURE' ? (
            <Field
              label={
                <span className='flex items-center gap-1.5'>
                  Способ распределения
                  <span
                    className='grid size-4 cursor-help place-items-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500'
                    title={distributionMethodDescriptions[form.distribution_method]}
                    aria-label={distributionMethodDescriptions[form.distribution_method]}
                  >
                    ?
                  </span>
                </span>
              }
            >
              <Select
                value={form.distribution_method}
                title={distributionMethodDescriptions[form.distribution_method]}
                onChange={(event) =>
                  setForm({
                    ...form,
                    distribution_method: event.target.value as FinanceDistributionMethod,
                  })
                }
              >
                <option value='PROPORTIONAL_TO_EXPENSES'>Пропорционально расходам</option>
                <option value='BY_TERM'>По сроку</option>
                <option value='BY_VOLUME'>По объему</option>
              </Select>
            </Field>
          ) : null}

          <Field label='Дефолтный диапазон распределения для аналитики'>
            <Select
              value={form.default_distribution_period}
              onChange={(event) =>
                setForm({
                  ...form,
                  default_distribution_period: event.target
                    .value as FinanceDistributionPeriod,
                })
              }
            >
              <option value='CURRENT_DAY'>Текущий день</option>
              <option value='WEEK'>Неделя</option>
              <option value='TWO_WEEKS'>Две недели</option>
              <option value='MONTH'>Месяц</option>
              <option value='QUARTER'>Квартал</option>
              <option value='HALF_YEAR'>Полгода</option>
              <option value='CURRENT_YEAR'>Текущий год</option>
              <option value='PREVIOUS_YEAR'>Прошлый год</option>
            </Select>
          </Field>

          <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#f8fbff] p-3'>
            <Field label='Проекты для распределения по умолчанию'>
              <Select
                value={form.default_distribution_project_mode}
                onChange={(event) => {
                  const mode = event.target.value as FinanceDistributionProjectMode;
                  setForm({
                    ...form,
                    default_distribution_project_mode: mode,
                    default_distribution_project_ids:
                      mode === 'ALL' ? [] : form.default_distribution_project_ids,
                  });
                }}
              >
                <option value='ALL'>Все проекты</option>
                <option value='SELECTED'>Выбранные проекты</option>
              </Select>
            </Field>

            {form.default_distribution_project_mode === 'SELECTED' ? (
              <Field label='Выберите проекты *'>
                <MultiSelect
                  values={form.default_distribution_project_ids}
                  onValuesChange={(values) =>
                    setForm({ ...form, default_distribution_project_ids: values })
                  }
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  searchable
                  placeholder='Выберите проекты'
                  emptyText='Нет доступных проектов'
                />
              </Field>
            ) : (
              <p className='text-xs leading-5 text-[#7082a8]'>
                В распределении участвуют все доступные проекты, включая добавленные
                позже.
              </p>
            )}
          </section>

          <div className='mt-2 grid gap-2 sm:flex sm:justify-end'>
            <Button
              type='button'
              variant='secondary'
              disabled={isSaving}
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              type='submit'
              disabled={isSaving || hasInvalidProjectDistribution}
              variant={
                isSaving || hasInvalidProjectDistribution ? 'secondary' : 'primary'
              }
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
