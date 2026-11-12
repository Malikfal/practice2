import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../api/api';
import KnowledgeBaseDetailsPanel from '../../components/page-elements/workspace/knowledge-base/KnowledgeBaseDetailsPanel';
import KnowledgeBaseListPanel, {
  type KnowledgeBaseFolderScope,
} from '../../components/page-elements/workspace/knowledge-base/KnowledgeBaseListPanel';
import KnowledgeBaseAccessDialog from '../../components/page-elements/workspace/knowledge-base/modals/KnowledgeBaseAccessDialog';
import KnowledgeBaseConfirmDialog, {
  type KnowledgeBaseConfirmDialogState,
} from '../../components/page-elements/workspace/knowledge-base/modals/KnowledgeBaseConfirmDialog';
import KnowledgeBaseFolderDialog, {
  type KnowledgeBaseFolderDialogState,
} from '../../components/page-elements/workspace/knowledge-base/modals/KnowledgeBaseFolderDialog';
import KnowledgeBaseTextInputDialog, {
  type KnowledgeBaseTextInputDialogState,
} from '../../components/page-elements/workspace/knowledge-base/modals/KnowledgeBaseTextInputDialog';
import {
  canDeleteKnowledgeBase,
  canEditKnowledgeBase,
  createFormFromArticle,
  emptyArticleForm,
  isKnowledgeBaseContentEmpty,
  resolveKnowledgeBaseAssetUrl,
} from '../../components/page-elements/workspace/knowledge-base/knowledgeBaseShared';
import { useAppControllerContext } from '../../context/AppControllerContext';
import type {
  KnowledgeBaseArticle,
  KnowledgeBaseArticleForm,
  KnowledgeBaseFolder,
  RoleOption,
  User,
} from '../../types/app';

const FALLBACK_ROLE_OPTIONS: RoleOption[] = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'WORKER', label: 'Сотрудник' },
];

function isAbortError(err: unknown) {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'AbortError';
  }

  return err instanceof Error && err.name === 'AbortError';
}

function articleMatchesScope(
  article: KnowledgeBaseArticle,
  scope: KnowledgeBaseFolderScope,
) {
  if (scope === 'all') return true;
  if (scope === 'unfiled') return !article.folder_id;

  return article.folder_id === scope;
}

function getArticleFolderIdForNewDraft(scope: KnowledgeBaseFolderScope) {
  if (scope === 'all' || scope === 'unfiled') return null;

  return scope;
}

function buildKnowledgeBaseUrl(scope: KnowledgeBaseFolderScope, articleId = '') {
  const params = new URLSearchParams();

  if (scope !== 'all') {
    params.set('folder', scope);
  }

  if (articleId) {
    params.set('article_id', articleId);
  }

  const query = params.toString();
  return query ? `/knowledge-base?${query}` : '/knowledge-base';
}

