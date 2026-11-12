import type { Dispatch, SetStateAction } from 'react';

import Button from '../../../ui/Button';
import type {
  KnowledgeBaseArticle,
  KnowledgeBaseArticleForm,
  KnowledgeBaseFolder,
} from '../../../../types/app';
import KnowledgeBaseArticleEditor from './KnowledgeBaseArticleEditor';
import KnowledgeBaseArticleViewer from './KnowledgeBaseArticleViewer';
import { getArticleStatusLabel } from './knowledgeBaseShared';

type Props = {
  article: KnowledgeBaseArticle | null;
  form: KnowledgeBaseArticleForm;
  isEditing: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSavingDraft: boolean;
  folders: KnowledgeBaseFolder[];
  onFormChange: Dispatch<SetStateAction<KnowledgeBaseArticleForm>>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onBackToList?: () => void;
  onUploadImage: (_file: File) => Promise<string | null>;
  onImportImage: (_url: string) => Promise<string>;
};

export default function KnowledgeBaseDetailsPanel({
  article,
  form,
  isEditing,
  canEdit,
  canDelete,
  isSavingDraft,
  folders,
  onFormChange,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onBackToList,
  onUploadImage,
  onImportImage,
}: Props) {
  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white text-[#0f2448]'>
      <header className='flex shrink-0 flex-col items-stretch justify-between gap-3 border-b border-[#e3e9f3] bg-[#fbfcff] px-3 py-3 lg:flex-row lg:items-center lg:px-5'>
        {onBackToList ? (
          <button
            type='button'
            className='flex min-h-10 w-full items-center gap-2 rounded-xl border border-[#dce7ff] bg-white px-3 text-left text-[13px] font-semibold text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff] lg:hidden'
            onClick={onBackToList}
          >
            <span aria-hidden='true'>←</span>
            <span>Все статьи</span>
          </button>
        ) : null}
        <div className='flex min-w-0 items-center gap-3'>
          <span className='grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#2d6ff7]'>
            <svg
              className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20' />
              <path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' />
            </svg>
          </span>
          <div className='min-w-0'>
            <p className='truncate text-[12px] font-medium text-[#7e8fb4]'>
              {isEditing && !article
                ? 'Новая статья'
                : article
                  ? getArticleStatusLabel(article)
                  : 'База знаний'}
            </p>
            <h2 className='truncate text-[18px] leading-snug font-semibold lg:text-[20px]'>
              {isEditing
                ? form.title || 'Без названия'
                : article?.title || 'Выберите статью'}
            </h2>
          </div>
        </div>

        {canEdit || canDelete ? (
          <div className='grid w-full shrink-0 grid-cols-2 items-center gap-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end'>
            {isEditing ? (
              <>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  className='w-full rounded-xl border-[#e3e9f3] text-[#1f3565] lg:w-auto'
                  onClick={onCancel}
                >
                  Отмена
                </Button>
                <span className='order-3 col-span-2 text-center text-[12px] font-medium text-[#7e8fb4] lg:order-0 lg:col-span-1 lg:text-left'>
                  {isSavingDraft ? 'Сохранение...' : 'Изменения сохранены'}
                </span>
                <Button
                  type='button'
                  size='sm'
                  className='w-full rounded-xl bg-[#2d6ff7] text-white hover:bg-[#2460dc] lg:w-auto'
                  disabled={isSavingDraft}
                  onClick={onSave}
                >
                  {article?.is_draft ? 'Опубликовать' : 'Сохранить'}
                </Button>
              </>
            ) : (
              <>
                {canEdit ? (
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    className='w-full rounded-xl border-[#e3e9f3] text-[#1f3565] lg:w-auto'
                    disabled={!article}
                    onClick={onEdit}
                  >
                    Редактировать
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type='button'
                    variant='danger'
                    size='sm'
                    className='w-full rounded-xl lg:w-auto'
                    disabled={!article}
                    onClick={onDelete}
                  >
                    Удалить
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </header>

      <div className='min-h-0 flex-1 overflow-auto px-3 py-3 lg:px-5 lg:py-4'>
        {isEditing ? (
          <KnowledgeBaseArticleEditor
            form={form}
            folders={folders}
            onChange={onFormChange}
            onUploadImage={onUploadImage}
            onImportImage={onImportImage}
          />
        ) : article ? (
          <KnowledgeBaseArticleViewer article={article} />
        ) : (
          <div className='flex h-full items-center justify-center text-[14px] font-medium text-[#7e8fb4]'>
            Выберите статью из списка
          </div>
        )}
      </div>
    </section>
  );
}
