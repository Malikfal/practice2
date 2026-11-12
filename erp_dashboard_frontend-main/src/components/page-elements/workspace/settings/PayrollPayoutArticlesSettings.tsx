import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { PayrollPayoutArticle } from '../../../../types/payrollPayouts';
import ConfirmDialog from '../../../modals/ConfirmDialog';
import Button from '../../../ui/Button';
import { Field, Input } from '../../../ui/FormField';
import { PayoutModalShell } from '../finances/payroll/payouts/PayoutParts';

const ICON_BUTTON =
  'grid size-10 place-items-center rounded-md text-[#7e8fb4] transition-colors hover:bg-[#edf3ff] hover:text-[#2d6ff7] md:size-8';

// Статьи выплаты ФОТ: плоский список оснований для выплат сотрудникам.
export default function PayrollPayoutArticlesSettings({
  canManage,
}: {
  canManage: boolean;
}) {
  const [articles, setArticles] = useState<PayrollPayoutArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<PayrollPayoutArticle | 'new' | null>(null);
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PayrollPayoutArticle | null>(null);

  const handleError = useCallback((error: unknown) => {
    toast.error(error instanceof Error ? error.message : 'Произошла ошибка.');
  }, []);

  const load = useCallback(async () => {
    try {
      setArticles(await api.workspace.payrollPayoutArticles.getMany());
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (target: PayrollPayoutArticle | 'new') => {
    setName(target === 'new' ? '' : target.name);
    setEditTarget(target);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!editTarget || !trimmed) {
      toast.error('Введите название статьи.');
      return;
    }

    try {
      setIsSaving(true);
      if (editTarget === 'new') {
        await api.workspace.payrollPayoutArticles.create(trimmed);
      } else {
        await api.workspace.payrollPayoutArticles.update(editTarget.id, trimmed);
      }
      toast.success(editTarget === 'new' ? 'Статья добавлена.' : 'Статья обновлена.');
      setEditTarget(null);
      await load();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;

    try {
      setIsSaving(true);
      const archived = await api.workspace.payrollPayoutArticles.delete(deleteTarget.id);
      toast.success(archived ? 'Статья перенесена в архив.' : 'Статья удалена.');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const restore = async (article: PayrollPayoutArticle) => {
    try {
      setIsSaving(true);
      await api.workspace.payrollPayoutArticles.restore(article.id);
      toast.success('Статья возвращена из архива.');
      await load();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className='grid min-h-40 place-items-center'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
      </div>
    );
  }

  return (
    <div className='grid max-w-190 gap-2'>
      <p className='pb-1 text-sm text-[#7e8fb4]'>
        Основания для выплат сотрудникам. Выбираются при выплате в ведомости, в ОФР и
        аналитику не попадают.
      </p>

      {articles.map((article) => (
        <div key={article.id} className='flex flex-col gap-2 md:flex-row md:items-center'>
          <div className='flex min-h-11 w-full min-w-0 flex-1 flex-col items-start gap-2 rounded-lg bg-[#f1f4f9] px-3 py-2 text-sm font-medium text-[#1f3565] sm:flex-row sm:items-center sm:justify-between sm:gap-3 md:min-h-0'>
            <span
              className={`max-w-full break-words sm:truncate ${article.is_archived ? 'text-[#7e8fb4] line-through' : ''}`}
            >
              {article.name}
            </span>
            <span className='flex max-w-full flex-wrap justify-start gap-1 sm:shrink-0 sm:justify-end'>
              {article.is_archived ? (
                <span className='shrink-0 rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-medium text-amber-700'>
                  В архиве
                </span>
              ) : null}
              <span className='shrink-0 rounded-md border border-[#dce7ff] bg-white px-2 py-1 text-[10px] font-medium text-[#7082a8]'>
                Выплат: {article.payouts_count}
              </span>
            </span>
          </div>
          {canManage ? (
            <div className='flex w-full items-center justify-end gap-1 rounded-lg border border-[#edf2fb] bg-white p-1 md:w-auto md:border-0 md:bg-transparent md:p-0'>
              {article.is_archived ? (
                <button
                  type='button'
                  className='rounded-md px-2 py-1.5 text-sm font-semibold text-[#2d6ff7] hover:bg-[#edf3ff]'
                  disabled={isSaving}
                  onClick={() => void restore(article)}
                >
                  Вернуть
                </button>
              ) : (
                <>
                  <button
                    type='button'
                    className={ICON_BUTTON}
                    aria-label={`Переименовать статью: ${article.name}`}
                    title='Переименовать'
                    onClick={() => openEditor(article)}
                  >
                    <svg
                      className='size-4 fill-none stroke-current stroke-[1.8]'
                      viewBox='0 0 24 24'
                    >
                      <path
                        d='M16.5 4.5l3 3L8 19l-4 1 1-4z'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </button>
                  <button
                    type='button'
                    className={`${ICON_BUTTON} hover:bg-rose-50 hover:text-rose-600`}
                    aria-label={`Удалить статью: ${article.name}`}
                    title={article.payouts_count ? 'В архив' : 'Удалить'}
                    onClick={() => setDeleteTarget(article)}
                  >
                    <svg
                      className='size-4 fill-none stroke-current stroke-[1.8]'
                      viewBox='0 0 24 24'
                    >
                      <path
                        d='M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      ))}

      {!articles.length ? (
        <div className='rounded-lg border border-dashed border-[#c9d8f8] bg-white px-3 py-8 text-center text-sm text-[#7e8fb4]'>
          Статьи не добавлены
        </div>
      ) : null}

      {canManage ? (
        <Button
          type='button'
          variant='secondary'
          className='mt-3 min-h-11 border-[#1f3565] text-[#1f3565] hover:bg-[#f3f7ff] md:h-10 md:min-h-0'
          onClick={() => openEditor('new')}
        >
          + Добавить статью
        </Button>
      ) : null}

      {editTarget ? (
        <PayoutModalShell
          title={editTarget === 'new' ? 'Новая статья выплаты ФОТ' : 'Статья выплаты ФОТ'}
          isSaving={isSaving}
          onClose={() => setEditTarget(null)}
        >
          <form onSubmit={(event) => void save(event)} className='grid gap-3' noValidate>
            <Field label='Название'>
              <Input
                autoFocus
                maxLength={255}
                autoComplete='off'
                placeholder='Например: Премия на карту'
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className='mt-1 flex flex-wrap justify-end gap-2'>
              <Button
                variant='secondary'
                disabled={isSaving}
                onClick={() => setEditTarget(null)}
              >
                Отмена
              </Button>
              <Button type='submit' disabled={isSaving}>
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </PayoutModalShell>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title={
          deleteTarget?.payouts_count ? 'Перенести статью в архив?' : 'Удалить статью?'
        }
        message={
          deleteTarget
            ? deleteTarget.payouts_count
              ? `По статье "${deleteTarget.name}" есть выплаты, поэтому она останется в истории, но для новых выплат будет недоступна.`
              : `Статья "${deleteTarget.name}" будет удалена безвозвратно.`
            : ''
        }
        confirmLabel={deleteTarget?.payouts_count ? 'В архив' : 'Удалить'}
        processingLabel='Сохранение...'
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
