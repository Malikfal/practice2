import { Toaster } from 'sonner';
import {
  startTransition,
  Suspense,
  useCallback,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';

import TrackerDownload from './TrackerDownload';
import WorkspaceHeader from './WorkspaceHeader';
import { ProLockMark } from '../tariff/ProBadge';
import Preloader from '../ui/Preloader';
import { useAppControllerContext } from '../../context/AppControllerContext';
import { getTariffAccess } from '../../hooks/useTariffAccess';

const MENU_ICON_PATHS: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h5v-6h4v6h5V9.5'],
  projects: [
    'M4 7.5A2.5 2.5 0 0 1 6.5 5H9l2 2h6.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z',
    'M8 13h8',
  ],
  employees: [
    'M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19',
    'M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M20 19v-1.2a3 3 0 0 0-2.2-2.9',
    'M16 5.2a3 3 0 0 1 0 5.6',
  ],
  clients: [
    'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2',
    'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M19 8v6',
    'M22 11h-6',
  ],
  reports: ['M5 3h10l4 4v14H5V3Z', 'M15 3v5h4', 'M8 13h8', 'M8 17h5'],
  finances: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6'],
  payroll: [
    'M3 6.5h18v11H3v-11Z',
    'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    'M6.5 9.5v.01',
    'M17.5 14.5v.01',
  ],
  'knowledge-base': [
    'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z',
    'M8 7h8',
    'M8 11h8',
  ],
  'role-permissions': [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2.1 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.6a7 7 0 0 0 2.1-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z',
  ],
};

