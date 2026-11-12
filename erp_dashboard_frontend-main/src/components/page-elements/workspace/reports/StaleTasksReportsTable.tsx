import { useMemo } from 'react';

import { formatDaysCount, formatReportTime, reportTaskLinkClasses } from './ReportsTable';
import {
  formatCalendarDate,
  formatDateLocal,
  formatDurationHms,
  formatTimeLocal,
} from '../../../../utils/formatters';
import type { StaleTasksReportRow } from '../../../../types/app';
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
  rows: StaleTasksReportRow[];
  spentSeconds: number;
  isLoading?: boolean;
  /** Порог «без движения» в днях — для подсказки в пустом отчёте. */
  thresholdDays: number;
  /** Включены ли фильтры: тогда подсказываем их снять. */
  hasFilters?: boolean;
  onOpenTask?: (_row: StaleTasksReportRow) => void;
};

type SortField = 'spent_seconds' | 'last_moved_ts';
type RowWithTimestamp = StaleTasksReportRow & { last_moved_ts: number };

function formatIdleDays(days: number) {
  return `${formatDaysCount(days)} без движения`;
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <>
      <span className='block'>{text}</span>
      {hint ? <span className='mt-1 block text-xs text-slate-400'>{hint}</span> : null}
    </>
  );
}

function formatTasksCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} задача`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} задачи`;
  return `${count} задач`;
}

function StatusLabel({ row }: { row: StaleTasksReportRow }) {
  if (!row.status_name) {
    return <span className='text-slate-400'>Без статуса</span>;
  }

  return (
    <span className='inline-flex min-w-0 items-center gap-1.5'>
      <span
        className='size-2 shrink-0 rounded-full bg-slate-300'
        style={row.status_color ? { backgroundColor: row.status_color } : undefined}
        aria-hidden='true'
      />
      <span className='min-w-0 break-words'>{row.status_name}</span>
    </span>
  );
}

function LastMoved({ row }: { row: StaleTasksReportRow }) {
  return (
    <span
      title={`${formatDateLocal(row.last_moved_at)} ${formatTimeLocal(row.last_moved_at)}`}
    >
      {formatCalendarDate(row.last_moved_on)}
      <span className='block text-xs text-amber-700'>
        {formatIdleDays(row.idle_days)}
      </span>
    </span>
  );
}

export default function StaleTasksReportsTable({
  rows,
  spentSeconds,
  isLoading = false,
  thresholdDays,
  hasFilters = false,
  onOpenTask,
}: Props) {
  // Дольше всех без движения — сверху: ради них отчёт и открывают.
  // Возр. → убыв. → исходный порядок с сервера.
  const { sort, toggleSort, directionOf } = useTableSort<SortField>({
    initial: { key: 'last_moved_ts', direction: 'asc' },
    resettable: true,
  });

  const rowsWithTimestamp = useMemo<RowWithTimestamp[]>(
    () => rows.map((row) => ({ ...row, last_moved_ts: Date.parse(row.last_moved_at) })),
    [rows],
  );

  const visibleRows = useMemo(
    () => sortRows(rowsWithTimestamp, sort, (row, key) => row[key]),
    [rowsWithTimestamp, sort],
  );

  const placeholder = isLoading ? (
    'Построение отчёта...'
  ) : (
    <EmptyState
      text='Нет задач без движения'
      hint={
        hasFilters
          ? `С выбранными фильтрами все задачи двигались за последние ${formatDaysCount(thresholdDays)}. Попробуйте снять фильтры.`
          : `Все задачи двигались за последние ${formatDaysCount(thresholdDays)}.`
      }
    />
  );
  // Итого по пустому отчёту ничего не сообщает.
  const showTotals = rows.length > 0;
  const renderTaskName = (row: StaleTasksReportRow) =>
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
      {/* На телефоне пять колонок не помещаются, поэтому карточки. */}
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
                  <dt className='text-slate-500'>Статус</dt>
                  <dd className='mt-0.5 font-medium text-slate-800'>
                    <StatusLabel row={row} />
                  </dd>
                </div>
                <div className='min-w-0'>
                  <dt className='text-slate-500'>Затрачено</dt>
                  <dd className='mt-0.5 font-medium text-slate-800 tabular-nums'>
                    {formatDurationHms(row.spent_seconds)}
                  </dd>
                </div>
                <div className='min-w-0'>
                  <dt className='text-slate-500'>Последнее движение</dt>
                  <dd className='mt-0.5 font-medium text-slate-800 tabular-nums'>
                    <LastMoved row={row} />
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
        {showTotals ? (
          <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm'>
            <span className='font-semibold text-black'>
              Итого: {formatTasksCount(rows.length)}
            </span>
            <span className='font-bold text-black tabular-nums'>
              {formatDurationHms(spentSeconds)}
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
              <Th>Статус</Th>
              <Th
                numeric
                sortDirection={directionOf('spent_seconds')}
                onSort={() => toggleSort('spent_seconds')}
              >
                Затрачено
              </Th>
              <Th
                sortDirection={directionOf('last_moved_ts')}
                onSort={() => toggleSort('last_moved_ts')}
              >
                Последнее движение
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
                  <Td>
                    <StatusLabel row={row} />
                  </Td>
                  <Td numeric>{formatReportTime(row.spent_seconds)}</Td>
                  <Td className='whitespace-nowrap'>
                    <LastMoved row={row} />
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
          {showTotals ? (
            <TFoot>
              <tr>
                <Td colSpan={3}>Итого: {formatTasksCount(rows.length)}</Td>
                <Td numeric>{formatReportTime(spentSeconds)}</Td>
                <Td />
              </tr>
            </TFoot>
          ) : null}
        </Table>
      </TableContainer>
    </>
  );
}
