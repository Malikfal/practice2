import type { ReactNode } from 'react';

import type { KnowledgeBaseArticle, KnowledgeBaseFolder } from '../../../../../types/app';

export type KnowledgeBaseContextMenuState =
  | { type: 'folder'; folder: KnowledgeBaseFolder; x: number; y: number }
  | { type: 'article'; article: KnowledgeBaseArticle; x: number; y: number };

type Props = {
  state: KnowledgeBaseContextMenuState | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onCreateArticle: (_folderId?: string | null) => void;
  onSelectArticle: (_articleId: string) => void;
  onRenameFolder: (_folder: KnowledgeBaseFolder) => void;
  onToggleFolderArchive: (_folder: KnowledgeBaseFolder) => void;
  onDeleteFolder: (_folder: KnowledgeBaseFolder) => void;
  onManageFolderAccess: (_folder: KnowledgeBaseFolder) => void;
  onRenameArticle: (_article: KnowledgeBaseArticle) => void;
  onManageArticleAccess: (_article: KnowledgeBaseArticle) => void;
  onPublishArticle: (_article: KnowledgeBaseArticle) => void;
  onDeleteArticle: (_article: KnowledgeBaseArticle) => void;
};

export default function KnowledgeBaseContextMenu({
  state,
  canEdit,
  canDelete,
  onClose,
  onCreateArticle,
  onSelectArticle,
  onRenameFolder,
  onToggleFolderArchive,
  onDeleteFolder,
  onManageFolderAccess,
  onRenameArticle,
  onManageArticleAccess,
  onPublishArticle,
  onDeleteArticle,
}: Props) {
  if (!state || (!canEdit && !canDelete)) return null;

  if (state.type === 'folder') {
    const { folder } = state;

    return (
      <MenuShell x={state.x} y={state.y}>
        {canEdit ? (
          <>
            <MenuButton
              onClick={() => {
                onClose();
                onCreateArticle(folder.id);
              }}
            >
              Создать статью
            </MenuButton>
            <MenuButton
              onClick={() => {
                onClose();
                onRenameFolder(folder);
              }}
            >
              Переименовать
            </MenuButton>
            <MenuButton
              onClick={() => {
                onClose();
                onManageFolderAccess(folder);
              }}
            >
              Управление доступом
            </MenuButton>
            <MenuButton
              onClick={() => {
                onClose();
                onToggleFolderArchive(folder);
              }}
            >
              {folder.is_archive ? 'Разархивировать' : 'Архивировать'}
            </MenuButton>
          </>
        ) : null}
        {canDelete ? (
          <MenuButton
            danger
            onClick={() => {
              onClose();
              onDeleteFolder(folder);
            }}
          >
            Удалить
          </MenuButton>
        ) : null}
      </MenuShell>
    );
  }

  const { article } = state;

  return (
    <MenuShell x={state.x} y={state.y}>
      <MenuButton
        onClick={() => {
          onClose();
          onSelectArticle(article.id);
        }}
      >
        Открыть
      </MenuButton>
      {canEdit ? (
        <>
          <MenuButton
            onClick={() => {
              onClose();
              onRenameArticle(article);
            }}
          >
            Переименовать
          </MenuButton>
          <MenuButton
            onClick={() => {
              onClose();
              onManageArticleAccess(article);
            }}
          >
            Управление доступом
          </MenuButton>
          {article.is_draft ? (
            <MenuButton
              onClick={() => {
                onClose();
                onPublishArticle(article);
              }}
            >
              Опубликовать
            </MenuButton>
          ) : null}
        </>
      ) : null}
      {canDelete ? (
        <MenuButton
          danger
          onClick={() => {
            onClose();
            onDeleteArticle(article);
          }}
        >
          Удалить
        </MenuButton>
      ) : null}
    </MenuShell>
  );
}

function MenuShell({ children, x, y }: { children: ReactNode; x: number; y: number }) {
  return (
    <div
      className='fixed z-1100 grid w-56 gap-1 rounded-xl border border-[#d9e2f2] bg-white p-1 shadow-xl shadow-slate-900/15'
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

function MenuButton({
  children,
  danger = false,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      className={`rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
        danger ? 'text-rose-700 hover:bg-rose-50' : 'text-[#1f3565] hover:bg-[#edf3ff]'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
