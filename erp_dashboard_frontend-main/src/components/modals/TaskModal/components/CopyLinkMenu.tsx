import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { copyToClipboard } from '../../../../utils/clipboard';

export default function CopyLinkMenu({
  taskId,
  canManageClientLink,
  initLinkToken,
  isClientVisible = true,
}: {
  taskId: string;
  canManageClientLink: boolean;
  initLinkToken: string | null;
  // Скрытая задача по ссылке для клиента не открывается, поэтому копировать её нельзя.
  isClientVisible?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [publicLinkToken, setPublicLinkToken] = useState<string | null>(
    initLinkToken ?? null,
  );
  const [isLinkActive, setIsLinkActive] = useState(Boolean(initLinkToken));
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isDeletingLink, setIsDeletingLink] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initLinkToken) {
      setPublicLinkToken(initLinkToken);
      setIsLinkActive(true);
    }
  }, [initLinkToken]);

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

  const handleCopyEmployeeLink = useCallback(async () => {
    const url = new URL(`/tasks/direct/${taskId}`, window.location.origin);
    try {
      await copyToClipboard(url.toString());
      toast.success('Ссылка на задачу скопирована.');
    } catch {
      toast.error('Не удалось скопировать ссылку.');
    }
    setIsOpen(false);
  }, [taskId]);

  const handleCopyClientLink = useCallback(async () => {
    try {
      let token = publicLinkToken;

      if (!token || !isLinkActive) {
        setIsCreatingLink(true);
        const link = await api.workspace.taskClientMessages.createPublicLink(taskId);
        token = link.id;
        setPublicLinkToken(token);
        setIsLinkActive(true);
        setIsCreatingLink(false);
      }

      const url = new URL(`/public/task/${token}`, window.location.origin);
      await copyToClipboard(url.toString());
      toast.success('Ссылка для клиента скопирована.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать ссылку.');
    } finally {
      setIsCreatingLink(false);
    }
    setIsOpen(false);
  }, [taskId, publicLinkToken, isLinkActive]);

  const handleDeleteLink = useCallback(async () => {
    try {
      setIsDeletingLink(true);
      await api.workspace.taskClientMessages.deletePublicLink(taskId);
      setIsLinkActive(false);
      setPublicLinkToken(null);
      toast.success('Ссылка для клиента отключена.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось отключить ссылку.',
      );
    } finally {
      setIsDeletingLink(false);
    }
  }, [taskId]);

  return (
    <div ref={menuRef} className='relative'>
      <button
        type='button'
        onClick={() => setIsOpen((prev) => !prev)}
        className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:px-3'
        aria-label='Скопировать ссылку'
        title='Скопировать ссылку'
      >
        <svg
          viewBox='0 0 24 24'
          className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
          aria-hidden='true'
        >
          <path d='M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5' />
          <path d='M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5' />
        </svg>
        <span className='hidden sm:inline'>Копировать ссылку</span>
      </button>

      {isOpen ? (
        <div className='absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10'>
          <button
            type='button'
            onClick={() => void handleCopyEmployeeLink()}
            className='flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50'
          >
            <svg
              viewBox='0 0 24 24'
              className='mt-0.5 size-4 shrink-0 fill-none stroke-slate-500 stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
              aria-hidden='true'
            >
              <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
              <circle cx='9' cy='7' r='4' />
            </svg>
            <div className='min-w-0'>
              <div className='text-[13px] font-medium text-slate-800'>Для сотрудника</div>
              <div className='text-[11px] text-slate-500'>Ссылка на задачу в ERP</div>
            </div>
          </button>

          {canManageClientLink ? (
            <>
              <div className='border-t border-slate-100' />
              <div className='flex items-start gap-3 px-3 py-2.5'>
                <button
                  type='button'
                  disabled={isCreatingLink || !isClientVisible}
                  onClick={() => void handleCopyClientLink()}
                  className='flex flex-1 items-start gap-3 text-left transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <svg
                    viewBox='0 0 24 24'
                    className='mt-0.5 size-4 shrink-0 fill-none stroke-blue-500 stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
                    aria-hidden='true'
                  >
                    <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
                    <circle cx='9' cy='7' r='4' />
                    <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
                    <path d='M16 3.13a4 4 0 0 1 0 7.75' />
                  </svg>
                  <div className='min-w-0'>
                    <div className='text-[13px] font-medium text-slate-800'>
                      Для клиента
                      {isCreatingLink ? (
                        <span className='ml-1.5 inline-block size-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 align-middle' />
                      ) : null}
                    </div>
                    <div className='text-[11px] text-slate-500'>
                      {isClientVisible
                        ? 'Страница согласования'
                        : 'Недоступна: задача скрыта от клиента'}
                    </div>
                  </div>
                </button>

                {isLinkActive && publicLinkToken ? (
                  <button
                    type='button'
                    disabled={isDeletingLink}
                    onClick={() => void handleDeleteLink()}
                    className='mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50'
                    aria-label='Отключить ссылку для клиента'
                    title='Отключить ссылку'
                  >
                    <svg
                      viewBox='0 0 24 24'
                      className='size-3.5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
                      aria-hidden='true'
                    >
                      <path d='M6 6l12 12M18 6L6 18' />
                    </svg>
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
