import { Link } from 'react-router';

import { SearchableSelect } from '../../../../ui/FormField';

export type PayrollView = 'calculation' | 'payout' | 'settings';

const payrollViews: Array<{ value: PayrollView; label: string; className?: string }> = [
  { value: 'calculation', label: 'Расчёт ФОТ', className: 'mb-2' },
  { value: 'payout', label: 'Выплата ФОТ' },
  { value: 'settings', label: 'Настройки', className: 'mt-2' },
];

export function payrollViewPath(view: PayrollView) {
  return view === 'calculation' ? '/payroll' : `/payroll?view=${view}`;
}

// Меню второго уровня. До xl — выпадающий список: на узких экранах ведомости нужна вся ширина.
export default function PayrollSidebar({
  activeView,
  onViewChange,
}: {
  activeView: PayrollView;
  onViewChange: (_view: PayrollView) => void;
}) {
  return (
    <>
      <div className='rounded-xl border border-[#e3e9f3] bg-white p-2 text-[#1f3565] xl:hidden'>
        <SearchableSelect
          value={activeView}
          onValueChange={(value) => {
            if (value) onViewChange(value as PayrollView);
          }}
          options={payrollViews}
          searchable={false}
          className='h-11 rounded-xl border-[#c9d8f8] bg-[#edf2fb] pr-11 text-base font-semibold text-[#10275a] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#dce7ff]'
        />
      </div>

      <aside className='hidden h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] xl:flex'>
        {payrollViews.map((item) => (
          <Link
            key={item.value}
            to={payrollViewPath(item.value)}
            replace
            className={`rounded-xl border px-3 py-3 text-left text-[14px] font-semibold transition-colors ${item.className ?? ''} ${
              activeView === item.value
                ? 'border-[#c9d8f8] bg-[#edf2fb] text-[#10275a]'
                : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:border-[#c9d8f8] hover:bg-[#fbfcff]'
            }`}
            aria-current={activeView === item.value ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </aside>
    </>
  );
}
