import { useMemo, type ReactNode } from 'react';

import { formatDaysCount, formatReportTime } from './ReportsTable';
import { formatDurationHms } from '../../../../utils/formatters';
import type {
  LimitReportClientRow,
  LimitReportProjectRow,
  LimitReportResponse,
} from '../../../../types/app';
import {
  cx,
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
  type SortDirection,
} from '../../../ui/table';

type Props = {
  report: LimitReportResponse | null;
  isLoading?: boolean;
  /** Включены ли фильтры: тогда в пустом отчёте подсказываем их снять. */
  hasFilters?: boolean;
};

type SortField = 'limit_seconds' | 'spent_seconds' | 'remaining_seconds';
type ProjectRowWithRemaining = LimitReportProjectRow & { remaining_seconds: number };
type Totals = { limit: number; spent: number; over: number; remaining: number };
type ExceededClient = {
  clientId: string;
  clientName: string;
  limit: number;
  spent: number;
};

const EMPTY_PROJECT_ROWS: LimitReportProjectRow[] = [];
const EMPTY_CLIENT_ROWS: LimitReportClientRow[] = [];
const overNoteClasses = 'block text-xs font-medium text-rose-600';
// Строка с превышением: лёгкий красный фон, чтобы её было видно и без чтения цифр.
const overRowBackground = 'bg-rose-50';
// Строка клиента над его проектами.
const clientRowBackground = 'bg-[#f8faff]';
const cardClasses = 'grid gap-2 rounded-lg border p-3';
const cardOverClasses = 'border-rose-200 bg-rose-50';
const cardDefaultClasses = 'border-slate-200 bg-white';

function weeklyHint(weeklySeconds: number, periodDays: number) {
  return `Недельный лимит ${formatReportTime(weeklySeconds)}, пересчитан на ${formatDaysCount(periodDays)} периода`;
}

function clientLimitTitle(row: LimitReportProjectRow, periodDays: number) {
  const ignored =
    row.project_weekly_limit_seconds != null
      ? ` Собственный лимит проекта ${formatReportTime(row.project_weekly_limit_seconds)} в неделю не учитывается.`
      : '';
  const status =
    row.limit_spent_seconds > row.limit_seconds
      ? `превышен на ${formatReportTime(row.limit_spent_seconds - row.limit_seconds)}`
      : `осталось ${formatReportTime(row.limit_seconds - row.limit_spent_seconds)}`;

  return `Общий лимит клиента «${row.client_name ?? ''}» на все его проекты: ${formatReportTime(row.limit_seconds)} за период (${weeklyHint(row.weekly_limit_seconds, periodDays).toLowerCase()}), ${status}.${ignored}`;
}

function isClientLimitOver(row: LimitReportProjectRow) {
  return row.limit_source === 'client' && row.limit_spent_seconds > row.limit_seconds;
}

/** Остаток лимита; при превышении — красным со знаком «+»: столько сверх лимита. */
function RemainingValue({ remaining }: { remaining: number }) {
  return remaining < 0 ? (
    <span className='font-semibold text-rose-600'>
      +{formatReportTime(-remaining)} сверх
    </span>
  ) : (
    <>{formatReportTime(remaining)}</>
  );
}

function RemainingCell({
  remaining,
  className,
}: {
  remaining: number;
  className?: string;
}) {
  const isOver = remaining < 0;

  return (
    <Td
      numeric
      className={cx(isOver && 'text-rose-600', className)}
      title={isOver ? 'Превышение лимита' : 'Осталось до лимита'}
    >
      <RemainingValue remaining={remaining} />
    </Td>
  );
}

/** Ячейка «Лимит» у проекта, который расходует общий лимит клиента. */
function ClientLimitLabel({ row }: { row: LimitReportProjectRow }) {
  return (
    <>
      <span className='text-slate-400'>в лимите клиента</span>
      {isClientLimitOver(row) ? (
        <span className={overNoteClasses}>лимит клиента превышен</span>
      ) : null}
    </>
  );
}

