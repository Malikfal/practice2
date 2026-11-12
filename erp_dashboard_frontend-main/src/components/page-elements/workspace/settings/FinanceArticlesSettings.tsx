import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import ConfirmDialog from '../../../modals/ConfirmDialog';
import FinanceArticleModal, {
  type FinanceArticleForm,
} from '../../../modals/FinanceArticleModal';
import Button from '../../../ui/Button';
import type {
  FinanceArticle,
  FinanceDistributionMethod,
  FinanceType,
  Project,
} from '../../../../types/app';

type Props = {
  canManage: boolean;
  embedded?: boolean;
  initialType?: FinanceType;
  onArticlesChange?: (_articles: FinanceArticle[]) => void;
};

type ArticleModalState = {
  article: FinanceArticle | null;
  defaultType: FinanceType;
  defaultParentId?: string | null;
};

const financeTypeTabs: Array<{ type: FinanceType; label: string }> = [
  { type: 'ENTRANCE', label: 'Поступления' },
  { type: 'EXPENDITURE', label: 'Расходы' },
];

const distributionMethodLabels: Record<FinanceDistributionMethod, string> = {
  PROPORTIONAL_TO_EXPENSES: 'Пропорционально расходам',
  BY_TERM: 'По сроку',
  BY_VOLUME: 'По объему',
};

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function ArticleTreeRows({
  articles,
  depth = 0,
  canManage,
  onOpenArticle,
  onDeleteArticle,
}: {
  articles: FinanceArticle[];
  depth?: number;
  canManage: boolean;
  onOpenArticle: (
    _article: FinanceArticle | null,
    _type?: FinanceType,
    _parentId?: string | null,
  ) => void;
  onDeleteArticle: (_article: FinanceArticle) => void;
}) {
  return (
    <>
      {articles.map((article) => (
        <div key={article.id} className='grid gap-2'>
          <div
            className='flex flex-col gap-2 [padding-left:var(--mobile-indent)] md:flex-row md:items-center md:[padding-left:var(--desktop-indent)]'
            style={
              {
                '--mobile-indent': `${Math.min(depth * 12, 24)}px`,
                '--desktop-indent': `${depth * 20}px`,
              } as CSSProperties
            }
          >
            <button
              type='button'
              className='min-h-11 w-full min-w-0 flex-1 rounded-lg border border-transparent bg-[#f1f4f9] px-3 py-2 text-left text-sm font-medium text-[#1f3565] transition-colors hover:border-[#dce7ff] hover:bg-white md:min-h-0'
              onClick={() => {
                if (canManage) onOpenArticle(article);
              }}
            >
              <span className='flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3'>
                <span className='max-w-full break-words sm:truncate'>{article.name}</span>
                <span className='flex max-w-full flex-wrap justify-start gap-1 sm:shrink-0 sm:justify-end'>
                  {article.type === 'EXPENDITURE' ? (
                    <span className='shrink-0 rounded-md border border-[#dce7ff] bg-white px-2 py-1 text-[10px] font-medium text-[#7082a8]'>
                      {article.distribution_method_label ??
                        distributionMethodLabels[article.distribution_method]}
                    </span>
                  ) : null}
                  <span className='shrink-0 rounded-md border border-[#dce7ff] bg-white px-2 py-1 text-[10px] font-medium text-[#7082a8]'>
                    {article.default_distribution_period_label ?? 'Текущий день'}
                  </span>
                  <span className='shrink-0 rounded-md border border-[#dce7ff] bg-white px-2 py-1 text-[10px] font-medium text-[#7082a8]'>
                    {article.default_distribution_project_mode === 'SELECTED'
                      ? `Проектов: ${article.default_distribution_project_ids.length}`
                      : 'Все проекты'}
                  </span>
                </span>
              </span>
            </button>
            {canManage ? (
              <div className='flex w-full items-center justify-end gap-1 rounded-lg border border-[#edf2fb] bg-white p-1 md:w-auto md:border-0 md:bg-transparent md:p-0'>
                <button
                  type='button'
                  className='grid size-10 place-items-center rounded-md text-[#7e8fb4] transition-colors hover:bg-[#edf3ff] hover:text-[#2d6ff7] md:size-8'
                  aria-label='Добавить дочернюю статью'
                  title='Добавить дочернюю статью'
                  onClick={() => onOpenArticle(null, article.type, article.id)}
                >
                  <svg
                    className='size-4 fill-none stroke-current stroke-[1.8]'
                    viewBox='0 0 24 24'
                  >
                    <path d='M12 5v14' />
                    <path d='M5 12h14' />
                  </svg>
                </button>
                <button
                  type='button'
                  className='grid size-10 place-items-center rounded-md text-[#7e8fb4] transition-colors hover:bg-[#edf3ff] hover:text-[#2d6ff7] md:size-8'
                  aria-label='Редактировать статью'
                  title='Редактировать'
                  onClick={() => onOpenArticle(article)}
                >
                  <svg
                    className='size-4 fill-none stroke-current stroke-[1.8]'
                    viewBox='0 0 24 24'
                  >
                    <path d='M12 20h9' />
                    <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' />
                  </svg>
                </button>
                <button
                  type='button'
                  className='grid size-10 place-items-center rounded-md text-[#7e8fb4] transition-colors hover:bg-rose-50 hover:text-rose-600 md:size-8'
                  aria-label='Удалить статью'
                  title='Удалить'
                  onClick={() => onDeleteArticle(article)}
                >
                  <svg
                    className='size-4 fill-none stroke-current stroke-[1.8]'
                    viewBox='0 0 24 24'
                  >
                    <path d='M3 6h18' />
                    <path d='M8 6V4h8v2' />
                    <path d='M19 6l-1 14H6L5 6' />
                  </svg>
                </button>
              </div>
            ) : null}
          </div>
          {article.children?.length ? (
            <ArticleTreeRows
              articles={article.children}
              depth={depth + 1}
              canManage={canManage}
              onOpenArticle={onOpenArticle}
              onDeleteArticle={onDeleteArticle}
            />
          ) : null}
        </div>
      ))}
    </>
  );
}

