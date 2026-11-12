import type { ReactNode } from 'react';

import type {
  EmployeePayrollCalculationRow,
  PayrollRecalculation,
  EmployeeRate,
  FinanceSettings,
  User,
} from '../../../../../../../types/app';

import Button from '../../../../../../ui/Button';
import TablePagination from '../../../../../../ui/TablePagination';
import {
  Table,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../../../../ui/table';

import { formatHours, formatMoney, formatPeriod, employeeName } from './payrollUtils';
import { SalaryFinanceArticleSelect } from './SalaryFinanceArticleSelect';
import { isCompletedPayrollPeriod, payrollPeriodKey } from './usePayrollRecalculations';

type RateCard = {
  label: string;
  value: string;
  isAdvanced?: boolean;
  note?: ReactNode;
};

type PayrollMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export function PayrollHeader({ employee }: { employee: User }) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div>
        <h3 className='text-xl leading-none font-semibold text-[#10275a] sm:text-[22px]'>
          Оплата труда
        </h3>
        <p className='mt-2 text-[13px] text-[#7e8fb4]'>
          Расчёт для сотрудника {employeeName(employee)}
        </p>
      </div>
    </div>
  );
}

export function CurrentRatesSection({
  employee,
  rateCards,
  currentRate,
  advancedSettingsCount,
  projectRatesCount,
  canChangeRate,
  canManageRate,
  onOpenRateHistory,
  onOpenRateModal,
  onOpenRateDetails,
}: {
  employee: User;
  rateCards: RateCard[];
  currentRate: EmployeeRate | null;
  advancedSettingsCount: number;
  projectRatesCount: number;
  canChangeRate: boolean;
  canManageRate: boolean;
  onOpenRateHistory: () => void;
  onOpenRateModal: () => void;
  onOpenRateDetails: () => void;
}) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 sm:p-3'>
      <div className='mb-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between'>
        <p className='text-[15px] font-semibold text-[#1f3565]'>Текущие ставки</p>
        <div className='grid gap-2 sm:flex sm:flex-wrap'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='min-h-10 w-full rounded-xl border-[#e3e9f3] bg-white px-3 text-[12px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff] sm:h-9 sm:w-auto sm:min-h-0'
            onClick={onOpenRateHistory}
          >
            История изменений ставки
          </Button>
          {canChangeRate ? (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              disabled={!canManageRate}
              className='min-h-10 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-3 text-[12px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! sm:h-9 sm:w-auto sm:min-h-0'
              onClick={onOpenRateModal}
            >
              + Изменить ставку
            </Button>
          ) : null}
        </div>
      </div>

      <p className='mb-2 text-[12px] font-semibold tracking-[0.05em] text-[#7e8fb4] uppercase'>
        Роль: {employee.role_label ?? 'Не указано'}
      </p>

      <div className='grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3'>
        {rateCards.map((card) => (
          <div
            key={card.label}
            className='min-w-0 rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-sm shadow-[#10275a]/5'
          >
            <p className='break-words text-[11px] text-[#7e8fb4] sm:text-[12px]'>
              {card.label}
            </p>
            <p
              className={`mt-2 leading-tight font-semibold ${
                card.isAdvanced
                  ? 'break-words text-sm text-[#2d6ff7] sm:text-[16px]'
                  : 'break-words text-lg text-[#10275a] sm:text-[22px]'
              }`}
            >
              {card.value}
            </p>
            {card.note ? <div className='mt-1'>{card.note}</div> : null}
          </div>
        ))}
      </div>

      <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
        <p className='text-[12px] text-[#7e8fb4]'>
          Настраивает владелец, бухгалтер. Все изменения сохраняются в истории.
          {currentRate?.exclude_from_supervised_hours
            ? ' Часы сотрудника не учитываются как подконтрольные.'
            : ''}
          {advancedSettingsCount > 0
            ? ` Продвинутых ставок: ${advancedSettingsCount}.`
            : ''}
          {projectRatesCount > 0
            ? ` Отдельных ставок по проектам: ${projectRatesCount}.`
            : ''}
        </p>
        {currentRate && (advancedSettingsCount > 0 || projectRatesCount > 0) ? (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='h-8 rounded-lg border-[#d7e1f1] bg-white px-3 text-[12px] font-semibold text-[#2d6ff7] hover:bg-[#edf3ff]'
            onClick={onOpenRateDetails}
          >
            Показать больше
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SalaryFinanceArticleSection({
  value,
  settings,
  isLoading,
  isSaving,
  error,
  onChange,
}: {
  value: string | null;
  settings: FinanceSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error?: string;
  onChange: (_value: string | null) => void;
}) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 sm:p-3'>
      <div className='mb-3 grid gap-1'>
        <p className='text-[15px] font-semibold text-[#1f3565]'>Финансовая статья</p>
        <p className='text-[12px] leading-5 text-[#7e8fb4]'>
          Индивидуальная статья используется для зарплатных начислений этого сотрудника.
          Общая статья продолжит использоваться, если выбран вариант по умолчанию.
        </p>
      </div>
      <div className='max-w-[620px]'>
        <SalaryFinanceArticleSelect
          value={value}
          settings={settings}
          isLoading={isLoading}
          isSaving={isSaving}
          error={error}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

export function BankDetailsSection({
  bankDetails,
  canEditBankDetails,
  isLoadingBankDetails,
  isSavingBankDetails,
  onBankDetailsChange,
  onSaveBankDetails,
}: {
  bankDetails: string;
  canEditBankDetails: boolean;
  isLoadingBankDetails: boolean;
  isSavingBankDetails: boolean;
  onBankDetailsChange: (_value: string) => void;
  onSaveBankDetails: () => void;
}) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 sm:p-3'>
      <p className='mb-3 text-[15px] font-semibold text-[#1f3565]'>Реквизиты</p>
      <div className='flex flex-col gap-3 md:flex-row'>
        {canEditBankDetails ? (
          <>
            <textarea
              className='min-h-20 flex-1 resize-y rounded-xl border border-[#c9d8f8] bg-white px-3 py-2 text-[13px] text-[#1f3565] outline-none transition-colors placeholder:text-[#9aa8c7] focus:border-[#2d6ff7] focus:ring-2 focus:ring-[#2d6ff7]/15'
              placeholder={
                isLoadingBankDetails
                  ? 'Загрузка реквизитов...'
                  : 'Введите банковские реквизиты для выплаты заработной платы...'
              }
              value={bankDetails}
              disabled={isLoadingBankDetails || isSavingBankDetails}
              onChange={(event) => onBankDetailsChange(event.target.value)}
            />
            <Button
              type='button'
              variant='secondary'
              disabled={
                isLoadingBankDetails || isSavingBankDetails || bankDetails.trim() === ''
              }
              className='h-11 w-full shrink-0 rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! md:w-auto md:self-start'
              onClick={onSaveBankDetails}
            >
              {isSavingBankDetails ? 'Сохранение...' : 'Сохранить реквизиты'}
            </Button>
          </>
        ) : (
          <div className='min-h-20 flex-1 rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 text-[13px] text-[#1f3565]'>
            {isLoadingBankDetails
              ? 'Загрузка реквизитов...'
              : bankDetails || 'Не указано'}
          </div>
        )}
      </div>
    </div>
  );
}

