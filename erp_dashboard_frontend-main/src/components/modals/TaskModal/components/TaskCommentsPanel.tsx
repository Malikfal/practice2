import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { notificationsStore } from '../../../../notifications/notificationsStore';
import { API_URL } from '../../../../constants/app';
import Button from '../../../ui/Button';
import ConfirmDialog from '../../ConfirmDialog';
import { formatName } from '../../../../utils/formatters';
import type { TaskComment, TaskCommentAttachment, User } from '../../../../types/app';
import {
  encodeMentions,
  findMentionQuery,
  splitMentions,
  type CommentMention,
} from '../../../../utils/commentMentions';
import { formatCommentDateTime, joinClassNames } from '../shared';

const COMMENT_MAX_FILES = 10;
const COMMENT_FILE_MAX_BYTES = 20 * 1024 * 1024;
const MENTION_SUGGESTIONS_LIMIT = 6;

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

export default function TaskCommentsPanel({
  taskId,
  currentUserId,
  canDeleteAnyComment,
  canDeleteOwnComment,
  mentionUsers = [],
}: {
  taskId: string;
  currentUserId: string;
  canDeleteAnyComment: boolean;
  canDeleteOwnComment: boolean;
  // Кого можно упомянуть через @: участники проекта.
  mentionUsers?: User[];
}) {
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentions, setMentions] = useState<CommentMention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const commentsListRef = useRef<HTMLDivElement | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [isCommentDragActive, setIsCommentDragActive] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string>('');
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string>('');
  const [commentPendingDelete, setCommentPendingDelete] = useState<TaskComment | null>(
    null,
  );

  const refreshComments = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      return;
    }
    try {
      setIsLoadingComments(true);
      const list = await api.workspace.taskComments.getForTask(taskId);
      setComments([...list].reverse());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить комментарии.',
      );
    } finally {
      setIsLoadingComments(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      return;
    }
    void refreshComments();
  }, [taskId, refreshComments]);

  // Новый комментарий к открытой задаче приходит уведомлением: показываем его сразу, без индикатора загрузки.
  useEffect(() => {
    if (!taskId) return;
    return notificationsStore.onNotification((notification) => {
      if (
        notification.task?.id !== taskId ||
        (notification.type !== 'task.comment_added' &&
          notification.type !== 'task.mentioned')
      ) {
        return;
      }
      api.workspace.taskComments
        .getForTask(taskId)
        .then((list) => setComments([...list].reverse()))
        .catch(() => undefined);
    });
  }, [taskId]);

  useEffect(() => {
    const el = commentsListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments]);

  const handleCommentFilesChange = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);
    const oversized = incoming.find((file) => file.size > COMMENT_FILE_MAX_BYTES);
    if (oversized) {
      toast.error(`Файл «${oversized.name}» больше 20 МБ.`);
      return;
    }

    setCommentFiles((current) => {
      const merged = [...current];
      for (const file of incoming) {
        if (merged.length >= COMMENT_MAX_FILES) {
          toast.error(`Можно прикрепить не более ${COMMENT_MAX_FILES} файлов.`);
          break;
        }
        merged.push(file);
      }
      return merged;
    });

    if (commentFileInputRef.current) {
      commentFileInputRef.current.value = '';
    }
  };

  const handleCommentDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event) || isSubmittingComment) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsCommentDragActive(true);
  };

  const handleCommentDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsCommentDragActive(false);
  };

  const handleCommentDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event) || isSubmittingComment) return;
    event.preventDefault();
    setIsCommentDragActive(false);
    handleCommentFilesChange(getDroppedFiles(event));
  };

  const removeCommentFile = (index: number) => {
    setCommentFiles((current) => current.filter((_, position) => position !== index));
  };

  const mentionSuggestions = useMemo(() => {
    if (!mentionQuery) return [];
    const query = mentionQuery.query.toLowerCase();
    const seen = new Set<string>();
    return mentionUsers
      .filter((user) => {
        if (!user.id || user.id === currentUserId || seen.has(user.id)) return false;
        seen.add(user.id);
        return formatName(user).toLowerCase().includes(query);
      })
      .slice(0, MENTION_SUGGESTIONS_LIMIT);
  }, [currentUserId, mentionQuery, mentionUsers]);

  const updateMentionQuery = (text: string, caret: number) => {
    setMentionQuery(findMentionQuery(text, caret));
    setMentionIndex(0);
  };

  const selectMention = (user: User) => {
    if (!mentionQuery) return;
    const label = formatName(user);
    const caret = commentInputRef.current?.selectionStart ?? commentText.length;
    const before = commentText.slice(0, mentionQuery.start);
    const after = commentText.slice(caret).replace(/^\S*/, '');
    const inserted = `@${label} `;
    const nextText = `${before}${inserted}${after}`;
    const nextCaret = before.length + inserted.length;

    setCommentText(nextText);
    setMentions((current) => [...current, { id: user.id, label }]);
    setMentionQuery(null);
    window.requestAnimationFrame(() => {
      const input = commentInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleCommentKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionQuery || mentionSuggestions.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setMentionIndex(
        (current) =>
          (current + step + mentionSuggestions.length) % mentionSuggestions.length,
      );
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      selectMention(mentionSuggestions[mentionIndex] ?? mentionSuggestions[0]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setMentionQuery(null);
    }
  };

  const submitComment = async () => {
    if (!taskId) return;

    const trimmed = commentText.trim();
    if (!trimmed && commentFiles.length === 0) {
      toast.error('Комментарий должен содержать текст или хотя бы один файл.');
      return;
    }
    try {
      setIsSubmittingComment(true);
      const created = await api.workspace.taskComments.createForTask(taskId, {
        text: trimmed ? encodeMentions(trimmed, mentions) : undefined,
        files: commentFiles,
      });
      setComments((current) => [...current, created]);
      setCommentText('');
      setMentions([]);
      setMentionQuery(null);
      setCommentFiles([]);
      notificationsStore.ownCommentAdded(taskId);
      toast.success('Комментарий добавлен.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось добавить комментарий.',
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const confirmDeleteComment = async () => {
    if (!taskId || !commentPendingDelete) return;
    const comment = commentPendingDelete;

    try {
      setDeletingCommentId(comment.id);
      await api.workspace.taskComments.deleteForTask(taskId, comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      toast.success('Комментарий удалён.');
      setCommentPendingDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось удалить комментарий.',
      );
    } finally {
      setDeletingCommentId('');
    }
  };

  const downloadAttachment = async (attachment: TaskCommentAttachment) => {
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

  const isDeletingPendingComment =
    Boolean(commentPendingDelete) && deletingCommentId === commentPendingDelete?.id;

  return (
    <>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
        {!taskId ? (
          <div className='flex min-h-60 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500'>
            <svg
              viewBox='0 0 24 24'
              className='mb-2 size-8 fill-none stroke-slate-400 stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
              aria-hidden='true'
            >
              <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
            </svg>
            Сначала сохраните задачу, чтобы оставлять комментарии.
          </div>
        ) : (
          <div
            className={joinClassNames(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white transition-colors',
              isCommentDragActive
                ? 'border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
                : 'border-slate-200',
            )}
            onDragOver={handleCommentDragOver}
            onDragLeave={handleCommentDragLeave}
            onDrop={handleCommentDrop}
          >
            <div
              ref={commentsListRef}
              className='min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3'
            >
              {isLoadingComments ? (
                <div className='py-6 text-center text-[12px] text-slate-500'>
                  Загрузка комментариев…
                </div>
              ) : comments.length === 0 ? (
                <div className='py-6 text-center text-[12px] text-slate-500'>
                  Пока нет комментариев.
                </div>
              ) : (
                <ul className='grid gap-3'>
                  {comments.map((comment) => {
                    const authorName = comment.author
                      ? formatName(comment.author)
                      : 'Пользователь';
                    const dateLabel = formatCommentDateTime(comment.created_at);
                    const isDeleting = deletingCommentId === comment.id;
                    const isOwnComment =
                      !!comment.author?.id &&
                      !!currentUserId &&
                      String(comment.author.id) === String(currentUserId);
                    const canDelete =
                      canDeleteAnyComment || (canDeleteOwnComment && isOwnComment);
                    return (
                      <li
                        key={comment.id}
                        className='min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800'
                      >
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0'>
                            <div className='truncate text-[12px] font-semibold text-slate-700'>
                              {authorName}
                            </div>
                            <div className='text-[11px] text-slate-500'>{dateLabel}</div>
                          </div>
                          {canDelete ? (
                            <button
                              type='button'
                              disabled={isDeleting}
                              onClick={() => setCommentPendingDelete(comment)}
                              className='grid size-7 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50'
                              aria-label='Удалить комментарий'
                              title='Удалить комментарий'
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

                        {comment.text ? (
                          <p className='mt-2 whitespace-pre-wrap wrap-break-word text-[13px] leading-relaxed text-slate-800'>
                            {splitMentions(comment.text).map((part, index) =>
                              part.type === 'mention' ? (
                                <span
                                  key={index}
                                  className='rounded bg-blue-50 px-0.5 font-semibold text-blue-600'
                                >
                                  {part.value}
                                </span>
                              ) : (
                                part.value
                              ),
                            )}
                          </p>
                        ) : null}

                        {comment.attachments && comment.attachments.length > 0 ? (
                          <ul className='mt-2 flex min-w-0 flex-col gap-1'>
                            {comment.attachments.map((attachment) => {
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

            <div
              className={joinClassNames(
                'border-t border-slate-100 p-3 transition-colors',
                isCommentDragActive && 'bg-blue-50/70',
              )}
            >
              <div className='relative'>
                {mentionQuery && mentionSuggestions.length > 0 ? (
                  <ul
                    role='listbox'
                    className='absolute bottom-full left-0 z-20 mb-1 max-h-56 w-full max-w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10'
                  >
                    {mentionSuggestions.map((user, index) => (
                      <li key={user.id}>
                        <button
                          type='button'
                          role='option'
                          aria-selected={index === mentionIndex}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectMention(user);
                          }}
                          onMouseEnter={() => setMentionIndex(index)}
                          className={joinClassNames(
                            'block w-full truncate px-3 py-1.5 text-left text-[13px]',
                            index === mentionIndex
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700',
                          )}
                        >
                          {formatName(user)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(event) => {
                    setCommentText(event.target.value);
                    updateMentionQuery(
                      event.target.value,
                      event.target.selectionStart ?? event.target.value.length,
                    );
                  }}
                  onKeyDown={handleCommentKeyDown}
                  onBlur={() => setMentionQuery(null)}
                  placeholder='Напишите комментарий… Чтобы упомянуть коллегу, введите @'
                  rows={3}
                  className={joinClassNames(
                    'block w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
                    isCommentDragActive ? 'border-blue-400' : 'border-slate-300',
                  )}
                />
              </div>

              {isCommentDragActive ? (
                <div className='mt-2 rounded-md border border-dashed border-blue-300 bg-white/80 px-3 py-2 text-center text-[12px] font-medium text-blue-600'>
                  Отпустите файлы, чтобы прикрепить их к комментарию.
                </div>
              ) : null}

              {commentFiles.length > 0 ? (
                <ul className='mt-2 flex flex-col gap-1'>
                  {commentFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className='flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-700'
                    >
                      <span className='min-w-0 truncate' title={file.name}>
                        {file.name}
                      </span>
                      <button
                        type='button'
                        onClick={() => removeCommentFile(index)}
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
                  onClick={() => commentFileInputRef.current?.click()}
                  disabled={
                    isSubmittingComment || commentFiles.length >= COMMENT_MAX_FILES
                  }
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
                  ref={commentFileInputRef}
                  type='file'
                  multiple
                  hidden
                  onChange={(event) => handleCommentFilesChange(event.target.files)}
                />
                <Button
                  type='button'
                  variant={
                    isSubmittingComment ||
                    (!commentText.trim() && commentFiles.length === 0)
                      ? 'secondary'
                      : 'primary'
                  }
                  disabled={
                    isSubmittingComment ||
                    (!commentText.trim() && commentFiles.length === 0)
                  }
                  onClick={() => void submitComment()}
                >
                  {isSubmittingComment ? 'Отправка…' : 'Отправить'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(commentPendingDelete)}
        isProcessing={isDeletingPendingComment}
        title='Удалить комментарий'
        message='Вы уверены, что хотите удалить этот комментарий? Действие нельзя отменить.'
        confirmLabel='Удалить'
        onClose={() => {
          if (isDeletingPendingComment) return;
          setCommentPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteComment()}
      />
    </>
  );
}
