import { Link } from 'react-router';

import ProBadge from '../../../tariff/ProBadge';
import { SearchableSelect } from '../../../ui/FormField';

export type FinanceView = 'payments' | 'financial-results' | 'analytics' | 'settings';

const financeViews: Array<{ value: FinanceView; label: string; className?: string }> = [
  { value: 'payments', label: 'Платежи', className: 'mb-2' },
  {
    value: 'financial-results',
    label: 'Отчёт о финансовых результатах',
    className: 'mb-2',
  },
  { value: 'analytics', label: 'Финансовая аналитика' },
  { value: 'settings', label: 'Настройки', className: 'mt-2' },
];

// Меню второго уровня. До xl — выпадающий список, как в «Оплате труда»: таблицам нужна ширина.
export default function FinanceSidebar({
  activeView,
  viewHref,
  onViewChange,
  lockedViews = [],
}: {
  activeView: FinanceView;
  /** Адрес раздела: пункты меню — ссылки, их можно открыть в новой вкладке. */
  viewHref: (_view: FinanceView) => string;
  onViewChange: (_view: FinanceView) => void;
  /** Разделы, закрытые тарифом ФРИ: остаются в меню с меткой «ПРО». */
  lockedViews?: FinanceView[];
}) {
  return (
    <>
      <div className='rounded-xl border border-[#e3e9f3] bg-white p-2 text-[#1f3565] xl:hidden'>
        <SearchableSelect
          value={activeView}
          onValueChange={(value) => {
            if (value) onViewChange(value as FinanceView);
          }}
          options={financeViews.map((item) => ({
            ...item,
            label: lockedViews.includes(item.value) ? `${item.label} · ПРО` : item.label,
          }))}
          className='h-11 rounded-xl border-[#c9d8f8] bg-[#edf2fb] pr-11 text-base font-semibold text-[#10275a] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#dce7ff]'
        />
      </div>

      <aside className='hidden h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] xl:flex'>
        {financeViews.map((item) => (
          <Link
            key={item.value}
            to={viewHref(item.value)}
            replace
            className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-3 text-left text-[14px] font-semibold transition-colors ${item.className ?? ''} ${
              activeView === item.value
                ? 'border-[#c9d8f8] bg-[#edf2fb] text-[#10275a]'
                : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:border-[#c9d8f8] hover:bg-[#fbfcff]'
            }`}
            aria-current={activeView === item.value ? 'page' : undefined}
          >
            <span className='min-w-0'>{item.label}</span>
            {lockedViews.includes(item.value) ? <ProBadge className='mt-0.5' /> : null}
          </Link>
        ))}
      </aside>
    </>
  );
}