export function PayrollCalculationsSection({
  payrollRows,
  payrollMeta,
  isLoadingPayrollRows,
  onOpenDetails,
  canManageRecalculation,
  recalculationStates,
  startingPeriods,
  onRequestRecalculation,
  onPageChange,
}: {
  payrollRows: EmployeePayrollCalculationRow[];
  payrollMeta: PayrollMeta;
  isLoadingPayrollRows: boolean;
  onOpenDetails: (_row: EmployeePayrollCalculationRow) => void;
  canManageRecalculation: boolean;
  recalculationStates: Record<string, PayrollRecalculation | null | undefined>;
  startingPeriods: Set<string>;
  onRequestRecalculation: (_row: EmployeePayrollCalculationRow) => void;
  onPageChange: (_page: number) => void;
}) {
  const recalculationButton = (row: EmployeePayrollCalculationRow, mobile = false) => {
    if (!isCompletedPayrollPeriod(row)) return null;

    const periodKey = payrollPeriodKey(row.period_from, row.period_to);
    const state = recalculationStates[periodKey];
    const isStarting = startingPeriods.has(periodKey);
    const isActive = state?.status === 'QUEUED' || state?.status === 'RUNNING';
    const label = isStarting
      ? 'Запуск...'
      : state?.status === 'QUEUED'
        ? 'В очереди'
        : state?.status === 'RUNNING'
          ? 'Пересчитывается'
          : 'Пересчитать период';

    return (
      <div className='grid gap-1'>
        <button
          type='button'
          disabled={isStarting || isActive}
          title={
            state?.status === 'FAILED' ? (state.error_message ?? undefined) : undefined
          }
          className={
            mobile
              ? 'min-h-10 w-full rounded-lg border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#2d6ff7] disabled:cursor-not-allowed disabled:bg-[#f3f7ff] disabled:text-[#7e8fb4]'
              : 'rounded-lg px-2 py-1 text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff] hover:text-[#245fd8] disabled:cursor-not-allowed disabled:text-[#7e8fb4] disabled:hover:bg-transparent'
          }
          onClick={() => onRequestRecalculation(row)}
        >
          {label}
        </button>
        {state?.status === 'FAILED' && state.error_message ? (
          <span className='text-[11px] leading-tight text-rose-600'>
            {state.error_message}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 sm:p-3'>
      <p className='mb-3 text-[15px] font-semibold text-[#1f3565]'>Таблица с расчётами</p>

      <div className='grid gap-2 md:hidden'>
        {isLoadingPayrollRows ? (
          <div className='grid min-h-28 place-items-center rounded-xl border border-[#e3e9f3] bg-white'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          </div>
        ) : payrollRows.length ? (
          payrollRows.map((row) => (
            <article
              key={payrollPeriodKey(row.period_from, row.period_to)}
              className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-xs text-[#7e8fb4]'>Период</p>
                  <p className='mt-0.5 text-sm font-semibold text-[#1f3565]'>
                    {formatPeriod(row.period_from, row.period_to)}
                  </p>
                </div>
                <p className='text-base font-semibold text-[#10275a]'>
                  {formatMoney(row.amount_kopecks)}
                </p>
              </div>
              <dl className='grid grid-cols-2 gap-2 text-xs'>
                <div>
                  <dt className='text-[#7e8fb4]'>Собственные часы</dt>
                  <dd className='mt-0.5 font-medium text-[#1f3565]'>
                    {formatHours(row.own_seconds)}
                  </dd>
                </div>
                <div>
                  <dt className='text-[#7e8fb4]'>Под контролем</dt>
                  <dd className='mt-0.5 font-medium text-[#1f3565]'>
                    {formatHours(row.supervised_seconds)}
                  </dd>
                </div>
              </dl>
              <button
                type='button'
                className='min-h-10 w-full rounded-lg border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#2d6ff7]'
                onClick={() => onOpenDetails(row)}
              >
                Показать детали
              </button>
              {canManageRecalculation ? recalculationButton(row, true) : null}
            </article>
          ))
        ) : (
          <div className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-8 text-center text-sm text-[#7e8fb4]'>
            Расчёты за период пока пустые.
          </div>
        )}
      </div>

      <TableContainer className='hidden md:block'>
        <Table
          density='compact'
          className={canManageRecalculation ? 'min-w-[820px]' : 'min-w-[680px]'}
        >
          <colgroup>
            <col className={canManageRecalculation ? 'w-[20%]' : 'w-[24%]'} />
            <col className={canManageRecalculation ? 'w-[16%]' : 'w-[19%]'} />
            <col className={canManageRecalculation ? 'w-[16%]' : 'w-[19%]'} />
            <col className={canManageRecalculation ? 'w-[16%]' : 'w-[19%]'} />
            <col className={canManageRecalculation ? 'w-[14%]' : 'w-[19%]'} />
            {canManageRecalculation ? <col className='w-[18%]' /> : null}
          </colgroup>
          <THead>
            <tr>
              <Th>Расчётный период</Th>
              <Th numeric>Собственные часы</Th>
              <Th numeric>Часы под контролем</Th>
              <Th numeric>Сумма</Th>
              <Th align='center'>Детали</Th>
              {canManageRecalculation ? <Th align='center'>Перерасчёт</Th> : null}
            </tr>
          </THead>
          <TBody>
            {isLoadingPayrollRows ? (
              <TableLoadingRow />
            ) : payrollRows.length ? (
              payrollRows.map((row) => (
                <Tr key={payrollPeriodKey(row.period_from, row.period_to)}>
                  <Td className='font-semibold'>
                    {formatPeriod(row.period_from, row.period_to)}
                  </Td>
                  <Td numeric>{formatHours(row.own_seconds)}</Td>
                  <Td numeric>{formatHours(row.supervised_seconds)}</Td>
                  <Td numeric className='font-semibold'>
                    {formatMoney(row.amount_kopecks)}
                  </Td>
                  <Td align='center' className='font-semibold'>
                    <button
                      type='button'
                      className='rounded-lg px-2 py-1 text-[#2d6ff7] transition-colors hover:bg-[#f3f7ff] hover:text-[#245fd8]'
                      onClick={() => onOpenDetails(row)}
                    >
                      Показать
                    </button>
                  </Td>
                  {canManageRecalculation ? (
                    <Td align='center' className='text-xs font-semibold'>
                      {recalculationButton(row)}
                    </Td>
                  ) : null}
                </Tr>
              ))
            ) : (
              <TableEmptyRow>Расчеты за период пока пустые.</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>

      <div className={isLoadingPayrollRows ? 'pointer-events-none opacity-60' : ''}>
        <TablePagination
          currentPage={payrollMeta.current_page}
          totalPages={payrollMeta.last_page}
          pageSize={payrollMeta.per_page}
          showPageSizeSelector={false}
          onPageChange={onPageChange}
          onPageSizeChange={() => undefined}
        />
        <p className='mt-2 text-[13px] text-[#7e8fb4]'>
          Всего периодов: {payrollMeta.total}
        </p>
      </div>
    </div>
  );
}
