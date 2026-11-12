import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { notificationsStore } from '../../../../notifications/notificationsStore';
import { API_URL } from '../../../../constants/app';
import Button from '../../../ui/Button';
import type {
  TaskClientMessage,
  TaskClientMessageAttachment,
} from '../../../../types/app';
import { formatCommentDateTime, joinClassNames } from '../shared';

const MAX_FILES = 10;
const FILE_MAX_BYTES = 20 * 1024 * 1024;

function hasDraggedFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

function getDroppedFiles(event: DragEvent<HTMLElement>): File[] {
  const items = Array.from(event.dataTransfer.items ?? []);
  const files = items
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return files.length > 0 ? files : Array.from(event.dataTransfer.files ?? []);
}

function formatAuthorName(message: TaskClientMessage): string {
  if (!message.author)
    return message.is_from_client ? 'Клиент' : message.author_name || 'Сотрудник';
  const name = `${message.author.name ?? ''} ${message.author.last_name ?? ''}`.trim();
  return name || (message.is_from_client ? 'Клиент' : message.author_name || 'Сотрудник');
}

export default function TaskClientPanel({
  taskId,
  canViewComments,
  canReply,
}: {
  taskId: string;
  canViewComments: boolean;
  canReply: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesListRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<TaskClientMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState('');

  const refreshMessages = useCallback(async () => {
    if (!taskId) {
      setMessages([]);
      return;
    }
    try {
      setIsLoading(true);
      const response = await api.workspace.taskClientMessages.getMessages(taskId);
      setMessages(response.data ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить переписку.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setMessages([]);
      return;
    }
    void refreshMessages();
  }, [taskId, refreshMessages]);

  // Сообщение в переписке открытой задачи приходит уведомлением: показываем его сразу.
  useEffect(() => {
    if (!taskId) return;
    return notificationsStore.onNotification((notification) => {
      const isConversation =
        notification.type === 'task.client_message_added' ||
        notification.type === 'task.client_reply_added';
      if (notification.task?.id !== taskId || !isConversation) return;
      api.workspace.taskClientMessages
        .getMessages(taskId)
        .then((response) => setMessages(response.data ?? []))
        .catch(() => undefined);
    });
  }, [taskId]);

  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleFilesChange = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);
    const oversized = incoming.find((file) => file.size > FILE_MAX_BYTES);
    if (oversized) {
      toast.error(`Файл «${oversized.name}» больше 20 МБ.`);
      return;
    }

    setMessageFiles((current) => {
      const merged = [...current];
      for (const file of incoming) {
        if (merged.length >= MAX_FILES) {
          toast.error(`Можно прикрепить не более ${MAX_FILES} файлов.`);
          break;
        }
        merged.push(file);
      }
      return merged;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event) || isSubmitting) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event) || isSubmitting) return;
    event.preventDefault();
    setIsDragActive(false);
    handleFilesChange(getDroppedFiles(event));
  };

  const removeFile = (index: number) => {
    setMessageFiles((current) => current.filter((_, position) => position !== index));
  };

  const submitMessage = async () => {
    if (!taskId) return;

    const trimmed = messageText.trim();
    if (!trimmed && messageFiles.length === 0) {
      toast.error('Сообщение должно содержать текст или хотя бы один файл.');
      return;
    }
    try {
      setIsSubmitting(true);
      const created = await api.workspace.taskClientMessages.sendMessage(taskId, {
        text: trimmed || undefined,
        files: messageFiles,
      });
      setMessages((current) => [...current, created]);
      setMessageText('');
      setMessageFiles([]);
      notificationsStore.ownCommentAdded(taskId);
      toast.success('Сообщение отправлено.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось отправить сообщение.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadAttachment = async (attachment: TaskClientMessageAttachment) => {
    if (!attachment.download_url) {
      toast.error('Ссылка на скачивание недоступна.');
      return;
    }

    try {
      setDownloadingAttachmentId(attachment.id);
      const response = await fetch(`${API_URL}${attachment.download_url}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Не удалось скачать файл.');
      }
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
      setDownloadingAttachmentId('');
    }
  };

  if (!taskId) {
    return (
      <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-2'>
        <div className='flex min-h-60 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500'>
          <svg
            viewBox='0 0 24 24'
            className='mb-2 size-8 fill-none stroke-slate-400 stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
            aria-hidden='true'
          >
            <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
            <circle cx='9' cy='7' r='4' />
            <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
            <path d='M16 3.13a4 4 0 0 1 0 7.75' />
          </svg>
          Сначала сохраните задачу.
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-2'>
      {canViewComments ? (
        <div
          className={joinClassNames(
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white transition-colors',
            isDragActive
              ? 'border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
              : 'border-slate-200',
          )}
          onDragOver={canReply ? handleDragOver : undefined}
          onDragLeave={canReply ? handleDragLeave : undefined}
          onDrop={canReply ? handleDrop : undefined}
        >
          <div
            ref={messagesListRef}
            className='min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3'
          >
            {isLoading ? (
              <div className='py-6 text-center text-[12px] text-slate-500'>
                Загрузка переписки…
              </div>
            ) : messages.length === 0 ? (
              <div className='py-6 text-center text-[12px] text-slate-500'>
                Пока нет сообщений.
              </div>
            ) : (
              <ul className='grid gap-3'>
                {messages.map((message) => {
                  const authorName = formatAuthorName(message);
                  const dateLabel = formatCommentDateTime(message.created_at);

                  return (
                    <li
                      key={message.id}
                      className={joinClassNames(
                        'min-w-0 rounded-lg border px-3 py-2 text-[13px]',
                        message.is_from_client
                          ? 'border-blue-200 bg-blue-50/60 text-slate-800'
                          : 'border-slate-200 bg-slate-50 text-slate-800',
                      )}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <div className='flex items-center gap-1.5'>
                            <span className='truncate text-[12px] font-semibold text-slate-700'>
                              {authorName}
                            </span>
                          </div>
                          <div className='text-[11px] text-slate-500'>{dateLabel}</div>
                        </div>
                      </div>

                      {message.text ? (
                        <p className='mt-2 whitespace-pre-wrap wrap-break-word text-[13px] leading-relaxed text-slate-800'>
                          {message.text}
                        </p>
                      ) : null}

                      {message.attachments && message.attachments.length > 0 ? (
                        <ul className='mt-2 flex min-w-0 flex-col gap-1'>
                          {message.attachments.map((attachment) => {
                            const isDownloading =
                              downloadingAttachmentId === attachment.id;
                            return (
                              <li key={attachment.id} className='min-w-0'>
                                <button
                                  type='button'
                                  disabled={isDownloading}
                                  onClick={() => void downloadAttachment(attachment)}
                                  className='flex w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60'
                                  title={attachment.original_name}
                                >
                                  <svg
                                    viewBox='0 0 24 24'
                                    className='size-3.5 shrink-0 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
                                    aria-hidden='true'
                                  >
                                    <path d='m21 12-8.5 8.5a5.5 5.5 0 1 1-7.8-7.8L13 4.6a3.7 3.7 0 1 1 5.2 5.2L9.8 18.5a1.8 1.8 0 1 1-2.6-2.6L15 8' />
                                  </svg>
                                  <span className='min-w-0 truncate'>
                                    {attachment.original_name}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {canReply ? (
            <div
              className={joinClassNames(
                'border-t border-slate-100 p-3 transition-colors',
                isDragActive && 'bg-blue-50/70',
              )}
            >
              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder='Ответить клиенту…'
                rows={3}
                className={joinClassNames(
                  'block w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
                  isDragActive ? 'border-blue-400' : 'border-slate-300',
                )}
              />

              {isDragActive ? (
                <div className='mt-2 rounded-md border border-dashed border-blue-300 bg-white/80 px-3 py-2 text-center text-[12px] font-medium text-blue-600'>
                  Отпустите файлы, чтобы прикрепить их к сообщению.
                </div>
              ) : null}

              {messageFiles.length > 0 ? (
                <ul className='mt-2 flex flex-col gap-1'>
                  {messageFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className='flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-700'
                    >
                      <span className='min-w-0 truncate' title={file.name}>
                        {file.name}
                      </span>
                      <button
                        type='button'
                        onClick={() => removeFile(index)}
                        className='grid size-5 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                        aria-label={`Убрать файл ${file.name}`}
                      >
                        <svg
                          viewBox='0 0 12 12'
                          className='size-2.5 fill-none stroke-current stroke-2'
                        >
                          <path
                            d='M3 3l6 6M9 3l-6 6'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className='mt-2 flex items-center justify-between gap-2'>
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || messageFiles.length >= MAX_FILES}
                  className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <svg
                    viewBox='0 0 24 24'
                    className='size-4 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
                    aria-hidden='true'
                  >
                    <path d='m21 12-8.5 8.5a5.5 5.5 0 1 1-7.8-7.8L13 4.6a3.7 3.7 0 1 1 5.2 5.2L9.8 18.5a1.8 1.8 0 1 1-2.6-2.6L15 8' />
                  </svg>
                  Прикрепить
                </button>
                <input
                  ref={fileInputRef}
                  type='file'
                  multiple
                  hidden
                  onChange={(event) => handleFilesChange(event.target.files)}
                />
                <Button
                  type='button'
                  variant={
                    isSubmitting || (!messageText.trim() && messageFiles.length === 0)
                      ? 'secondary'
                      : 'primary'
                  }
                  disabled={
                    isSubmitting || (!messageText.trim() && messageFiles.length === 0)
                  }
                  onClick={() => void submitMessage()}
                >
                  {isSubmitting ? 'Отправка…' : 'Отправить'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className='flex min-h-40 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[13px] text-slate-500'>
          Нет доступа к переписке.
        </div>
      )}
    </div>
  );
}