export default function FinanceArticlesSettings({
  canManage,
  embedded = false,
  initialType = 'ENTRANCE',
  onArticlesChange,
}: Props) {
  const [articles, setArticles] = useState<FinanceArticle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeType, setActiveType] = useState<FinanceType>(initialType);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modal, setModal] = useState<ArticleModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceArticle | null>(null);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  const loadArticles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.workspace.financeArticles.getMany();
      setArticles(response);
      onArticlesChange?.(response);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [handleError, onArticlesChange]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    api.workspace.projects
      .getMany({ status: 'all', per_page: 1000 })
      .then((response) => setProjects(response.data ?? []))
      .catch(handleError);
  }, [handleError]);

  const activeArticles = useMemo(
    () => articles.filter((article) => article.type === activeType),
    [activeType, articles],
  );

  const openArticleModal = (
    article: FinanceArticle | null,
    type = activeType,
    parentId: string | null = null,
  ) => {
    setModal({
      article,
      defaultType: article?.type ?? type,
      defaultParentId: parentId,
    });
  };

  const saveArticle = async (form: FinanceArticleForm) => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Введите название статьи.');
      return;
    }

    if (
      form.default_distribution_project_mode === 'SELECTED' &&
      form.default_distribution_project_ids.length === 0
    ) {
      toast.error('Выберите хотя бы один проект для распределения.');
      return;
    }

    try {
      setIsSaving(true);
      if (modal?.article) {
        await api.workspace.financeArticles.update(modal.article.id, {
          name,
          type: form.type,
          parent_id: form.parent_id,
          distribution_method:
            form.type === 'EXPENDITURE' ? form.distribution_method : 'BY_TERM',
          default_distribution_period: form.default_distribution_period,
          default_distribution_project_mode: form.default_distribution_project_mode,
          default_distribution_project_ids: form.default_distribution_project_ids,
        });
      } else {
        await api.workspace.financeArticles.create({
          name,
          type: form.type,
          parent_id: form.parent_id,
          distribution_method:
            form.type === 'EXPENDITURE' ? form.distribution_method : 'BY_TERM',
          default_distribution_period: form.default_distribution_period,
          default_distribution_project_mode: form.default_distribution_project_mode,
          default_distribution_project_ids: form.default_distribution_project_ids,
        });
      }

      toast.success(modal?.article ? 'Статья обновлена.' : 'Статья добавлена.');
      setModal(null);
      setActiveType(form.type);
      await loadArticles();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteArticle = async () => {
    if (!deleteTarget) return;

    try {
      setIsSaving(true);
      await api.workspace.financeArticles.delete(deleteTarget.id);
      toast.success('Статья удалена.');
      setDeleteTarget(null);
      await loadArticles();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <section
        className={joinClassNames(
          'flex min-h-0 flex-col bg-white text-[#1f3565]',
          embedded
            ? 'overflow-visible lg:h-full lg:overflow-hidden'
            : 'h-full overflow-hidden rounded-xl border border-[#e3e9f3] p-4',
        )}
      >
        {!embedded ? (
          <h1 className='mb-6 text-[24px] leading-none font-semibold text-[#10275a]'>
            Финансы - Настройки - Статьи
          </h1>
        ) : null}

        <div className='mb-4'>
          {!embedded ? (
            <h2 className='mb-4 text-[15px] font-semibold text-[#10275a]'>
              Настройка статей
            </h2>
          ) : null}
          <div className='grid grid-cols-2 border-b border-[#e3e9f3] sm:flex'>
            {financeTypeTabs.map((tab) => (
              <button
                key={tab.type}
                type='button'
                className={joinClassNames(
                  'min-h-11 border-b-2 px-3 py-2 text-sm font-semibold transition-colors sm:min-h-0 sm:px-4',
                  activeType === tab.type
                    ? tab.type === 'ENTRANCE'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-rose-500 text-rose-600'
                    : 'border-transparent text-[#7e8fb4] hover:text-[#1f3565]',
                )}
                onClick={() => setActiveType(tab.type)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={joinClassNames(
            'min-h-0 flex-1 rounded-xl border border-[#edf2fb] bg-[#fbfcff] p-2 md:p-3',
            embedded ? 'overflow-visible lg:overflow-auto' : 'overflow-auto',
          )}
        >
          {isLoading ? (
            <div className='grid min-h-40 place-items-center'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
            </div>
          ) : (
            <div className='mx-auto grid max-w-190 gap-2'>
              <ArticleTreeRows
                articles={activeArticles}
                canManage={canManage}
                onOpenArticle={openArticleModal}
                onDeleteArticle={setDeleteTarget}
              />

              {!activeArticles.length ? (
                <div className='rounded-lg border border-dashed border-[#c9d8f8] bg-white px-3 py-8 text-center text-sm text-[#7e8fb4]'>
                  Статьи не добавлены
                </div>
              ) : null}

              {canManage ? (
                <Button
                  type='button'
                  variant='secondary'
                  className='mt-3 min-h-11 border-[#1f3565] text-[#1f3565] hover:bg-[#f3f7ff] md:h-10 md:min-h-0'
                  onClick={() => void openArticleModal(null)}
                >
                  + Добавить статью
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {modal ? (
        <FinanceArticleModal
          key={modal.article?.id ?? `new-${modal.defaultType}`}
          article={modal.article}
          articles={articles}
          projects={projects}
          defaultType={modal.defaultType}
          defaultParentId={modal.defaultParentId}
          isSaving={isSaving}
          onClose={() => setModal(null)}
          onSubmit={saveArticle}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title='Удалить статью?'
        message={
          deleteTarget ? `Статья "${deleteTarget.name}" будет удалена безвозвратно.` : ''
        }
        confirmLabel='Удалить'
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteArticle}
      />
    </>
  );
}
