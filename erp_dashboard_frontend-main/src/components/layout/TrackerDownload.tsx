import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { copyToClipboard } from '../../utils/clipboard';
import { ProLockMark } from '../tariff/ProBadge';
import ProFeatureLock from '../tariff/ProFeatureLock';

// Сборки раздаёт тот же сервер, что и автообновление трекера (app-archive.json).
// Ссылку на Windows обновлять при выпуске новой версии.
const TRACKER_WINDOWS_URL =
  'https://api.flow-erp.ru/app-releases/stable/releases/1.0.2/windows/erp_installer.exe';
const TRACKER_LINUX_COMMANDS = [
  'curl -fsSLO https://api.flow-erp.ru/app-releases/stable/install-erp.sh',
  'bash install-erp.sh',
];
const TRACKER_GUIDE_URL =
  'https://flow-erp.ru/assets/docs/rukovodstvo-polzovatelya-po-rabote-v-trekere-flou.pdf';

function noticeStorageKey(userId: string) {
  return `tracker-download-notice:${userId}`;
}

// Уведомление показывается один раз: при первом входе пользователя в этом браузере.
function wasNoticeShown(userId: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(noticeStorageKey(userId)));
  } catch {
    return true;
  }
}

function markNoticeShown(userId: string) {
  try {
    window.localStorage.setItem(noticeStorageKey(userId), 'shown');
  } catch {
    // Без localStorage уведомление покажется при следующей загрузке ещё раз.
  }
}

function DownloadIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      className={`${className} shrink-0 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]`}
      aria-hidden='true'
    >
      <path d='M12 4v11' />
      <path d='m7 10 5 5 5-5' />
      <path d='M5 20h14' />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg viewBox='0 0 24 24' className='size-10 fill-[#2d6ff7]' aria-hidden='true'>
      <path d='M3 5.7 10.5 4.6V11.6H3M10.5 12.4V19.4L3 18.3V12.4M11.4 4.5 21 3V11.6H11.4M21 12.4V21L11.4 19.5V12.4Z' />
    </svg>
  );
}

function LinuxIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-10 fill-none stroke-[#10275a] stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <rect x='3' y='4' width='18' height='16' rx='2.5' />
      <path d='m7 9 3 3-3 3' />
      <path d='M12.5 15H17' />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox='0 0 24 24' className='size-10 fill-[#7e8fb4]' aria-hidden='true'>
      <path d='M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701' />
    </svg>
  );
}

