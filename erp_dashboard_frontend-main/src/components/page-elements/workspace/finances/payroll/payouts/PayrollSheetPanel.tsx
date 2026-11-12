import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../api/api';
import { ApiRequestError } from '../../../../../../api/core/error';
import type {
  PayrollPayout,
  PayrollPayoutArticle,
  PayrollPayoutCell,
  PayrollPayoutCreatePayload,
  PayrollPayoutKind,
  PayrollPayoutSheet,
  PayrollPayoutSheetRow,
} from '../../../../../../types/payrollPayouts';
import ConfirmDialog from '../../../../../modals/ConfirmDialog';
import Button from '../../../../../ui/Button';
import { HintToolTip } from '../../../../../ui/HintTooltip';
import {
  cx,
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
import PayoutModal, { type PayoutModalItem } from './PayoutModal';
import {
  AccrualPartsTable,
  PayoutsList,
  PayoutSpinner,
  PayoutStatusPill,
  PencilIcon,
} from './PayoutParts';
import { PayoutStartCard } from './PayoutStart';
import {
  employeeLabel,
  formatDate,
  formatMoney,
  formatSigned,
  KIND_LABELS,
  lastDayOfMonth,
  monthName,
  monthTitle,
  shiftMonth,
  STATUS_CELL_CLASSES,
} from './payoutUtils';

type SheetFilter = 'all' | 'none' | 'part' | 'paid';

const FILTERS: Array<{ value: SheetFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'none', label: 'Не выплачено' },
  { value: 'part', label: 'Частично' },
  { value: 'paid', label: 'Выплачено' },
];

function rowState(row: PayrollPayoutSheetRow): Exclude<SheetFilter, 'all'> {
  if (row.unpaid === 0) return 'paid';

  return row.paid === 0 ? 'none' : 'part';
}

function cellOf(row: PayrollPayoutSheetRow, kind: PayrollPayoutKind): PayrollPayoutCell {
  return kind === 'ADVANCE' ? row.advance : row.settlement;
}

function PayCell({
  row,
  kind,
  month,
  openMonthDay,
  isClosed,
  canManage,
  onEdit,
  onPay,
}: {
  row: PayrollPayoutSheetRow;
  kind: PayrollPayoutKind;
  month: string;
  // Число сегодняшнего дня, если месяц ещё не закрыт.
  openMonthDay: number | null;
  // Месяц зафиксирован: суммы не меняются, выплаты проводятся.
  isClosed: boolean;
  canManage: boolean;
  onEdit: () => void;
  onPay: () => void;
}) {
  const cell = cellOf(row, kind);
  const canPay = canManage && (cell.status === 'none' || cell.status === 'part');
  const nextMonth = monthName(shiftMonth(month, 1));
  const isLive = openMonthDay !== null && !cell.is_fixed;
  const isAwaited =
    kind === 'SETTLEMENT' && isLive && openMonthDay <= 15 && cell.status === 'zero';

  return (
    // Не `numeric`: в ячейке переносятся пометки и строка переноса, цифры выровнены внутри.
    <Td align='right' className={cx('min-w-44', STATUS_CELL_CLASSES[cell.status])}>
      <div className='flex flex-wrap items-center justify-end gap-1.5'>
        {canManage && !isClosed ? (
          <button
            type='button'
            className='group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-semibold text-[#10275a] tabular-nums hover:bg-[#edf3ff]'
            title='Изменить сумму'
            aria-label={`Изменить сумму: ${KIND_LABELS[kind].toLowerCase()}, ${employeeLabel(row.employee)}`}
            onClick={onEdit}
          >
            {formatMoney(cell.amount)}
            <PencilIcon />
          </button>
        ) : (
          <span className='font-semibold text-[#10275a] tabular-nums'>
            {formatMoney(cell.amount)}
          </span>
        )}
        {cell.is_manual ? (
          <span
            className='rounded-full border border-dashed border-[#c9d8f8] bg-white px-1.5 text-[11px] text-[#7e8fb4]'
            title='Сумма изменена вручную'
          >
            вручную
          </span>
        ) : cell.is_fixed && cell.amount !== cell.auto_amount ? (
          <span
            className='rounded-full border border-dashed border-[#c9d8f8] bg-white px-1.5 text-[11px] text-[#7e8fb4]'
            title={`${isClosed ? 'Месяц зафиксирован' : 'Сумма закреплена после выплаты'}. По текущим начислениям она была бы ${formatMoney(cell.auto_amount)}, разница переходит на следующий месяц.`}
          >
            закреплено
          </span>
        ) : null}
      </div>
      <div className='mt-1.5 flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1'>
        <PayoutStatusPill cell={cell} label={isAwaited ? 'С 16-го числа' : undefined} />
        {canPay ? (
          <button
            type='button'
            className='font-semibold text-[#2d6ff7] hover:underline'
            onClick={onPay}
          >
            Выплатить
          </button>
        ) : null}
      </div>
      {kind !== 'SETTLEMENT' || row.carry_out === 0 ? null : isLive ? (
        // Пока месяц открыт, расчёт ещё растёт и перекроет эту сумму, поэтому это не перенос.
        <p
          className='mt-1.5 text-xs text-[#7e8fb4] tabular-nums'
          title={`Выплачено больше, чем начислено на сегодня. Сумма уменьшит расчёт по мере начислений; что останется к концу месяца, перейдёт на ${nextMonth}.`}
        >
          Зачтётся в расчёте: {formatMoney(-row.carry_out)}
        </p>
      ) : (
        <p className='mt-1.5 text-xs text-[#7e8fb4] tabular-nums'>
          Перенос на {nextMonth}: {formatSigned(row.carry_out)}
        </p>
      )}
    </Td>
  );
}

