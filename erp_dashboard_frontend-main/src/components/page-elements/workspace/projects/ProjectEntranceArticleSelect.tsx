import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { FinanceArticle, Project } from '../../../../types/app';
import { SearchableSelect } from '../../../ui/FormField';

function flattenArticles(
  articles: FinanceArticle[],
  path: string[] = [],
): Array<{ value: string; label: string; searchText: string }> {
  return articles.flatMap((article) => {
    if (article.type !== 'ENTRANCE') return [];
    const nextPath = [...path, article.name];
    const label = nextPath.join(' / ');
    return [
      { value: article.id, label, searchText: label },
      ...flattenArticles(article.children ?? [], nextPath),
    ];
  });
}

export default function ProjectEntranceArticleSelect({
  project,
  articles,
  disabled = false,
  onSaved,
}: {
  project: Project;
  articles: FinanceArticle[];
  disabled?: boolean;
  onSaved: (_articleId: string | null) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const options = useMemo(
    () => [
      {
        value: '__none__',
        label: 'Без статьи (сбросить выбор)',
        searchText: 'сбросить очистить',
      },
      ...flattenArticles(
        articles.filter(
          (article) =>
            !project.company_id ||
            !article.company_id ||
            article.company_id === project.company_id,
        ),
      ),
    ],
    [articles, project.company_id],
  );
  const selectedId = project.default_entrance_finance_article_id;

  return (
    <SearchableSelect
      value={selectedId ?? ''}
      onValueChange={async (value) => {
        if (!value) return;
        const articleId = value === '__none__' ? null : value;
        if (articleId === (selectedId ?? null)) return;
        try {
          setIsSaving(true);
          const response = await api.workspace.projects.updateDefaultEntranceArticle(
            project.id,
            articleId,
          );
          onSaved(response.default_entrance_finance_article_id);
          toast.success('Статья поступления проекта сохранена.');
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Не удалось сохранить статью.',
          );
        } finally {
          setIsSaving(false);
        }
      }}
      options={options}
      placeholder='Выберите статью'
      disabled={disabled || isSaving}
      className='h-10 w-full min-w-0 max-w-full truncate rounded-lg border-[#c9d8f8] bg-white pr-9 text-[13px] text-[#1f3565]'
    />
  );
}

export function ProjectEntranceArticleField({
  project,
  disabled,
}: {
  project: Project;
  disabled?: boolean;
}) {
  const [savedValue, setSavedValue] = useState<{
    projectId: string;
    articleId: string | null;
  } | null>(null);
  const [articles, setArticles] = useState<FinanceArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.workspace.financeArticles
      .getMany({ type: 'ENTRANCE' })
      .then((nextArticles) => {
        if (!cancelled) {
          setArticles(nextArticles);
        }
      })
      .catch((error) => {
        if (!cancelled)
          toast.error(
            error instanceof Error ? error.message : 'Не удалось загрузить статью.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const currentProject =
    savedValue?.projectId === project.id
      ? { ...project, default_entrance_finance_article_id: savedValue.articleId }
      : project;

  return (
    <ProjectEntranceArticleSelect
      project={currentProject}
      articles={articles}
      disabled={disabled}
      onSaved={(articleId) => setSavedValue({ projectId: project.id, articleId })}
    />
  );
}
