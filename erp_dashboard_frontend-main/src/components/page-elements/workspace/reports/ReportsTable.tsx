import { useMemo } from 'react';

import { formatDateLocal, formatDurationHms } from '../../../../utils/formatters';
import type {
  ReportGroupBy,
  TimeReportDayRow,
  TimeReportEmployeeRow,
  TimeReportProjectRow,
  TimeReportRow,
  TimeReportTaskRow,
} from '../../../../types/app';
import {
  sortRows,
  Table,
  TableContainer,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
  useTableSort,
} from '../../../ui/table';

type Props = {
  reportFormGroupBy: ReportGroupBy;
  reports: TimeReportRow[];
  reportOwnSeconds: number;
  onOpenTask?: (_row: TimeReportTaskRow) => void;
};

export const reportTaskLinkClasses =
  'cursor-pointer rounded-sm text-left text-[#2d6ff7] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d6ff7]';

const decimalHoursFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** Часы в отчётах: «16:30:00 (16,5)», «15:00:00 (15)» — сотые через запятую, без лишних нулей. */
export function formatReportTime(seconds: number | null | undefined) {
  const value = Math.max(0, Number(seconds || 0));
  return `${formatDurationHms(value)} (${decimalHoursFormat.format(value / 3600)})`;
}

/** «1 день», «3 дня», «26 дней». */
export function formatDaysCount(days: number) {
  const mod10 = days % 10;
  const mod100 = days % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'день'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'дня'
        : 'дней';

  return `${days} ${word}`;
}

function rowKey(row: TimeReportRow, index: number): string {
  if ('date' in row) return `day-${row.date}`;
  if ('task_id' in row) return `task-${row.task_id}`;
  if ('project_id' in row) return `project-${row.project_id}`;
  if ('user_id' in row) return `employee-${row.user_id}`;
  return `report-${index}`;
}

export default function ReportsTable({
  reportFormGroupBy,
  reports,
  reportOwnSeconds,
  onOpenTask,
}: Props) {
  const showDayColumn = reportFormGroupBy === 'day';
  const showProjectColumn =
    reportFormGroupBy === 'project' || reportFormGroupBy === 'task';
  const showEmployeeColumn = reportFormGroupBy === 'employee';
  const showTaskColumn = reportFormGroupBy === 'task';
  // Возр. → убыв. → исходный порядок с сервера.
  const { sort, toggleSort, directionOf } = useTableSort<'own_seconds'>({
    resettable: true,
  });

  const visibleReports = useMemo(
    () => sortRows(reports, sort, (row, key) => row[key]),
    [reports, sort],
  );

  const labelColumnCount =
    (showDayColumn ? 1 : 0) +
    (showProjectColumn ? 1 : 0) +
    (showEmployeeColumn ? 1 : 0) +
    (showTaskColumn ? 1 : 0);

  return (
    <TableContainer className='mt-3'>
      <Table>
        <THead>
          <tr>
            {showDayColumn ? <Th>День</Th> : null}
            {showProjectColumn ? <Th>Проект</Th> : null}
            {showEmployeeColumn ? <Th>Сотрудник</Th> : null}
            {showTaskColumn ? <Th>Задача</Th> : null}
            <Th
              numeric
              sortDirection={directionOf('own_seconds')}
              onSort={() => toggleSort('own_seconds')}
            >
              Часы
            </Th>
          </tr>
        </THead>
        <TBody>
          {visibleReports.map((row, index) => (
            <Tr key={rowKey(row, index)}>
              {showDayColumn ? (
                <Td>{formatDateLocal((row as TimeReportDayRow).date)}</Td>
              ) : null}
              {showProjectColumn ? (
                <Td>
                  {(row as TimeReportProjectRow | TimeReportTaskRow).project_name || '—'}
                </Td>
              ) : null}
              {showEmployeeColumn ? (
                <Td>{(row as TimeReportEmployeeRow).user_name || '—'}</Td>
              ) : null}
              {showTaskColumn ? (
                <Td>
                  {onOpenTask ? (
                    <button
                      type='button'
                      onClick={() => onOpenTask(row as TimeReportTaskRow)}
                      className={reportTaskLinkClasses}
                    >
                      {(row as TimeReportTaskRow).task_name || '—'}
                    </button>
                  ) : (
                    (row as TimeReportTaskRow).task_name || '—'
                  )}
                </Td>
              ) : null}
              <Td numeric>{formatReportTime(row.own_seconds)}</Td>
            </Tr>
          ))}
        </TBody>
        <TFoot>
          <tr>
            <Td colSpan={labelColumnCount}>Итого</Td>
            <Td numeric>{formatReportTime(reportOwnSeconds)}</Td>
          </tr>
        </TFoot>
      </Table>
    </TableContainer>
  );
}
