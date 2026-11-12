import {
  formatAnalyticsNumber,
  getProfitTone,
} from '../finance-analytics/financeAnalyticsUtils';
import type { FinanceSummary } from '../../../../types/app';

export type { FinanceSummary } from '../../../../types/app';

export const emptyFinanceSummary: FinanceSummary = {
  income: 0,
  expenses: 0,
  profit: 0,
};

export default function FinanceSummaryStrip({
  summary,
  isLoading,
  className = '',
}: {
  summary: FinanceSummary;
  isLoading: boolean;
  className?: string;
}) {
  const profitTone = getProfitTone(summary.profit);
  const items = [
    { key: 'income', label: 'Поступления', value: summary.income, color: '#8bb9f9' },
    { key: 'expenses', label: 'Расходы', value: summary.expenses, color: '#ef625b' },
    {
      key: 'profit',
      label: profitTone.label,
      value: summary.profit,
      color: profitTone.color,
    },
  ];

  return (
    <div className={`grid gap-1 sm:grid-cols-3 ${className}`} aria-busy={isLoading}>
      {items.map((item) => (
        <div
          key={item.key}
          className='min-w-0 rounded-lg border border-[#e3e9f3] bg-[#fbfdff] px-2.5 py-2 shadow-sm shadow-slate-900/3'
        >
          <div className='flex items-center gap-2 text-[11px] font-medium text-[#7e8fb4]'>
            <span
              className='size-2 rounded-full'
              style={{ backgroundColor: item.color }}
            />
            {item.label}, ₽
          </div>
          <div className='mt-1 text-[18px] leading-none font-semibold text-[#10275a]'>
            {formatAnalyticsNumber(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
