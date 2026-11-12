import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { toast, Toaster } from 'sonner';
import DOMPurify from 'dompurify';

import { publicApi } from '../api/modules/publicApi';
import type {
  PublicTask,
  PublicTaskAttachment,
  TaskClientMessage,
  TaskClientMessageAttachment,
} from '../types/app';
import {
  formatCommentDateTime,
  joinClassNames,
} from '../components/modals/TaskModal/shared';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/modals/ConfirmDialog';
import ImageViewerModal from '../components/modals/ImageViewerModal';

const MAX_FILES = 10;
const FILE_MAX_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getHoursPlural(hours: number): string {
  const h = Math.abs(hours) % 100;
  const h1 = h % 10;
  if (h > 10 && h < 20) return 'часов';
  if (h1 > 1 && h1 < 5) return 'часа';
  if (h1 === 1) return 'час';
  return 'часов';
}

function formatEstimation(seconds: number): string {
  if (!seconds) return 'Не указана';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const hoursText = `${hours} ${getHoursPlural(hours)}`;
  if (minutes > 0) {
    return `${hoursText} ${String(minutes).padStart(2, '0')} мин.`;
  }
  return hoursText;
}

export default function PublicTaskPage() {
  const token = window.location.pathname.split('/').pop();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [taskData, setTaskData] = useState<PublicTask | null>(null);
  const [messages, setMessages] = useState<TaskClientMessage[]>([]);

  const [messageText, setMessageText] = useState('');
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    try {
      const response = await publicApi.getTask(token);
      setTaskData(response.data.task);
      setMessages(response.data.messages ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleFilesChange = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    const oversized = incoming.find((f) => f.size > FILE_MAX_BYTES);
    if (oversized) {
      toast.error(`Файл «${oversized.name}» больше 20 МБ.`);
      return;
    }
    setMessageFiles((curr) => {
      const merged = [...curr];
      for (const file of incoming) {
        if (merged.length >= MAX_FILES) {
          toast.error(`Можно прикрепить не более ${MAX_FILES} файлов.`);
          break;
        }
        merged.push(file);
      }
      return merged;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  };
  const handleDragLeave = () => {
    setIsDragActive(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const items = Array.from(e.dataTransfer.items ?? []);
    const files = items
      .filter((i) => i.kind === 'file')
      .map((i) => i.getAsFile())
      .filter((f): f is File => Boolean(f));
    handleFilesChange(files.length > 0 ? files : Array.from(e.dataTransfer.files ?? []));
  };
  const removeFile = (index: number) => {
    setMessageFiles((curr) => curr.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!token) return;
    const trimmed = messageText.trim();
    if (!trimmed && messageFiles.length === 0) return;

    try {
      setIsSubmitting(true);
      const created = await publicApi.sendMessage(token, {
        text: trimmed || undefined,
        files: messageFiles,
      });
      setMessages((curr) => [...curr, created]);
      setMessageText('');
      setMessageFiles([]);
      toast.success('Сообщение отправлено');
    } catch {
      toast.error('Ошибка при отправке сообщения');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!token) return;
    try {
      setIsApproving(true);
      if (messageText.trim() || messageFiles.length > 0) {
        await handleSendMessage();
      }
      await publicApi.approve(token);
      setTaskData((prev) =>
        prev ? { ...prev, client_approval_status: 'approved' } : prev,
      );
      setIsApproveConfirmOpen(false);
      toast.success('Задача согласована!');
    } catch {
      toast.error('Не удалось согласовать задачу');
    } finally {
      setIsApproving(false);
    }
  };

  const performDownload = async (id: string, url: string, originalName: string) => {
    try {
      setDownloadingAttachmentId(id);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Ошибка скачивания');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = originalName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Не удалось скачать файл.');
    } finally {
      setDownloadingAttachmentId('');
    }
  };

  const downloadCommentAttachment = (attachment: TaskClientMessageAttachment) => {
    if (!token) return;
    const url = publicApi.getAttachmentDownloadUrl(token, attachment.id);
    void performDownload(attachment.id, url, attachment.original_name);
  };

  const downloadTaskAttachment = (attachment: PublicTaskAttachment) => {
    if (!token) return;
    const url = publicApi.getTaskAttachmentDownloadUrl(token, attachment.id);
    void performDownload(attachment.id, url, attachment.original_name);
  };

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50'>
        <div className='size-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4'>
        <h1 className='text-2xl font-bold text-slate-800'>Ссылка недоступна</h1>
        <p className='mt-2 text-center text-slate-500'>
          Возможно, срок действия ссылки истёк или она была отключена.
        </p>
      </div>
    );
  }

  const isApproved = taskData.client_approval_status === 'approved';
  // Задачу архивного проекта можно только просматривать.
  const isReadOnly = Boolean(taskData.is_read_only);

  return (
    <div className='flex h-[100dvh] flex-col overflow-y-auto bg-slate-50 font-sans text-slate-900 public-page-font'>
      <Toaster position='top-center' />

      <header className='shrink-0 border-b border-slate-200 bg-white'>
        <div className='mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-4 sm:px-6'>
          <img src='/logo_text.png' alt='ФЛОУ' className='h-10 w-auto' />
          <a
            href='https://flow-erp.ru/'
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-base font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900'
          >
            Что такое ФЛОУ?
            <svg viewBox='0 0 20 20' className='size-4 fill-none stroke-current stroke-2'>
              <path d='M5 15l10-10m0 0H7m8 0v8' />
            </svg>
          </a>
        </div>
      </header>

      <main className='mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-3 sm:p-5 lg:py-6'>
        <div className='mb-3 flex items-center gap-4 text-sm font-medium'>
          <span className='flex items-center gap-1.5 text-slate-600'>
            <svg
              viewBox='0 0 24 24'
              className='size-3.5 fill-none stroke-current stroke-2'
            >
              <rect x='3' y='4' width='18' height='16' rx='2' />
              <path d='M8 8h8M8 12h8M8 16h4' />
            </svg>
            Задача на согласование
          </span>
          <span className='flex items-center gap-1.5 text-blue-600'>
            <svg
              viewBox='0 0 24 24'
              className='size-3.5 fill-none stroke-current stroke-2'
            >
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
            </svg>
            Безопасная ссылка
          </span>
        </div>

        <div className='flex flex-col gap-4 sm:gap-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm'>
          <div>
            <h1 className='text-lg font-bold leading-tight text-slate-900 sm:text-xl'>
              {taskData.title}
            </h1>
            <div className='mt-1 text-sm text-slate-500'>
              Проект:{' '}
              <span className='font-medium text-slate-700'>
                {taskData.project_name || 'Без проекта'}
              </span>
            </div>

            <div className='mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3'>
              <div className='rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2'>
                <div className='flex items-center gap-1.5 text-xs text-slate-500'>
                  <svg
                    viewBox='0 0 24 24'
                    className='size-3 fill-none stroke-current stroke-2'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <path d='M12 6v6l4 2' />
                  </svg>
                  Оценка
                </div>
                <div className='mt-0.5 text-sm font-semibold text-slate-800'>
                  {taskData.estimation
                    ? formatEstimation(taskData.estimation)
                    : 'Не указана'}
                </div>
              </div>
              <div className='rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2'>
                <div className='flex items-center gap-1.5 text-xs text-slate-500'>
                  <svg
                    viewBox='0 0 24 24'
                    className='size-3 fill-none stroke-current stroke-2'
                  >
                    <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
                    <path d='M16 2v4M8 2v4M3 10h18' />
                  </svg>
                  Дедлайн
                </div>
                <div className='mt-0.5 text-sm font-semibold text-slate-800'>
                  {taskData.deadline
                    ? new Date(taskData.deadline)
                        .toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        .replace(',', '')
                    : 'Не указан'}
                </div>
              </div>
              <div className='rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2'>
                <div className='flex items-center gap-1.5 text-xs text-slate-500'>
                  <svg
                    viewBox='0 0 24 24'
                    className='size-3 fill-none stroke-current stroke-2'
                  >
                    <path d='M20 6L9 17l-5-5' />
                  </svg>
                  Статус
                </div>
                <div
                  className={joinClassNames(
                    'mt-0.5 text-sm font-semibold',
                    isApproved ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {isApproved ? 'Согласовано' : 'Ожидает согласования'}
                </div>
              </div>
            </div>
          </div>

          {taskData.description && (
            <div className='flex flex-col overflow-hidden rounded-xl border border-slate-200'>
              <div className='border-b border-slate-100 bg-slate-50/50 px-4 py-3'>
                <h3 className='text-base font-bold text-slate-900'>Описание задачи</h3>
              </div>
              <div className='max-h-[500px] overflow-y-auto p-4 sm:p-5'>
                <div
                  className='task-description-prose max-w-none text-sm leading-relaxed text-slate-700 break-words'
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(taskData.description),
                  }}
                  onClick={(e) => {
                    const target = e.target;
                    if (target instanceof HTMLImageElement) {
                      e.preventDefault();
                      setSelectedImage({ src: target.src, alt: target.alt });
                    }
                  }}
                />
              </div>
            </div>
          )}

          {taskData.attachments && taskData.attachments.length > 0 && (
            <div className='flex flex-col overflow-hidden rounded-xl border border-slate-200'>
              <div className='border-b border-slate-100 bg-slate-50/50 px-4 py-3'>
                <h3 className='text-base font-bold text-slate-900'>Вложения</h3>
              </div>
              <div className='max-h-[250px] overflow-y-auto p-2 sm:p-3'>
                <div className='divide-y divide-slate-100'>
                  {taskData.attachments.map((att) => (
                    <div
                      key={att.id}
                      className='flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg transition-colors'
                    >
                      <div className='flex min-w-0 items-center gap-2.5'>
                        <div className='flex size-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 shadow-sm'>
                          {att.mime_type?.startsWith('image/') ? (
                            <svg
                              viewBox='0 0 24 24'
                              className='size-3.5 fill-none stroke-blue-500 stroke-2'
                            >
                              <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
                              <circle cx='8.5' cy='8.5' r='1.5' />
                              <path d='M21 15l-5-5L5 21' />
                            </svg>
                          ) : att.mime_type === 'application/pdf' ? (
                            <svg
                              viewBox='0 0 24 24'
                              className='size-3.5 fill-none stroke-red-500 stroke-2'
                            >
                              <path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' />
                              <polyline points='14 2 14 8 20 8' />
                              <path d='M10 13h4M10 17h4M8 9h2' />
                            </svg>
                          ) : (
                            <svg
                              viewBox='0 0 24 24'
                              className='size-3.5 fill-none stroke-slate-500 stroke-2'
                            >
                              <path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' />
                              <polyline points='14 2 14 8 20 8' />
                            </svg>
                          )}
                        </div>
                        <span className='min-w-0 truncate text-sm font-medium text-slate-800'>
                          {att.original_name}
                        </span>
                      </div>
                      <div className='flex shrink-0 items-center gap-3'>
                        <span className='text-xs text-slate-400'>
                          {formatFileSize(att.size)}
                        </span>
                        <button
                          type='button'
                          onClick={() => downloadTaskAttachment(att)}
                          className='flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-slate-50 shadow-sm'
                        >
                          {downloadingAttachmentId === att.id ? (
                            <div className='size-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600' />
                          ) : (
                            <svg
                              viewBox='0 0 24 24'
                              className='size-3 fill-none stroke-current stroke-2'
                            >
                              <path d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
                            </svg>
                          )}
                          Скачать
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className='flex flex-col overflow-hidden rounded-xl border border-slate-200'>
              <div className='border-b border-slate-100 bg-slate-50/50 px-4 py-3'>
                <h3 className='text-base font-bold text-slate-900'>Обсуждение</h3>
              </div>
              <div className='max-h-[300px] overflow-y-auto p-4 sm:p-5 bg-slate-50/30'>
                <div className='space-y-3'>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={joinClassNames(
                        'rounded-lg border p-3 shadow-sm',
                        msg.is_from_client
                          ? 'border-blue-100 bg-blue-50/50'
                          : 'border-slate-200 bg-white',
                      )}
                    >
                      <div className='flex items-center justify-between text-sm'>
                        <span className='font-semibold text-slate-800'>
                          {msg.author
                            ? `${msg.author.name || ''} ${msg.author.last_name || ''}`.trim()
                            : msg.is_from_client
                              ? 'Вы'
                              : msg.author_name || 'Сотрудник'}
                        </span>
                        <span className='text-xs text-slate-500'>
                          {formatCommentDateTime(msg.created_at)}
                        </span>
                      </div>
                      {msg.text && (
                        <div className='mt-1.5 text-sm text-slate-700 whitespace-pre-wrap break-words'>
                          {msg.text}
                        </div>
                      )}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className='mt-2.5 flex flex-wrap gap-2'>
                          {msg.attachments.map((att) => (
                            <button
                              key={att.id}
                              type='button'
                              onClick={() => downloadCommentAttachment(att)}
                              className='flex w-fit items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-blue-600 transition hover:bg-slate-50 shadow-sm'
                            >
                              {downloadingAttachmentId === att.id ? (
                                <div className='size-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600' />
                              ) : (
                                <svg
                                  viewBox='0 0 24 24'
                                  className='size-3 fill-none stroke-current stroke-2'
                                >
                                  <path d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
                                </svg>
                              )}
                              {att.original_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isReadOnly ? (
            <div className='rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 shadow-sm mt-2'>
              <h3 className='text-base font-bold text-slate-900'>Решение по задаче</h3>
              <p className='mt-0.5 text-xs text-slate-500'>
                {isApproved
                  ? 'Задача согласована. Вы можете оставить дополнительный комментарий.'
                  : 'Подтвердите оценку и состав работ или оставьте комментарий'}
              </p>

              <div
                className={joinClassNames(
                  'mt-3 rounded-lg border bg-white transition-colors shadow-sm',
                  isDragActive ? 'border-blue-400 bg-blue-50/30' : 'border-slate-300',
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder='Комментарий (необязательно)'
                  rows={2}
                  className='block w-full resize-none rounded-t-lg border-none bg-transparent p-3 text-sm outline-none focus:ring-0'
                />

                {messageFiles.length > 0 && (
                  <div className='border-t border-slate-100 p-2'>
                    <div className='flex flex-wrap gap-1.5'>
                      {messageFiles.map((file, i) => (
                        <div
                          key={i}
                          className='flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px]'
                        >
                          <span className='max-w-[120px] truncate'>{file.name}</span>
                          <button
                            onClick={() => removeFile(i)}
                            className='text-slate-400 hover:text-slate-700'
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className='flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-1.5 rounded-b-lg'>
                  <div>
                    <button
                      type='button'
                      onClick={() => fileInputRef.current?.click()}
                      className='flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors'
                    >
                      <svg
                        viewBox='0 0 24 24'
                        className='size-3.5 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
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
                      className='hidden'
                      onChange={(e) => handleFilesChange(e.target.files)}
                    />
                  </div>

                  <button
                    type='button'
                    onClick={handleSendMessage}
                    disabled={
                      isSubmitting || (!messageText.trim() && messageFiles.length === 0)
                    }
                    className='flex h-7 items-center justify-center rounded bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    {isSubmitting ? '...' : 'Отправить'}
                  </button>
                </div>
              </div>

              <div className='mt-4 flex justify-center'>
                {!isApproved ? (
                  <Button
                    variant='danger'
                    className='h-9 min-w-[200px] text-sm font-semibold'
                    disabled={isSubmitting || isApproving}
                    onClick={() => setIsApproveConfirmOpen(true)}
                  >
                    <svg
                      viewBox='0 0 24 24'
                      className='mr-1.5 size-4 fill-none stroke-current stroke-2'
                    >
                      <path d='M20 6L9 17l-5-5' />
                    </svg>
                    Согласовать задачу
                  </Button>
                ) : (
                  <Button
                    variant='success'
                    className='h-9 min-w-[200px] text-sm font-semibold'
                    disabled
                  >
                    <svg
                      viewBox='0 0 24 24'
                      className='mr-1.5 size-4 fill-none stroke-current stroke-2'
                    >
                      <path d='M20 6L9 17l-5-5' />
                    </svg>
                    Согласовано
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className='mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500 sm:p-5'>
              Задача доступна только для просмотра.
            </p>
          )}
        </div>

        <footer className='mt-6 flex shrink-0 flex-col items-center justify-center gap-4 text-base text-slate-400 sm:flex-row sm:gap-6'>
          <a href='https://flow-erp.ru' className='hover:text-slate-600'>
            Страница создана в ФЛОУ
          </a>
          <span className='hidden sm:inline'>•</span>
          <a href='https://flow-erp.ru/policy' className='hover:text-slate-600'>
            Политика конфиденциальности
          </a>
        </footer>
      </main>
      <ConfirmDialog
        isOpen={isApproveConfirmOpen}
        isProcessing={isApproving}
        title='Согласовать задачу?'
        message='Согласуйте задачу, когда все детали обсуждены. Отменить согласование будет нельзя.'
        confirmLabel='Согласовать'
        processingLabel='Согласование...'
        onClose={() => setIsApproveConfirmOpen(false)}
        onConfirm={() => void handleApprove()}
      />
      {selectedImage ? (
        <ImageViewerModal
          isOpen
          src={selectedImage.src}
          alt={selectedImage.alt}
          onClose={() => setSelectedImage(null)}
        />
      ) : null}
    </div>
  );
}
