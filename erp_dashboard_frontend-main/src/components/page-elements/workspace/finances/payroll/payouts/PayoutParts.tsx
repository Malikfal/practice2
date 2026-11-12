import type { ReactNode } from 'react';

import { useEscapeToClose } from '../../../../../../hooks/useEscapeToClose';
import type {
  PayrollPayout,
  PayrollPayoutAccrualPart,
  PayrollPayoutCell,
} from '../../../../../../types/payrollPayouts';
import { HintToolTip } from '../../../../../ui/HintTooltip';
import {
  Table,
  TableContainer,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
} from '../../../../../ui/table';

import {
  formatDate,
  formatDayMonth,
  formatMoney,
  KIND_LABELS,
  monthTitle,
  STATUS_LABELS,
  STATUS_PILL_CLASSES,
} from './payoutUtils';

export function PayoutStatusPill({
  cell,
  label,
}: {
  cell: Pick<PayrollPayoutCell, 'status' | 'rest' | 'over'>;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums ${STATUS_PILL_CLASSES[cell.status]}`}
    >
      <span className='size-1.5 rounded-full bg-current' />
      {label ?? STATUS_LABELS[cell.status]}
      {cell.status === 'part' ? ` · остаток ${formatMoney(cell.rest)}` : null}
      {cell.status === 'over' ? ` ${formatMoney(cell.over)}` : null}
    </span>
  );
}

export function PencilIcon() {
  return (
    <svg
      className='size-3 shrink-0 fill-none stroke-[#7e8fb4] stroke-[1.6] group-hover:stroke-[#2d6ff7]'
      viewBox='0 0 16 16'
      aria-hidden='true'
    >
      <path
        d='M11.2 2.4l2.4 2.4L5.6 12.8 2.5 13.5l.7-3.1z'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function PayoutSpinner() {
  return (
    <div className='grid min-h-56 place-items-center'>
      <div className='size-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
    </div>
  );
}

// Из чего сложено начисление месяца и какая его часть входит в аванс.
export function AccrualPartsTable({
  parts,
  lastDay,
}: {
  parts: PayrollPayoutAccrualPart[];
  lastDay: number;
}) {
  if (!parts.length) {
    return <p className='text-sm text-[#7e8fb4]'>Начислений нет.</p>;
  }

  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  const firstHalf = parts.reduce((sum, part) => sum + part.first_half, 0);

  return (
    <TableContainer>
      <Table density='compact'>
        <THead>
          <tr>
            <Th>
              <span className='inline-flex items-center gap-1'>
                Период
                <HintToolTip content='Расчёт ФОТ идёт по неделям до границы месяца. Отдельными строками показаны расходы с сотрудником, внесённые в финансах вручную или импортом: они тоже считаются начислением.' />
              </span>
            </Th>
            <Th numeric>Начислено</Th>
            <Th numeric>За 1-15</Th>
            <Th numeric>За 16-{lastDay}</Th>
          </tr>
        </THead>
        <TBody>
          {parts.map((part) => (
            <Tr key={part.type === 'period' ? part.from : `${part.date}:${part.article}`}>
              <Td>
                {part.type === 'period' ? (
                  <>
                    <span className='tabular-nums'>
                      {formatDayMonth(part.from)}
                      {part.to === part.from ? '' : ` - ${formatDayMonth(part.to)}`}
                    </span>
                    {part.split_days ? (
                      <span
                        className='ml-2 text-xs text-[#7e8fb4]'
                        title='15-е число выпало на середину недели, поэтому её сумма делится между авансом и расчётом по дням.'
                      >
                        {part.split_days} из 7 дней в аванс
                      </span>
                    ) : null}
                    {part.is_closed ? null : (
                      <span
                        className='ml-2 text-xs text-[#7e8fb4]'
                        title='Неделя ещё идёт: начислено по дням, после закрытия сумма может измениться.'
                      >
                        не закрыт
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className='tabular-nums'>{formatDayMonth(part.date)}</span>
                    <span className='ml-2'>{part.article ?? 'Без статьи'}</span>
                    <span className='ml-2 rounded-full border border-dashed border-[#c9d8f8] bg-white px-1.5 text-[11px] text-[#7e8fb4]'>
                      {part.source === 'IMPORT' ? 'импорт' : 'операция в финансах'}
                    </span>
                  </>
                )}
              </Td>
              <Td numeric>{formatMoney(part.amount)}</Td>
              <Td numeric>{formatMoney(part.first_half)}</Td>
              <Td numeric>{formatMoney(part.amount - part.first_half)}</Td>
            </Tr>
          ))}
        </TBody>
        <TFoot>
          <tr>
            <Td>Итого</Td>
            <Td numeric>{formatMoney(total)}</Td>
            <Td numeric>{formatMoney(firstHalf)}</Td>
            <Td numeric>{formatMoney(total - firstHalf)}</Td>
          </tr>
        </TFoot>
      </Table>
    </TableContainer>
  );
}

export function PayoutsList({
  payouts,
  showMonth = false,
  onDelete,
}: {
  payouts: PayrollPayout[];
  showMonth?: boolean;
  onDelete?: (_payout: PayrollPayout) => void;
}) {
  if (!payouts.length) {
    return <p className='text-sm text-[#7e8fb4]'>Выплат нет.</p>;
  }

  return (
    <TableContainer>
      <Table density='compact'>
        <THead>
          <tr>
            <Th>Дата</Th>
            {showMonth ? <Th>За период</Th> : null}
            <Th>Вид</Th>
            <Th>Основание</Th>
            <Th numeric>Сумма</Th>
            <Th>Комментарий</Th>
            <Th>Провёл</Th>
            {onDelete ? (
              <Th align='center'>
                <span className='sr-only'>Действия</span>
              </Th>
            ) : null}
          </tr>
        </THead>
        <TBody>
          {payouts.map((payout) => (
            // Комментарий переносится на несколько строк, остальные ячейки прижаты к верху.
            <Tr key={payout.id} className='[&>td]:align-top'>
              <Td className='whitespace-nowrap tabular-nums'>
                {formatDate(payout.paid_at)}
              </Td>
              {showMonth ? (
                <Td className='whitespace-nowrap'>{monthTitle(payout.month)}</Td>
              ) : null}
              <Td>{KIND_LABELS[payout.kind]}</Td>
              <Td>{payout.article.name ?? 'Без статьи'}</Td>
              <Td numeric className='font-semibold'>
                {formatMoney(payout.amount)}
              </Td>
              <Td className='max-w-60 break-words'>
                {payout.comment || <span className='text-[#7e8fb4]'>—</span>}
              </Td>
              <Td className='whitespace-nowrap'>
                {payout.created_by?.name || <span className='text-[#7e8fb4]'>—</span>}
              </Td>
              {onDelete ? (
                <Td align='center'>
                  <button
                    type='button'
                    className='rounded-lg px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50'
                    aria-label={`Удалить выплату от ${formatDate(payout.paid_at)}`}
                    onClick={() => onDelete(payout)}
                  >
                    Удалить
                  </button>
                </Td>
              ) : null}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}

// Общая оболочка окон выплат: затемнение, закрытие по клику мимо и крестик.
export function PayoutModalShell({
  title,
  subtitle,
  isSaving,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  isSaving: boolean;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEscapeToClose(() => {
    if (!isSaving) onClose();
  });

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 sm:p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-label={title}
        className={`max-h-[calc(100dvh-1rem)] w-full overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[90vh] sm:rounded-2xl sm:p-5 ${wide ? 'max-w-[680px]' : 'max-w-[520px]'}`}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-xl font-semibold text-slate-900'>{title}</h2>
            {subtitle ? (
              <p className='mt-1 truncate text-sm text-slate-500' title={subtitle}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type='button'
            onClick={onClose}
            disabled={isSaving}
            className='grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
            title='Закрыть'
          >
            <svg
              className='size-5 fill-none stroke-current stroke-[1.8]'
              viewBox='0 0 24 24'
            >
              <path
                d='M6 6l12 12M18 6L6 18'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
