import { Fragment, useMemo, useState, type ReactNode } from 'react';

import type {
  FinanceAnalyticsClientRow,
  FinanceAnalyticsExpenseBreakdown,
  FinanceAnalyticsManagerRow,
  FinanceAnalyticsProjectRow,
  FinanceAnalyticsProjectSummary,
} from '../../../../types/financeAnalytics';
import {
  sortRows,
  Table,
  TableContainer,
  TableEmptyRow,
  TableExpandButton,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useTableSort,
} from '../../../ui/table';
import {
  formatAnalyticsMoney,
  formatAnalyticsPerson,
  getBreakdownAmount,
  getBreakdownName,
  getProfitTone,
} from './financeAnalyticsUtils';

type View = 'projects' | 'managers' | 'clients';
type SortKey = 'income' | 'expenses' | 'profit';
type Row =
  | FinanceAnalyticsProjectRow
  | FinanceAnalyticsManagerRow
  | FinanceAnalyticsClientRow;

const COLUMN_COUNT = 5;

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`size-4 fill-none stroke-current stroke-2 transition-transform ${expanded ? 'rotate-90' : ''}`}
      viewBox='0 0 16 16'
    >
      <path d='m6 3 5 5-5 5' />
    </svg>
  );
}

function Breakdown({
  title,
  items,
}: {
  title: string;
  items: FinanceAnalyticsExpenseBreakdown[];
}) {
  return (
    <div>
      <h4 className='mb-1 text-xs font-semibold text-[#53617c]'>{title}</h4>
      <div className='grid gap-1'>
        {items.map((item, index) => (
          <div
            key={`${getBreakdownName(item)}-${index}`}
            className='grid grid-cols-[minmax(0,1fr)_auto] gap-4 text-xs text-[#66728d]'
          >
            <span className='truncate'>{getBreakdownName(item)}</span>
            <span className='whitespace-nowrap'>
              {formatAnalyticsMoney(getBreakdownAmount(item))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfitAmount({ value }: { value: number }) {
  const tone = getProfitTone(value);

  return (
    <span className='text-right font-medium' style={{ color: tone.color }}>
      {formatAnalyticsMoney(value)}
    </span>
  );
}

/** Детализация проекта без рамки и фона: их задаёт место показа. */
function ProjectDetails({ row }: { row: FinanceAnalyticsProjectRow }) {
  return (
    <div className='grid gap-4 md:grid-cols-3'>
      <Breakdown title='Сотрудники проекта' items={row.employees ?? []} />
      <Breakdown title='Прямые расходы по статьям' items={row.expense_articles ?? []} />
      <Breakdown title='Распределенные расходы' items={row.allocated_articles ?? []} />
      {(row.employees?.length ?? 0) +
        (row.expense_articles?.length ?? 0) +
        (row.allocated_articles?.length ?? 0) ===
      0 ? (
        <div className='text-xs text-[#7e8fb4]'>Детализация отсутствует</div>
      ) : null}
    </div>
  );
}

function ProjectSummaryRows({ rows }: { rows: FinanceAnalyticsProjectSummary[] }) {
  return (
    <div className='grid gap-2'>
      {rows.map((row) => (
        <div
          key={row.project.id ?? row.project.name}
          className='grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,0.32fr))] gap-4 text-xs text-[#66728d]'
        >
          <span className='truncate font-medium'>{row.project.name}</span>
          <span className='text-right'>{formatAnalyticsMoney(row.income)}</span>
          <span className='text-right'>{formatAnalyticsMoney(row.expenses)}</span>
          <ProfitAmount value={row.profit} />
        </div>
      ))}
    </div>
  );
}

function ClientProjects({ rows }: { rows: FinanceAnalyticsProjectRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className='grid gap-1'>
      {rows.map((row) => {
        const id = row.project.id ?? row.project.name;
        const isExpanded = expandedId === id;
        return (
          <div
            key={id}
            className='overflow-hidden rounded-lg border border-[#e3e9f3] bg-white'
          >
            <button
              type='button'
              className='grid w-full grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,0.32fr))] items-center gap-4 px-3 py-2 text-left text-xs text-[#66728d] hover:bg-[#f7f9fc]'
              onClick={() => setExpandedId(isExpanded ? null : id)}
            >
              <span className='flex min-w-0 items-center gap-2 font-medium'>
                <Chevron expanded={isExpanded} />
                <span className='truncate'>{row.project.name}</span>
              </span>
              <span className='text-right'>{formatAnalyticsMoney(row.income)}</span>
              <span className='text-right'>{formatAnalyticsMoney(row.expenses)}</span>
              <ProfitAmount value={row.profit} />
            </button>
            {isExpanded ? (
              <div className='border-t border-[#dbe2ed] bg-[#fafbfd] px-6 py-4'>
                <ProjectDetails row={row} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function FinanceAnalyticsTables({
  projects,
  managers,
  clients,
}: {
  projects: FinanceAnalyticsProjectRow[];
  managers: FinanceAnalyticsManagerRow[];
  clients: FinanceAnalyticsClientRow[];
}) {
  const [view, setView] = useState<View>('projects');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { sort, toggleSort, directionOf } = useTableSort<SortKey>({
    initial: { key: 'income', direction: 'desc' },
    firstDirection: 'desc',
  });

  const rows = useMemo(() => {
    const source: Row[] =
      view === 'projects' ? projects : view === 'managers' ? managers : clients;
    return sortRows(source, sort, (row, key) => Number(row[key] ?? 0));
  }, [clients, managers, projects, sort, view]);

  const sortableHeader = (key: SortKey) => ({
    sortDirection: directionOf(key),
    onSort: () => toggleSort(key),
  });

  const viewLabels: Record<View, string> = {
    projects: 'Анализ по проектам',
    managers: 'Анализ по менеджерам',
    clients: 'Анализ по клиентам',
  };

  const profitTone = getProfitTone(
    rows.reduce((total, row) => total + Number(row.profit ?? 0), 0),
  );

  return (
    <section className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white shadow-sm shadow-slate-900/3'>
      <div className='flex overflow-x-auto border-b border-[#dbe2ed] px-2 md:px-4'>
        {(Object.keys(viewLabels) as View[]).map((item) => (
          <button
            key={item}
            type='button'
            className={`shrink-0 border-b-2 px-4 py-4 text-xs font-semibold transition-colors ${view === item ? 'border-[#2d6ff7] text-[#2d6ff7]' : 'border-transparent text-[#4d5871] hover:text-[#2d6ff7]'}`}
            onClick={() => {
              setView(item);
              setExpandedId(null);
            }}
          >
            {viewLabels[item]}
          </button>
        ))}
      </div>

      <div className='min-w-0 p-2 md:p-4'>
        <TableContainer>
          <Table striped={false} className='min-w-190'>
            <THead>
              <tr>
                <Th align='center' className='w-10'>
                  <span className='sr-only'>Детализация</span>
                </Th>
                <Th>
                  {view === 'projects'
                    ? 'Название проекта'
                    : view === 'managers'
                      ? 'Менеджер'
                      : 'Клиент'}
                </Th>
                {/* Цвет колонки — смысл суммы: доходы, расходы, прибыль или убыток. */}
                <Th numeric style={{ color: '#2d6ff7' }} {...sortableHeader('income')}>
                  Доходы
                </Th>
                <Th numeric style={{ color: '#e83f4b' }} {...sortableHeader('expenses')}>
                  Расходы
                </Th>
                <Th
                  numeric
                  style={{ color: profitTone.color }}
                  {...sortableHeader('profit')}
                >
                  {profitTone.label}
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <TableEmptyRow>Нет данных для выбранных фильтров</TableEmptyRow>
              ) : (
                rows.map((row) => {
                  const entity =
                    view === 'projects'
                      ? (row as FinanceAnalyticsProjectRow).project
                      : view === 'managers'
                        ? (row as FinanceAnalyticsManagerRow).manager
                        : (row as FinanceAnalyticsClientRow).client;
                  const id = entity.id ?? entity.name ?? 'unknown';
                  const name =
                    view === 'managers'
                      ? formatAnalyticsPerson((row as FinanceAnalyticsManagerRow).manager)
                      : entity.name;
                  const isExpanded = expandedId === id;
                  const toggle = () => setExpandedId(isExpanded ? null : id);
                  let details: ReactNode = null;
                  if (isExpanded && view === 'projects')
                    details = <ProjectDetails row={row as FinanceAnalyticsProjectRow} />;
                  if (isExpanded && view === 'managers') {
                    details = (
                      <>
                        <h4 className='mb-3 text-xs font-semibold text-[#53617c]'>
                          Проекты менеджера
                        </h4>
                        <ProjectSummaryRows
                          rows={(row as FinanceAnalyticsManagerRow).projects ?? []}
                        />
                      </>
                    );
                  }
                  if (isExpanded && view === 'clients') {
                    details = (
                      <>
                        <h4 className='mb-3 text-xs font-semibold text-[#53617c]'>
                          Проекты клиента
                        </h4>
                        <ClientProjects
                          rows={(row as FinanceAnalyticsClientRow).projects ?? []}
                        />
                      </>
                    );
                  }

                  return (
                    <Fragment key={id}>
                      <Tr className='cursor-pointer' onClick={toggle}>
                        <Td align='center'>
                          <TableExpandButton
                            expanded={isExpanded}
                            label={
                              isExpanded ? 'Скрыть детализацию' : 'Показать детализацию'
                            }
                            onToggle={toggle}
                          />
                        </Td>
                        <Td className='font-medium text-[#3a8de0]'>{name}</Td>
                        <Td numeric>{formatAnalyticsMoney(row.income)}</Td>
                        <Td numeric>{formatAnalyticsMoney(row.expenses)}</Td>
                        <Td numeric>
                          <ProfitAmount value={row.profit} />
                        </Td>
                      </Tr>
                      {details ? (
                        <Tr background='bg-[#fafbfd]' hoverable={false}>
                          <Td colSpan={COLUMN_COUNT}>
                            <div className='px-3.5 py-2'>{details}</div>
                          </Td>
                        </Tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableContainer>
      </div>
    </section>
  );
}
