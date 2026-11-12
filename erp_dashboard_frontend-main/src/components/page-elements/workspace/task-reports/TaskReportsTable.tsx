import { useMemo } from 'react';

import {
  formatHoursMinutes,
  formatRemainingHoursMinutes,
  type DisplayOptions,
  type TaskReportRow,
} from './taskReportsShared';
import SortIcon from '../../../ui/SortIcon';
import {
  sortRows,
  Table,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useTableSort,
} from '../../../ui/table';

type Props = {
  rows: TaskReportRow[];
  displayOptions: DisplayOptions;
  isLoading: boolean;
  selectedProjectNames: string[];
  periodFrom: string;
  periodTo: string;
  showSpentBreakdown: boolean;
  getEmployeeHref?: (_row: TaskReportRow, _employeeId: string) => string;
  getProjectHref?: (_row: TaskReportRow) => string;
  onOpenTask?: (_row: TaskReportRow) => void;
};

function formatDateTime(value?: string): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatInputDateRu(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function openInCurrentWindow(href: string): void {
  window.location.assign(href);
}

export default function TaskReportsTable({
  rows,
  displayOptions,
  isLoading,
  selectedProjectNames,
  periodFrom,
  periodTo,
  showSpentBreakdown,
  getEmployeeHref,
  getProjectHref,
  onOpenTask,
}: Props) {
  // Возр. → убыв. → исходный порядок; общая для карточек и таблицы.
  const {
    sort: timeSort,
    toggleSort,
    directionOf,
  } = useTableSort<'spent_seconds'>({ resettable: true });
  const timeSortDirection = directionOf('spent_seconds');
  const toggleTimeSort = () => toggleSort('spent_seconds');
  const totalSpentSeconds = rows.reduce((sum, row) => sum + (row.spent_seconds ?? 0), 0);
  const visibleRows = useMemo(
    () => sortRows(rows, timeSort, (row) => row.spent_seconds ?? 0),
    [rows, timeSort],
  );
  const projectLabel =
    selectedProjectNames.length === 0
      ? 'Все проекты'
      : selectedProjectNames.length === 1
        ? selectedProjectNames[0]
        : `Несколько (${selectedProjectNames.length})`;

  return (
    <div id='tasks-report-table' className='mt-3 grid min-w-0 max-w-full gap-3'>
      <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-white p-2 text-[#1f3565] sm:p-3'>
        <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
          <div className='min-w-0 rounded-lg border border-[#e3e9f3] bg-[#f8faff] px-3 py-2'>
            <div className='text-[10px] font-semibold text-[#7e8fb4] uppercase'>
              Проект
            </div>
            <div className='mt-1 break-words text-sm font-semibold'>{projectLabel}</div>
          </div>
          <div className='min-w-0 rounded-lg border border-[#e3e9f3] bg-[#f8faff] px-3 py-2'>
            <div className='text-[10px] font-semibold text-[#7e8fb4] uppercase'>
              Период
            </div>
            <div className='mt-1 text-sm font-semibold'>
              {formatInputDateRu(periodFrom)} - {formatInputDateRu(periodTo)}
            </div>
          </div>
          <div className='min-w-0 rounded-lg border border-[#e3e9f3] bg-[#f8faff] px-3 py-2'>
            <div className='text-[10px] font-semibold text-[#7e8fb4] uppercase'>
              Количество задач за период
            </div>
            <div className='mt-1 text-sm font-semibold'>{rows.length}</div>
          </div>
          <div className='min-w-0 rounded-lg border border-[#e3e9f3] bg-[#f8faff] px-3 py-2'>
            <div className='text-[10px] font-semibold text-[#7e8fb4] uppercase'>
              Общее время
            </div>
            <div className='mt-1 text-sm font-semibold'>
              {formatHoursMinutes(totalSpentSeconds)}
            </div>
          </div>
        </div>
      </div>

      <div className='grid min-w-0 gap-2 md:hidden'>
        <div className='flex items-center justify-between gap-2'>
          <p className='text-[12px] font-semibold text-slate-500'>Задачи</p>
          <button
            type='button'
            className='inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600'
            onClick={toggleTimeSort}
          >
            Время
            <SortIcon direction={timeSortDirection} />
          </button>
        </div>

        {isLoading ? (
          <div className='grid min-h-28 place-items-center rounded-xl border border-slate-200 bg-white'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#2d6ff7]' />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className='rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-sm font-medium text-slate-500'>
            За выбранный период задачи не найдены
          </div>
        ) : (
          visibleRows.map((row) => {
            const estimation = row.estimation ?? 0;
            const spent = row.spent_seconds ?? 0;
            const remaining = estimation - spent;
            const spentByUsers = Array.isArray(row.spent_by_users)
              ? row.spent_by_users
              : [];
            const shouldShowSpentBreakdown =
              showSpentBreakdown && spentByUsers.length > 1;

            return (
              <article
                key={row.id}
                className='grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3'
              >
                <div className='flex min-w-0 items-start justify-between gap-2'>
                  <div className='min-w-0 flex-1'>
                    {onOpenTask ? (
                      <button
                        type='button'
                        onClick={() => onOpenTask(row)}
                        className='max-w-full break-words text-left text-sm font-semibold text-[#2d6ff7]'
                      >
                        {row.title}
                      </button>
                    ) : (
                      <p className='break-words text-sm font-semibold text-slate-800'>
                        {row.title}
                      </p>
                    )}
                    {displayOptions.showProjects ? (
                      <div className='mt-1 min-w-0 text-xs text-slate-500'>
                        {getProjectHref ? (
                          <a
                            href={getProjectHref(row)}
                            className='break-words text-[#2d6ff7]'
                          >
                            {row.project_name || '—'}
                          </a>
                        ) : (
                          row.project_name || '—'
                        )}
                      </div>
                    ) : null}
                  </div>
                  {displayOptions.showTaskStatus ? (
                    <span className='max-w-[45%] shrink-0 break-words rounded-full bg-slate-100 px-2 py-1 text-right text-[11px] font-semibold text-slate-600'>
                      {row.status_label || row.status || '—'}
                    </span>
                  ) : null}
                </div>

                <dl className='grid min-w-0 grid-cols-2 gap-2 text-xs'>
                  <div className='min-w-0 rounded-lg bg-slate-50 p-2'>
                    <dt className='font-medium text-slate-500'>Время</dt>
                    <dd className='mt-1 font-semibold text-slate-800'>
                      {formatHoursMinutes(spent)}
                    </dd>
                  </div>
                  {displayOptions.showRemainingTime ? (
                    <div className='min-w-0 rounded-lg bg-slate-50 p-2'>
                      <dt className='font-medium text-slate-500'>Осталось</dt>
                      <dd className='mt-1 font-semibold text-slate-800'>
                        {formatRemainingHoursMinutes(remaining)}
                      </dd>
                    </div>
                  ) : null}
                  {displayOptions.showUpdatedAt ? (
                    <div className='col-span-2 min-w-0 rounded-lg bg-slate-50 p-2'>
                      <dt className='font-medium text-slate-500'>Обновлено</dt>
                      <dd className='mt-1 font-semibold text-slate-800'>
                        {formatDateTime(row.updated_at)}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {displayOptions.showEmployees && row.assignees?.length ? (
                  <div className='min-w-0'>
                    <p className='text-[11px] font-semibold text-slate-500'>Сотрудники</p>
                    <div className='mt-1 flex min-w-0 flex-wrap gap-1.5'>
                      {row.assignees.map((assignee) => {
                        const assigneeName = [assignee.name, assignee.last_name]
                          .filter(Boolean)
                          .join(' ')
                          .trim();
                        return getEmployeeHref ? (
                          <button
                            type='button'
                            key={assignee.id}
                            onClick={() =>
                              openInCurrentWindow(getEmployeeHref(row, assignee.id))
                            }
                            className='max-w-full break-words rounded-lg bg-[#edf3ff] px-2 py-1 text-left text-xs text-[#2d6ff7]'
                          >
                            {assigneeName || '—'}
                          </button>
                        ) : (
                          <span
                            key={assignee.id}
                            className='max-w-full break-words rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600'
                          >
                            {assigneeName || '—'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {shouldShowSpentBreakdown ? (
                  <div className='min-w-0 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-500'>
                    {spentByUsers.map((spentByUser) => {
                      const name = [spentByUser.name, spentByUser.last_name]
                        .filter(Boolean)
                        .join(' ')
                        .trim();

                      return (
                        <div
                          key={spentByUser.user_id}
                          className='flex min-w-0 justify-between gap-2'
                        >
                          <span className='min-w-0 break-words'>{name || '—'}</span>
                          <span className='shrink-0 font-medium text-slate-700'>
                            {formatHoursMinutes(spentByUser.spent_seconds ?? 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <TableContainer className='hidden md:block'>
        <Table>
          <THead>
            <tr>
              {displayOptions.showProjects ? <Th>Проект</Th> : null}
              <Th>Задача / подзадача</Th>
              {displayOptions.showEmployees ? <Th>Сотрудник</Th> : null}
              {displayOptions.showTaskStatus ? <Th>Статус задачи</Th> : null}
              {displayOptions.showUpdatedAt ? <Th>Дата обновления</Th> : null}
              <Th numeric sortDirection={timeSortDirection} onSort={toggleTimeSort}>
                Время
              </Th>
              {displayOptions.showRemainingTime ? (
                <Th numeric>Оставшееся время</Th>
              ) : null}
            </tr>
          </THead>

          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : visibleRows.length === 0 ? (
              <TableEmptyRow>За выбранный период задачи не найдены</TableEmptyRow>
            ) : (
              visibleRows.map((row) => {
                const estimation = row.estimation ?? 0;
                const spent = row.spent_seconds ?? 0;
                const remaining = estimation - spent;
                const spentByUsers = Array.isArray(row.spent_by_users)
                  ? row.spent_by_users
                  : [];
                const shouldShowSpentBreakdown =
                  showSpentBreakdown && spentByUsers.length > 1;

                return (
                  <Tr key={row.id}>
                    {displayOptions.showProjects ? (
                      <Td>
                        {getProjectHref ? (
                          <a
                            href={getProjectHref(row)}
                            className='text-[#2d6ff7] hover:underline'
                          >
                            {row.project_name || '—'}
                          </a>
                        ) : (
                          row.project_name || '—'
                        )}
                      </Td>
                    ) : null}
                    <Td>
                      {onOpenTask ? (
                        <button
                          type='button'
                          onClick={() => onOpenTask(row)}
                          className='cursor-pointer text-left text-[#2d6ff7] hover:underline'
                        >
                          {row.title}
                        </button>
                      ) : (
                        row.title
                      )}
                    </Td>
                    {displayOptions.showEmployees ? (
                      <Td>
                        {row.assignees && row.assignees.length > 0 ? (
                          <div className='flex flex-col items-start gap-1'>
                            {row.assignees.map((assignee) => {
                              const assigneeName = [assignee.name, assignee.last_name]
                                .filter(Boolean)
                                .join(' ')
                                .trim();
                              return getEmployeeHref ? (
                                <button
                                  type='button'
                                  key={assignee.id}
                                  onClick={() =>
                                    openInCurrentWindow(getEmployeeHref(row, assignee.id))
                                  }
                                  className='text-[#2d6ff7] hover:underline'
                                >
                                  {assigneeName || '—'}
                                </button>
                              ) : (
                                <span key={assignee.id}>{assigneeName || '—'}</span>
                              );
                            })}
                          </div>
                        ) : (
                          '—'
                        )}
                      </Td>
                    ) : null}
                    {displayOptions.showTaskStatus ? (
                      <Td>{row.status_label || row.status || '—'}</Td>
                    ) : null}
                    {displayOptions.showUpdatedAt ? (
                      <Td>{formatDateTime(row.updated_at)}</Td>
                    ) : null}
                    {/* Не `numeric`: разбивка по сотрудникам должна переноситься. */}
                    <Td align='right' className='tabular-nums'>
                      <div className='flex flex-col items-end gap-1'>
                        <span className='whitespace-nowrap'>
                          {formatHoursMinutes(spent)}
                        </span>
                        {shouldShowSpentBreakdown ? (
                          <span className='max-w-[250px] text-xs leading-5 text-slate-500'>
                            {spentByUsers.map((spentByUser, index) => {
                              const name = [spentByUser.name, spentByUser.last_name]
                                .filter(Boolean)
                                .join(' ')
                                .trim();

                              return (
                                <span
                                  key={spentByUser.user_id}
                                  className={index === 0 ? 'inline' : 'block'}
                                >
                                  {name || '—'}:{' '}
                                  {formatHoursMinutes(spentByUser.spent_seconds ?? 0)}
                                  {index < spentByUsers.length - 1 ? ',' : ''}
                                </span>
                              );
                            })}
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    {displayOptions.showRemainingTime ? (
                      <Td numeric>{formatRemainingHoursMinutes(remaining)}</Td>
                    ) : null}
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </TableContainer>
    </div>
  );
}
