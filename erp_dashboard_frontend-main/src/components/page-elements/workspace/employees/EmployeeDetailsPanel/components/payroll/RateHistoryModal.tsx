import { useRef, useState, type MouseEvent, type ReactNode } from 'react';

import { useEscapeToClose } from '../../../../../../../hooks/useEscapeToClose';
import type { EmployeeRate } from '../../../../../../../types/app';
import {
  Table,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../../../../ui/table';

import { EmployeeRateDetailsModal } from './EmployeeRateDetailsModal';
import { ProjectRatesNote } from './ProjectRatesNote';
import {
  formatChanger,
  formatDate,
  formatRateValue,
  hasRateDetails,
  isAdvancedRateSetting,
} from './payrollUtils';

export function RateHistoryModal({
  isOpen,
  rates,
  isLoading,
  canManageRates,
  deletingRateId,
  onEditRate,
  onDeleteRate,
  onClose,
}: {
  isOpen: boolean;
  rates: EmployeeRate[];
  isLoading: boolean;
  canManageRates: boolean;
  deletingRateId: string | null;
  onEditRate: (_rate: EmployeeRate) => void;
  onDeleteRate: (_rate: EmployeeRate) => void;
  onClose: () => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [selectedRate, setSelectedRate] = useState<EmployeeRate | null>(null);
  // Пока ставка удаляется, окно не закрывается по Esc.
  useEscapeToClose(() => {
    if (!deletingRateId) onClose();
  }, isOpen);

  if (!isOpen) return null;

  const renderRateValue = (
    rate: EmployeeRate,
    rateType: 'WEEKLY_SALARY' | 'HOURLY' | 'SUPERVISED_HOURLY' | 'COMPANY_HOURLY',
    // В таблице суммы прижаты вправо вместе с подписью под ними.
    alignEnd = false,
  ) => {
    const isAdvanced = isAdvancedRateSetting(rate, rateType);

    return (
      <div className={`grid gap-0.5 ${alignEnd ? 'justify-items-end' : ''}`}>
        <span className={isAdvanced ? 'font-semibold text-[#2d6ff7]' : undefined}>
          {formatRateValue(rate, rateType)}
        </span>
        <ProjectRatesNote rate={rate} rateType={rateType} />
      </div>
    );
  };

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] sm:p-3'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose) {
          onClose();
        }
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[94vh] sm:max-w-[calc(100vw-24px)] sm:rounded-2xl sm:p-4 md:overflow-auto'
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <div>
            <h2 className='text-lg leading-tight font-semibold text-[#10275a] sm:text-[22px]'>
              История изменений ставки
            </h2>
            <p className='mt-1 text-[13px] text-[#7e8fb4]'>
              Изменять можно только последнюю ставку, а удалять её — если есть более
              ранние ставки.
            </p>
          </div>
          <button
            type='button'
            className='grid size-8 shrink-0 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-[18px] leading-none text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
            onClick={onClose}
            aria-label='Закрыть историю изменений ставки'
            title='Закрыть'
          >
            x
          </button>
        </div>

        <div className='grid gap-2 md:hidden'>
          {isLoading ? (
            <div className='grid min-h-28 place-items-center rounded-xl border border-[#e3e9f3] bg-white'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
            </div>
          ) : rates.length ? (
            rates.map((rate, index) => {
              const canEditRate = canManageRates && index === 0;
              const canDeleteRate = canEditRate && rates.length > 1;
              const isDeleting = deletingRateId === rate.id;

              return (
                <article
                  key={rate.id}
                  className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-xs text-[#7e8fb4]'>Действует с</p>
                      <p className='mt-0.5 text-sm font-semibold text-[#10275a]'>
                        {formatDate(rate.effective_from)}
                      </p>
                    </div>
                    {hasRateDetails(rate) ? (
                      <button
                        type='button'
                        className='shrink-0 rounded-lg bg-[#edf3ff] px-2 py-1 text-xs font-semibold text-[#2d6ff7]'
                        onClick={() => setSelectedRate(rate)}
                      >
                        Подробнее
                      </button>
                    ) : null}
                  </div>

                  <dl className='grid grid-cols-2 gap-2 text-xs'>
                    <RateMobileDetail
                      label='Оклад за неделю'
                      value={renderRateValue(rate, 'WEEKLY_SALARY')}
                    />
                    <RateMobileDetail
                      label='Ставка за час'
                      value={renderRateValue(rate, 'HOURLY')}
                    />
                    <RateMobileDetail
                      label='Под контролем'
                      value={renderRateValue(rate, 'SUPERVISED_HOURLY')}
                    />
                    <RateMobileDetail
                      label='Часы компании'
                      value={renderRateValue(rate, 'COMPANY_HOURLY')}
                    />
                    <RateMobileDetail
                      label='Дата изменения'
                      value={formatDate(rate.created_at)}
                    />
                    <RateMobileDetail label='Кем изменено' value={formatChanger(rate)} />
                  </dl>

                  <div className='grid grid-cols-2 gap-2'>
                    <button
                      type='button'
                      disabled={!canEditRate}
                      className='min-h-10 rounded-lg border border-[#c9d8f8] px-3 text-xs font-semibold text-[#2d6ff7] disabled:cursor-not-allowed disabled:opacity-50'
                      onClick={() => onEditRate(rate)}
                    >
                      Изменить
                    </button>
                    <button
                      type='button'
                      disabled={!canDeleteRate || isDeleting}
                      className='min-h-10 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50'
                      onClick={() => onDeleteRate(rate)}
                    >
                      {isDeleting ? 'Удаление...' : 'Удалить'}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-8 text-center text-sm text-[#7e8fb4]'>
              История ставок пока пустая.
            </div>
          )}
        </div>

        <TableContainer className='hidden md:block'>
          <Table density='compact' className='min-w-[1220px]'>
            <THead>
              <tr>
                <Th pin='left'>Дата начала действия</Th>
                <Th numeric>Оклад (неделя)</Th>
                <Th numeric>Ставка/час</Th>
                <Th numeric>Ставка/час под контролем</Th>
                <Th numeric>Ставка/час всей компании</Th>
                <Th>Не учитывать как подконтрольные</Th>
                <Th>Дата изменения</Th>
                <Th>Кем изменено</Th>
                <Th align='center'>Детали</Th>
                <Th align='center'>Действия</Th>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <TableLoadingRow />
              ) : rates.length ? (
                rates.map((rate, index) => {
                  const canEditRate = canManageRates && index === 0;
                  const canDeleteRate = canEditRate && rates.length > 1;
                  const isDeleting = deletingRateId === rate.id;

                  return (
                    <Tr key={rate.id}>
                      <Td pin='left' className='font-semibold'>
                        {formatDate(rate.effective_from)}
                      </Td>
                      <Td align='right' className='tabular-nums'>
                        {renderRateValue(rate, 'WEEKLY_SALARY', true)}
                      </Td>
                      <Td align='right' className='tabular-nums'>
                        {renderRateValue(rate, 'HOURLY', true)}
                      </Td>
                      <Td align='right' className='tabular-nums'>
                        {renderRateValue(rate, 'SUPERVISED_HOURLY', true)}
                      </Td>
                      <Td align='right' className='tabular-nums'>
                        {renderRateValue(rate, 'COMPANY_HOURLY', true)}
                      </Td>
                      <Td>{rate.exclude_from_supervised_hours ? 'Да' : 'Нет'}</Td>
                      <Td>{formatDate(rate.created_at)}</Td>
                      <Td className='font-semibold'>{formatChanger(rate)}</Td>
                      <Td align='center' className='font-semibold'>
                        {hasRateDetails(rate) ? (
                          <button
                            type='button'
                            className='rounded-lg px-2 py-1 text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff] hover:text-[#245fd8]'
                            onClick={() => setSelectedRate(rate)}
                          >
                            Показать больше
                          </button>
                        ) : (
                          <span className='text-[#7e8fb4]'>-</span>
                        )}
                      </Td>
                      <Td align='center' className='font-semibold'>
                        <TableActions>
                          <button
                            type='button'
                            disabled={!canEditRate}
                            className='rounded-lg px-2 py-1 text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff] hover:text-[#245fd8] disabled:cursor-not-allowed disabled:opacity-40'
                            onClick={() => onEditRate(rate)}
                          >
                            Изменить
                          </button>
                          <button
                            type='button'
                            disabled={!canDeleteRate || isDeleting}
                            className='rounded-lg px-2 py-1 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40'
                            onClick={() => onDeleteRate(rate)}
                          >
                            {isDeleting ? 'Удаление...' : 'Удалить'}
                          </button>
                        </TableActions>
                      </Td>
                    </Tr>
                  );
                })
              ) : (
                <TableEmptyRow>История ставок пока пустая.</TableEmptyRow>
              )}
            </TBody>
          </Table>
        </TableContainer>
      </div>
      <EmployeeRateDetailsModal
        rate={selectedRate}
        title='Ставка из истории'
        onClose={() => setSelectedRate(null)}
      />
    </div>
  );
}

function RateMobileDetail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='min-w-0'>
      <dt className='text-[#7e8fb4]'>{label}</dt>
      <dd className='mt-0.5 break-words font-medium text-[#1f3565]'>{value}</dd>
    </div>
  );
}
