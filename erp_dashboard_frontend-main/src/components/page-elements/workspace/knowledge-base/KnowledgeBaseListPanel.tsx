import { useEffect, useMemo, useState } from 'react';

import Button from '../../../ui/Button';
import type { KnowledgeBaseArticle, KnowledgeBaseFolder } from '../../../../types/app';
import KnowledgeBaseContextMenu, {
  type KnowledgeBaseContextMenuState,
} from './list/KnowledgeBaseContextMenu';
import SvgIcon from './list/KnowledgeBaseExplorerIcon';
import { getArticleStatusLabel } from './knowledgeBaseShared';
import PinIcon from './PinIcon';

export type KnowledgeBaseFolderScope = 'all' | 'unfiled' | string;

type Props = {
  articles: KnowledgeBaseArticle[];
  articleCountSource: KnowledgeBaseArticle[];
  folders: KnowledgeBaseFolder[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  searchQuery: string;
  selectedFolderScope: KnowledgeBaseFolderScope;
  selectedArticleId: string;
  isCreatingDraft: boolean;
  onSearchQueryChange: (_value: string) => void;
  onSelectFolderScope: (_scope: KnowledgeBaseFolderScope) => void;
  onSelectArticle: (_articleId: string) => void;
  onCreateArticle: (_folderId?: string | null) => void;
  onCreateFolder: () => void;
  onRenameFolder: (_folder: KnowledgeBaseFolder) => void;
  onToggleFolderArchive: (_folder: KnowledgeBaseFolder) => void;
  onDeleteFolder: (_folder: KnowledgeBaseFolder) => void;
  onManageFolderAccess: (_folder: KnowledgeBaseFolder) => void;
  onRenameArticle: (_article: KnowledgeBaseArticle) => void;
  onManageArticleAccess: (_article: KnowledgeBaseArticle) => void;
  onMoveArticle: (_article: KnowledgeBaseArticle, _folderId: string | null) => void;
  onPublishArticle: (_article: KnowledgeBaseArticle) => void;
  onDeleteArticle: (_article: KnowledgeBaseArticle) => void;
};

function compareArticles(left: KnowledgeBaseArticle, right: KnowledgeBaseArticle) {
  if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;

  return left.title.localeCompare(right.title, 'ru');
}

function getStorageKey() {
  return 'knowledge-base-flat-expanded-folders';
}

export default function KnowledgeBaseListPanel({
  articles,
  articleCountSource,
  folders,
  isLoading,
  canEdit,
  canDelete,
  searchQuery,
  selectedFolderScope,
  selectedArticleId,
  isCreatingDraft,
  onSearchQueryChange,
  onSelectFolderScope,
  onSelectArticle,
  onCreateArticle,
  onCreateFolder,
  onRenameFolder,
  onToggleFolderArchive,
  onDeleteFolder,
  onManageFolderAccess,
  onRenameArticle,
  onManageArticleAccess,
  onMoveArticle,
  onPublishArticle,
  onDeleteArticle,
}: Props) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(['unfiled']);

    try {
      const stored = JSON.parse(window.localStorage.getItem(getStorageKey()) ?? '[]');
      return new Set(Array.isArray(stored) ? stored : ['unfiled']);
    } catch {
      return new Set(['unfiled']);
    }
  });
  const [contextMenu, setContextMenu] = useState<KnowledgeBaseContextMenuState | null>(
    null,
  );
  const [draggedArticleId, setDraggedArticleId] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState('');
  const sortedFolders = useMemo(
    () =>
      folders.slice().sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [folders],
  );
  const articlesByFolder = useMemo(() => {
    const grouped = new Map<string, KnowledgeBaseArticle[]>();

    articles.forEach((article) => {
      const key = article.folder_id ?? 'unfiled';
      const group = grouped.get(key) ?? [];
      group.push(article);
      grouped.set(key, group);
    });

    grouped.forEach((group) => group.sort(compareArticles));

    return grouped;
  }, [articles]);
  const articleCountsByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    articleCountSource.forEach((article) => {
      const key = article.folder_id ?? 'unfiled';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return counts;
  }, [articleCountSource]);
  const rootArticles = articlesByFolder.get('unfiled') ?? [];
  const effectiveExpandedFolderIds = useMemo(() => {
    const nextExpanded = new Set(expandedFolderIds);
    const activeArticle = articleCountSource.find(
      (article) => article.id === selectedArticleId,
    );

    if (activeArticle) {
      nextExpanded.add(activeArticle.folder_id ?? 'unfiled');
    }

    return nextExpanded;
  }, [articleCountSource, expandedFolderIds, selectedArticleId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
      getStorageKey(),
      JSON.stringify(Array.from(expandedFolderIds)),
    );
  }, [expandedFolderIds]);

  useEffect(() => {
    if (!contextMenu) return;

    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);

    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
    };
  }, [contextMenu]);

  const openContextMenu = (
    event: React.MouseEvent,
    nextContextMenu: KnowledgeBaseContextMenuState,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(nextContextMenu);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }

      return next;
    });
  };

  const moveDraggedArticle = (event: React.DragEvent, targetFolderId: string | null) => {
    event.preventDefault();
    event.stopPropagation();

    const articleId =
      event.dataTransfer.getData('application/x-knowledge-base-article-id') ||
      draggedArticleId;
    const article = articleCountSource.find((item) => item.id === articleId);

    setDraggedArticleId('');
    setDragOverFolderId('');

    if (!article || article.folder_id === targetFolderId) return;

    onMoveArticle(article, targetFolderId);
  };

  const getDropTargetClassName = (folderId: string, isDropDisabled: boolean) => {
    if (isDropDisabled || dragOverFolderId !== folderId) return '';

    return 'border-[#2d6ff7]! bg-[#edf3ff]!';
  };

  const canDropToRoot = () => {
    const draggedArticle = articleCountSource.find(
      (article) => article.id === draggedArticleId,
    );

    return canEdit && Boolean(draggedArticle?.folder_id);
  };

  const renderRootDropZone = () => {
    if (!canDropToRoot()) return null;

    const isActive = dragOverFolderId === 'root';

    return (
      <li>
        <div
          className={`flex items-center gap-2 rounded-lg border border-dashed px-2 py-2 text-[12px] font-semibold transition-colors ${
            isActive
              ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
              : 'border-[#bad0ff] bg-[#fbfcff] text-[#7e8fb4]'
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDragOverFolderId('root');
          }}
          onDragLeave={() => {
            setDragOverFolderId((current) => (current === 'root' ? '' : current));
          }}
          onDrop={(event) => moveDraggedArticle(event, null)}
        >
          <SvgIcon name='file' className='size-4 shrink-0' />
          Переместить без папки
        </div>
      </li>
    );
  };

  const renderArticle = (article: KnowledgeBaseArticle, level = 0) => {
    const isActive = selectedArticleId === article.id;

    return (
      <li key={article.id}>
        <div
          onContextMenu={(event) =>
            openContextMenu(event, {
              type: 'article',
              article,
              x: event.clientX,
              y: event.clientY,
            })
          }
          draggable={canEdit}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(
              'application/x-knowledge-base-article-id',
              article.id,
            );
            event.dataTransfer.setData('text/plain', article.id);
            setDraggedArticleId(article.id);
          }}
          onDragEnd={() => {
            setDraggedArticleId('');
            setDragOverFolderId('');
          }}
          className={`group grid grid-cols-[minmax(0,1fr)_24px] items-center rounded-lg border transition-colors duration-150 ${
            isActive
              ? 'border-[#c9d8f8] bg-[#edf2fb]'
              : 'border-transparent hover:border-[#e3e9f3] hover:bg-[#fbfcff]'
          } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${
            draggedArticleId === article.id ? 'opacity-60' : ''
          }`}
        >
          <button
            type='button'
            className='flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-left'
            style={{ paddingLeft: `${level * 14 + 8}px` }}
            onClick={() => onSelectArticle(article.id)}
          >
            <SvgIcon name='file' className='size-4 shrink-0 text-[#7e8fb4]' />
            <span className='min-w-0 flex-1 truncate text-[13px] leading-snug font-medium'>
              {article.title || 'Без названия'}
            </span>
            {article.is_pinned ? (
              <PinIcon className='size-3.5 shrink-0 text-[#1f3565]' title='Закреплена' />
            ) : null}
            {article.access?.roles?.length || article.access?.users?.length ? (
              <SvgIcon name='users' className='size-3.5 shrink-0 text-[#7e8fb4]' />
            ) : null}
            {article.is_draft || article.is_archive ? (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                  article.is_draft
                    ? 'bg-[#fff4d6] text-[#946400]'
                    : 'bg-[#edf1f7] text-[#5d7098]'
                }`}
              >
                {getArticleStatusLabel(article)}
              </span>
            ) : null}
          </button>
          {canEdit || canDelete ? (
            <button
              type='button'
              title='Действия'
              className='mr-1 grid size-6 place-items-center rounded-md text-[#7e8fb4] opacity-0 transition-opacity hover:bg-[#edf3ff] hover:text-[#2d6ff7] group-hover:opacity-100'
              onClick={(event) =>
                openContextMenu(event, {
                  type: 'article',
                  article,
                  x: event.clientX,
                  y: event.clientY,
                })
              }
            >
              <SvgIcon name='more' className='size-4' />
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  const renderFolder = (folder: KnowledgeBaseFolder) => {
    const isExpanded = effectiveExpandedFolderIds.has(folder.id);
    const isActive = selectedFolderScope === folder.id;
    const folderArticles = articlesByFolder.get(folder.id) ?? [];
    const draggedArticle = articleCountSource.find(
      (article) => article.id === draggedArticleId,
    );
    const isDropDisabled =
      !canEdit || !draggedArticle || draggedArticle.folder_id === folder.id;

    return (
      <li key={folder.id}>
        <div
          onContextMenu={(event) =>
            openContextMenu(event, {
              type: 'folder',
              folder,
              x: event.clientX,
              y: event.clientY,
            })
          }
          onDragOver={(event) => {
            if (isDropDisabled) return;

            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDragOverFolderId(folder.id);
          }}
          onDragLeave={(event) => {
            event.stopPropagation();
            setDragOverFolderId((current) => (current === folder.id ? '' : current));
          }}
          onDrop={(event) => moveDraggedArticle(event, folder.id)}
          className={`group grid grid-cols-[minmax(0,1fr)_24px] items-center rounded-lg border transition-colors ${
            isActive
              ? 'border-[#c9d8f8] bg-[#edf2fb]'
              : 'border-transparent hover:border-[#e3e9f3] hover:bg-[#fbfcff]'
          } ${getDropTargetClassName(folder.id, isDropDisabled)}`}
        >
          <button
            type='button'
            className='flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-left'
            onClick={() => {
              toggleFolder(folder.id);
              onSelectFolderScope(folder.id);
            }}
          >
            <SvgIcon
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              className='size-4 shrink-0 text-[#7e8fb4]'
            />
            <SvgIcon name='folder' className='size-4 shrink-0 text-[#2d6ff7]' />
            <span className='min-w-0 flex-1 truncate text-[13px] font-semibold'>
              {folder.name}
            </span>
            {folder.is_archive ? (
              <SvgIcon name='archive' className='size-3.5 shrink-0 text-[#7e8fb4]' />
            ) : null}
            {folder.access?.roles?.length || folder.access?.users?.length ? (
              <SvgIcon name='users' className='size-3.5 shrink-0 text-[#7e8fb4]' />
            ) : null}
            <span className='shrink-0 rounded-md bg-[#edf1f7] px-1.5 py-0.5 text-[10px] font-semibold text-[#5d7098]'>
              {articleCountsByFolder.get(folder.id) ?? 0}
            </span>
          </button>
          {canEdit || canDelete ? (
            <button
              type='button'
              title='Действия'
              className='mr-1 grid size-6 place-items-center rounded-md text-[#7e8fb4] opacity-0 transition-opacity hover:bg-[#edf3ff] hover:text-[#2d6ff7] group-hover:opacity-100'
              onClick={(event) =>
                openContextMenu(event, {
                  type: 'folder',
                  folder,
                  x: event.clientX,
                  y: event.clientY,
                })
              }
            >
              <SvgIcon name='more' className='size-4' />
            </button>
          ) : null}
        </div>

        {isExpanded ? (
          <ul className='grid gap-0.5'>
            {folderArticles.length ? (
              folderArticles.map((article) => renderArticle(article, 1))
            ) : (
              <li className='px-2 py-1 pl-9 text-[12px] text-[#9aa8c4]'>Пусто</li>
            )}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <aside className='flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565] lg:h-full'>
      <div className='border-b border-[#e3e9f3] p-3'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <h1 className='text-[13px] leading-none font-semibold'>База знаний</h1>
          {canEdit ? (
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                title='Создать папку'
                className='h-7! min-h-0! rounded-lg border-[#bad0ff] bg-[#edf3ff] px-2! py-1! text-[#2d6ff7] hover:bg-[#edf3ff]'
                onClick={onCreateFolder}
              >
                <SvgIcon name='folder' className='size-4' />
              </Button>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                title='Создать статью'
                className='h-7! min-h-0! rounded-lg border-[#bad0ff] bg-[#edf3ff] px-2! py-1! text-[#2d6ff7] hover:bg-[#edf3ff]'
                disabled={isCreatingDraft}
                onClick={() => onCreateArticle()}
              >
                {isCreatingDraft ? '...' : <SvgIcon name='plus' className='size-4' />}
              </Button>
            </div>
          ) : null}
        </div>

        <label className='flex items-center gap-2 rounded-xl border border-[#e3e9f3] px-2 py-1 text-[12px] text-[#7e8fb4]'>
          <svg
            className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
            viewBox='0 0 24 24'
            aria-hidden='true'
          >
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder='Поиск'
            className='min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-[#1f3565] outline-none placeholder:text-[#7e8fb4]'
          />
        </label>
      </div>

      <div className='min-h-0 flex-1 overflow-auto p-2'>
        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
          </div>
        ) : sortedFolders.length || articles.length ? (
          <div className='grid gap-2'>
            <button
              type='button'
              className={`flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                selectedFolderScope === 'all'
                  ? 'border-[#c9d8f8] bg-[#edf2fb]'
                  : 'border-transparent hover:border-[#e3e9f3] hover:bg-[#fbfcff]'
              }`}
              onClick={() => onSelectFolderScope('all')}
            >
              <SvgIcon name='file' className='size-4 shrink-0 text-[#7e8fb4]' />
              <span className='min-w-0 flex-1 truncate text-[13px] font-semibold'>
                Все статьи
              </span>
              <span className='shrink-0 rounded-md bg-[#edf1f7] px-1.5 py-0.5 text-[10px] font-semibold text-[#5d7098]'>
                {articleCountSource.length}
              </span>
            </button>

            <ul
              className={`grid min-h-6 gap-0.5 rounded-lg border transition-colors ${
                dragOverFolderId === 'root'
                  ? 'border-[#2d6ff7] bg-[#edf3ff]'
                  : 'border-transparent'
              }`}
              onDragOver={(event) => {
                if (!canDropToRoot()) return;

                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverFolderId('root');
              }}
              onDragLeave={() => {
                setDragOverFolderId((current) => (current === 'root' ? '' : current));
              }}
              onDrop={(event) => moveDraggedArticle(event, null)}
            >
              {sortedFolders.map((folder) => renderFolder(folder))}
              {rootArticles.map((article) => renderArticle(article))}
              {renderRootDropZone()}
            </ul>
          </div>
        ) : (
          <div className='px-2 py-8 text-center text-[13px] text-[#7e8fb4]'>
            {searchQuery.trim()
              ? 'Ничего не найдено'
              : 'Доступных папок и статей пока нет'}
          </div>
        )}
      </div>

      <KnowledgeBaseContextMenu
        state={contextMenu}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setContextMenu(null)}
        onCreateArticle={onCreateArticle}
        onSelectArticle={onSelectArticle}
        onRenameFolder={onRenameFolder}
        onToggleFolderArchive={onToggleFolderArchive}
        onDeleteFolder={onDeleteFolder}
        onManageFolderAccess={onManageFolderAccess}
        onRenameArticle={onRenameArticle}
        onManageArticleAccess={onManageArticleAccess}
        onPublishArticle={onPublishArticle}
        onDeleteArticle={onDeleteArticle}
      />
    </aside>
  );
}
