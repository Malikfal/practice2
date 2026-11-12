import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import HeaderIcon from '../layout/HeaderIcon';
import NotificationSettingsModal from './NotificationSettingsModal';
import {
  notificationsStore,
  useNotifications,
} from '../../notifications/notificationsStore';
import {
  collapsedHint,
  describeNotification,
  formatNotificationTime,
  joinReasons,
  notificationActorName,
  notificationTaskPath,
} from '../../notifications/notificationText';
import type { AppNotification, NotificationScope } from '../../types/notifications';

const BASE_TITLE_PATTERN = /^\(\d+\+?\)\s/;

function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

function reportError(error: unknown, fallback: string) {
  toast.error(error instanceof Error ? error.message : fallback);
}

function NotificationItem({
  notification,
  scope,
  onOpen,
  onMarkRead,
}: {
  notification: AppNotification;
  scope: NotificationScope;
  onOpen: (_notification: AppNotification) => void;
  onMarkRead: (_notification: AppNotification) => void;
}) {
  const isUnread = !notification.read_at;
  const { action, detail } = describeNotification(notification, scope);
  const count = notification.data.count ?? 1;
  const reason = joinReasons(notification.reasons.map((item) => item.label));
  const meta = [notification.project?.name, reason].filter(Boolean).join(' · ');

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(notification);
    }
  };

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={onKeyDown}
      title={reason || undefined}
      className={`group flex cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 outline-none hover:bg-[#f3f7ff] focus-visible:bg-[#f3f7ff] ${
        isUnread ? 'bg-[#f7faff]' : ''
      }`}
    >
      <div className='min-w-0 flex-1'>
        <div
          className={`truncate text-[13px] leading-5 ${
            isUnread ? 'font-semibold text-[#10275a]' : 'font-medium text-[#1f3565]'
          }`}
        >
          {notification.task?.title || 'Задача без названия'}
        </div>
        <div className='mt-0.5 text-[13px] leading-snug text-[#1f3565]'>
          <span className='font-medium'>{notificationActorName(notification)}</span>
          <span className='text-[#5f73a3]'> · </span>
          {action}
          {count > 1 ? (
            <span
              className='ml-1.5 rounded bg-[#eef3ff] px-1 py-px text-[11px] font-medium text-[#5f73a3]'
              title={collapsedHint(notification)}
            >
              ×{count}
            </span>
          ) : null}
        </div>
        {detail ? (
          <div className='mt-0.5 line-clamp-2 text-[12px] leading-snug break-words text-[#5f73a3]'>
            {detail}
          </div>
        ) : null}
        {meta ? (
          <div className='mt-1 truncate text-[11px] text-[#9aa8c7]'>{meta}</div>
        ) : null}
      </div>
      {/* Время в своей колонке; под ним точка, на её месте при наведении галочка прочтения. */}
      <div className='flex shrink-0 flex-col items-end gap-1'>
        <time
          dateTime={notification.created_at}
          className='text-[11px] leading-5 text-[#7e8fb4]'
        >
          {formatNotificationTime(notification.created_at)}
        </time>
        {isUnread ? (
          <div className='relative grid size-6 place-items-center'>
            <span
              className='hidden size-2 rounded-full bg-[#2d6ff7] transition-opacity sm:block sm:group-focus-within:opacity-0 sm:group-hover:opacity-0'
              aria-hidden='true'
            />
            <button
              type='button'
              onClick={(event) => {
                event.stopPropagation();
                onMarkRead(notification);
              }}
              className='absolute inset-0 grid place-items-center rounded-md text-[#7e8fb4] opacity-100 transition-colors hover:bg-white hover:text-[#2d6ff7] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'
              aria-label='Отметить прочитанным'
              title='Отметить прочитанным'
            >
              <svg
                className='size-3.5 fill-none stroke-current stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path d='m5 12 5 5L20 7' />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function NotificationsMenu({ isClient }: { isClient: boolean }) {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scope: NotificationScope =
    notifications.scope ?? (isClient ? 'client' : 'employee');
  const {
    unreadCount,
    items,
    isLoaded,
    isLoading,
    onlyUnread,
    onlyMentions,
    nextCursor,
  } = notifications;
  const closeSettings = useCallback(() => notificationsStore.closeSettings(), []);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isLoaded) return;
    notificationsStore
      .loadFirstPage()
      .catch((error) => reportError(error, 'Не удалось загрузить уведомления.'));
  }, [isOpen, isLoaded]);

  // Число непрочитанных видно и на свёрнутой вкладке браузера.
  useEffect(() => {
    const baseTitle = document.title.replace(BASE_TITLE_PATTERN, '');
    document.title =
      unreadCount > 0 ? `(${badgeLabel(unreadCount)}) ${baseTitle}` : baseTitle;
  }, [unreadCount]);

  useEffect(
    () => () => {
      document.title = document.title.replace(BASE_TITLE_PATTERN, '');
    },
    [],
  );

  const openNotification = (notification: AppNotification) => {
    setIsOpen(false);
    if (!notification.read_at) {
      notificationsStore
        .markRead(notification.id)
        .catch((error) => reportError(error, 'Не удалось отметить уведомление.'));
    }

    const path = notificationTaskPath(notification, scope);
    if (path) navigate(path);
  };

  const markRead = (notification: AppNotification) => {
    notificationsStore
      .markRead(notification.id)
      .catch((error) => reportError(error, 'Не удалось отметить уведомление.'));
  };

  const markAllRead = () => {
    notificationsStore
      .markAllRead()
      .catch((error) => reportError(error, 'Не удалось отметить уведомления.'));
  };

  const loadMore = () => {
    notificationsStore
      .loadMore()
      .catch((error) => reportError(error, 'Не удалось загрузить уведомления.'));
  };

  const tabClasses = (isActive: boolean) =>
    `flex-1 rounded-md px-2 py-1 text-[12px] font-semibold whitespace-nowrap transition-colors ${
      isActive
        ? 'bg-white text-[#2d6ff7] shadow-sm'
        : 'text-[#7e8fb4] hover:text-[#1f3565]'
    }`;

  return (
    <div className='relative' ref={containerRef}>
      <HeaderIcon
        label={
          unreadCount > 0 ? `Уведомления: непрочитанных ${unreadCount}` : 'Уведомления'
        }
        isActive={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        badge={
          unreadCount > 0 ? (
            <span className='absolute -top-1.5 -right-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-[#ff3b5c] px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-white'>
              {badgeLabel(unreadCount)}
            </span>
          ) : null
        }
      >
        <path d='M14 18H5l1.4-1.4A2 2 0 0 0 7 15.2V11a5 5 0 0 1 10 0v4.2a2 2 0 0 0 .6 1.4L19 18h-5Z' />
        <path d='M10 20a2 2 0 0 0 4 0' />
      </HeaderIcon>

      {isOpen ? (
        <div className='fixed top-18 right-2 left-2 z-50 flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white shadow-lg shadow-slate-900/10 sm:absolute sm:top-[calc(100%+8px)] sm:right-0 sm:left-auto sm:max-h-[min(640px,calc(100dvh-6rem))] sm:w-[400px]'>
          <div className='grid gap-2 border-b border-[#eef2f8] px-3 pt-3 pb-2'>
            <div className='flex items-center justify-between gap-2'>
              <h2 className='text-[15px] font-semibold text-[#10275a]'>Уведомления</h2>
              <div className='flex items-center gap-1'>
                <button
                  type='button'
                  disabled={unreadCount === 0}
                  onClick={markAllRead}
                  className='rounded-md px-2 py-1 text-[12px] font-semibold text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff] disabled:cursor-default disabled:text-[#b8c4dd] disabled:hover:bg-transparent'
                >
                  Прочитать все
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setIsOpen(false);
                    notificationsStore.openSettings();
                  }}
                  className='grid size-8 place-items-center rounded-lg text-[#7e8fb4] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
                  aria-label='Настроить уведомления'
                  title='Мои уведомления'
                >
                  <svg
                    className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path d='M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' />
                    <path d='M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' />
                  </svg>
                </button>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <div className='flex w-full gap-0.5 rounded-lg bg-[#f1f5fc] p-0.5'>
                <button
                  type='button'
                  className={tabClasses(!onlyUnread && !onlyMentions)}
                  onClick={() => notificationsStore.setTab('all')}
                >
                  Все
                </button>
                <button
                  type='button'
                  className={tabClasses(onlyUnread)}
                  onClick={() => notificationsStore.setTab('unread')}
                >
                  Непрочитанные{unreadCount > 0 ? ` (${badgeLabel(unreadCount)})` : ''}
                </button>
                {scope !== 'client' ? (
                  <button
                    type='button'
                    className={tabClasses(onlyMentions)}
                    onClick={() => notificationsStore.setTab('mentions')}
                  >
                    Упоминания
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1.5'>
            {!isLoaded ? (
              <div className='grid min-h-32 place-items-center'>
                <div className='size-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
              </div>
            ) : items.length === 0 ? (
              <div className='grid justify-items-center gap-1.5 px-6 py-10 text-center'>
                <svg
                  className='size-8 fill-none stroke-[#c3cfe6] stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path d='M14 18H5l1.4-1.4A2 2 0 0 0 7 15.2V11a5 5 0 0 1 10 0v4.2a2 2 0 0 0 .6 1.4L19 18h-5Z' />
                  <path d='M10 20a2 2 0 0 0 4 0' />
                </svg>
                <div className='text-[13px] font-semibold text-[#1f3565]'>
                  {onlyUnread
                    ? 'Всё прочитано'
                    : onlyMentions
                      ? 'Вас пока не упоминали'
                      : 'Уведомлений пока нет'}
                </div>
                <div className='text-[12px] leading-snug text-[#7e8fb4]'>
                  {scope === 'client'
                    ? 'Здесь появятся ответы и изменения по задачам ваших проектов.'
                    : 'Здесь появятся изменения по задачам, где вы исполнитель, автор, PM или наблюдатель.'}
                </div>
              </div>
            ) : (
              <div className='grid grid-cols-1 gap-0.5'>
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    scope={scope}
                    onOpen={openNotification}
                    onMarkRead={markRead}
                  />
                ))}
                {nextCursor ? (
                  <button
                    type='button'
                    disabled={isLoading}
                    onClick={loadMore}
                    className='mt-1 rounded-lg px-3 py-2 text-[12px] font-semibold text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff] disabled:opacity-60'
                  >
                    {isLoading ? 'Загрузка...' : 'Показать ещё'}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <NotificationSettingsModal
        isOpen={notifications.isSettingsOpen}
        scope={scope}
        onClose={closeSettings}
      />
    </div>
  );
}
