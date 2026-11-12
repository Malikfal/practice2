import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { api } from '../../api/api';
import Button from '../ui/Button';
import type {
  NotificationScope,
  PersonalNotificationSettings,
} from '../../types/notifications';

function SettingsDialog({
  scope,
  onClose,
}: {
  scope: NotificationScope;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<PersonalNotificationSettings | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [autoWatch, setAutoWatch] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const shouldCloseOnBackdropClickRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    api.notifications
      .getSettings(scope)
      .then((data) => {
        if (!isActive) return;
        setSettings(data);
        setEnabled(
          Object.fromEntries(data.events.map((event) => [event.key, event.enabled])),
        );
        setAutoWatch(data.auto_watch ?? true);
      })
      .catch((error) => {
        if (isActive) {
          setLoadError(
            error instanceof Error ? error.message : 'Не удалось загрузить настройки.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [scope]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isSaving, onClose]);

  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      settings.events.some((event) => enabled[event.key] !== event.enabled) ||
      (settings.auto_watch !== null && settings.auto_watch !== autoWatch)
    );
  }, [settings, enabled, autoWatch]);

  const save = async () => {
    if (!settings) return;
    try {
      setIsSaving(true);
      await api.notifications.updateSettings(scope, {
        events: settings.events.map((event) => ({
          key: event.key,
          enabled: enabled[event.key] ?? event.enabled,
        })),
        auto_watch: settings.auto_watch === null ? null : autoWatch,
      });
      toast.success('Настройки уведомлений сохранены.');
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить настройки.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className='fixed inset-0 z-[1100] grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;
        if (shouldClose && !isSaving) onClose();
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='notification-settings-title'
        className='flex max-h-[calc(100dvh-1rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white shadow-2xl shadow-slate-900/20 md:rounded-2xl'
      >
        <div className='border-b border-[#eef2f8] px-4 pt-4 pb-3'>
          <h2
            id='notification-settings-title'
            className='text-base font-semibold text-[#10275a]'
          >
            Мои уведомления
          </h2>
          <p className='mt-1 text-[13px] leading-5 text-[#5f7095]'>
            {scope === 'client'
              ? 'Выберите, о чём сообщать по задачам ваших проектов.'
              : 'Выберите, о чём сообщать в колокольчике. Кому из участников задачи приходят события, задаёт администратор в настройках рабочего пространства.'}
          </p>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 py-3'>
          {loadError ? (
            <div className='grid min-h-40 place-items-center text-center text-[13px] text-[#c2410c]'>
              {loadError}
            </div>
          ) : !settings ? (
            <div className='grid min-h-40 place-items-center'>
              <div className='size-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
            </div>
          ) : (
            <div className='grid gap-4'>
              {settings.groups.map((group) => (
                <section key={group.key} className='grid gap-1'>
                  <h3 className='px-1 text-[11px] font-semibold tracking-wide text-[#7e8fb4] uppercase'>
                    {group.label}
                  </h3>
                  {settings.events
                    .filter((event) => event.group === group.key)
                    .map((event) => (
                      <label
                        key={event.key}
                        className={`flex items-start gap-3 rounded-lg px-2 py-2 ${
                          event.available
                            ? 'cursor-pointer hover:bg-[#f7faff]'
                            : 'cursor-default'
                        }`}
                      >
                        <input
                          type='checkbox'
                          className='mt-0.5 size-4.5 shrink-0 accent-[#2d6ff7]'
                          checked={
                            event.available && (enabled[event.key] ?? event.enabled)
                          }
                          disabled={!event.available || isSaving}
                          onChange={(changeEvent) =>
                            setEnabled((current) => ({
                              ...current,
                              [event.key]: changeEvent.target.checked,
                            }))
                          }
                        />
                        <span className='min-w-0'>
                          <span
                            className={`block text-[14px] leading-5 ${
                              event.available ? 'text-[#1f3565]' : 'text-[#9aa8c7]'
                            }`}
                          >
                            {event.label}
                          </span>
                          {!event.available ? (
                            <span className='block text-[12px] leading-4 text-[#9aa8c7]'>
                              Отключено в настройках компании
                            </span>
                          ) : event.hint ? (
                            <span className='block text-[12px] leading-4 text-[#7e8fb4]'>
                              {event.hint}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                </section>
              ))}

              {settings.auto_watch !== null ? (
                <section className='grid gap-1 border-t border-[#eef2f8] pt-3'>
                  <h3 className='px-1 text-[11px] font-semibold tracking-wide text-[#7e8fb4] uppercase'>
                    Подписка на задачи
                  </h3>
                  <label className='flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-[#f7faff]'>
                    <input
                      type='checkbox'
                      className='mt-0.5 size-4.5 shrink-0 accent-[#2d6ff7]'
                      checked={autoWatch}
                      disabled={isSaving}
                      onChange={(event) => setAutoWatch(event.target.checked)}
                    />
                    <span className='min-w-0'>
                      <span className='block text-[14px] leading-5 text-[#1f3565]'>
                        Следить за задачами, которые я прокомментировал(-а)
                      </span>
                      <span className='block text-[12px] leading-4 text-[#7e8fb4]'>
                        После комментария или ответа клиенту приходят все уведомления по
                        задаче. Отписаться можно в окне задачи.
                      </span>
                    </span>
                  </label>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <div className='grid gap-2 border-t border-[#eef2f8] px-4 py-3 sm:flex sm:justify-end'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            disabled={isSaving}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={!isDirty || isSaving}
            onClick={() => void save()}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Личные настройки уведомлений. Окно монтируется заново при каждом открытии и всегда показывает свежие данные.
 */
export default function NotificationSettingsModal({
  isOpen,
  scope,
  onClose,
}: {
  isOpen: boolean;
  scope: NotificationScope;
  onClose: () => void;
}) {
  if (!isOpen || typeof document === 'undefined') return null;

  // Порталом в body: шапка — отдельный слой (z-40), а окно должно быть поверх окна задачи.
  return createPortal(<SettingsDialog scope={scope} onClose={onClose} />, document.body);
}
