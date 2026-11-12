import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import type { RolePermissionMatrixRole } from '../../../../types/app';

type Props = {
  role: RolePermissionMatrixRole;
  disabled?: boolean;
  onRename: (_role: RolePermissionMatrixRole) => void;
  onDelete: (_role: RolePermissionMatrixRole) => void;
};

const MENU_WIDTH = 176;
const VIEWPORT_GAP = 8;

function menuPosition(button: HTMLButtonElement | null) {
  if (!button) return null;

  const rect = button.getBoundingClientRect();

  return {
    top: rect.bottom + 4,
    left: Math.max(
      VIEWPORT_GAP,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP),
    ),
  };
}

export default function RoleActionsMenu({
  role,
  disabled = false,
  onRename,
  onDelete,
}: Props) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isOpen = position !== null;
  // Системные роли удалить нельзя, им оставляем только переименование.
  const canDelete = !role.is_immutable;

  const close = (restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) buttonRef.current?.focus();
  };

  // Меню рендерится в body: таблица ролей обрезает всё, что выходит за её скролл.
  const open = () => setPosition(menuPosition(buttonRef.current));

  useEffect(() => {
    if (!isOpen) return;

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setPosition(null);
    };
    // При прокрутке таблицы или страницы меню едет вместе с кнопкой.
    const handleViewportChange = () => setPosition(menuPosition(buttonRef.current));

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(currentIndex + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
  };

  const runAction = (action: (_role: RolePermissionMatrixRole) => void) => {
    close();
    action(role);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        className='inline-flex size-6 shrink-0 items-center justify-center rounded-lg text-[#8090b8] transition-colors hover:bg-[#edf3ff] hover:text-[#1f3565] focus-visible:ring-2 focus-visible:ring-[#2d6ff7] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:bg-[#edf3ff] aria-expanded:text-[#1f3565]'
        aria-label={`Действия с ролью ${role.label}`}
        title='Действия с ролью'
        aria-haspopup='menu'
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(event) => {
          if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            open();
          }
        }}
      >
        <svg viewBox='0 0 24 24' className='size-4 fill-current' aria-hidden='true'>
          <circle cx='12' cy='5' r='1.8' />
          <circle cx='12' cy='12' r='1.8' />
          <circle cx='12' cy='19' r='1.8' />
        </svg>
      </button>

      {position
        ? createPortal(
            <div
              ref={menuRef}
              role='menu'
              aria-label={`Действия с ролью ${role.label}`}
              className='fixed z-1100 grid gap-1 rounded-xl border border-[#d9e2f2] bg-white p-1 text-left shadow-xl shadow-slate-900/15'
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              onKeyDown={handleMenuKeyDown}
            >
              <button
                type='button'
                role='menuitem'
                className='rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#1f3565] transition-colors outline-none hover:bg-[#edf3ff] focus-visible:bg-[#edf3ff]'
                onClick={() => runAction(onRename)}
              >
                Переименовать
              </button>
              {canDelete ? (
                <button
                  type='button'
                  role='menuitem'
                  className='rounded-lg px-3 py-2 text-left text-[13px] font-medium text-rose-700 transition-colors outline-none hover:bg-rose-50 focus-visible:bg-rose-50'
                  onClick={() => runAction(onDelete)}
                >
                  Удалить
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