function CloseButton({
  onClick,
  className = '',
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type='button'
      aria-label='Закрыть'
      title='Закрыть'
      onClick={onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${className}`}
    >
      <svg
        className='size-5 fill-none stroke-current stroke-2'
        viewBox='0 0 24 24'
        aria-hidden='true'
      >
        <path d='M18 6 6 18' />
        <path d='m6 6 12 12' />
      </svg>
    </button>
  );
}

const platformCardClassName =
  'flex min-w-0 flex-col items-center gap-2 rounded-xl border p-4 text-center';
const platformButtonClassName =
  'mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors';

function TrackerDownloadModal({
  onClose,
  isLocked,
}: {
  onClose: () => void;
  isLocked: boolean;
}) {
  const [isLinuxOpen, setIsLinuxOpen] = useState(false);
  const linuxCommands = TRACKER_LINUX_COMMANDS.join('\n');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyLinuxCommands = async () => {
    try {
      await copyToClipboard(linuxCommands);
      toast.success('Команды скопированы.');
    } catch {
      toast.info('Выделите команды и скопируйте их вручную.');
    }
  };

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] sm:p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='tracker-download-title'
        className='max-h-[calc(100dvh-1rem)] w-full max-w-190 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-4 shadow-2xl shadow-slate-900/20 sm:rounded-2xl sm:p-6'
      >
        <div className='flex items-start justify-between gap-4'>
          <h2
            id='tracker-download-title'
            className='text-[20px] leading-tight font-semibold text-[#10275a] sm:text-[22px]'
          >
            Трекер ФЛОУ для сотрудников
          </h2>
          <CloseButton
            onClick={onClose}
            className='text-[#7e8fb4] hover:bg-[#edf3ff] hover:text-[#2d6ff7]'
          />
        </div>
        {isLocked ? (
          <div className='mt-4'>
            <ProFeatureLock feature='tracker' variant='inline' onNavigate={onClose} />
          </div>
        ) : (
          <>
            <p className='mt-2 text-[14px] leading-5 text-[#53617c]'>
              Приложение автоматически отслеживает ваше рабочее время и синхронизирует
              данные с системой ФЛОУ. Установите трекер на компьютер, чтобы учёт времени
              вёлся автоматически в фоне.
            </p>

            <div className='mt-5 grid gap-3 sm:grid-cols-3'>
              <div className={`${platformCardClassName} border-[#c9d8f8] bg-[#f5f8ff]`}>
                <WindowsIcon />
                <h3 className='text-[15px] font-semibold text-[#10275a]'>Windows</h3>
                <p className='text-[12px] text-[#7e8fb4]'>Для Windows 10 и выше</p>
                <a
                  href={TRACKER_WINDOWS_URL}
                  download
                  className={`${platformButtonClassName} border-transparent bg-[#2d6ff7] text-white hover:bg-[#245fd8]`}
                >
                  <DownloadIcon />
                  Скачать для Windows
                </a>
              </div>

              <div className={`${platformCardClassName} border-[#e3e9f3] bg-white`}>
                <LinuxIcon />
                <h3 className='text-[15px] font-semibold text-[#10275a]'>Linux</h3>
                <p className='text-[12px] text-[#7e8fb4]'>
                  Для Ubuntu, Debian и других дистрибутивов
                </p>
                <button
                  type='button'
                  aria-expanded={isLinuxOpen}
                  onClick={() => setIsLinuxOpen((prev) => !prev)}
                  className={`${platformButtonClassName} border-[#c9d8f8] bg-white text-[#2d6ff7] hover:bg-[#f3f7ff]`}
                >
                  <DownloadIcon />
                  Установить на Linux
                </button>
              </div>

              <div className={`${platformCardClassName} border-[#e3e9f3] bg-white`}>
                <AppleIcon />
                <h3 className='text-[15px] font-semibold text-[#10275a]'>macOS</h3>
                <p className='text-[12px] text-[#7e8fb4]'>Сборка для macOS готовится</p>
                <button
                  type='button'
                  disabled
                  className={`${platformButtonClassName} cursor-not-allowed border-[#e3e9f3] bg-[#f7f9fc] text-[#9aa7c2]`}
                >
                  Скоро
                </button>
              </div>
            </div>

            {isLinuxOpen ? (
              <div className='mt-4 rounded-xl border border-[#e3e9f3] p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p className='text-[13px] text-[#53617c]'>
                    Откройте терминал и выполните две команды:
                  </p>
                  <button
                    type='button'
                    onClick={() => void copyLinuxCommands()}
                    className='rounded-lg px-2 py-1 text-[13px] font-semibold text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff]'
                  >
                    Скопировать
                  </button>
                </div>
                <pre className='mt-3 overflow-x-auto rounded-lg bg-[#071a36] p-3 font-mono text-[12px] leading-6 text-slate-100'>
                  {linuxCommands}
                </pre>
              </div>
            ) : null}

            <a
              href={TRACKER_GUIDE_URL}
              target='_blank'
              rel='noreferrer'
              className='mt-5 flex items-center gap-3 rounded-xl border border-[#e3e9f3] bg-[#f7f9fc] px-4 py-3 transition-colors hover:border-[#c9d8f8] hover:bg-[#f3f7ff]'
            >
              <svg
                viewBox='0 0 24 24'
                className='size-6 shrink-0 fill-none stroke-[#2d6ff7] stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
                aria-hidden='true'
              >
                <path d='M6 3h8l4 4v14H6V3Z' />
                <path d='M14 3v4h4' />
                <path d='M9 12h6' />
                <path d='M9 16h6' />
              </svg>
              <span className='min-w-0 flex-1'>
                <span className='block text-[14px] font-semibold text-[#10275a]'>
                  Инструкция по установке
                </span>
                <span className='block text-[12px] text-[#7e8fb4]'>
                  Руководство пользователя по работе с трекером ФЛОУ
                </span>
              </span>
              <span className='text-[18px] text-[#7e8fb4]' aria-hidden='true'>
                ›
              </span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Кнопка «Скачать трекер» внизу левого меню, окно со ссылками на сборки
 * и уведомление, которое показывается сотруднику при первом входе.
 */
export default function TrackerDownload({
  userId,
  isCollapsed,
  isLocked = false,
}: {
  userId: string;
  isCollapsed: boolean;
  /** Тариф ФРИ: трекер недоступен, кнопка открывает заглушку «Доступно на ПРО». */
  isLocked?: boolean;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNoticeVisible, setIsNoticeVisible] = useState(() => !wasNoticeShown(userId));

  // Отмечаем показ сразу: после перезагрузки страницы уведомление больше не появится,
  // даже если его не закрыли. Кнопка в меню остаётся.
  useEffect(() => {
    if (isNoticeVisible && !isLocked) markNoticeShown(userId);
  }, [isLocked, isNoticeVisible, userId]);

  const hideNotice = () => setIsNoticeVisible(false);

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const openModal = () => {
    hideNotice();
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        type='button'
        onClick={openModal}
        aria-label={isCollapsed ? 'Скачать трекер' : undefined}
        title={isCollapsed ? 'Скачать трекер' : undefined}
        className={`flex items-center gap-2 rounded-lg border border-[#e3e9f3] text-[12px] leading-none font-medium text-[#2d6ff7] transition-colors duration-150 hover:border-[#c9d8f8] hover:bg-[#f3f7ff] ${
          isCollapsed ? 'size-11 justify-center' : 'w-full px-2 py-2.5'
        }`}
      >
        <span className='relative inline-flex shrink-0'>
          <DownloadIcon />
          {isLocked ? <ProLockMark className='absolute -top-1.5 -right-1.5' /> : null}
        </span>
        <span className={isCollapsed ? 'sr-only' : 'min-w-0 truncate leading-snug'}>
          Скачать трекер
        </span>
      </button>

      {isNoticeVisible && !isModalOpen && !isLocked ? (
        <div
          role='status'
          className={`fixed bottom-6 z-50 hidden w-72 rounded-xl bg-[#2d6ff7] p-4 text-white shadow-xl shadow-[#2d6ff7]/30 lg:block ${
            isCollapsed ? 'left-24' : 'left-44'
          }`}
        >
          <div className='flex items-start gap-2'>
            <p className='min-w-0 flex-1 text-[13px] leading-5'>
              Настройте учёт рабочего времени. Скачайте и установите трекер на компьютер.
            </p>
            <CloseButton
              onClick={hideNotice}
              className='-mt-1 -mr-1 text-white/80 hover:bg-white/15 hover:text-white'
            />
          </div>
          <div className='mt-3 flex items-center gap-2'>
            <button
              type='button'
              onClick={openModal}
              className='h-9 rounded-lg bg-white px-4 text-[13px] font-semibold text-[#2d6ff7] transition-colors hover:bg-[#edf3ff]'
            >
              Установить
            </button>
            <button
              type='button'
              onClick={hideNotice}
              className='h-9 rounded-lg px-4 text-[13px] font-semibold text-white transition-colors hover:bg-white/15'
            >
              Позже
            </button>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <TrackerDownloadModal onClose={closeModal} isLocked={isLocked} />
      ) : null}
    </>
  );
}