function EmptyState({
  isLoading,
  hasFilters,
}: {
  isLoading: boolean;
  hasFilters: boolean;
}) {
  if (isLoading) return <>Построение отчёта...</>;

  return (
    <>
      <span className='block'>
        {hasFilters
          ? 'По выбранным фильтрам нет проектов с недельным лимитом'
          : 'Нет проектов с недельным лимитом'}
      </span>
      <span className='mt-1 block text-xs text-slate-400'>
        {hasFilters ? 'Попробуйте снять фильтры. ' : null}
        Лимит задаётся в карточке клиента или в разделе «О проекте».
      </span>
    </>
  );
}

/**
 * В группировке по проектам превышение общего лимита клиента показываем один раз над таблицей,
 * а не в каждой строке его проектов.
 */
function ExceededClientsNotice({ clients }: { clients: ExceededClient[] }) {
  if (clients.length === 0) return null;

  return (
    <div
      className='mt-3 grid gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700'
      role='status'
    >
      {clients.map((client) => (
        <p key={client.clientId}>
          Превышен общий лимит клиента «{client.clientName || '—'}»:{' '}
          <span className='tabular-nums'>
            {formatReportTime(client.spent)} при лимите {formatReportTime(client.limit)},
          </span>{' '}
          <span className='font-semibold tabular-nums'>
            сверх {formatReportTime(client.spent - client.limit)}
          </span>
        </p>
      ))}
    </div>
  );
}

function useSortedProjectRows(rows: LimitReportProjectRow[]) {
  // Сначала проекты с превышением: ради них отчёт и открывают.
  // Возр. → убыв. → исходный порядок с сервера.
  const { sort, toggleSort, directionOf } = useTableSort<SortField>({
    initial: { key: 'remaining_seconds', direction: 'asc' },
    resettable: true,
  });

  const visibleRows = useMemo(() => {
    const withRemaining: ProjectRowWithRemaining[] = rows.map((row) => ({
      ...row,
      remaining_seconds: row.limit_seconds - row.limit_spent_seconds,
    }));

    return sortRows(withRemaining, sort, (row, key) => row[key]);
  }, [rows, sort]);

  return { toggleSort, directionOf, visibleRows };
}

function ProjectRowsTable({
  rows,
  directionOf,
  onSort,
  periodDays,
  totals,
  placeholder,
}: {
  rows: ProjectRowWithRemaining[];
  directionOf: (_field: SortField) => SortDirection | null;
  onSort: (_field: SortField) => void;
  periodDays: number;
  totals: Totals;
  placeholder: ReactNode;
}) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Проект</Th>
          <Th>Клиент</Th>
          <Th
            numeric
            sortDirection={directionOf('limit_seconds')}
            onSort={() => onSort('limit_seconds')}
          >
            Лимит
          </Th>
          <Th
            numeric
            sortDirection={directionOf('spent_seconds')}
            onSort={() => onSort('spent_seconds')}
          >
            Часы
          </Th>
          <Th
            numeric
            sortDirection={directionOf('remaining_seconds')}
            onSort={() => onSort('remaining_seconds')}
          >
            Остаток
          </Th>
        </tr>
      </THead>
      <TBody>
        {rows.length === 0 ? (
          <TableEmptyRow>{placeholder}</TableEmptyRow>
        ) : (
          rows.map((row) => {
            const isClientLimit = row.limit_source === 'client';
            // Превышение общего лимита клиента — в сводке над таблицей, строку проекта не красим.
            const isOver = !isClientLimit && row.remaining_seconds < 0;

            return (
              <Tr
                key={row.project_id}
                background={isOver ? overRowBackground : undefined}
              >
                <Td>{row.project_name || '—'}</Td>
                <Td>{row.client_name || '—'}</Td>
                <Td
                  numeric
                  title={
                    isClientLimit
                      ? clientLimitTitle(row, periodDays)
                      : weeklyHint(row.weekly_limit_seconds, periodDays)
                  }
                >
                  {isClientLimit ? (
                    <ClientLimitLabel row={row} />
                  ) : (
                    formatReportTime(row.limit_seconds)
                  )}
                </Td>
                <Td numeric className={isOver ? 'text-rose-600' : undefined}>
                  {formatReportTime(row.spent_seconds)}
                </Td>
                {isClientLimit ? (
                  <Td numeric title='Остаток считается по общему лимиту клиента'>
                    <span className='text-slate-400'>—</span>
                  </Td>
                ) : (
                  <RemainingCell remaining={row.remaining_seconds} />
                )}
              </Tr>
            );
          })
        )}
      </TBody>
      {rows.length > 0 ? <TotalsFooter labelColSpan={2} totals={totals} /> : null}
    </Table>
  );
}

