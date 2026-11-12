import type { ReactNode } from 'react';
import { Link } from 'react-router';

export type SectionHeaderTab = {
  key: string;
  label: string;
  to: string;
  /** Метка рядом с названием, например «ПРО» для вкладки, закрытой тарифом. */
  badge?: ReactNode;
};

type Props = {
  /** Надпись над заголовком: раздел, к которому относится экран. */
  overline: string;
  title: string;
  description?: ReactNode;
  tabs?: SectionHeaderTab[];
  activeTab?: string;
  /** Переход по вкладке заменяет запись в истории, как переключение внутри экрана. */
  replace?: boolean;
  onTabClick?: (_key: string) => void;
};

/**
 * Шапка экрана раздела: надпись, заголовок, описание и вкладки-ссылки.
 * Общая для настроек, импорта и экранов «Оплаты труда», чтобы они выглядели одинаково.
 */
export default function SectionHeader({
  overline,
  title,
  description,
  tabs,
  activeTab,
  replace = false,
  onTabClick,
}: Props) {
  return (
    <div className='border-b border-[#e8eef8] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_100%)] px-3 py-4 md:px-5 md:py-5'>
      <div className='grid gap-4'>
        <div className='grid gap-2'>
          <span className='text-[12px] font-semibold tracking-[0.18em] text-[#7e8fb4] uppercase'>
            {overline}
          </span>
          <div className='grid gap-2'>
            <h1 className='text-[20px] leading-tight font-semibold text-[#10275a] md:text-[24px] md:leading-none'>
              {title}
            </h1>
            {description ? (
              <p className='max-w-[760px] text-[14px] leading-6 text-[#5f7095]'>
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {tabs?.length ? (
          <div className='flex overflow-x-auto border-b border-[#dbe6fb] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Link
                  key={tab.key}
                  to={tab.to}
                  replace={replace}
                  className={`min-h-11 min-w-max shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors md:min-h-0 md:px-4 ${
                    isActive
                      ? 'border-[#2d6ff7] text-[#2d6ff7]'
                      : 'border-transparent text-[#7e8fb4] hover:text-[#1f3565]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={onTabClick ? () => onTabClick(tab.key) : undefined}
                >
                  {tab.label}
                  {tab.badge ? (
                    <span className='ml-1.5 inline-flex align-middle'>{tab.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
