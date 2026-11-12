import { Link } from 'react-router';

import {
  BILLING_SETTINGS_PATH,
  LOCKED_SCREEN_INFO,
  TARIFF_FEATURE_INFO,
  type LockedScreen,
} from '../../constants/tariffs';
import { useTariffAccess } from '../../hooks/useTariffAccess';
import type { TariffFeature } from '../../types/app';

function LockIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-6 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <rect x='5' y='10.5' width='14' height='10' rx='2.5' />
      <path d='M8 10.5V8a4 4 0 0 1 8 0v2.5' />
      <path d='M12 14.5v2' />
    </svg>
  );
}

/**
 * Заглушка вместо раздела, закрытого тарифом ФРИ: что даёт раздел и как его открыть.
 * `page` занимает всю область раздела, `inline` — для вкладок, окон и боковых панелей.
 */
export default function ProFeatureLock({
  feature,
  variant = 'page',
  screen,
  onNavigate,
}: {
  feature: TariffFeature;
  /** Открытый экран: заголовок и описание вместо общего названия возможности. */
  screen?: LockedScreen;
  variant?: 'page' | 'inline';
  /** Вызывается перед переходом в «Подписку и платежи», например чтобы закрыть окно. */
  onNavigate?: () => void;
}) {
  const { canChangeTariff } = useTariffAccess();
  const info = screen ? LOCKED_SCREEN_INFO[screen] : TARIFF_FEATURE_INFO[feature];
  const isPage = variant === 'page';

  return (
    <section
      className={
        isPage
          ? 'flex h-full min-h-60 items-center justify-center overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-4 text-[#1f3565] sm:p-8'
          : 'rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-4 text-[#1f3565] sm:p-5'
      }
    >
      <div
        className={`flex w-full max-w-md flex-col gap-3 ${
          isPage ? 'items-center text-center' : 'items-start text-left'
        }`}
      >
        <span className='grid size-12 place-items-center rounded-2xl bg-[#fff4e0] text-[#b45309]'>
          <LockIcon />
        </span>
        <div className='grid gap-1.5'>
          <p className='text-[12px] font-semibold tracking-wide text-[#b45309] uppercase'>
            Доступно на тарифе ПРО
          </p>
          <h2 className='text-[18px] leading-tight font-semibold text-[#10275a]'>
            {info.title}
          </h2>
          <p className='text-[14px] leading-5 text-[#53617c]'>{info.description}</p>
        </div>
        {canChangeTariff ? (
          <Link
            to={BILLING_SETTINGS_PATH}
            onClick={onNavigate}
            className='mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-[#2d6ff7] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#245fd8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
          >
            Перейти на ПРО
          </Link>
        ) : (
          <p className='mt-1 rounded-lg bg-[#f3f7ff] px-3 py-2 text-[13px] leading-5 text-[#53617c]'>
            Чтобы подключить ПРО, обратитесь к администратору компании.
          </p>
        )}
      </div>
    </section>
  );
}