function ClientRowsTable({
  rows,
  periodDays,
  totals,
  placeholder,
}: {
  rows: LimitReportClientRow[];
  periodDays: number;
  totals: Totals;
  placeholder: ReactNode;
}) {
  return (
    <Table striped={false}>
      <THead>
        <tr>
          <Th>Клиент / проект</Th>
          <Th numeric>Лимит</Th>
          <Th numeric>Часы</Th>
          <Th numeric>Остаток</Th>
        </tr>
      </THead>
      {rows.length === 0 ? (
        <TBody>
          <TableEmptyRow>{placeholder}</TableEmptyRow>
        </TBody>
      ) : (
        rows.map((client) => {
          const hasClientLimit = client.limit_seconds !== null;
          const clientRemaining = hasClientLimit
            ? (client.limit_seconds ?? 0) - client.spent_seconds
            : null;
          const isClientOver = clientRemaining !== null && clientRemaining < 0;

          return (
            <TBody key={client.client_id ?? 'no-client'}>
              <Tr background={isClientOver ? overRowBackground : clientRowBackground}>
                <Td className='font-semibold'>
                  {client.client_id ? client.client_name || '—' : 'Без клиента'}
                </Td>
                <Td
                  numeric
                  className='font-semibold'
                  title={
                    hasClientLimit && client.weekly_limit_seconds !== null
                      ? `Общий на все проекты клиента. ${weeklyHint(client.weekly_limit_seconds, periodDays)}`
                      : 'У клиента нет лимита, действуют лимиты проектов'
                  }
                >
                  {hasClientLimit ? (
                    formatReportTime(client.limit_seconds)
                  ) : (
                    <span className='font-normal text-slate-400'>—</span>
                  )}
                </Td>
                <Td
                  numeric
                  className={cx('font-semibold', isClientOver && 'text-rose-600')}
                >
                  {formatReportTime(client.spent_seconds)}
                </Td>
                {clientRemaining !== null ? (
                  <RemainingCell remaining={clientRemaining} className='font-semibold' />
                ) : (
                  <Td numeric>
                    <span className='text-slate-400'>—</span>
                  </Td>
                )}
              </Tr>
              {client.projects.map((project) => {
                const isClientLimit = project.limit_source === 'client';
                const remaining = project.limit_seconds - project.limit_spent_seconds;
                const isOver = !isClientLimit && remaining < 0;

                return (
                  <Tr
                    key={project.project_id}
                    background={isOver ? overRowBackground : undefined}
                  >
                    {/* Проекты под строкой клиента с отступом. */}
                    <Td>
                      <span className='block pl-4.5'>{project.project_name || '—'}</span>
                    </Td>
                    <Td
                      numeric
                      title={
                        isClientLimit
                          ? clientLimitTitle(project, periodDays)
                          : weeklyHint(project.weekly_limit_seconds, periodDays)
                      }
                    >
                      {isClientLimit ? (
                        <span className='text-slate-400'>в лимите клиента</span>
                      ) : (
                        formatReportTime(project.limit_seconds)
                      )}
                    </Td>
                    <Td numeric className={isOver ? 'text-rose-600' : undefined}>
                      {formatReportTime(project.spent_seconds)}
                    </Td>
                    {isClientLimit ? <Td /> : <RemainingCell remaining={remaining} />}
                  </Tr>
                );
              })}
            </TBody>
          );
        })
      )}
      {rows.length > 0 ? <TotalsFooter labelColSpan={1} totals={totals} /> : null}
    </Table>
  );
}