export default function KnowledgeBasePage() {
  const { user } = useAppControllerContext();
  const navigate = useNavigate();
  const canEdit = canEditKnowledgeBase(user?.permissions);
  const canDelete = canDeleteKnowledgeBase(user?.permissions);
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [folders, setFolders] = useState<KnowledgeBaseFolder[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>(FALLBACK_ROLE_OPTIONS);
  const [areAccessDictionariesLoaded, setAreAccessDictionariesLoaded] = useState(false);
  const [isLoadingAccessDictionaries, setIsLoadingAccessDictionaries] = useState(false);
  const [selectedFolderScope, setSelectedFolderScope] =
    useState<KnowledgeBaseFolderScope>('all');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [folderDialog, setFolderDialog] = useState<KnowledgeBaseFolderDialogState | null>(
    null,
  );
  const [accessFolder, setAccessFolder] = useState<KnowledgeBaseFolder | null>(null);
  const [accessArticle, setAccessArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [confirmDialog, setConfirmDialog] =
    useState<KnowledgeBaseConfirmDialogState | null>(null);
  const [textInputDialog, setTextInputDialog] =
    useState<KnowledgeBaseTextInputDialogState | null>(null);
  const saveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraftAbortRef = useRef<AbortController | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMobileArticleOpen, setIsMobileArticleOpen] = useState(false);
  const [articleForm, setArticleForm] =
    useState<KnowledgeBaseArticleForm>(emptyArticleForm);

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) ?? null,
    [articles, selectedArticleId],
  );

  const searchedArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return articles.filter((article) => {
      if (!query) return true;

      return [
        article.title,
        article.content,
        article.folder?.name,
        article.author?.name,
        article.author?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [articles, searchQuery]);

  const refreshArticles = useCallback(async () => {
    const response = await api.workspace.knowledgeBase.getMany();
    const articleList = Array.isArray(response.data) ? response.data : [];
    setArticles(articleList);

    return articleList;
  }, []);

  const refreshFolders = useCallback(async () => {
    const folderList = await api.workspace.knowledgeBase.folders.getMany();
    setFolders(Array.isArray(folderList) ? folderList : []);

    return Array.isArray(folderList) ? folderList : [];
  }, []);

  const fetchKnowledgeBase = useCallback(async () => {
    try {
      setIsLoading(true);
      const [articleList, folderList] = await Promise.all([
        refreshArticles(),
        refreshFolders(),
      ]);
      const params =
        typeof window === 'undefined'
          ? new URLSearchParams()
          : new URLSearchParams(window.location.search);
      const requestedFolder = params.get('folder') ?? 'all';
      const requestedArticleId = params.get('article_id') ?? '';
      const nextScope =
        requestedFolder === 'unfiled' ||
        requestedFolder === 'all' ||
        folderList.some((folder) => folder.id === requestedFolder)
          ? requestedFolder
          : 'all';

      const scopedArticles = articleList.filter((article) =>
        articleMatchesScope(article, nextScope),
      );
      const hasRequestedArticle =
        Boolean(requestedArticleId) &&
        scopedArticles.some((article) => article.id === requestedArticleId);
      const nextArticleId = hasRequestedArticle
        ? requestedArticleId
        : (scopedArticles[0]?.id ?? '');

      setSelectedFolderScope(nextScope);
      setSelectedArticleId(nextArticleId);
      setIsMobileArticleOpen(hasRequestedArticle);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Не удалось загрузить базу знаний.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [refreshArticles, refreshFolders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchKnowledgeBase();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchKnowledgeBase]);

  const loadAccessDictionaries = useCallback(async () => {
    if (!canEdit || areAccessDictionariesLoaded || isLoadingAccessDictionaries) {
      return;
    }

    try {
      setIsLoadingAccessDictionaries(true);
      const [roles, employeeResponse] = await Promise.all([
        api.getRoleOptions(),
        api.workspace.employees.getMany({
          status: 'active',
          per_page: 1000,
        }),
      ]);
      setRoleOptions(
        Array.isArray(roles) && roles.length ? roles : FALLBACK_ROLE_OPTIONS,
      );
      setEmployees(Array.isArray(employeeResponse.data) ? employeeResponse.data : []);
      setAreAccessDictionariesLoaded(true);
    } catch {
      setRoleOptions(FALLBACK_ROLE_OPTIONS);
    } finally {
      setIsLoadingAccessDictionaries(false);
    }
  }, [areAccessDictionariesLoaded, canEdit, isLoadingAccessDictionaries]);

  useEffect(() => {
    if (!isEditing) {
      setArticleForm(createFormFromArticle(selectedArticle));
    }
  }, [isEditing, selectedArticle]);

  const selectFolderScope = (scope: KnowledgeBaseFolderScope) => {
    const scopedArticles = articles.filter((article) =>
      articleMatchesScope(article, scope),
    );
    const nextArticleId =
      selectedArticleId &&
      scopedArticles.some((article) => article.id === selectedArticleId)
        ? selectedArticleId
        : (scopedArticles[0]?.id ?? '');

    setSelectedFolderScope(scope);
    setSelectedArticleId(nextArticleId);
    setIsEditing(false);
    navigate(buildKnowledgeBaseUrl(scope, nextArticleId), { replace: true });
  };

  const selectArticle = (articleId: string) => {
    const article = articles.find((item) => item.id === articleId);
    const nextScope =
      selectedFolderScope === 'all' ? 'all' : (article?.folder_id ?? 'all');

    setSelectedArticleId(articleId);
    setSelectedFolderScope(nextScope);
    setIsEditing(false);
    setIsMobileArticleOpen(true);
    navigate(buildKnowledgeBaseUrl(nextScope, articleId), { replace: true });
  };

  const startEditing = () => {
    if (!selectedArticle || !canEdit) return;
    setArticleForm(createFormFromArticle(selectedArticle));
    setIsEditing(true);
  };

  const upsertArticle = useCallback((nextArticle: KnowledgeBaseArticle) => {
    setArticles((prev) => {
      const exists = prev.some((article) => article.id === nextArticle.id);
      if (!exists) return [nextArticle, ...prev];

      return prev.map((article) =>
        article.id === nextArticle.id ? nextArticle : article,
      );
    });
  }, []);

  const saveDraftChanges = useCallback(
    async (
      articleId: string,
      payload: KnowledgeBaseArticleForm,
      signal?: AbortSignal,
    ) => {
      const updatedArticle = await api.workspace.knowledgeBase.update(
        articleId,
        payload,
        { signal },
      );
      upsertArticle(updatedArticle);
      return updatedArticle;
    },
    [upsertArticle],
  );

  const startCreating = async (folderId?: string | null) => {
    if (!canEdit) return;

    const targetFolderId =
      folderId === undefined
        ? getArticleFolderIdForNewDraft(selectedFolderScope)
        : folderId;
    const targetScope = targetFolderId ?? selectedFolderScope;

    try {
      setIsCreatingDraft(true);
      const createdArticle = await api.workspace.knowledgeBase.create(targetFolderId);
      upsertArticle(createdArticle);
      setSelectedFolderScope(targetScope);
      setSelectedArticleId(createdArticle.id);
      setArticleForm(createFormFromArticle(createdArticle));
      setIsEditing(true);
      setIsMobileArticleOpen(true);
      navigate(buildKnowledgeBaseUrl(targetScope, createdArticle.id), {
        replace: true,
      });
      toast.success('Черновик создан.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать черновик.');
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const cancelEditing = () => {
    setArticleForm(createFormFromArticle(selectedArticle));
    setIsEditing(false);
  };

  useEffect(() => {
    if (saveDraftTimerRef.current) {
      clearTimeout(saveDraftTimerRef.current);
      saveDraftTimerRef.current = null;
    }
    saveDraftAbortRef.current?.abort();
    saveDraftAbortRef.current = null;

    if (!canEdit || !isEditing || !selectedArticle) return;

    const hasChanges =
      selectedArticle.folder_id !== articleForm.folder_id ||
      selectedArticle.title !== articleForm.title ||
      selectedArticle.content !== articleForm.content ||
      selectedArticle.is_archive !== articleForm.is_archive ||
      selectedArticle.is_pinned !== articleForm.is_pinned;

    if (!hasChanges) return;

    saveDraftTimerRef.current = setTimeout(() => {
      const abortController = new AbortController();
      saveDraftAbortRef.current = abortController;

      setIsSavingDraft(true);
      saveDraftChanges(selectedArticle.id, articleForm, abortController.signal)
        .catch((err) => {
          if (isAbortError(err)) return;

          toast.error(
            err instanceof Error ? err.message : 'Не удалось сохранить изменения.',
          );
        })
        .finally(() => {
          if (saveDraftAbortRef.current === abortController) {
            saveDraftAbortRef.current = null;
            setIsSavingDraft(false);
          }
        });
    }, 1000);

    return () => {
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
      saveDraftAbortRef.current?.abort();
      saveDraftAbortRef.current = null;
      setIsSavingDraft(false);
    };
  }, [articleForm, canEdit, isEditing, saveDraftChanges, selectedArticle]);

  const publishArticle = async (
    article: KnowledgeBaseArticle | null = selectedArticle,
  ) => {
    if (!canEdit || !article) return;

    const form =
      article.id === selectedArticle?.id ? articleForm : createFormFromArticle(article);

    if (!form.title.trim()) {
      toast.error('Укажите заголовок перед публикацией.');
      return;
    }

    if (isKnowledgeBaseContentEmpty(form.content)) {
      toast.error('Добавьте содержимое перед публикацией.');
      return;
    }

    try {
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
      saveDraftAbortRef.current?.abort();
      saveDraftAbortRef.current = null;
      setIsSavingDraft(true);
      await saveDraftChanges(article.id, form);
      const publishedArticle = await api.workspace.knowledgeBase.publish(article.id);
      upsertArticle(publishedArticle);
      setSelectedArticleId(publishedArticle.id);
      setIsEditing(false);
      toast.success('Статья опубликована.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось опубликовать статью.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const performDeleteArticle = async (
    article: KnowledgeBaseArticle | null = selectedArticle,
  ) => {
    if (!article || !canDelete) return;

    try {
      await api.workspace.knowledgeBase.delete(article.id);
      if (selectedArticleId === article.id) {
        setIsMobileArticleOpen(false);
      }
      setArticles((prev) => {
        const nextArticles = prev.filter((item) => item.id !== article.id);
        if (selectedArticleId === article.id) {
          const nextSelectedId =
            nextArticles.find((item) => articleMatchesScope(item, selectedFolderScope))
              ?.id ?? '';
          setSelectedArticleId(nextSelectedId);
          navigate(buildKnowledgeBaseUrl(selectedFolderScope, nextSelectedId), {
            replace: true,
          });
        }

        return nextArticles;
      });
      toast.success('Статья удалена.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить статью.');
    }
  };

  const deleteArticle = (article: KnowledgeBaseArticle | null = selectedArticle) => {
    if (!article || !canDelete) return;

    setConfirmDialog({
      title: 'Удаление статьи',
      message: `Удалить статью "${article.title}"?`,
      confirmLabel: 'Удалить',
      danger: true,
      onConfirm: () => void performDeleteArticle(article),
    });
  };

  const submitFolderDialog = async (name: string) => {
    if (!folderDialog || !canEdit) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Укажите название папки.');
      return;
    }

    try {
      if (folderDialog.mode === 'create') {
        await api.workspace.knowledgeBase.folders.create({
          name: trimmedName,
        });
        toast.success('Папка создана.');
      } else {
        await api.workspace.knowledgeBase.folders.update(folderDialog.folder.id, {
          name: trimmedName,
          is_archive: null,
        });
        toast.success('Папка переименована.');
      }

      setFolderDialog(null);
      await refreshFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить папку.');
    }
  };

  const toggleFolderArchive = async (folder: KnowledgeBaseFolder) => {
    if (!canEdit) return;

    try {
      await api.workspace.knowledgeBase.folders.update(folder.id, {
        name: null,
        is_archive: !folder.is_archive,
      });
      await refreshFolders();
      toast.success(folder.is_archive ? 'Папка разархивирована.' : 'Папка архивирована.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось обновить папку.');
    }
  };

  const performDeleteFolder = async (folder: KnowledgeBaseFolder) => {
    if (!canDelete) return;

    try {
      await api.workspace.knowledgeBase.folders.delete(folder.id);
      const [, articleList] = await Promise.all([refreshFolders(), refreshArticles()]);
      if (selectedFolderScope === folder.id) {
        setSelectedFolderScope('all');
        const nextSelectedId = articleList[0]?.id ?? '';
        setSelectedArticleId(nextSelectedId);
        navigate(buildKnowledgeBaseUrl('all', nextSelectedId), { replace: true });
      }
      toast.success('Папка удалена.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить папку.');
    }
  };

  const deleteFolder = (folder: KnowledgeBaseFolder) => {
    if (!canDelete) return;

    setConfirmDialog({
      title: 'Удаление папки',
      message: `Удалить папку "${folder.name}"? Все статьи внутри этой папки тоже будут удалены.`,
      confirmLabel: 'Удалить',
      danger: true,
      onConfirm: () => void performDeleteFolder(folder),
    });
  };

  const submitRenameArticle = async (article: KnowledgeBaseArticle, title: string) => {
    if (!canEdit) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Укажите название статьи.');
      return;
    }

    try {
      const updatedArticle = await api.workspace.knowledgeBase.update(article.id, {
        folder_id: article.folder_id ?? null,
        title: trimmedTitle,
        content: article.content,
        is_archive: article.is_archive,
        is_pinned: article.is_pinned,
      });
      upsertArticle(updatedArticle);
      toast.success('Статья переименована.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Не удалось переименовать статью.',
      );
    }
  };

  const renameArticle = (article: KnowledgeBaseArticle) => {
    if (!canEdit) return;

    setTextInputDialog({
      title: 'Переименование статьи',
      label: 'Название статьи',
      defaultValue: article.title,
      submitLabel: 'Сохранить',
      onSubmit: (title) => void submitRenameArticle(article, title),
    });
  };

  const moveArticle = async (
    article: KnowledgeBaseArticle,
    targetFolderId: string | null,
  ) => {
    if (!canEdit || article.folder_id === targetFolderId) return;

    const isSelectedArticle = article.id === selectedArticleId;
    const sourceForm =
      isSelectedArticle && isEditing ? articleForm : createFormFromArticle(article);
    const targetScope = targetFolderId ?? 'all';

    try {
      if (isSelectedArticle) {
        if (saveDraftTimerRef.current) {
          clearTimeout(saveDraftTimerRef.current);
          saveDraftTimerRef.current = null;
        }
        saveDraftAbortRef.current?.abort();
        saveDraftAbortRef.current = null;
        setIsSavingDraft(true);
      }

      const updatedArticle = await api.workspace.knowledgeBase.update(article.id, {
        ...sourceForm,
        folder_id: targetFolderId,
      });

      upsertArticle(updatedArticle);

      if (isSelectedArticle) {
        setArticleForm(createFormFromArticle(updatedArticle));

        if (selectedFolderScope !== 'all') {
          setSelectedFolderScope(targetScope);
          navigate(buildKnowledgeBaseUrl(targetScope, updatedArticle.id), {
            replace: true,
          });
        }
      }

      const targetFolderName =
        targetFolderId === null
          ? 'корень'
          : (folders.find((folder) => folder.id === targetFolderId)?.name ?? 'папку');
      toast.success(`Статья перенесена в "${targetFolderName}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось перенести статью.');
    } finally {
      if (isSelectedArticle) {
        setIsSavingDraft(false);
      }
    }
  };

  const saveFolderAccesses = async (payload: { roles: string[]; user_ids: string[] }) => {
    if (!accessFolder || !canEdit) return;

    try {
      await api.workspace.knowledgeBase.folders.updateAccesses(accessFolder.id, payload);
      setAccessFolder(null);
      await refreshFolders();
      toast.success('Доступы сохранены.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить доступы.');
    }
  };

  const openFolderAccessDialog = useCallback(
    async (folder: KnowledgeBaseFolder) => {
      if (!canEdit) return;

      setAccessFolder(folder);
      await loadAccessDictionaries();
    },
    [canEdit, loadAccessDictionaries],
  );

  const openArticleAccessDialog = useCallback(
    async (article: KnowledgeBaseArticle) => {
      if (!canEdit) return;

      setAccessArticle(article);
      await loadAccessDictionaries();
    },
    [canEdit, loadAccessDictionaries],
  );

  const saveArticleAccesses = async (payload: {
    roles: string[];
    user_ids: string[];
  }) => {
    if (!accessArticle || !canEdit) return;

    try {
      const updatedArticle = await api.workspace.knowledgeBase.updateAccesses(
        accessArticle.id,
        payload,
      );
      upsertArticle(updatedArticle);
      setAccessArticle(null);
      toast.success('Доступы сохранены.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить доступы.');
    }
  };

  const importArticleImage = async (url: string) => {
    if (!selectedArticle?.id) {
      throw new Error('Сначала создайте черновик статьи.');
    }

    const response = await api.workspace.knowledgeBase.importImage(
      selectedArticle.id,
      url,
    );
    return resolveKnowledgeBaseAssetUrl(response.url);
  };

  const uploadArticleImage = async (file: File) => {
    if (!selectedArticle?.id) {
      toast.error('Сначала создайте черновик статьи.');
      return null;
    }

    try {
      const response = await api.workspace.knowledgeBase.uploadImage(
        selectedArticle.id,
        file,
      );

      return resolveKnowledgeBaseAssetUrl(response.url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Не удалось загрузить изображение.',
      );
      return null;
    }
  };

  return (
    <>
      <div className='grid h-full min-h-0 gap-2 overflow-hidden lg:grid-cols-[310px_minmax(0,1fr)]'>
        <div
          className={`h-full min-h-0 ${
            isMobileArticleOpen || isEditing ? 'hidden lg:block' : 'block'
          }`}
        >
          <KnowledgeBaseListPanel
            articles={searchedArticles}
            articleCountSource={articles}
            folders={folders}
            isLoading={isLoading}
            canEdit={canEdit}
            canDelete={canDelete}
            searchQuery={searchQuery}
            selectedFolderScope={selectedFolderScope}
            selectedArticleId={selectedArticleId}
            onSearchQueryChange={setSearchQuery}
            onSelectFolderScope={selectFolderScope}
            onSelectArticle={selectArticle}
            onCreateArticle={startCreating}
            onCreateFolder={() => setFolderDialog({ mode: 'create', folder: null })}
            onRenameFolder={(folder) => setFolderDialog({ mode: 'rename', folder })}
            onToggleFolderArchive={toggleFolderArchive}
            onDeleteFolder={deleteFolder}
            onManageFolderAccess={openFolderAccessDialog}
            onRenameArticle={renameArticle}
            onManageArticleAccess={openArticleAccessDialog}
            onMoveArticle={moveArticle}
            onPublishArticle={publishArticle}
            onDeleteArticle={deleteArticle}
            isCreatingDraft={isCreatingDraft}
          />
        </div>

        <div
          className={`h-full min-h-0 ${
            isMobileArticleOpen || isEditing ? 'block' : 'hidden lg:block'
          }`}
        >
          <KnowledgeBaseDetailsPanel
            article={selectedArticle}
            form={articleForm}
            folders={folders}
            isEditing={isEditing}
            canEdit={canEdit}
            canDelete={canDelete}
            onBackToList={
              isEditing
                ? undefined
                : () => {
                    setIsMobileArticleOpen(false);
                    navigate(buildKnowledgeBaseUrl(selectedFolderScope), {
                      replace: true,
                    });
                  }
            }
            onFormChange={setArticleForm}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={() => publishArticle()}
            onDelete={() => deleteArticle()}
            onUploadImage={uploadArticleImage}
            onImportImage={importArticleImage}
            isSavingDraft={isSavingDraft}
          />
        </div>
      </div>

      <KnowledgeBaseFolderDialog
        state={folderDialog}
        onClose={() => setFolderDialog(null)}
        onSubmit={submitFolderDialog}
      />
      <KnowledgeBaseAccessDialog
        key={accessFolder?.id ?? 'closed'}
        folder={accessFolder}
        employees={employees}
        roleOptions={roleOptions.length ? roleOptions : FALLBACK_ROLE_OPTIONS}
        onClose={() => setAccessFolder(null)}
        onSubmit={saveFolderAccesses}
      />
      <KnowledgeBaseAccessDialog
        key={accessArticle?.id ?? 'closed-article'}
        folder={null}
        article={accessArticle}
        employees={employees}
        roleOptions={roleOptions.length ? roleOptions : FALLBACK_ROLE_OPTIONS}
        onClose={() => setAccessArticle(null)}
        onSubmit={saveArticleAccesses}
      />
      <KnowledgeBaseConfirmDialog
        state={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
      <KnowledgeBaseTextInputDialog
        state={textInputDialog}
        onClose={() => setTextInputDialog(null)}
      />
    </>
  );
}