function MenuIcon({ id }: { id: string }) {
  const paths = MENU_ICON_PATHS[id] ?? MENU_ICON_PATHS.home;

  return (
    <svg
      viewBox='0 0 24 24'
      className='size-4 shrink-0 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export default function AppLayout({
  children,
  pageLabel,
}: {
  children: ReactNode;
  pageLabel?: string;
}) {
  const controller = useAppControllerContext();
  const {
    user,
    displayName,
    avatarFallback,
    isUserMenuOpen,
    setIsUserMenuOpen,
    onLogout,
    menuItems,
    currentPageId,
  } = controller;
  // У клиента один раздел — проекты, поэтому левое меню и заголовок раздела ему не нужны.
  const isClient = user?.role === 'CLIENT';
  const hasSidebar = Boolean(user && !isClient && menuItems.length);
  const shouldShowContentTitle = Boolean(user && !isClient && !hasSidebar && pageLabel);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const closeUserMenu = useCallback(() => setIsUserMenuOpen(false), [setIsUserMenuOpen]);
  const tariffAccess = getTariffAccess(user);
  // Раздел целиком закрыт тарифом ФРИ: пункт остаётся в меню с меткой и ведёт на заглушку.
  const isMenuItemProLocked = (itemId: string) =>
    itemId === 'payroll' && tariffAccess.isFeatureLocked('payroll');
  // Страницы хранят открытую карточку в своём состоянии, поэтому клик по активному
  // разделу пересоздаёт страницу: она заново читает URL и открывается со списка.
  const [pageResetKey, setPageResetKey] = useState(0);

  const onMenuItemClick = (event: MouseEvent<HTMLAnchorElement>, isActive: boolean) => {
    const isPlainClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    if (!isActive || !isPlainClick) return;
    // В одном переходе с навигацией, чтобы новая страница сразу получила новый URL.
    startTransition(() => setPageResetKey((prev) => prev + 1));
  };
  // Страницы грузятся лениво: пока чанк идёт, шапка и меню остаются на месте.
  const content = (
    <Suspense
      fallback={
        <div className='flex h-full min-h-40 items-center justify-center'>
          <Preloader size='lg' />
        </div>
      }
    >
      {children}
    </Suspense>
  );

  return (
    <main className='app-viewport overflow-hidden bg-[#f7f9fc] p-1 text-[#1f3565] antialiased sm:p-2'>
      <section className='flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white'>
        <div className='relative z-40 shrink-0'>
          <WorkspaceHeader
            user={user}
            displayName={displayName}
            avatarFallback={avatarFallback}
            isMenuOpen={isUserMenuOpen}
            onToggleMenu={() => setIsUserMenuOpen((prev: boolean) => !prev)}
            onCloseMenu={closeUserMenu}
            onLogout={onLogout}
          />
        </div>

        {!user ? (
          <section className='flex min-h-0 flex-1 justify-center overflow-auto bg-[#f7f9fc] p-4 pt-6 sm:pt-10'>
            {content}
          </section>
        ) : hasSidebar ? (
          <div
            className={`grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 bg-[#f7f9fc] p-2 lg:grid-rows-1 ${
              isSidebarCollapsed
                ? 'lg:grid-cols-[76px_minmax(0,1fr)]'
                : 'lg:grid-cols-[150px_minmax(0,1fr)]'
            }`}
          >
            <aside className='flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white'>
              <nav
                className={`flex gap-1 overflow-x-auto p-2 text-[12px] leading-none font-medium lg:overflow-visible ${
                  isSidebarCollapsed
                    ? 'lg:flex-col lg:items-center'
                    : 'lg:block lg:space-y-1'
                }`}
              >
                {menuItems.map((item) => {
                  const isActive = currentPageId === item.id;

                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={(event) => onMenuItemClick(event, isActive)}
                      className={`flex items-center transition-colors duration-150 ${
                        isSidebarCollapsed
                          ? `h-10 min-w-max gap-2 rounded-lg border border-transparent px-3 lg:size-10 lg:min-w-0 lg:justify-center lg:px-0 ${
                              isActive
                                ? 'bg-[#f1f6ff] text-[#2d6ff7]'
                                : 'text-[#1f3565] hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
                            }`
                          : `w-auto min-w-max gap-2 rounded-lg px-3 py-2.5 text-left lg:w-full lg:min-w-0 lg:px-2 lg:py-2 ${
                              isActive
                                ? 'bg-[#f1f6ff] text-[#2d6ff7] lg:rounded-r-lg lg:border-l-4 lg:border-[#2d6ff7]'
                                : 'text-[#1f3565] hover:bg-[#f3f7ff] lg:border-l-4 lg:border-transparent'
                            }`
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={isSidebarCollapsed ? item.label : undefined}
                      title={isSidebarCollapsed ? item.label : undefined}
                    >
                      {/* Меню узкое: метка «ПРО» — замок на иконке, название не теснит. */}
                      <span className='relative inline-flex shrink-0'>
                        <MenuIcon id={item.id} />
                        {isMenuItemProLocked(item.id) ? (
                          <ProLockMark className='absolute -top-1.5 -right-1.5' />
                        ) : null}
                      </span>
                      <span
                        className={
                          isSidebarCollapsed
                            ? 'whitespace-nowrap lg:sr-only'
                            : 'min-w-0 whitespace-nowrap leading-snug lg:truncate'
                        }
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              <div className='hidden min-h-0 flex-1 lg:block' />
              {user ? (
                <div
                  className={`hidden px-2 lg:block ${
                    isSidebarCollapsed ? 'lg:flex lg:justify-center' : ''
                  }`}
                >
                  <TrackerDownload
                    userId={user.id}
                    isCollapsed={isSidebarCollapsed}
                    isLocked={tariffAccess.isFeatureLocked('tracker')}
                  />
                </div>
              ) : null}
              <div
                className={`hidden p-4 lg:block ${
                  isSidebarCollapsed ? 'lg:flex lg:justify-center' : ''
                }`}
              >
                <button
                  type='button'
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className='grid size-11 place-items-center rounded-lg border border-[#e3e9f3] text-[18px] text-[#7e8fb4] transition-colors duration-150 hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
                  aria-label={isSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
                  title={isSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
                >
                  {isSidebarCollapsed ? (
                    <svg
                      viewBox='0 0 24 24'
                      className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                      aria-hidden='true'
                    >
                      <circle cx='4' cy='6' r='1' fill='currentColor' stroke='none' />
                      <circle cx='4' cy='12' r='1' fill='currentColor' stroke='none' />
                      <circle cx='4' cy='18' r='1' fill='currentColor' stroke='none' />
                      <line x1='9' y1='6' x2='20' y2='6' />
                      <line x1='9' y1='12' x2='20' y2='12' />
                      <line x1='9' y1='18' x2='20' y2='18' />
                    </svg>
                  ) : (
                    '«'
                  )}
                </button>
              </div>
            </aside>

            <section className='min-h-0 overflow-hidden'>
              <div key={pageResetKey} className='h-full min-h-0'>
                {content}
              </div>
            </section>
          </div>
        ) : (
          <section className='flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f9fc] p-2'>
            {shouldShowContentTitle ? (
              <div className='mb-2 rounded-xl border border-[#e3e9f3] bg-white px-4 py-3'>
                <h2 className='text-[18px] leading-none font-semibold'>{pageLabel}</h2>
              </div>
            ) : null}
            <div className='min-h-0 flex-1 overflow-hidden'>{content}</div>
          </section>
        )}
      </section>
      <Toaster position='bottom-right' richColors closeButton />
    </main>
  );
}