export default function PayrollSheetPanel({
  canManage,
  month,
  focusEmployeeId,
  onMonthChange,
}: {
  canManage: boolean;
  month: string | null;
  focusEmployeeId?: string | null;
  onMonthChange: (_month: string) => void;
}) {
  const [sheet, setSheet] = useState<PayrollPayoutSheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SheetFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const expandedRows = useExpandedRows<string>(focusEmployeeId ? [focusEmployeeId] : []);
  const [articles, setArticles] = useState<PayrollPayoutArticle[]>([]);
  const [payoutModal, setPayoutModal] = useState<{
    kind: PayrollPayoutKind;
    items: PayoutModalItem[];
  } | null>(null);
  const [amountModal, setAmountModal] = useState<{
    row: PayrollPayoutSheetRow;
    kind: PayrollPayoutKind;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayrollPayout | null>(null);
  const [closingAction, setClosingAction] = useState<'close' | 'reopen' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Последняя дата выплаты за месяц: при вводе задним числом её не нужно выбирать заново.
  const [lastPaidAt, setLastPaidAt] = useState<{ month: string; date: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setSheet(await api.workspace.payrollPayouts.getSheet(month));
    } catch (loadError) {
      setError(
        loadError instanceof ApiRequestError && loadError.status === 403
          ? 'У вас нет доступа к ведомости выплат.'
          : loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить ведомость.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelected(new Set());
  }, [month]);

  const loadArticles = useCallback(async () => {
    try {
      setArticles(await api.workspace.payrollPayoutArticles.getMany());
    } catch (loadError) {
      toast.error(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить статьи выплат.',
      );
    }
  }, []);

  useEffect(() => {
    if (canManage && sheet?.start_month) void loadArticles();
  }, [canManage, loadArticles, sheet?.start_month]);

  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter(
      (row) =>
        (!query || employeeLabel(row.employee).toLowerCase().includes(query)) &&
        (filter === 'all' || rowState(row) === filter),
    );
  }, [filter, rows, search]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (result, row) => ({
          accrued: result.accrued + row.accrued,
          due: result.due + row.total_due,
          paid: result.paid + row.paid,
          unpaid: result.unpaid + row.unpaid,
        }),
        { accrued: 0, due: 0, paid: 0, unpaid: 0 },
      ),
    [rows],
  );
  const visibleTotals = useMemo(
    () =>
      visibleRows.reduce(
        (result, row) => ({
          carryIn: result.carryIn + row.carry_in,
          accrued: result.accrued + row.accrued,
          advance: result.advance + row.advance.amount,
          settlement: result.settlement + row.settlement.amount,
          unpaid: result.unpaid + row.unpaid,
        }),
        { carryIn: 0, accrued: 0, advance: 0, settlement: 0, unpaid: 0 },
      ),
    [visibleRows],
  );

  const handleError = (actionError: unknown) => {
    toast.error(actionError instanceof Error ? actionError.message : 'Произошла ошибка.');
  };

  const openPayout = (kind: PayrollPayoutKind, targetRows: PayrollPayoutSheetRow[]) => {
    const items = targetRows
      .map((row) => {
        const cell = cellOf(row, kind);

        return {
          employee: row.employee,
          due: cell.amount,
          paid: cell.paid,
          rest: cell.rest,
        };
      })
      .filter((item) => item.rest > 0);

    if (!items.length) {
      toast.info(
        `У выбранных сотрудников нет невыплаченной суммы: ${KIND_LABELS[kind].toLowerCase()}.`,
      );
      return;
    }

    setPayoutModal({ kind, items });
  };

  const submitPayout = async (payload: PayrollPayoutCreatePayload) => {
    try {
      setIsSaving(true);
      const created = await api.workspace.payrollPayouts.create(payload);
      await load();
      toast.success(
        created.length > 1
          ? `Проведено выплат: ${created.length}.`
          : 'Выплата проведена.',
      );
      setPayoutModal(null);
      setLastPaidAt({ month: payload.month, date: payload.paid_at });
      setSelected(new Set());
      // Выплату одному сотруднику показываем раскрытой строкой.
      if (payload.items.length === 1) {
        expandedRows.expandAll([...expandedRows.expanded, payload.items[0].employee_id]);
      }
    } catch (actionError) {
      handleError(actionError);
    } finally {
      setIsSaving(false);
    }
  };

  const savePlan = async (amount: number | null) => {
    if (!amountModal || !sheet) return;

    try {
      setIsSaving(true);
      await api.workspace.payrollPayouts.updatePlan({
        employee_id: amountModal.row.employee.id,
        month: sheet.month,
        kind: amountModal.kind,
        amount,
      });
      await load();
      toast.success(
        amount === null ? 'Возвращена сумма по начислениям.' : 'Сумма изменена.',
      );
      setAmountModal(null);
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

  const changeClosing = async () => {
    if (!closingAction || !sheet) return;

    try {
      setIsSaving(true);
      if (closingAction === 'close') {
        await api.workspace.payrollPayouts.closeMonth(sheet.month);
      } else {
        await api.workspace.payrollPayouts.reopenMonth(sheet.month);
      }
      await load();
      toast.success(
        closingAction === 'close' ? 'Месяц зафиксирован.' : 'Фиксация месяца снята.',
      );
      setClosingAction(null);
    } catch (actionError) {
      handleError(actionError);
    } finally {
      setIsSaving(false);
    }
  };

  const changeMonth = (nextMonth: string) => {
    expandedRows.collapseAll();
    onMonthChange(nextMonth);
  };

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  if (!sheet) {
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

  if (!sheet.start_month) {
    return <PayoutStartCard canManage={canManage} onSaved={() => void load()} />;
  }

  const activeMonth = sheet.month;
  const selectedRows = visibleRows.filter((row) => selected.has(row.employee.id));
  const allSelected =
    visibleRows.length > 0 && selectedRows.length === visibleRows.length;
  const selectedRest = selectedRows.reduce(
    (result, row) => ({
      ADVANCE: result.ADVANCE + Math.max(0, row.advance.rest),
      SETTLEMENT: result.SETTLEMENT + Math.max(0, row.settlement.rest),
    }),
    { ADVANCE: 0, SETTLEMENT: 0 },
  );
  const paidPercent =
    totals.paid + totals.unpaid > 0
      ? Math.round((totals.paid / (totals.paid + totals.unpaid)) * 100)
      : 0;
  const columnsCount = canManage ? 7 : 6;
  const openMonthDay =
    activeMonth === sheet.current_month ? Number(sheet.today.slice(8, 10)) : null;
  const amountRow = amountModal?.row;
  const isClosed = Boolean(sheet.closing);
  const nextMonthName = monthName(shiftMonth(activeMonth, 1));

  return (
    <div className='grid min-w-0 gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] md:p-4'>
      <div className='z-10 flex flex-wrap items-center gap-x-3 gap-y-2 bg-white lg:sticky lg:-top-3 lg:-mx-4 lg:-mt-4 lg:-mb-3 lg:rounded-t-xl lg:px-4 lg:pt-4 lg:pb-3'>
        <div className='flex items-center gap-1 rounded-lg border border-[#d7e1f1] bg-white p-0.5'>
          <button
            type='button'
            className='grid size-8 place-items-center rounded-md text-lg text-[#2d6ff7] hover:bg-[#edf3ff] disabled:cursor-not-allowed disabled:opacity-40'
            aria-label='Предыдущий месяц'
            disabled={activeMonth <= sheet.start_month}
            onClick={() => changeMonth(shiftMonth(activeMonth, -1))}
          >
            ‹
          </button>
          <strong className='min-w-34 text-center font-semibold text-[#10275a]'>
            {monthTitle(activeMonth)}
          </strong>
          <button
            type='button'
            className='grid size-8 place-items-center rounded-md text-lg text-[#2d6ff7] hover:bg-[#edf3ff] disabled:cursor-not-allowed disabled:opacity-40'
            aria-label='Следующий месяц'
            disabled={activeMonth >= sheet.current_month}
            onClick={() => changeMonth(shiftMonth(activeMonth, 1))}
          >
            ›
          </button>
        </div>
        <input
          type='search'
          className='h-9 w-52 max-w-full rounded-lg border border-[#d7e1f1] bg-white px-3 text-sm outline-none focus:border-[#2d6ff7]'
          placeholder='Сотрудник'
          aria-label='Поиск сотрудника'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div
          className='flex flex-wrap overflow-hidden rounded-lg border border-[#d7e1f1] bg-white'
          role='group'
          aria-label='Статус выплаты'
        >
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type='button'
              aria-pressed={filter === item.value}
              className={`border-r border-[#e3e9f3] px-3 py-2 text-sm font-semibold last:border-r-0 ${
                filter === item.value
                  ? 'bg-[#edf3ff] text-[#2d6ff7]'
                  : 'text-[#7e8fb4] hover:text-[#1f3565]'
              }`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {canManage ? (
          <div className='flex flex-wrap gap-2 lg:ml-auto'>
            <Button
              variant='secondary'
              className='h-9'
              disabled={openMonthDay !== null}
              title={
                openMonthDay !== null
                  ? 'Зафиксировать можно после окончания месяца'
                  : undefined
              }
              onClick={() => setClosingAction(isClosed ? 'reopen' : 'close')}
            >
              {isClosed ? 'Снять фиксацию' : 'Зафиксировать месяц'}
            </Button>
          </div>
        ) : null}
        {canManage && visibleRows.length ? (
          // Массовая выплата: без подсказки чекбоксы в таблице не находят.
          // Цвета и кнопки как у выделения в "Платежах", подсказка как в окне экспорта.
          <div className='flex min-h-12 basis-full flex-wrap items-center gap-2 rounded-lg border border-[#dce7ff] bg-[#edf3ff] px-3 py-2 text-[13px] text-[#1f3565]'>
            {selectedRows.length ? (
              <>
                <span className='font-semibold'>Выделено: {selectedRows.length}</span>
                {(['ADVANCE', 'SETTLEMENT'] as const).map((kind) => (
                  <button
                    key={kind}
                    type='button'
                    className='inline-flex h-8 items-center rounded-md border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#1f3565] transition-colors hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:text-[#7e8fb4] disabled:hover:bg-white'
                    disabled={selectedRest[kind] === 0}
                    title={
                      selectedRest[kind] === 0
                        ? `У выделенных сотрудников нет невыплаченной суммы: ${KIND_LABELS[kind].toLowerCase()}`
                        : undefined
                    }
                    onClick={() => openPayout(kind, selectedRows)}
                  >
                    Выплатить {KIND_LABELS[kind].toLowerCase()}
                    {selectedRest[kind] > 0
                      ? ` · ${formatMoney(selectedRest[kind])}`
                      : ''}
                  </button>
                ))}
                <button
                  type='button'
                  className='px-1 text-xs font-semibold text-[#2d6ff7] hover:underline'
                  onClick={() => setSelected(new Set())}
                >
                  Снять выделение
                </button>
              </>
            ) : (
              <>
                <svg
                  className='size-5 shrink-0 fill-none stroke-[#2d6ff7] stroke-[1.8]'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <circle cx='12' cy='12' r='9' />
                  <path d='M12 11v5' />
                  <path d='M12 8h.01' />
                </svg>
                <span className='font-medium'>
                  Чтобы выплатить аванс или расчёт сразу нескольким сотрудникам, отметьте
                  их галочками в первой колонке таблицы.
                </span>
              </>
            )}
          </div>
        ) : null}
      </div>

      <dl className='flex flex-wrap items-end gap-x-7 gap-y-2.5 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3.5 py-3'>
        {[
          ['Начислено', totals.accrued],
          ['К выплате', totals.due],
          ['Выплачено', totals.paid],
          ['Осталось выплатить', totals.unpaid],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className='text-xs text-[#7e8fb4]'>{label}</dt>
            <dd className='text-[17px] font-semibold text-[#10275a] tabular-nums'>
              {formatMoney(value as number)}
            </dd>
          </div>
        ))}
        <div className='grid min-w-44 flex-1 gap-1 text-xs text-[#7e8fb4]'>
          <span>Выплачено {paidPercent}%</span>
          <div className='h-2 overflow-hidden rounded-full bg-[#eef2f8]'>
            <div
              className='h-full rounded-full bg-emerald-600'
              style={{ width: `${paidPercent}%` }}
            />
          </div>
        </div>
      </dl>

      {activeMonth === sheet.current_month ? (
        <p className='text-sm text-[#7e8fb4]'>
          Месяц не закрыт: начисления на {formatDate(sheet.today)}. Аванс считается за
          1-15 число, расчёт начнёт расти с 16-го.
        </p>
      ) : sheet.closing ? (
        <p className='text-sm text-[#1f3565]'>
          <b className='font-semibold text-[#10275a]'>Месяц зафиксирован</b>
          {sheet.closing.closed_at
            ? ` ${new Date(sheet.closing.closed_at).toLocaleDateString('ru-RU')}`
            : ''}
          {sheet.closing.closed_by ? `, ${sheet.closing.closed_by.name}` : ''}. Суммы
          аванса и расчёта не меняются: перерасчёт начислений уйдёт переносом на{' '}
          {nextMonthName}.
        </p>
      ) : (
        <p className='text-sm text-[#7e8fb4]'>
          Месяц не зафиксирован: невыплаченные суммы меняются вместе с начислениями.
        </p>
      )}

      {error ? (
        <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      ) : null}

      {visibleRows.length === 0 ? (
        <div className='grid min-h-40 place-items-center text-sm text-[#7e8fb4]'>
          {rows.length
            ? 'Нет сотрудников по выбранным условиям.'
            : 'За этот месяц нет начислений и выплат.'}
        </div>
      ) : (
        <TableContainer>
          <Table striped={false} className='min-w-235'>
            <THead>
              <tr>
                {canManage ? (
                  <Th align='center' className='w-10'>
                    <input
                      type='checkbox'
                      aria-label='Выбрать всех'
                      checked={allSelected}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? new Set(visibleRows.map((row) => row.employee.id))
                            : new Set(),
                        )
                      }
                    />
                  </Th>
                ) : null}
                <Th>Сотрудник</Th>
                <Th numeric>
                  <span className='inline-flex items-center gap-1'>
                    Перенос
                    <HintToolTip content='Остаток с прошлого месяца: ручное округление, перерасчёт после выплаты или переплата. Входит в расчёт этого месяца.' />
                  </span>
                </Th>
                <Th numeric>Начислено</Th>
                <Th numeric>
                  <span className='inline-flex items-center gap-1'>
                    Аванс
                    <HintToolTip content='Начислено за 1-15 число. Неделя, в которую попадает 15-е, делится между авансом и расчётом по дням. Сумму можно изменить, расчёт пересчитается.' />
                  </span>
                </Th>
                <Th numeric>
                  <span className='inline-flex items-center gap-1'>
                    Расчёт
                    <HintToolTip content='Перенос + начислено − аванс. Если изменить сумму, разница перейдёт на следующий месяц.' />
                  </span>
                </Th>
                <Th numeric>Осталось выплатить</Th>
              </tr>
            </THead>
            <TBody>
              {visibleRows.map((row) => {
                const employeeId = row.employee.id;
                const isExpanded = expandedRows.isExpanded(employeeId);
                // Часть начисленного, которая не входит в аванс и расчёт этого месяца.
                const outsideDue = row.carry_in + row.accrued - row.total_due;

                return (
                  <Fragment key={employeeId}>
                    {/* Ячейки строки многострочные, поэтому прижаты к верху. */}
                    <Tr className='[&>td]:align-top'>
                      {canManage ? (
                        <Td align='center'>
                          <input
                            type='checkbox'
                            aria-label={`Выбрать: ${employeeLabel(row.employee)}`}
                            checked={selected.has(employeeId)}
                            onChange={() => setSelected(toggle(selected, employeeId))}
                          />
                        </Td>
                      ) : null}
                      <Td>
                        <div className='flex min-w-44 items-start gap-2'>
                          <TableExpandButton
                            expanded={isExpanded}
                            label={`Выплаты за месяц: ${employeeLabel(row.employee)}`}
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
                          row.carry_in < 0
                            ? 'text-blue-700'
                            : row.carry_in === 0
                              ? 'text-[#7e8fb4]'
                              : undefined
                        }
                      >
                        {formatSigned(row.carry_in)}
                      </Td>
                      <Td numeric className='font-semibold text-[#10275a]'>
                        {formatMoney(row.accrued)}
                      </Td>
                      {(['ADVANCE', 'SETTLEMENT'] as const).map((kind) => (
                        <PayCell
                          key={kind}
                          row={row}
                          kind={kind}
                          month={activeMonth}
                          openMonthDay={openMonthDay}
                          isClosed={isClosed}
                          canManage={canManage}
                          onEdit={() => setAmountModal({ row, kind })}
                          onPay={() => openPayout(kind, [row])}
                        />
                      ))}
                      <Td
                        numeric
                        className={
                          row.unpaid > 0
                            ? 'font-semibold text-[#10275a]'
                            : 'text-[#7e8fb4]'
                        }
                      >
                        {formatMoney(row.unpaid)}
                      </Td>
                    </Tr>
                    {isExpanded ? (
                      // Панель подробностей, а не строка данных: свои отступы и фон.
                      <tr>
                        <td
                          colSpan={columnsCount}
                          className='border-b border-[#c9d8f8] bg-[#fbfcff] px-4 py-3.5'
                        >
                          <div className='grid gap-x-7 gap-y-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,1fr)]'>
                            <div className='min-w-0'>
                              <h4 className='mb-2 text-xs font-bold tracking-[0.05em] text-[#7e8fb4] uppercase'>
                                Начисление за {monthName(activeMonth)}
                              </h4>
                              <AccrualPartsTable
                                parts={row.accrual_parts}
                                lastDay={lastDayOfMonth(activeMonth)}
                              />
                            </div>
                            <div>
                              <h4 className='mb-2 text-xs font-bold tracking-[0.05em] text-[#7e8fb4] uppercase'>
                                К выплате за {monthName(activeMonth)}
                              </h4>
                              <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm'>
                                <dt className='text-[#7e8fb4]'>Начислено</dt>
                                <dd className='text-right tabular-nums'>
                                  {formatMoney(row.accrued)}
                                </dd>
                                <dt className='text-[#7e8fb4]'>
                                  Перенос с прошлого месяца
                                </dt>
                                <dd className='text-right tabular-nums'>
                                  {formatSigned(row.carry_in)}
                                </dd>
                                {outsideDue !== 0 ? (
                                  <>
                                    <dt className='text-[#7e8fb4]'>
                                      {outsideDue > 0
                                        ? `Переходит на ${monthName(shiftMonth(activeMonth, 1))}`
                                        : openMonthDay !== null &&
                                            !row.settlement.is_fixed
                                          ? 'Зачтётся в расчёте'
                                          : 'Сверх начисленного'}
                                    </dt>
                                    <dd className='text-right tabular-nums'>
                                      {formatSigned(-outsideDue)}
                                    </dd>
                                  </>
                                ) : null}
                                <dt className='border-t border-[#e3e9f3] pt-1 font-semibold'>
                                  К выплате
                                </dt>
                                <dd className='border-t border-[#e3e9f3] pt-1 text-right font-semibold tabular-nums'>
                                  {formatMoney(row.total_due)}
                                </dd>
                                <dt className='text-[#7e8fb4]'>Выплачено</dt>
                                <dd className='text-right tabular-nums'>
                                  {formatMoney(row.paid)}
                                </dd>
                                <dt className='text-[#7e8fb4]'>Осталось выплатить</dt>
                                <dd className='text-right tabular-nums'>
                                  {formatMoney(row.unpaid)}
                                </dd>
                              </dl>
                            </div>
                            <div className='min-w-0 lg:col-span-2'>
                              <h4 className='mb-2 text-xs font-bold tracking-[0.05em] text-[#7e8fb4] uppercase'>
                                Выплаты за {monthName(activeMonth)}
                              </h4>
                              <PayoutsList
                                payouts={row.payouts}
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
                {canManage ? <Td /> : null}
                <Td>Итого: {visibleRows.length}</Td>
                {[
                  formatSigned(visibleTotals.carryIn),
                  formatMoney(visibleTotals.accrued),
                  formatMoney(visibleTotals.advance),
                  formatMoney(visibleTotals.settlement),
                  formatMoney(visibleTotals.unpaid),
                ].map((value, index) => (
                  <Td key={index} numeric>
                    {value}
                  </Td>
                ))}
              </tr>
            </TFoot>
          </Table>
        </TableContainer>
      )}

      {payoutModal ? (
        <PayoutModal
          month={activeMonth}
          kind={payoutModal.kind}
          items={payoutModal.items}
          articles={articles}
          defaultPaidAt={
            lastPaidAt?.month === activeMonth ? lastPaidAt.date : sheet.today
          }
          isSaving={isSaving}
          onClose={() => setPayoutModal(null)}
          onSubmit={(payload) => void submitPayout(payload)}
        />
      ) : null}

      {amountModal && amountRow ? (
        <PayoutAmountModal
          title={`${KIND_LABELS[amountModal.kind]} за ${monthName(activeMonth)} ${activeMonth.slice(0, 4)}`}
          subtitle={employeeLabel(amountRow.employee)}
          label='Сумма к выплате, руб.'
          description={
            <>
              Сумма по начислениям:{' '}
              <b className='font-semibold text-[#10275a]'>
                {formatMoney(cellOf(amountRow, amountModal.kind).auto_amount)}
              </b>{' '}
              (
              {amountModal.kind === 'ADVANCE'
                ? 'начислено за 1-15 число'
                : 'перенос + начислено − аванс'}
              ).
              {cellOf(amountRow, amountModal.kind).paid > 0
                ? ` Уже выплачено ${formatMoney(cellOf(amountRow, amountModal.kind).paid)}.`
                : ''}
            </>
          }
          initialAmount={cellOf(amountRow, amountModal.kind).amount}
          isSaving={isSaving}
          hint={(amount) => planHint(amountRow, amountModal.kind, amount, activeMonth)}
          onReset={
            cellOf(amountRow, amountModal.kind).is_fixed
              ? () => void savePlan(null)
              : undefined
          }
          onClose={() => setAmountModal(null)}
          onSave={(amount) => void savePlan(amount)}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(closingAction)}
        isProcessing={isSaving}
        danger={false}
        title={
          closingAction === 'reopen'
            ? `Снять фиксацию: ${monthTitle(activeMonth)}?`
            : `Зафиксировать ${monthTitle(activeMonth)}?`
        }
        message={
          closingAction === 'reopen'
            ? 'Суммы аванса и расчёта снова будут считаться по начислениям. Выплаты и суммы, введённые вручную, сохранятся.'
            : `Суммы аванса и расчёта всех сотрудников закрепятся и перестанут меняться. Если начисления за месяц потом пересчитают, разница уйдёт переносом на ${nextMonthName}. Выплаты можно проводить и после фиксации.`
        }
        confirmLabel={closingAction === 'reopen' ? 'Снять фиксацию' : 'Зафиксировать'}
        processingLabel='Сохранение...'
        onClose={() => setClosingAction(null)}
        onConfirm={() => void changeClosing()}
      />

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

// Подсказка повторяет расчёт сервера: показывает, как правка суммы изменит расчёт и перенос.
function planHint(
  row: PayrollPayoutSheetRow,
  kind: PayrollPayoutKind,
  amount: number,
  month: string,
) {
  const nextMonth = monthName(shiftMonth(month, 1));
  const advanceClosed = Math.max(
    kind === 'ADVANCE' ? amount : row.advance.amount,
    row.advance.paid,
  );
  const settlement =
    kind === 'SETTLEMENT'
      ? amount
      : row.settlement.is_fixed
        ? row.settlement.amount
        : Math.max(0, row.carry_in + row.accrued - advanceClosed);
  const carry =
    row.carry_in + row.accrued - Math.max(advanceClosed + settlement, row.paid);

  if (kind === 'ADVANCE' && !row.settlement.is_fixed) {
    return `Расчёт за месяц станет ${formatMoney(settlement)}.`;
  }

  return carry === 0
    ? `Переноса на ${nextMonth} не будет.`
    : `Перенос на ${nextMonth}: ${formatSigned(carry)}.`;
}
