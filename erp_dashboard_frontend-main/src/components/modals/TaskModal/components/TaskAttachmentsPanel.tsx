import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { API_URL } from '../../../../constants/app';
import ConfirmDialog from '../../ConfirmDialog';
import { formatName } from '../../../../utils/formatters';
import type { TaskAttachment } from '../../../../types/app';
import { formatCommentDateTime, joinClassNames } from '../shared';

const FILE_MAX_BYTES = 20 * 1024 * 1024; // 20 МБ

function hasDraggedFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';

  const kb = 1024;
  const mb = 1024 * 1024;

  if (bytes < kb) {
    return `${bytes} B`;
  }

  if (bytes < mb) {
    return `${parseFloat((bytes / kb).toFixed(1))} KB`;
  }

  return `${parseFloat((bytes / mb).toFixed(1))} MB`;
}

export default function TaskAttachmentsPanel({
  taskId,
  currentUserId,
  canDeleteAnyAttachment,
  canDeleteOwnAttachment,
}: {
  taskId: string;
  currentUserId: string;
  canDeleteAnyAttachment: boolean;
  canDeleteOwnAttachment: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);

  const [deletingId, setDeletingId] = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string>('');
  const [pendingDelete, setPendingDelete] = useState<TaskAttachment | null>(null);

  const refreshAttachments = useCallback(async () => {
    if (!taskId) {
      setAttachments([]);
      return;
    }
    try {
      setIsLoading(true);
      const list = await api.workspace.taskAttachments.getForTask(taskId);
      setAttachments(list); // реверс не нужен, так как бэк отдает по убыванию created_at
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить файлы.');
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void refreshAttachments();
  }, [refreshAttachments]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !taskId) return;

    const incoming = Array.from(fileList);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsUploading(true);

    for (const file of incoming) {
      if (file.size > FILE_MAX_BYTES) {
        toast.error(`Файл «${file.name}» больше 20 МБ и был пропущен.`);
        continue;
      }

      try {
        const created = await api.workspace.taskAttachments.uploadForTask(taskId, file);
        setAttachments((current) => [created, ...current]);
        toast.success(`Файл «${file.name}» загружен.`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : `Ошибка при загрузке «${file.name}».`,
        );
      }
    }

    setIsUploading(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event) || isUploading) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event) || isUploading) return;
    event.preventDefault();
    setIsDropActive(false);
    void handleFilesSelected(event.dataTransfer.files);
  };

  const confirmDelete = async () => {
    if (!taskId || !pendingDelete) return;
    const attachment = pendingDelete;

    try {
      setDeletingId(attachment.id);
      await api.workspace.taskAttachments.deleteForTask(taskId, attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      toast.success('Файл удалён.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить файл.');
    } finally {
      setDeletingId('');
    }
  };

  const downloadAttachment = async (attachment: TaskAttachment) => {
    if (!attachment.download_url) return;

    try {
      setDownloadingId(attachment.id);
      const response = await fetch(`${API_URL}${attachment.download_url}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Не удалось скачать файл.');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.original_name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Не удалось скачать файл.');
    } finally {
      setDownloadingId('');
    }
  };
  const isDeletingPending = Boolean(pendingDelete) && deletingId === pendingDelete?.id;

  return (
    <>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden'>
        {!taskId ? (
          <div className='flex min-h-60 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500'>
            <svg
              viewBox='0 0 24 24'
              className='mb-2 size-8 fill-none stroke-slate-400 stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
              aria-hidden='true'
            >
              <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
              <polyline points='17 8 12 3 7 8' />
              <line x1='12' y1='3' x2='12' y2='15' />
            </svg>
            Сначала сохраните задачу, чтобы прикреплять файлы.
          </div>
        ) : (
          <div
            className={joinClassNames(
              'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white transition-colors',
              isDropActive
                ? 'border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
                : 'border-slate-200',
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className='border-b border-slate-100 bg-slate-50 p-3'>
              <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={(event) => void handleFilesSelected(event.target.files)}
              />
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={joinClassNames(
                  'flex w-full items-center justify-center gap-2 rounded-md border border-dashed py-3 text-[13px] font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
                  isDropActive
                    ? 'border-blue-500 bg-blue-100 text-blue-700'
                    : 'border-blue-300 bg-blue-50/50 text-blue-600 hover:bg-blue-50',
                )}
              >
                {isUploading ? (
                  'Загрузка файлов...'
                ) : isDropActive ? (
                  'Отпустите файлы для загрузки'
                ) : (
                  <>
                    <svg
                      viewBox='0 0 24 24'
                      className='size-4 fill-none stroke-current stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]'
                      aria-hidden='true'
                    >
                      <line x1='12' y1='5' x2='12' y2='19'></line>
                      <line x1='5' y1='12' x2='19' y2='12'></line>
                    </svg>
                    Добавить файлы
                  </>
                )}
              </button>
            </div>

            <div ref={listRef} className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
              {isLoading ? (
                <div className='py-6 text-center text-[12px] text-slate-500'>
                  Загрузка файлов…
                </div>
              ) : attachments.length === 0 ? (
                <div className='py-6 text-center text-[12px] text-slate-500'>
                  Нет прикрепленных файлов.
                </div>
              ) : (
                <ul className='grid gap-2'>
                  {attachments.map((attachment) => {
                    const authorName = attachment.uploader
                      ? formatName(attachment.uploader)
                      : 'Система';
                    const dateLabel = formatCommentDateTime(attachment.created_at);
                    const isDeleting = deletingId === attachment.id;
                    const isDownloading = downloadingId === attachment.id;

                    const isOwnFile =
                      !!attachment.uploader?.id &&
                      !!currentUserId &&
                      String(attachment.uploader.id) === String(currentUserId);

                    const canDelete =
                      canDeleteAnyAttachment || (canDeleteOwnAttachment && isOwnFile);

                    return (
                      <li
                        key={attachment.id}
                        className='group flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-2.5 transition-colors hover:border-slate-200 hover:shadow-sm overflow-hidden' // 1. Добавили overflow-hidden здесь
                      >
                        <div className='flex min-w-0 flex-1 items-center gap-3 w-px'>
                          <button
                            type='button'
                            disabled={isDownloading}
                            onClick={() => void downloadAttachment(attachment)}
                            className='grid size-8 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-500 transition-colors hover:bg-blue-100 focus:outline-none disabled:cursor-wait disabled:opacity-60'
                            title='Скачать файл'
                          >
                            <svg
                              viewBox='0 0 24 24'
                              className='size-4.5 fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]'
                            >
                              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path>
                              <polyline points='14 2 14 8 20 8'></polyline>
                            </svg>
                          </button>

                          <div className='flex min-w-0 flex-1 flex-col'>
                            <span className='mb-0.5 truncate text-[11px] font-medium text-slate-400'>
                              {authorName}
                            </span>

                            <button
                              type='button'
                              disabled={isDownloading}
                              onClick={() => void downloadAttachment(attachment)}
                              className='block w-full truncate text-left text-[13px] font-medium text-slate-800 transition-colors hover:text-blue-600 focus:outline-none disabled:cursor-wait disabled:opacity-60'
                              title={attachment.original_name}
                            >
                              {attachment.original_name}
                            </button>

                            <div className='mt-0.5 flex items-center gap-2 text-[11px] text-slate-400'>
                              <span>{formatBytes(attachment.size)}</span>
                              <span className='size-1 rounded-full bg-slate-200'></span>
                              <span>{dateLabel}</span>
                            </div>
                          </div>
                        </div>

                        <div className='flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
                          {canDelete ? (
                            <button
                              type='button'
                              disabled={isDeleting}
                              onClick={() => setPendingDelete(attachment)}
                              className='grid size-7 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50'
                              aria-label='Удалить вложение'
                              title='Удалить вложение'
                            >
                              <svg
                                viewBox='0 0 24 24'
                                className='size-4 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
                                aria-hidden='true'
                              >
                                <path d='M4 7h16' />
                                <path d='M10 11v6' />
                                <path d='M14 11v6' />
                                <path d='M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7' />
                                <path d='M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        isProcessing={isDeletingPending}
        title='Удалить файл'
        message='Вы уверены, что хотите удалить этот файл? Действие нельзя отменить.'
        confirmLabel='Удалить'
        onClose={() => {
          if (isDeletingPending) return;
          setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
