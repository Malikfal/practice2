import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import type { User } from '../../types/app';
import { fetchDocuments, type LegalDocument } from '../../constants/documents';
import { api } from '../../api/api';
import type { CurrentSubscription } from '../../types/billing';
import NotificationsMenu from '../notifications/NotificationsMenu';
import HeaderIcon from './HeaderIcon';

function SubscriptionAlert({ user }: { user: User | null }) {
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    let isMounted = true;
    api.workspace.billing
      .getSubscription()
      .then((data) => {
        if (isMounted && data) {
          setSubscription(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;

    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  if (
    !subscription ||
    subscription.ends_at === null ||
    subscription.days_left === null ||
    subscription.days_left > 14
  )
    return null;

  return (
    <div className='relative' ref={containerRef}>
      <button
        type='button'
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex size-9 items-center justify-center rounded-xl transition-colors sm:size-10 ${
          isOpen
            ? 'bg-[#FFE0E6] text-[#FF2056]'
            : 'bg-[#FFF0F3] text-[#FF2056] hover:bg-[#FFE0E6]'
        }`}
        aria-label='Уведомление об оплате'
      >
        <svg className='size-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
          />
        </svg>
      </button>

      {isOpen ? (
        <div className='absolute top-[calc(100%+8px)] right-0 z-50 w-64 rounded-xl rounded-xl border border-[#e3e9f3] bg-white p-1.5 shadow-lg shadow-slate-900/10 bg-white p-4'>
          <h4 className='mb-1 text-sm font-bold text-[#FF2056]'>
            Заканчивается подписка
          </h4>
          <p className='mb-4 text-xs text-[#5f73a3]'>
            До конца оплаченного периода осталось{' '}
            <b>{Math.floor(subscription.days_left)} дней</b>. Пожалуйста, оплатите тариф
            для продолжения работы.
          </p>
          <p className='mb-4 text-xs text-[#5f73a3]'>
            Перейдите: <b> {'Настройки -> Подписки и платежи'} </b>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DocumentsMenu({ user }: { user: User | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const isEmployee = Boolean(user) && user?.role !== 'CLIENT';

  // Пока список не загружен, documents пуст и меню не показывается.
  useEffect(() => {
    let isMounted = true;

    fetchDocuments(isEmployee).then((data) => {
      if (isMounted) {
        setDocuments(Array.isArray(data) ? data : []);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isEmployee]);

  useEffect(() => {
    if (!isOpen) return;

    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  if (documents.length === 0) return null;

  return (
    <div className='relative' ref={containerRef}>
      <HeaderIcon
        label='Документы'
        isActive={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <path d='M14 3v4a1 1 0 0 0 1 1h4' />
        <path d='M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z' />
        <path d='M9 13h6' />
        <path d='M9 17h4' />
      </HeaderIcon>

      {isOpen ? (
        <div className='fixed top-18 right-2 left-2 z-50 grid max-h-[calc(100dvh-5rem)] w-auto gap-0.5 overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-1.5 shadow-lg shadow-slate-900/10 sm:absolute sm:top-[calc(100%+8px)] sm:right-0 sm:left-auto sm:max-h-none sm:w-80 sm:max-w-[calc(100vw-1.5rem)] sm:overflow-visible'>
          <div className='px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-[#7e8fb4] uppercase'>
            Документы
          </div>
          {documents.map((doc) => {
            const url = doc.download_url;

            return (
              <div
                key={doc.id}
                className='flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-[#f3f7ff]'
              >
                <a
                  href={url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex min-w-0 flex-1 items-center gap-2.5 text-left'
                  title={`Открыть: ${doc.title}`}
                >
                  <svg
                    className='size-4 shrink-0 fill-none stroke-[#2d6ff7] stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path d='M14 3v4a1 1 0 0 0 1 1h4' />
                    <path d='M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z' />
                  </svg>
                  <span className='min-w-0 break-words text-[13px] leading-snug text-[#1f3565]'>
                    {doc.title}
                  </span>
                </a>
                <a
                  href={url}
                  download={`${doc.title}.pdf`}
                  className='grid size-8 shrink-0 place-items-center rounded-lg border border-[#e3e9f3] text-[#7e8fb4] transition-colors duration-150 hover:border-[#c9d8f8] hover:bg-white hover:text-[#2d6ff7]'
                  aria-label={`Скачать: ${doc.title}`}
                  title='Скачать'
                >
                  <svg
                    className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path d='M12 4v11' />
                    <path d='m8 11 4 4 4-4' />
                    <path d='M5 19h14' />
                  </svg>
                </a>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function WorkspaceHeader({
  user,
  displayName,
  avatarFallback,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onLogout,
}: {
  user: User | null;
  displayName: string;
  avatarFallback: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onLogout: () => void;
}) {
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const isRegisterPage = location.pathname === '/register-company';
  const isClient = user?.role === 'CLIENT';
  const homePath = isClient ? '/projects' : '/home';
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Как у остальных меню шапки: закрывается по клику вне и Escape, не перекрывает колокольчик.
  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) onCloseMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMenu();
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMenuOpen, onCloseMenu]);

  const changePassword = async () => {
    try {
      setIsSavingPassword(true);
      await api.client.changePassword(
        passwords.current,
        passwords.next,
        passwords.confirm,
      );
      setPasswords({ current: '', next: '', confirm: '' });
      setIsPasswordOpen(false);
      toast.success('Пароль изменен.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось изменить пароль.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <header className='h-16 border-b border-[#e3e9f3] bg-white px-2 text-[#1f3565] sm:h-18.5 sm:px-4'>
      <div className='flex h-full items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center'>
          <a href={homePath} aria-label='На главную'>
            <img src='/logo.svg' alt='Флоу' className='size-9 object-contain sm:hidden' />
            <img
              src='/logo_text.png'
              alt='Флоу'
              className='hidden h-10 w-auto object-contain sm:block'
            />
          </a>
        </div>

        <div className='flex min-w-0 items-center gap-1 sm:gap-4'>
          {user ? <SubscriptionAlert user={user} /> : null}

          <div className='flex items-center gap-2 sm:gap-3'>
            <a
              href='/docs/registry-extract-no-35180-2026-09-15.pdf'
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-lg border border-transparent hover:border-[#c9d8f8] hover:bg-[#f3f7ff] transition-all duration-150 group'
              title={
                !isRegisterPage
                  ? 'ПО в реестре российского ПО.\nЗапись № 35180'
                  : undefined
              }
            >
              <img
                src='/reestr-logo.svg'
                alt='Реестр российского ПО'
                className='size-5 sm:size-6 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity'
              />
              {isRegisterPage && (
                <span className='hidden md:block text-[10px] sm:text-[11px] leading-snug text-[#7e8fb4] group-hover:text-[#1f3565] transition-colors text-left'>
                  ПО в реестре российского ПО.
                  <br />
                  Запись № 35180
                </span>
              )}
            </a>
            <a
              href='/docs/state-registration-computer-program.PDF'
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-lg border border-transparent hover:border-[#c9d8f8] hover:bg-[#f3f7ff] transition-all duration-150 group'
              title={
                !isRegisterPage
                  ? 'ПО зарегистрировано в Роспатенте.\nСвидетельство № 2026684334'
                  : undefined
              }
            >
              <img
                src='/sertificate-image.svg'
                alt='Роспатент'
                className='size-5 sm:size-6 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity'
              />
              {isRegisterPage && (
                <span className='hidden md:block text-[10px] sm:text-[11px] leading-snug text-[#7e8fb4] group-hover:text-[#1f3565] transition-colors text-left'>
                  ПО зарегистрировано в Роспатенте.
                  <br />
                  Свидетельство № 2026684334
                </span>
              )}
            </a>
            <a
              href='/docs/сertificate-of-сonformity.pdf'
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-lg border border-transparent hover:border-[#c9d8f8] hover:bg-[#f3f7ff] transition-all duration-150 group'
              title={
                !isRegisterPage
                  ? 'Сертификат соответствия «Сделано в России»\n№ СС. 005278'
                  : undefined
              }
            >
              <img
                src='/made-in-russia-logo-black.svg'
                alt='Сделано в России'
                className='size-5 sm:size-6 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity'
              />
              {isRegisterPage && (
                <span className='hidden md:block text-[10px] sm:text-[11px] leading-snug text-[#7e8fb4] group-hover:text-[#1f3565] transition-colors text-left'>
                  <span className='font-bold'>
                    Сертификат соответствия «Сделано в России»
                  </span>
                  <br />№ СС. 005278
                </span>
              )}
            </a>
          </div>

          <DocumentsMenu user={user} />

          {user ? <NotificationsMenu isClient={isClient} /> : null}

          {user ? (
            <div className='relative min-w-0' ref={userMenuRef}>
              <button
                type='button'
                className='flex max-w-55 cursor-pointer items-center gap-1.5 rounded-full border border-[#e3e9f3] bg-[#f3f7ff] py-1 pr-1 pl-1 text-left text-inherit transition-colors duration-150 hover:border-[#c9d8f8] hover:bg-[#edf3ff] sm:max-w-none sm:gap-3 sm:px-3 sm:py-1.5'
                aria-label='Текущий пользователь'
                aria-expanded={isMenuOpen}
                onClick={onToggleMenu}
              >
                <div
                  className='grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e8eef9] text-[16px] font-semibold text-[#1f3565] sm:size-10 sm:text-[18px]'
                  aria-hidden='true'
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt='Аватар'
                      className='size-full object-cover'
                    />
                  ) : (
                    <span>{avatarFallback}</span>
                  )}
                </div>
                <div className='hidden min-w-0 leading-tight sm:block'>
                  <div className='text-[11px] text-[#7e8fb4]'>Вы вошли как</div>
                  <div className='truncate text-[16px] leading-snug font-semibold'>
                    {displayName}
                  </div>
                </div>
                <svg
                  className={`size-4 shrink-0 fill-none stroke-current stroke-[1.8] text-[#1f3565]/70 transition-transform duration-150 [stroke-linecap:round] [stroke-linejoin:round] ${
                    isMenuOpen ? 'rotate-180' : ''
                  }`}
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path d='m6 9 6 6 6-6' />
                </svg>
              </button>

              {isMenuOpen ? (
                <div className='absolute top-[calc(100%+8px)] right-0 z-50 grid min-w-64 gap-1 rounded-xl border border-[#e3e9f3] bg-white p-1.5 shadow-lg shadow-slate-900/10'>
                  {isClient ? (
                    <div className='grid gap-2 px-2 py-2'>
                      <button
                        type='button'
                        className='w-full rounded-lg px-1 py-1 text-left text-sm text-[#1f3565] transition-colors duration-150 hover:bg-[#f3f7ff]'
                        onClick={() => setIsPasswordOpen((open) => !open)}
                      >
                        Сменить пароль
                      </button>
                      {isPasswordOpen ? (
                        <div className='grid gap-2'>
                          <input
                            className='rounded-lg border border-[#e3e9f3] px-2 py-1.5 text-sm'
                            type='password'
                            placeholder='Текущий пароль'
                            value={passwords.current}
                            onChange={(event) =>
                              setPasswords((current) => ({
                                ...current,
                                current: event.target.value,
                              }))
                            }
                          />
                          <input
                            className='rounded-lg border border-[#e3e9f3] px-2 py-1.5 text-sm'
                            type='password'
                            placeholder='Новый пароль'
                            value={passwords.next}
                            onChange={(event) =>
                              setPasswords((current) => ({
                                ...current,
                                next: event.target.value,
                              }))
                            }
                          />
                          <input
                            className='rounded-lg border border-[#e3e9f3] px-2 py-1.5 text-sm'
                            type='password'
                            placeholder='Повторите пароль'
                            value={passwords.confirm}
                            onChange={(event) =>
                              setPasswords((current) => ({
                                ...current,
                                confirm: event.target.value,
                              }))
                            }
                          />
                          <button
                            type='button'
                            disabled={isSavingPassword}
                            className='rounded-lg bg-[#2d6ff7] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60'
                            onClick={() => void changePassword()}
                          >
                            Сохранить пароль
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type='button'
                    className='w-full rounded-lg px-3 py-2 text-left text-sm text-[#1f3565] transition-colors duration-150 hover:bg-[#f3f7ff]'
                    onClick={onLogout}
                  >
                    Выйти
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
