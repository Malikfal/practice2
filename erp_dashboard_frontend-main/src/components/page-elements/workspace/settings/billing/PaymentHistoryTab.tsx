import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import type { Invoice } from '../../../../../types/billing';
import {
  joinClassNames,
  handleDownloadUpd,
  handleDownloadInvoice,
} from '../settingsUtils';
import ConfirmDialog from '../../../../modals/ConfirmDialog';
import InvoiceDetailsModal from '../../../../modals/InvoiceDetailsModal';
import Icon from './components/Icon';
import { useServerPagination } from '../../../../ui/Pagination';
import TablePagination from '../../../../ui/TablePagination';
import {
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../../ui/table';

export default function PaymentHistoryTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const pagination = useServerPagination(10);
  const { currentPage, pageSize, applyMeta } = pagination;

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.workspace.billing.getInvoices({
        page: currentPage,
        per_page: pageSize,
      });
      setInvoices(response.data);
      applyMeta(response.meta);
    } catch {
      toast.error('Ошибка при загрузке истории платежей');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, applyMeta]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const handleCancelInvoice = async () => {
    if (!invoiceToCancel) return;
    try {
      setIsCancelling(true);
      await api.workspace.billing.cancelInvoice(invoiceToCancel.id);
      toast.success('Счет успешно отменен');
      setInvoiceToCancel(null);
      void fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка при отмене счета');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const STATUS_COLORS: Record<Invoice['status'], string> = {
    PAID: 'bg-[#10b981] text-white',
    AWAITING_PAYMENT: 'bg-[#ffa500] text-white',
    CANCELLED: 'bg-[#94a3b8] text-white',
  };

  return (
    <div className='flex h-full min-h-0 flex-col'>
      {/* <div className='mb-4 flex flex-wrap gap-2'>
        <input
          type='text'
          placeholder='Поиск по № ...'
          className='rounded-lg border border-[#e3e9f3] px-3 py-2 text-sm focus:border-[#2d6ff7] focus:outline-none'
        />
        <button
          type='button'
          className='ml-auto rounded-lg border border-[#e3e9f3] bg-white px-3 py-2 text-sm font-semibold text-[#1f3565] transition-colors hover:bg-[#f4f7ff]'
        >
          Экспорт
        </button>
      </div> */}

      <TableContainer className='min-h-0 flex-1'>
        <Table className='min-w-[1080px] lg:min-w-full'>
          <THead sticky>
            <tr>
              <Th pin='left'>№</Th>
              <Th>Дата платежа</Th>
              <Th numeric>Сумма</Th>
              <Th>Тариф / Услуга</Th>
              <Th>Период</Th>
              <Th>Начало действия</Th>
              <Th>Конец действия</Th>
              <Th>Статус оплаты</Th>
              <Th align='center'>Счет</Th>
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : invoices.length === 0 ? (
              <TableEmptyRow>История платежей пуста</TableEmptyRow>
            ) : (
              invoices.map((invoice) => {
                return (
                  <Tr key={invoice.id}>
                    <Td pin='left' className='font-medium'>
                      {invoice.number}
                    </Td>
                    <Td>{formatDate(invoice.created_at)}</Td>
                    <Td numeric>{formatPrice(invoice.amount)} ₽</Td>
                    <Td>{invoice.tariff.name}</Td>
                    <Td>
                      {invoice.period_days === 30
                        ? '1 месяц'
                        : `${Math.round(invoice.period_days / 30)} месяца`}
                    </Td>
                    <Td>
                      {invoice.starts_at
                        ? formatDate(invoice.starts_at)
                        : formatDate(invoice.created_at)}
                    </Td>
                    <Td>{invoice.ends_at ? formatDate(invoice.ends_at) : '-'}</Td>
                    <Td>
                      <span
                        className={joinClassNames(
                          'inline-block rounded px-2.5 py-1 text-[11px] font-bold uppercase',
                          STATUS_COLORS[invoice.status] || 'bg-[#94a3b8] text-white',
                        )}
                      >
                        {invoice.status_label}
                      </span>
                    </Td>
                    <Td align='center'>
                      <TableActions>
                        <TableActionButton
                          label='Просмотр счета'
                          className='max-lg:size-9'
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <Icon name='eye' />
                        </TableActionButton>
                        <TableActionButton
                          label='Скачать счет'
                          className='max-lg:size-9'
                          onClick={() =>
                            handleDownloadInvoice(invoice.id, invoice.number)
                          }
                        >
                          <Icon name='document' />
                        </TableActionButton>
                        {invoice.can_download_upd ? (
                          <TableActionButton
                            label='Скачать УПД'
                            className='max-lg:size-9'
                            onClick={() => handleDownloadUpd(invoice.id, invoice.number)}
                          >
                            <Icon name='download' />
                          </TableActionButton>
                        ) : (
                          <TableActionButton
                            label='УПД будет доступен по окончании оплаченного периода'
                            className='max-lg:size-9'
                            disabled
                          >
                            <Icon name='download' />
                          </TableActionButton>
                        )}
                        {invoice.status === 'AWAITING_PAYMENT' && (
                          <TableActionButton
                            label='Отменить счет'
                            tone='danger'
                            className='max-lg:size-9'
                            onClick={() => setInvoiceToCancel(invoice)}
                          >
                            <Icon name='close' />
                          </TableActionButton>
                        )}
                      </TableActions>
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </TableContainer>

      {invoices.length > 0 && (
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}

      <InvoiceDetailsModal
        isOpen={selectedInvoice !== null}
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

      {invoiceToCancel && (
        <ConfirmDialog
          isOpen={true}
          isProcessing={isCancelling}
          danger={true}
          title='Отменить счет?'
          message={
            <>
              Вы уверены, что хотите отменить счет{' '}
              <strong>№{invoiceToCancel.number}</strong>? Это действие нельзя отменить.
            </>
          }
          confirmLabel='Да, отменить'
          cancelLabel='Закрыть'
          onClose={() => setInvoiceToCancel(null)}
          onConfirm={handleCancelInvoice}
        />
      )}
    </div>
  );
}
