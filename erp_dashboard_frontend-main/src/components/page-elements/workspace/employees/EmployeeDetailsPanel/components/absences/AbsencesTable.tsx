import type { EmployeeAbsence } from '../../../../../../../types/app';
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
} from '../../../../../../ui/table';
import Icon from '../../../components/Icon';

import {
  ABSENCE_TYPE_LABELS,
  ABSENCE_TYPE_STYLES,
  PAYMENT_MODE_LABELS,
} from './constants';
import {
  applyFixedPaymentCoefficient,
  actorName,
  canDeleteAbsence,
  formatDateTime,
  formatMoney,
  formatPeriod,
  inclusiveDays,
  isFullyPast,
} from './utils';

type Props = {
  selectedYear: number;
  absences: EmployeeAbsence[];
  isLoading: boolean;
  activeId: string | null;
  canManageAbsences: boolean;
  canChangePast: boolean;
  onEdit: (_absence: EmployeeAbsence) => void;
  onDelete: (_absence: EmployeeAbsence) => void;
};

export function AbsencesTable({
  selectedYear,
  absences,
  isLoading,
  activeId,
  canManageAbsences,
  canChangePast,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 sm:p-3'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <p className='text-[15px] font-semibold text-[#1f3565]'>
          Отсутствия за {selectedYear} год ({absences.length})
        </p>
      </div>

      <div className='grid gap-2 md:hidden'>
        {isLoading ? (
          <div className='grid min-h-28 place-items-center rounded-xl border border-[#e3e9f3] bg-white'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          </div>
        ) : absences.length ? (
          absences.map((absence) => {
            const days = inclusiveDays(absence.date_from, absence.date_to);
            const amount = getAbsenceAmount(absence, days);

            return (
              <article
                key={absence.id}
                className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'
              >
                <div className='flex items-start justify-between gap-2'>
                  <span
                    className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${ABSENCE_TYPE_STYLES[absence.type]}`}
                  >
                    {ABSENCE_TYPE_LABELS[absence.type]}
                  </span>
                  <span className='text-xs font-semibold text-[#7e8fb4]'>{days} дн.</span>
                </div>

                <dl className='grid grid-cols-2 gap-x-3 gap-y-2 text-xs'>
                  <MobileDetail
                    label='Период'
                    value={formatPeriod(absence.date_from, absence.date_to)}
                  />
                  <MobileDetail label='Сумма' value={formatMoney(amount)} emphasis />
                  <MobileDetail
                    label='Способ оплаты'
                    value={PAYMENT_MODE_LABELS[absence.payment_mode]}
                  />
                  <MobileDetail
                    label='За день'
                    value={formatMoney(absence.fixed_daily_amount)}
                  />
                  {absence.comment ? (
                    <div className='col-span-2 min-w-0'>
                      <dt className='text-[#7e8fb4]'>Комментарий</dt>
                      <dd className='mt-0.5 break-words font-medium text-[#1f3565]'>
                        {absence.comment}
                      </dd>
                    </div>
                  ) : null}
                  <MobileDetail label='Создал' value={actorName(absence.created_by)} />
                  <MobileDetail
                    label='Дата создания'
                    value={formatDateTime(absence.created_at)}
                  />
                </dl>

                {canManageAbsences ? (
                  <div className='grid grid-cols-2 gap-2'>
                    <button
                      type='button'
                      className='min-h-10 rounded-lg border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#2d6ff7] disabled:opacity-55'
                      disabled={
                        activeId === absence.id ||
                        (!canChangePast && isFullyPast(absence))
                      }
                      onClick={() => onEdit(absence)}
                    >
                      Редактировать
                    </button>
                    <button
                      type='button'
                      className='min-h-10 rounded-lg border border-[#ffd7dd] bg-white px-3 text-xs font-semibold text-[#c83f52] disabled:opacity-55'
                      disabled={
                        activeId === absence.id ||
                        (!canChangePast && !canDeleteAbsence(absence))
                      }
                      onClick={() => onDelete(absence)}
                    >
                      Удалить
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-8 text-center text-sm text-[#7e8fb4]'>
            Отсутствия за год не добавлены.
          </div>
        )}
      </div>

      <TableContainer className='hidden md:block'>
        <Table density='compact' className='min-w-280'>
          <THead>
            <tr>
              <Th>Тип</Th>
              <Th>Период</Th>
              <Th numeric>Дней</Th>
              <Th>Способ оплаты</Th>
              <Th numeric>Фиксированная оплата за день</Th>
              <Th numeric>Сумма</Th>
              <Th>Комментарий</Th>
              <Th>Создал</Th>
              <Th>Дата создания</Th>
              <Th align='center'>Действия</Th>
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : absences.length ? (
              absences.map((absence) => (
                <AbsenceTableRow
                  key={absence.id}
                  absence={absence}
                  activeId={activeId}
                  canManageAbsences={canManageAbsences}
                  canChangePast={canChangePast}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            ) : (
              <TableEmptyRow>Отсутствия за год не добавлены.</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>
    </div>
  );
}

function AbsenceTableRow({
  absence,
  activeId,
  canManageAbsences,
  canChangePast,
  onEdit,
  onDelete,
}: {
  absence: EmployeeAbsence;
  activeId: string | null;
  canManageAbsences: boolean;
  canChangePast: boolean;
  onEdit: (_absence: EmployeeAbsence) => void;
  onDelete: (_absence: EmployeeAbsence) => void;
}) {
  const days = inclusiveDays(absence.date_from, absence.date_to);
  const amount = getAbsenceAmount(absence, days);

  return (
    <Tr>
      <Td>
        <span
          className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${ABSENCE_TYPE_STYLES[absence.type]}`}
        >
          {ABSENCE_TYPE_LABELS[absence.type]}
        </span>
      </Td>
      <Td>{formatPeriod(absence.date_from, absence.date_to)}</Td>
      <Td numeric>{days}</Td>
      <Td>{PAYMENT_MODE_LABELS[absence.payment_mode]}</Td>
      <Td numeric>{formatMoney(absence.fixed_daily_amount)}</Td>
      <Td numeric className='font-semibold'>
        {formatMoney(amount)}
      </Td>
      <Td className='max-w-45'>
        <span className='block truncate'>{absence.comment || '—'}</span>
      </Td>
      <Td>{actorName(absence.created_by)}</Td>
      <Td>{formatDateTime(absence.created_at)}</Td>
      <Td align='center'>
        {canManageAbsences ? (
          <TableActions>
            <TableActionButton
              label='Редактировать'
              disabled={
                activeId === absence.id || (!canChangePast && isFullyPast(absence))
              }
              onClick={() => onEdit(absence)}
            >
              <Icon name='edit' />
            </TableActionButton>
            <TableActionButton
              label='Удалить'
              tone='danger'
              disabled={
                activeId === absence.id || (!canChangePast && !canDeleteAbsence(absence))
              }
              onClick={() => onDelete(absence)}
            >
              <Icon name='trash' />
            </TableActionButton>
          </TableActions>
        ) : null}
      </Td>
    </Tr>
  );
}

function getAbsenceAmount(absence: EmployeeAbsence, days: number) {
  return (
    absence.amount_kopecks ??
    (absence.fixed_daily_amount !== null
      ? (applyFixedPaymentCoefficient(absence.fixed_daily_amount, absence.coefficient) ??
          0) * days
      : null)
  );
}

function MobileDetail({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className='min-w-0'>
      <dt className='text-[#7e8fb4]'>{label}</dt>
      <dd
        className={`mt-0.5 break-words font-medium ${
          emphasis ? 'font-semibold text-[#10275a]' : 'text-[#1f3565]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
