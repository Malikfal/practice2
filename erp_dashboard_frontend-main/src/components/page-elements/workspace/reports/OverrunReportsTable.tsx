import { useMemo } from 'react';

import { formatReportTime, reportTaskLinkClasses } from './ReportsTable';
import { formatDurationHms, formatHoursCompact } from '../../../../utils/formatters';
import type { OverrunReportRow } from '../../../../types/app';
import {
  sortRows,
  Table,
  TableContainer,
  TableEmptyRow,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
  useTableSort,
} from '../../../ui/table';

type Props = {
  rows: OverrunReportRow[];
  spentSeconds: number;
  unestimatedTaskLimitSeconds: number;
  isLoading?: boolean;
  onOpenTask?: (_row: OverrunReportRow) => void;
};

type TimeField = 'estimation_seconds' | 'spent_seconds' | 'overrun_seconds';
type RowWithOverrun = OverrunReportRow & { overrun_seconds: number };

export default function OverrunReportsTable({
  rows,
  spentSeconds,
  unestimatedTaskLimitSeconds,
  isLoading = false,
  onOpenTask,
}: Props) {
  // Самые крупные перерасходы сверху: ради них отчёт и открывают.
  // Возр. → убыв. → исходный порядок с сервера.
  const { sort, toggleSort, directionOf } = useTableSort<TimeField>({
    initial: { key: 'overrun_seconds', direction: 'desc' },
    resettable: true,
  });

  // Задача без оценки превышает не оценку, а допустимое время из настроек компании.
  const rowsWithOverrun = useMemo<RowWithOverrun[]>(
    () =>
      rows.map((row) => ({
        ...row,
        overrun_seconds: Math.max(
          0,
          row.spent_seconds - (row.estimation_seconds ?? unestimatedTaskLimitSeconds),
        ),
      })),
    [rows, unestimatedTaskLimitSeconds],
  );
  const overrunSeconds = useMemo(
    () => rowsWithOverrun.reduce((sum, row) => sum + row.overrun_seconds, 0),
    [rowsWithOverrun],
  );

  // Задача без оценки сортируется как оценка 0.
  const visibleRows = useMemo(
    () => sortRows(rowsWithOverrun, sort, (row, key) => row[key] ?? 0),
    [rowsWithOverrun, sort],
  );

  const placeholder = isLoading ? 'Построение отчёта...' : 'Нет задач с перерасходом';
  const limitLabel = `допустимо ${formatHoursCompact(unestimatedTaskLimitSeconds)} ч`;
  const renderTaskName = (row: OverrunReportRow) =>
    onOpenTask ? (
      <button
        type='button'
        onClick={() => onOpenTask(row)}
        className={reportTaskLinkClasses}
      >
        {row.task_name || '—'}
      </button>
    ) : (
      row.task_name || '—'
    );

  return (
    <>
      {/* На телефоне пять колонок не помещаются: перерасход уходит за край, поэтому карточки. */}
      <div className='mt-3 grid gap-2 md:hidden'>
        {visibleRows.length === 0 ? (
          <div className='rounded-lg border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500'>
            {placeholder}
          </div>
        ) : (
          visibleRows.map((row) => (
            <article
              key={row.task_id}
              className='grid gap-2 rounded-lg border border-slate-200 bg-white p-3'
            >
              <div className='min-w-0'>
                <p className='text-xs text-slate-500'>{row.project_name || '—'}</p>
                <div className='mt-0.5 text-sm font-medium break-words text-slate-800'>
                  {renderTaskName(row)}
                </div>
              </div>
              <dl className='grid grid-cols-3 gap-2 text-xs'>
                <div className='min-w-0'>
                  <dt className='text-slate-500'>Оценка</dt>
                  <dd className='mt-0.5 font-medium text-slate-800 tabular-nums'>
                    {row.estimation_seconds !== null ? (
                      formatDurationHms(row.estimation_seconds)
                    ) : (
                      <>
                        <span className='text-slate-400'>Нет оценки</span>
                        <span className='block text-[11px] font-normal text-slate-400'>
                          {limitLabel}
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div className='min-w-0'>
                  <dt className='text-slate-500'>Затрачено</dt>
                  <dd className='mt-0.5 font-medium text-slate-800 tabular-nums'>
                    {formatDurationHms(row.spent_seconds)}
                  </dd>
                </div>
                <div className='min-w-0'>
                  <dt className='text-slate-500'>Перерасход</dt>
                  <dd className='mt-0.5 font-semibold text-rose-600 tabular-nums'>
                    +{formatDurationHms(row.overrun_seconds)}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
        {rows.length > 0 ? (
          <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm'>
            <span className='font-semibold text-black'>Итого</span>
            <span className='tabular-nums'>
              <span className='font-bold text-black'>
                {formatDurationHms(spentSeconds)}
              </span>
              <span className='ml-2 font-bold text-rose-600'>
                +{formatDurationHms(overrunSeconds)}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <TableContainer className='mt-3 hidden md:block'>
        <Table>
          <THead>
            <tr>
              <Th>Проект</Th>
              <Th>Задача</Th>
              <Th
                numeric
                sortDirection={directionOf('estimation_seconds')}
                onSort={() => toggleSort('estimation_seconds')}
              >
                Оценка
              </Th>
              <Th
                numeric
                sortDirection={directionOf('spent_seconds')}
                onSort={() => toggleSort('spent_seconds')}
              >
                Затрачено
              </Th>
              <Th
                numeric
                sortDirection={directionOf('overrun_seconds')}
                onSort={() => toggleSort('overrun_seconds')}
              >
                Перерасход
              </Th>
            </tr>
          </THead>
          <TBody>
            {visibleRows.length === 0 ? (
              <TableEmptyRow>{placeholder}</TableEmptyRow>
            ) : (
              visibleRows.map((row) => (
                <Tr key={row.task_id}>
                  <Td>{row.project_name || '—'}</Td>
                  <Td>{renderTaskName(row)}</Td>
                  <Td numeric>
                    {row.estimation_seconds !== null ? (
                      formatReportTime(row.estimation_seconds)
                    ) : (
                      <>
                        <span className='text-slate-400'>Нет оценки</span>
                        <span className='block text-xs text-slate-400'>{limitLabel}</span>
                      </>
                    )}
                  </Td>
                  <Td numeric>{formatReportTime(row.spent_seconds)}</Td>
                  <Td numeric className='font-semibold text-rose-600'>
                    +{formatReportTime(row.overrun_seconds)}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
          {/* Итого по пустому отчёту ничего не сообщает. */}
          {rows.length > 0 ? (
            <TFoot>
              <tr>
                <Td colSpan={3}>Итого</Td>
                <Td numeric>{formatReportTime(spentSeconds)}</Td>
                <Td numeric>
                  <span className='text-rose-600'>
                    +{formatReportTime(overrunSeconds)}
                  </span>
                </Td>
              </tr>
            </TFoot>
          ) : null}
        </Table>
      </TableContainer>
    </>
  );
}
