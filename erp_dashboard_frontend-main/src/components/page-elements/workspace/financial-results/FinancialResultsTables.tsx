import { Fragment, useMemo, useState, type ReactNode } from 'react';

import type {
  FinancialResultsClientRow,
  FinancialResultsManagerRow,
  FinancialResultsProjectRow,
  FinancialResultsProjectSummary,
} from '../../../../types/financialResults';
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
  getProfitTone,
} from '../finance-analytics/financeAnalyticsUtils';
import { formatFinancialResultsPerson } from './financialResultsUtils';

type View = 'projects' | 'managers' | 'clients';
type SortKey = 'income' | 'expenses' | 'profit';
type Row =
  | FinancialResultsProjectRow
  | FinancialResultsManagerRow
  | FinancialResultsClientRow;

const COLUMN_COUNT = 5;

function ProfitAmount({ value }: { value: number }) {
  return (
    <span
      className='text-right font-medium'
      style={{ color: getProfitTone(value).color }}
    >
      {formatAnalyticsMoney(value)}
    </span>
  );
}

function EmptyDetails() {
  return <div className='text-xs text-[#7e8fb4]'>Детализация отсутствует</div>;
}

function ProjectDetails({ row }: { row: FinancialResultsProjectRow }) {
  const incomeArticles = row.income_articles ?? [];
  const employees = row.employees ?? [];
  const articles = row.expense_articles ?? [];
  return (
    <div className='grid gap-5 md:grid-cols-3'>
      <div>
        <h4 className='mb-2 text-xs font-semibold text-[#53617c]'>Сотрудники проекта</h4>
        {employees.length ? (
          <div className='grid gap-1'>
            {employees.map((item, index) => (
              <div
                key={`${item.employee.id}-${index}`}
                className='grid grid-cols-[minmax(0,1fr)_auto] gap-4 text-xs text-[#66728d]'
              >
                <span className='truncate'>
                  {formatFinancialResultsPerson(item.employee)}
                </span>
                <span>{formatAnalyticsMoney(item.expenses)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyDetails />
        )}
      </div>

      <div>
        <h4 className='mb-2 text-xs font-semibold text-[#53617c]'>
          Прямые расходы по статьям
        </h4>
        {articles.length ? (
          <div className='grid gap-1'>
            {articles.map((item, index) => (
              <div
                key={`${item.article.id ?? item.article.name}-${index}`}
                className='grid grid-cols-[minmax(0,1fr)_auto] gap-4 text-xs text-[#66728d]'
              >
                <span className='truncate'>{item.article.name}</span>
                <span>{formatAnalyticsMoney(item.expenses)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyDetails />
        )}
      </div>

      <div>
        <h4 className='mb-2 text-xs font-semibold text-[#53617c]'>
          Прямые доходы по статьям
        </h4>
        {incomeArticles.length ? (
          <div className='grid gap-1'>
            {incomeArticles.map((item, index) => (
              <div
                key={`${item.article.id ?? item.article.name}-${index}`}
                className='grid grid-cols-[minmax(0,1fr)_auto] gap-4 text-xs text-[#66728d]'
              >
                <span className='truncate'>{item.article.name}</span>
                <span>{formatAnalyticsMoney(item.income)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyDetails />
        )}
      </div>
    </div>
  );
}

function ManagerProjects({ rows }: { rows: FinancialResultsProjectSummary[] }) {
  return rows.length ? (
    <div className='grid gap-2'>
      {rows.map((row) => (
        <div
          key={row.project.id ?? row.project.name}
          className='grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,0.32fr))] gap-4 text-xs text-[#66728d]'
        >
          <span className='truncate font-medium'>
            {row.project.name}
            {row.client ? (
              <span className='ml-2 font-normal text-[#8b96ad]'>· {row.client.name}</span>
            ) : null}
          </span>
          <span className='text-right'>{formatAnalyticsMoney(row.income)}</span>
          <span className='text-right'>{formatAnalyticsMoney(row.expenses)}</span>
          <ProfitAmount value={row.profit} />
        </div>
      ))}
    </div>
  ) : (
    <EmptyDetails />
  );
}

export default function FinancialResultsTables({
  projects,
  managers,
  clients,
}: {
  projects: FinancialResultsProjectRow[];
  managers: FinancialResultsManagerRow[];
  clients: FinancialResultsClientRow[];
}) {
  const [view, setView] = useState<View>('projects');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { sort, toggleSort, directionOf } = useTableSort<SortKey>({
    initial: { key: 'income', direction: 'desc' },
    firstDirection: 'desc',
  });
  const rows = useMemo<Row[]>(() => {
    const source: Row[] =
      view === 'projects' ? projects : view === 'managers' ? managers : clients;
    const sorted = sortRows(source, sort, (row, key) => Number(row[key] ?? 0));
    if (view !== 'projects') return sorted;

    // Строка «без проекта» всегда в конце, при любой сортировке.
    const hasNoProject = (row: Row) =>
      (row as FinancialResultsProjectRow).project.id === null;
    return [
      ...sorted.filter((row) => !hasNoProject(row)),
      ...sorted.filter(hasNoProject),
    ];
  }, [clients, managers, projects, sort, view]);
  const sortableHeader = (key: SortKey) => ({
    sortDirection: directionOf(key),
    onSort: () => toggleSort(key),
  });
  const labels: Record<View, string> = {
    projects: 'По проектам',
    managers: 'По менеджерам',
    clients: 'По клиентам',
  };
  const canExpand = view !== 'clients';

  return (
    <section className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white shadow-sm shadow-slate-900/3'>
      <div className='flex overflow-x-auto border-b border-[#dbe2ed] px-2 md:px-4'>
        {(Object.keys(labels) as View[]).map((item) => (
          <button
            key={item}
            type='button'
            className={`shrink-0 border-b-2 px-4 py-4 text-xs font-semibold transition-colors ${view === item ? 'border-[#2d6ff7] text-[#2d6ff7]' : 'border-transparent text-[#4d5871] hover:text-[#2d6ff7]'}`}
            onClick={() => {
              setView(item);
              setExpandedId(null);
            }}
          >
            {labels[item]}
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
                {/* Цвет колонки — смысл суммы: доходы, расходы, прибыль. */}
                <Th numeric style={{ color: '#2d6ff7' }} {...sortableHeader('income')}>
                  Доходы
                </Th>
                <Th numeric style={{ color: '#e83f4b' }} {...sortableHeader('expenses')}>
                  Расходы
                </Th>
                <Th numeric style={{ color: '#20b85a' }} {...sortableHeader('profit')}>
                  Прибыль / убыток
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
                      ? (row as FinancialResultsProjectRow).project
                      : view === 'managers'
                        ? (row as FinancialResultsManagerRow).manager
                        : (row as FinancialResultsClientRow).client;
                  const id = entity.id ?? entity.name ?? 'unknown';
                  const name =
                    view === 'managers'
                      ? formatFinancialResultsPerson(
                          (row as FinancialResultsManagerRow).manager,
                        )
                      : entity.name;
                  const isExpanded = canExpand && expandedId === id;
                  const toggle = () => setExpandedId(isExpanded ? null : id);
                  let details: ReactNode = null;
                  if (isExpanded && view === 'projects')
                    details = <ProjectDetails row={row as FinancialResultsProjectRow} />;
                  if (isExpanded && view === 'managers')
                    details = (
                      <>
                        <h4 className='mb-3 text-xs font-semibold text-[#53617c]'>
                          Проекты менеджера
                        </h4>
                        <ManagerProjects
                          rows={(row as FinancialResultsManagerRow).projects ?? []}
                        />
                      </>
                    );
                  return (
                    <Fragment key={id}>
                      <Tr
                        hoverable={canExpand}
                        className={canExpand ? 'cursor-pointer' : undefined}
                        onClick={canExpand ? toggle : undefined}
                      >
                        <Td align='center'>
                          {canExpand ? (
                            <TableExpandButton
                              expanded={isExpanded}
                              label={
                                isExpanded ? 'Скрыть детализацию' : 'Показать детализацию'
                              }
                              onToggle={toggle}
                            />
                          ) : null}
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
