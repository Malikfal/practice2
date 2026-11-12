import { useState } from 'react';

import type { FinanceAnalyticsUnaccountedPayments } from '../../../../types/financeAnalytics';
import { formatAnalyticsNumber } from './financeAnalyticsUtils';

type PaymentKind = 'income' | 'expense';

const PAGE_SIZE = 10;

function rub(value: number): string {
  return `${formatAnalyticsNumber(value)} руб.`;
}

function UnaccountedPaymentsTable({
  title,
  periodLabel,
  data,
  kind,
  isLoading,
  onPageChange,
}: {
  title: string;
  periodLabel: string;
  data: FinanceAnalyticsUnaccountedPayments;
  kind: PaymentKind;
  isLoading: boolean;
  onPageChange: (_kind: PaymentKind, _page: number) => void;
}) {
  const totalColor = kind === 'income' ? '#20b85a' : '#e83f4b';
  const items = data.items ?? [];
  const [isExpanded, setIsExpanded] = useState(true);
  const totalCount = Number(data.total_count ?? items.length);
  const perPage = Number(data.per_page ?? PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Number(data.total_pages ?? Math.ceil(totalCount / perPage)),
  );
  const currentPage = Math.min(Math.max(Number(data.page ?? 1), 1), totalPages);
  const fromItem = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const toItem = Math.min((currentPage - 1) * perPage + items.length, totalCount);

  const goToPage = (nextPage: number) => {
    onPageChange(kind, Math.min(Math.max(nextPage, 1), totalPages));
  };

  return (
    <section className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white shadow-sm shadow-slate-900/3'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b border-[#dbe2ed] p-3 md:p-4'>
        <div>
          <h3 className='text-sm font-semibold text-[#10275a]'>{title}</h3>
          <p className='mt-1 text-xs text-[#66728d]'>
            {title} за {periodLabel}: {totalCount}
          </p>
          <p className='mt-1 text-xs font-semibold' style={{ color: totalColor }}>
            Итого: {rub(data.total ?? 0)}
          </p>
        </div>
        <button
          type='button'
          className='rounded-md border border-[#c9d5ea] px-3 py-2 text-xs font-semibold text-[#496494] transition-colors hover:border-[#8fa8d8] hover:bg-[#f4f7fd]'
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? 'Свернуть' : 'Развернуть'}
        </button>
      </div>

      {isExpanded ? (
        <>
          <div className='min-w-0 overflow-x-auto p-2 md:p-4'>
            <div className='min-w-150 overflow-hidden rounded-lg border border-[#aeb9ca]'>
              <div className='grid grid-cols-[minmax(180px,0.35fr)_minmax(260px,1fr)_minmax(140px,0.22fr)] bg-[#d8dde6] text-xs font-semibold text-[#364057]'>
                <div className='border-r border-[#aeb9ca] px-3 py-3'>Категория</div>
                <div className='border-r border-[#aeb9ca] px-3 py-3'>Описание</div>
                <div className='px-3 py-3 text-right'>Сумма</div>
              </div>

              {items.length === 0 ? (
                <div className='px-3 py-8 text-center text-sm text-[#7e8fb4]'>
                  Нет неучтенных платежей за выбранный период
                </div>
              ) : (
                items.map((payment, index) => (
                  <div
                    key={payment.id || `${payment.category}-${currentPage}-${index}`}
                    className='grid grid-cols-[minmax(180px,0.35fr)_minmax(260px,1fr)_minmax(140px,0.22fr)] border-t border-[#aeb9ca] text-xs text-[#414b61]'
                  >
                    <div className='border-r border-[#aeb9ca] px-3 py-3 font-medium text-[#364057]'>
                      {payment.category}
                    </div>
                    <div className='border-r border-[#aeb9ca] px-3 py-3'>
                      {payment.description}
                    </div>
                    <div className='px-3 py-3 text-right font-medium'>
                      {rub(payment.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className='flex flex-col gap-3 border-t border-[#dbe2ed] px-3 py-3 text-xs text-[#66728d] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:px-4'>
            <div>
              {totalCount > 0 ? `${fromItem}-${toItem} из ${totalCount}` : 'Нет записей'}
            </div>
            <div className='flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start'>
              <button
                type='button'
                className='rounded-md border border-[#c9d5ea] px-3 py-2 font-semibold text-[#496494] disabled:cursor-not-allowed disabled:opacity-45'
                disabled={isLoading || currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                Назад
              </button>
              <span className='min-w-18 text-center font-semibold text-[#364057]'>
                {currentPage} / {totalPages}
              </span>
              <button
                type='button'
                className='rounded-md border border-[#c9d5ea] px-3 py-2 font-semibold text-[#496494] disabled:cursor-not-allowed disabled:opacity-45'
                disabled={isLoading || currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Вперед
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function UnaccountedPaymentsAnalytics({
  periodLabel,
  income,
  expenses,
  isLoading,
  onPageChange,
}: {
  periodLabel: string;
  income: FinanceAnalyticsUnaccountedPayments;
  expenses: FinanceAnalyticsUnaccountedPayments;
  isLoading: boolean;
  onPageChange: (_kind: PaymentKind, _page: number) => void;
}) {
  return (
    <div className='grid min-w-0 gap-3'>
      <UnaccountedPaymentsTable
        title='Неучтенные доходы'
        periodLabel={periodLabel}
        data={income}
        kind='income'
        isLoading={isLoading}
        onPageChange={onPageChange}
      />
      <UnaccountedPaymentsTable
        title='Неучтенные расходы'
        periodLabel={periodLabel}
        data={expenses}
        kind='expense'
        isLoading={isLoading}
        onPageChange={onPageChange}
      />
    </div>
  );
}
