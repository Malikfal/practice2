import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../../../api/api';
import { ApiRequestError } from '../../../../../../api/core/error';
import type {
  PayrollPayout,
  PayrollPayoutDebtRow,
  PayrollPayoutDebts,
} from '../../../../../../types/payrollPayouts';
import ConfirmDialog from '../../../../../modals/ConfirmDialog';
import { HintToolTip } from '../../../../../ui/HintTooltip';
import {
  Table,
  TableContainer,
  TableExpandButton,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
  useExpandedRows,
} from '../../../../../ui/table';
import { PayrollEmployeeName } from '../PayrollEmployeeName';

import PayoutAmountModal from './PayoutAmountModal';
import { PayoutsList, PayoutSpinner, PencilIcon } from './PayoutParts';
import { PayoutStartCard, PayoutStartModal } from './PayoutStart';
import {
  employeeLabel,
  formatDate,
  formatMoney,
  formatSigned,
  KIND_LABELS,
  monthName,
  monthStartLabel,
  monthTitle,
} from './payoutUtils';

function DebtPill({ debt }: { debt: number }) {
  const [classes, label] =
    debt > 0
      ? ['border-amber-300 text-amber-700', `Долг ${formatMoney(debt)}`]
      : debt < 0
        ? ['border-blue-300 text-blue-700', `Переплата ${formatMoney(-debt)}`]
        : ['border-emerald-300 text-emerald-700', 'Расчёт закрыт'];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums ${classes}`}
    >
      <span className='size-1.5 rounded-full bg-current' />
      {label}
    </span>
  );
}

// Делит остаток на долг за закрытые месяцы и на начисления текущего, ещё не закрытого месяца.
function splitDebt(row: PayrollPayoutDebtRow, currentMonth: string) {
  const current = row.months.find((item) => item.month === currentMonth);
  const closed = current ? current.debt_in : row.debt;

  return { closed, current: row.debt - closed };
}

function DebtSplit({
  closed,
  current,
  currentMonth,
}: {
  closed: number;
  current: number;
  currentMonth: string;
}) {
  if (current === 0) return null;

  return (
    <div className='mt-1 text-xs whitespace-nowrap text-[#7e8fb4] tabular-nums'>
      закрытые месяцы: {formatMoney(closed)} · {monthName(currentMonth)}:{' '}
      {formatMoney(current)}
    </div>
  );
}

export default function PayrollDebtPanel({
  canManage,
  monthHref,
}: {
  canManage: boolean;
  /** Адрес ведомости за месяц с раскрытой строкой сотрудника. */
  monthHref: (_month: string, _employeeId: string) => string;
}) {
  const [debts, setDebts] = useState<PayrollPayoutDebts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(true);
  const [onlyWithDebt, setOnlyWithDebt] = useState(false);
  const expandedRows = useExpandedRows<string>();
  const [openingTarget, setOpeningTarget] = useState<PayrollPayoutDebtRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayrollPayout | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setDebts(await api.workspace.payrollPayouts.getDebts());
    } catch (loadError) {
      setError(
        loadError instanceof ApiRequestError && loadError.status === 403
          ? 'У вас нет доступа к задолженности по выплатам.'
          : loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить задолженность.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (debts?.rows ?? []).filter(
      (row) =>
        (!query || employeeLabel(row.employee).toLowerCase().includes(query)) &&
        (showArchived || !row.employee.is_archived) &&
        (!onlyWithDebt || row.debt !== 0),
    );
  }, [debts, onlyWithDebt, search, showArchived]);
  const currentMonth = debts?.current_month ?? '';
  const totals = useMemo(
    () =>
      rows.reduce(
        (result, row) => ({
          opening: result.opening + row.opening,
          accrued: result.accrued + row.accrued,
          paid: result.paid + row.paid,
          debt: result.debt + row.debt,
          closed: result.closed + splitDebt(row, currentMonth).closed,
        }),
        { opening: 0, accrued: 0, paid: 0, debt: 0, closed: 0 },
      ),
    [currentMonth, rows],
  );

  const handleError = (actionError: unknown) => {
    toast.error(actionError instanceof Error ? actionError.message : 'Произошла ошибка.');
  };

  const saveOpening = async (amount: number) => {
    if (!openingTarget) return;

    try {
      setIsSaving(true);
      await api.workspace.payrollPayouts.updateOpening(openingTarget.employee.id, amount);
      await load();
      toast.success('Остаток на начало учёта сохранён.');
      setOpeningTarget(null);
    } catch (actionError) {
      handleError(actionError);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePayout = async () => {
    if (!deleteTarget) return;

    try {
      setIsSaving(true);
      await api.workspace.payrollPayouts.delete(deleteTarget.id);
      await load();
      toast.success('Выплата удалена.');
      setDeleteTarget(null);
    } catch (actionError) {
      handleError(actionError);
    } finally {
      setIsSaving(false);
    }
  };

  if (!debts) {
    return (
      <div className='min-h-0 rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] md:p-4'>
        {isLoading ? (
          <PayoutSpinner />
        ) : (
          <div className='my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {error}
          </div>
        )}
      </div>
    );
  }

  if (!debts.start_month) {
    return <PayoutStartCard canManage={canManage} onSaved={() => void load()} />;
  }

  const startLabel = monthStartLabel(debts.start_month);

  return (
    <div className='grid min-w-0 gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] md:p-4'>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <input
          type='search'
          className='h-9 w-52 max-w-full rounded-lg border border-[#d7e1f1] bg-white px-3 text-sm outline-none focus:border-[#2d6ff7]'
          placeholder='Сотрудник'
          aria-label='Поиск сотрудника'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className='inline-flex items-center gap-1.5 text-sm'>
          <input
            type='checkbox'
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Показывать архивных
        </label>
        <label className='inline-flex items-center gap-1.5 text-sm'>
          <input
            type='checkbox'
            checked={onlyWithDebt}
            onChange={(event) => setOnlyWithDebt(event.target.checked)}
          />
          Только с остатком
        </label>
        <div className='flex items-center gap-3 rounded-lg border border-[#dce7ff] bg-[#edf3ff] px-3 py-1.5 text-sm text-[#1f3565] lg:ml-auto'>
          <span>
            Учёт выплат с{' '}
            <b className='font-semibold text-[#10275a] tabular-nums'>{startLabel}</b>
          </span>
          {canManage ? (
            <button
              type='button'
              className='font-semibold text-[#2d6ff7] hover:underline'
              onClick={() => setIsStartModalOpen(true)}
            >
              Изменить
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className='grid min-h-40 place-items-center text-sm text-[#7e8fb4]'>
          {debts.rows.length
            ? 'Нет сотрудников по выбранным условиям.'
            : 'С начала учёта нет начислений и выплат.'}
        </div>
      ) : (
        <TableContainer>
          <Table striped={false} className='min-w-215'>
            <THead>
              <tr>
                <Th pin='left'>Сотрудник</Th>
                <Th numeric>
                  <span className='inline-flex items-center gap-1'>
                    Остаток на начало учёта
                    <HintToolTip
                      content={`Долг компании перед сотрудником на ${startLabel}. Вводится вручную${canManage ? ': нажмите на сумму в строке сотрудника' : ''}.`}
                    />
                  </span>
                </Th>
                <Th numeric>Начислено</Th>
                <Th numeric>Выплачено</Th>
                <Th numeric>
                  <span className='inline-flex items-center gap-1'>
                    Остаток на {formatDate(debts.today)}
                    <HintToolTip content='Остаток на начало учёта + начислено − выплачено. Включает начисления текущего месяца, который ещё не закрыт: под суммой видно, сколько приходится на закрытые месяцы.' />
                  </span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => {
                const employeeId = row.employee.id;
                const isExpanded = expandedRows.isExpanded(employeeId);

                return (
                  <Fragment key={employeeId}>
                    {/* Ячейки строки многострочные, поэтому прижаты к верху. */}
                    <Tr className='[&>td]:align-top'>
                      <Td pin='left'>
                        <div className='flex min-w-44 items-start gap-2'>
                          <TableExpandButton
                            expanded={isExpanded}
                            label={`Периоды и выплаты: ${employeeLabel(row.employee)}`}
                            onToggle={() => expandedRows.toggle(employeeId)}
                          />
                          <PayrollEmployeeName
                            name={employeeLabel(row.employee)}
                            isArchived={row.employee.is_archived}
                            position={row.employee.position}
                          />
                        </div>
                      </Td>
                      <Td
                        numeric
                        className={
                          row.opening < 0
                            ? 'text-blue-700'
                            : row.opening === 0
                              ? 'text-[#7e8fb4]'
                              : undefined
                        }
                      >
                        {canManage ? (
                          <button
                            type='button'
                            className='group -my-0.5 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 tabular-nums decoration-dotted underline-offset-4 hover:bg-[#edf3ff] hover:text-[#2d6ff7] hover:underline'
                            title='Изменить остаток на начало учёта'
                            aria-label={`Изменить остаток на начало учёта: ${employeeLabel(row.employee)}`}
                            onClick={() => setOpeningTarget(row)}
                          >
                            {formatSigned(row.opening)}
                            <PencilIcon />
                          </button>
                        ) : (
                          formatSigned(row.opening)
                        )}
                      </Td>
                      <Td numeric>{formatMoney(row.accrued)}</Td>
                      <Td numeric>{formatMoney(row.paid)}</Td>
                      <Td numeric>
                        <DebtPill debt={row.debt} />
                        <DebtSplit
                          {...splitDebt(row, currentMonth)}
                          currentMonth={currentMonth}
                        />
                      </Td>
                    </Tr>
                    {isExpanded ? (
                      // Панель подробностей, а не строка данных: свои отступы и фон.
                      <tr>
                        <td
                          colSpan={5}
                          className='border-b border-[#c9d8f8] bg-[#fbfcff] px-4 py-3.5'
                        >
                          <div className='mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
                            <span>
                              Остаток на начало учёта ({startLabel}):{' '}
                              <b className='font-semibold text-[#10275a] tabular-nums'>
                                {formatSigned(row.opening)}
                              </b>
                            </span>
                            {canManage ? (
                              <button
                                type='button'
                                className='font-semibold text-[#2d6ff7] hover:underline'
                                onClick={() => setOpeningTarget(row)}
                              >
                                Изменить
                              </button>
                            ) : null}
                          </div>
                          <div className='grid gap-4'>
                            <div className='min-w-0'>
                              <h4 className='mb-2 text-xs font-bold tracking-[0.05em] text-[#7e8fb4] uppercase'>
                                По месяцам
                              </h4>
                              <TableContainer className='max-w-190'>
                                <Table density='compact'>
                                  <THead>
                                    <tr>
                                      <Th>Месяц</Th>
                                      <Th numeric>На начало</Th>
                                      <Th numeric>Начислено</Th>
                                      <Th numeric>Выплачено</Th>
                                      <Th numeric>На конец</Th>
                                    </tr>
                                  </THead>
                                  <TBody>
                                    {row.months.map((item) => (
                                      <Tr key={item.month}>
                                        <Td>
                                          <Link
                                            to={monthHref(item.month, employeeId)}
                                            replace
                                            className='font-semibold whitespace-nowrap text-[#2d6ff7] hover:underline'
                                            title='Открыть ведомость за этот месяц'
                                          >
                                            {monthTitle(item.month)}
                                          </Link>
                                        </Td>
                                        <Td numeric>{formatMoney(item.debt_in)}</Td>
                                        <Td numeric>{formatMoney(item.accrued)}</Td>
                                        <Td numeric>{formatMoney(item.paid)}</Td>
                                        <Td
                                          numeric
                                          className='font-semibold text-[#10275a]'
                                        >
                                          {formatMoney(item.debt_out)}
                                        </Td>
                                      </Tr>
                                    ))}
                                  </TBody>
                                </Table>
                              </TableContainer>
                            </div>
                            <div className='min-w-0'>
                              <h4 className='mb-2 text-xs font-bold tracking-[0.05em] text-[#7e8fb4] uppercase'>
                                История выплат
                              </h4>
                              <PayoutsList
                                payouts={row.payouts}
                                showMonth
                                onDelete={canManage ? setDeleteTarget : undefined}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </TBody>
            <TFoot>
              <tr>
                <Td pin='left'>Итого: {rows.length}</Td>
                {[
                  formatSigned(totals.opening),
                  formatMoney(totals.accrued),
                  formatMoney(totals.paid),
                ].map((value, index) => (
                  <Td key={index} numeric>
                    {value}
                  </Td>
                ))}
                <Td numeric>
                  {formatMoney(totals.debt)}
                  <div className='font-normal'>
                    <DebtSplit
                      closed={totals.closed}
                      current={totals.debt - totals.closed}
                      currentMonth={currentMonth}
                    />
                  </div>
                </Td>
              </tr>
            </TFoot>
          </Table>
        </TableContainer>
      )}

      {openingTarget ? (
        <PayoutAmountModal
          title='Остаток на начало учёта'
          subtitle={`${employeeLabel(openingTarget.employee)}, на ${startLabel}`}
          label='Сумма, руб.'
          description='Плюс: компания должна сотруднику. Минус: сотруднику переплатили.'
          initialAmount={openingTarget.opening}
          allowNegative
          isSaving={isSaving}
          onClose={() => setOpeningTarget(null)}
          onSave={(amount) => void saveOpening(amount)}
        />
      ) : null}

      {isStartModalOpen ? (
        <PayoutStartModal
          onClose={() => setIsStartModalOpen(false)}
          onSaved={() => {
            setIsStartModalOpen(false);
            void load();
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title='Удалить выплату?'
        message={
          deleteTarget
            ? `${KIND_LABELS[deleteTarget.kind]} ${formatMoney(deleteTarget.amount)} от ${formatDate(deleteTarget.paid_at)} перестанет учитываться в ведомости и задолженности.`
            : ''
        }
        confirmLabel='Удалить'
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deletePayout()}
      />
    </div>
  );
}
