import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { notificationsStore } from '../../../../notifications/notificationsStore';
import { joinReasons } from '../../../../notifications/notificationText';
import type {
  TaskSubscriptionMode,
  TaskSubscriptionState,
} from '../../../../types/notifications';

type Option = {
  mode: TaskSubscriptionMode | null;
  title: string;
  description: string;
};

const OPTIONS: Option[] = [
  {
    mode: null,
    title: 'По участию',
    description: 'Если вы исполнитель, автор или PM — по настройкам компании.',
  },
  {
    mode: 'watch',
    title: 'Следить за задачей',
    description: 'Все изменения, комментарии и переписка с клиентом.',
  },
  {
    mode: 'mute',
    title: 'Не уведомлять',
    description: 'Ничего по этой задаче, даже если вы исполнитель.',
  },
];

function optionDescription(option: Option, state: TaskSubscriptionState | null): string {
  if (option.mode === null && state && state.relations.length > 0) {
    return joinReasons(state.relations.map((relation) => relation.label));
  }
  // Переписку с клиентом получают только те, у кого есть право её видеть.
  if (option.mode === 'watch' && state && !state.includes_client_messages) {
    return 'Все изменения и комментарии.';
  }
  return option.description;
}

function buttonLabel(state: TaskSubscriptionState | null): string {
  if (state?.mode === 'watch') return 'Вы следите';
  if (state?.mode === 'mute') return 'Без уведомлений';
  return state && state.relations.length > 0 ? 'Уведомления' : 'Следить';
}

function ButtonIcon({ state }: { state: TaskSubscriptionState | null }) {
  const className =
    'size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]';

  if (state?.mode === 'mute') {
    return (
      <svg viewBox='0 0 24 24' className={className} aria-hidden='true'>
        <path d='M8.7 3.7A5 5 0 0 1 17 8v4.2a2 2 0 0 0 .6 1.4L19 15' />
        <path d='M17 18H5l1.4-1.4A2 2 0 0 0 7 15.2V9' />
        <path d='M10 21a2 2 0 0 0 4 0' />
        <path d='m3 3 18 18' />
      </svg>
    );
  }

  if (state?.mode === 'watch' || !state || state.relations.length === 0) {
    return (
      <svg viewBox='0 0 24 24' className={className} aria-hidden='true'>
        <path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z' />
        <circle cx='12' cy='12' r='3' />
      </svg>
    );
  }

  return (
    <svg viewBox='0 0 24 24' className={className} aria-hidden='true'>
      <path d='M14 18H5l1.4-1.4A2 2 0 0 0 7 15.2V11a5 5 0 0 1 10 0v4.2a2 2 0 0 0 .6 1.4L19 18h-5Z' />
      <path d='M10 20a2 2 0 0 0 4 0' />
    </svg>
  );
}

/**
 * «Следить / Не уведомлять» в окне задачи. Монтируется заново для каждой задачи (key = taskId).
 */
export default function TaskWatchMenu({ taskId }: { taskId: string }) {
  const [state, setState] = useState<TaskSubscriptionState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isActive = true;
    api.notifications
      .getTaskSubscription(taskId)
      .then((data) => {
        if (isActive) setState(data);
      })
      .catch(() => {
        // Без состояния кнопка покажет «Следить», выбор всё равно сохранится.
      });

    // Комментарий или ответ клиенту мог включить автоподписку: показываем «Вы следите» сразу.
    const unsubscribe = notificationsStore.onOwnCommentAdded((commentedTaskId) => {
      if (commentedTaskId !== taskId) return;
      api.notifications
        .getTaskSubscription(taskId)
        .then((data) => {
          if (isActive) setState(data);
        })
        .catch(() => undefined);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [taskId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const choose = async (mode: TaskSubscriptionMode | null) => {
    if (isSaving || (state && state.mode === mode)) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSaving(true);
      setState(await api.notifications.updateTaskSubscription(taskId, mode));
      toast.success(
        mode === 'watch'
          ? 'Вы следите за задачей.'
          : mode === 'mute'
            ? 'Уведомления по задаче отключены.'
            : 'Уведомления по задаче — по участию.',
      );
      setIsOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentMode = state?.mode ?? null;
  const isHighlighted = currentMode === 'watch';

  return (
    <div ref={menuRef} className='relative'>
      <button
        type='button'
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[13px] font-medium transition-colors sm:px-3 ${
          isHighlighted
            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
        }`}
        aria-label='Уведомления по задаче'
        aria-expanded={isOpen}
        title='Уведомления по задаче'
      >
        <ButtonIcon state={state} />
        <span className='hidden sm:inline'>{buttonLabel(state)}</span>
      </button>

      {isOpen ? (
        <div className='absolute top-full right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10'>
          <div className='py-1'>
            {OPTIONS.map((option) => {
              const isSelected = currentMode === option.mode;

              return (
                <button
                  key={option.mode ?? 'default'}
                  type='button'
                  disabled={isSaving}
                  onClick={() => void choose(option.mode)}
                  className='flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-60'
                  aria-pressed={isSelected}
                >
                  <span
                    className={`mt-1 grid size-3.5 shrink-0 place-items-center rounded-full border ${
                      isSelected ? 'border-blue-600' : 'border-slate-300'
                    }`}
                    aria-hidden='true'
                  >
                    {isSelected ? (
                      <span className='size-1.5 rounded-full bg-blue-600' />
                    ) : null}
                  </span>
                  <span className='min-w-0'>
                    <span className='block text-[13px] font-medium text-slate-800'>
                      {option.title}
                    </span>
                    <span className='block text-[11px] leading-4 text-slate-500'>
                      {optionDescription(option, state)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className='grid gap-1 border-t border-slate-100 px-3 py-2 text-[11px] leading-4 text-slate-500'>
            {state && state.watchers.length > 0 ? (
              <span>
                Следят: {state.watchers.map((watcher) => watcher.name).join(', ')}
              </span>
            ) : null}
            <button
              type='button'
              onClick={() => {
                setIsOpen(false);
                notificationsStore.openSettings();
              }}
              className='justify-self-start font-medium text-blue-600 hover:text-blue-700'
            >
              Мои уведомления
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
