import { useEffect, useRef, useState } from 'react';
import type { Invoice, Requisites } from '../../types/billing';
import { api } from '../../api/api';

type Props = {
  isOpen: boolean;
  invoice: Invoice | null;
  onClose: () => void;
};

export default function InvoiceDetailsModal({ isOpen, invoice, onClose }: Props) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [requisites, setRequisites] = useState<Requisites | null>(null);
  const [isLoadingRequisites, setIsLoadingRequisites] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const fetchRequisites = async () => {
        try {
          setIsLoadingRequisites(true);
          const req = await api.workspace.billing.getRequisites();
          setRequisites(req);
        } catch (error) {
          console.error('Failed to load requisites', error);
        } finally {
          setIsLoadingRequisites(false);
        }
      };
      void fetchRequisites();
    } else {
      document.body.style.overflow = 'unset';
      setRequisites(null);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !invoice) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const periodMonths =
    invoice.period_days === 30 ? 1 : Math.round(invoice.period_days / 30);

  return (
    <div
      className='fixed inset-0 z-[1000] grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;
        if (shouldClose) onClose();
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[600px] overflow-x-hidden overflow-y-auto rounded-xl bg-white shadow-2xl shadow-slate-900/20 md:overflow-auto md:rounded-2xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex items-center justify-between border-b border-[#e3e9f3] p-3 md:p-5'>
          <h2 className='text-lg font-bold text-[#10275a]'>
            Счёт № {invoice.number} от {formatDate(invoice.created_at)}
          </h2>
          <button
            type='button'
            onClick={onClose}
            className='grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700'
            aria-label='Закрыть'
            title='Закрыть'
          >
            <svg
              viewBox='0 0 24 24'
              className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
            >
              <path d='M6 6l12 12M18 6L6 18' />
            </svg>
          </button>
        </div>

        <div className='p-3 md:p-5'>
          <div className='mb-4 flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between md:mb-6'>
            <div>
              <div className='mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]'>
                ТАРИФ
              </div>
              <div className='font-bold text-[#10275a]'>{invoice.tariff.name}</div>
            </div>
            <div className='text-left min-[360px]:text-right'>
              <div className='mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]'>
                ПЛАТЕЖНЫЙ ПЕРИОД
              </div>
              <div className='font-bold text-[#10275a]'>
                {periodMonths}{' '}
                {periodMonths === 1 ? 'месяц' : periodMonths < 5 ? 'месяца' : 'месяцев'}
              </div>
            </div>
          </div>

          <div className='mb-4 rounded-xl border border-[#e3e9f3] bg-[#f8fbff] p-4'>
            <div className='mb-1 text-xs font-medium text-[#5f73a3]'>Сумма к оплате</div>
            <div className='text-2xl font-bold text-[#10275a]'>
              {formatPrice(invoice.amount)} ₽
            </div>
          </div>

          <div className='rounded-xl border border-[#e3e9f3] bg-[#f8fbff] p-4 text-sm text-[#5f73a3]'>
            <div className='mb-2 font-bold text-[#10275a]'>Реквизиты на оплату:</div>
            {isLoadingRequisites ? (
              <div className='animate-pulse space-y-1'>
                <div className='h-4 w-1/2 rounded bg-slate-200'></div>
                <div className='h-4 w-2/3 rounded bg-slate-200'></div>
                <div className='h-4 w-2/3 rounded bg-slate-200'></div>
                <div className='h-4 w-1/3 rounded bg-slate-200'></div>
              </div>
            ) : requisites ? (
              <div className='space-y-1'>
                <div>Банк: {requisites.bank}</div>
                <div>Расчетный счет: {requisites.checking_account}</div>
                <div>Корсчет: {requisites.correspondent_account}</div>
                <div>БИК: {requisites.bic}</div>
              </div>
            ) : (
              <div className='text-sm text-slate-400'>Реквизиты не загружены</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