/** «Осталось» и «Сверх лимита» раздельно: превышение одного лимита не гасится запасом другого. */
function TotalsBalance({ totals }: { totals: Totals }) {
  return (
    <>
      <span className='block'>
        <span className='font-normal text-slate-500'>Осталось: </span>
        {formatReportTime(totals.remaining)}
      </span>
      <span className={`block ${totals.over > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
        <span className='font-normal'>Сверх лимита: </span>
        {totals.over > 0 ? `+${formatReportTime(totals.over)}` : formatReportTime(0)}
      </span>
    </>
  );
}

function TotalsFooter({
  labelColSpan,
  totals,
}: {
  labelColSpan: number;
  totals: Totals;
}) {
  return (
    <TFoot>
      <tr>
        <Td colSpan={labelColSpan}>Итого</Td>
        <Td numeric title='Сумма лимитов: лимит клиента учитывается один раз'>
          {formatReportTime(totals.limit)}
        </Td>
        <Td numeric>{formatReportTime(totals.spent)}</Td>
        <Td numeric title='Лимит клиента учитывается один раз'>
          <TotalsBalance totals={totals} />
        </Td>
      </tr>
    </TFoot>
  );
}

/** Пара «подпись — значение» в карточке телефона. */
function CardValue({
  label,
  children,
  className = 'text-slate-800',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className='min-w-0'>
      <dt className='text-slate-500'>{label}</dt>
      <dd className={`mt-0.5 font-medium tabular-nums ${className}`}>{children}</dd>
    </div>
  );
}

function CardRemaining({ remaining }: { remaining: number }) {
  return remaining < 0 ? (
    <CardValue label='Остаток' className='font-semibold text-rose-600'>
      +{formatDurationHms(-remaining)} сверх
    </CardValue>
  ) : (
    <CardValue label='Остаток'>{formatDurationHms(remaining)}</CardValue>
  );
}

function ProjectCards({ rows }: { rows: ProjectRowWithRemaining[] }) {
  return rows.map((row) => {
    const isClientLimit = row.limit_source === 'client';
    const isOver = !isClientLimit && row.remaining_seconds < 0;

    return (
      <article
        key={row.project_id}
        className={`${cardClasses} ${isOver ? cardOverClasses : cardDefaultClasses}`}
      >
        <div className='min-w-0'>
          <p className='text-xs text-slate-500'>{row.client_name || 'Без клиента'}</p>
          <p className='mt-0.5 text-sm font-medium break-words text-slate-800'>
            {row.project_name || '—'}
          </p>
        </div>
        <dl className='grid grid-cols-3 gap-2 text-xs'>
          <CardValue label='Лимит'>
            {isClientLimit ? (
              <ClientLimitLabel row={row} />
            ) : (
              formatDurationHms(row.limit_seconds)
            )}
          </CardValue>
          <CardValue label='Часы' className={isOver ? 'text-rose-600' : 'text-slate-800'}>
            {formatDurationHms(row.spent_seconds)}
          </CardValue>
          {isClientLimit ? (
            <CardValue label='Остаток'>
              <span className='font-normal text-slate-400'>—</span>
            </CardValue>
          ) : (
            <CardRemaining remaining={row.remaining_seconds} />
          )}
        </dl>
      </article>
    );
  });
}

function ClientCards({ rows }: { rows: LimitReportClientRow[] }) {
  return rows.map((client) => {
    const hasClientLimit = client.limit_seconds !== null;
    const clientRemaining = hasClientLimit
      ? (client.limit_seconds ?? 0) - client.spent_seconds
      : null;
    const isClientOver = clientRemaining !== null && clientRemaining < 0;

    return (
      <article
        key={client.client_id ?? 'no-client'}
        className={`${cardClasses} ${isClientOver ? cardOverClasses : cardDefaultClasses}`}
      >
        <p className='text-sm font-semibold break-words text-slate-800'>
          {client.client_id ? client.client_name || '—' : 'Без клиента'}
        </p>
        {clientRemaining !== null ? (
          <dl className='grid grid-cols-3 gap-2 text-xs'>
            <CardValue label='Лимит'>{formatDurationHms(client.limit_seconds)}</CardValue>
            <CardValue
              label='Часы'
              className={isClientOver ? 'text-rose-600' : 'text-slate-800'}
            >
              {formatDurationHms(client.spent_seconds)}
            </CardValue>
            <CardRemaining remaining={clientRemaining} />
          </dl>
        ) : null}
        <ul className='grid gap-2 border-t border-slate-200 pt-2'>
          {client.projects.map((project) => {
            const isClientLimit = project.limit_source === 'client';
            const remaining = project.limit_seconds - project.limit_spent_seconds;
            const isOver = !isClientLimit && remaining < 0;

            return (
              <li
                key={project.project_id}
                className={`grid gap-1 ${isOver ? '-mx-1 rounded-md bg-rose-100/60 px-1 py-1' : ''}`}
              >
                <div className='flex min-w-0 items-baseline justify-between gap-2 text-sm'>
                  <span className='min-w-0 break-words text-slate-800'>
                    {project.project_name || '—'}
                  </span>
                  {isClientLimit ? (
                    <span className='shrink-0 text-slate-800 tabular-nums'>
                      {formatDurationHms(project.spent_seconds)}
                    </span>
                  ) : null}
                </div>
                {isClientLimit ? null : (
                  <dl className='grid grid-cols-3 gap-2 text-xs'>
                    <CardValue label='Лимит'>
                      {formatDurationHms(project.limit_seconds)}
                    </CardValue>
                    <CardValue
                      label='Часы'
                      className={isOver ? 'text-rose-600' : 'text-slate-800'}
                    >
                      {formatDurationHms(project.spent_seconds)}
                    </CardValue>
                    <CardRemaining remaining={remaining} />
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      </article>
    );
  });
}

function TotalsCard({ totals }: { totals: Totals }) {
  return (
    <dl className='grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs'>
      <p className='col-span-2 text-sm font-semibold text-black'>Итого</p>
      <CardValue label='Лимит' className='font-bold text-black'>
        {formatDurationHms(totals.limit)}
      </CardValue>
      <CardValue label='Часы' className='font-bold text-black'>
        {formatDurationHms(totals.spent)}
      </CardValue>
      <CardValue label='Осталось' className='font-bold text-black'>
        {formatDurationHms(totals.remaining)}
      </CardValue>
      <CardValue
        label='Сверх лимита'
        className={totals.over > 0 ? 'font-bold text-rose-600' : 'text-slate-400'}
      >
        {totals.over > 0 ? '+' : ''}
        {formatDurationHms(totals.over)}
      </CardValue>
    </dl>
  );
}

export default function LimitReportsTable({
  report,
  isLoading = false,
  hasFilters = false,
}: Props) {
  const placeholder = <EmptyState isLoading={isLoading} hasFilters={hasFilters} />;
  const totals: Totals = {
    limit: report?.limit_seconds ?? 0,
    spent: report?.spent_seconds ?? 0,
    over: report?.over_limit_seconds ?? 0,
    remaining: report?.remaining_seconds ?? 0,
  };
  const periodDays = report?.period_days ?? 7;
  const isClientGroup = report?.group_by === 'client';
  const clientRows = report?.group_by === 'client' ? report.rows : EMPTY_CLIENT_ROWS;
  const projectRows = report?.group_by === 'project' ? report.rows : EMPTY_PROJECT_ROWS;
  const { toggleSort, directionOf, visibleRows } = useSortedProjectRows(projectRows);
  const isEmpty = isClientGroup ? clientRows.length === 0 : projectRows.length === 0;

  const exceededClients = useMemo(() => {
    const byClient = new Map<string, ExceededClient>();
    for (const row of projectRows) {
      if (!isClientLimitOver(row) || !row.client_id || byClient.has(row.client_id))
        continue;
      byClient.set(row.client_id, {
        clientId: row.client_id,
        clientName: row.client_name ?? '',
        limit: row.limit_seconds,
        spent: row.limit_spent_seconds,
      });
    }
    return [...byClient.values()];
  }, [projectRows]);

  return (
    <>
      {isClientGroup ? null : <ExceededClientsNotice clients={exceededClients} />}

      {/* На телефоне таблица не помещается: «Остаток» уходит за край, поэтому карточки. */}
      <div className='mt-3 grid gap-2 md:hidden'>
        {isEmpty ? (
          <div className='rounded-lg border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500'>
            {placeholder}
          </div>
        ) : isClientGroup ? (
          <ClientCards rows={clientRows} />
        ) : (
          <ProjectCards rows={visibleRows} />
        )}
        {isEmpty ? null : <TotalsCard totals={totals} />}
      </div>

      <TableContainer className='mt-3 hidden md:block'>
        {isClientGroup ? (
          <ClientRowsTable
            rows={clientRows}
            periodDays={periodDays}
            totals={totals}
            placeholder={placeholder}
          />
        ) : (
          <ProjectRowsTable
            rows={visibleRows}
            directionOf={directionOf}
            onSort={toggleSort}
            periodDays={periodDays}
            totals={totals}
            placeholder={placeholder}
          />
        )}
      </TableContainer>
    </>
  );
}
