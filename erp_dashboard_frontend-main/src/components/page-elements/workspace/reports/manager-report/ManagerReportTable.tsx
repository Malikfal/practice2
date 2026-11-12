import { Fragment, useMemo } from 'react';

import type {
  ManagerReportManagerRow,
  ManagerReportProjectRow,
  ManagerReportSummary,
} from '../../../../../types/managerReport';
import {
  defaultManagerReportSort,
  formatReportHours,
  formatReportMoney,
  formatReportShare,
  sortManagerReportRows,
  type ManagerReportMetricRow,
  type ManagerReportSort,
  type ManagerReportSortKey,
} from './managerReportUtils';
import {
  Table,
  TableContainer,
  TableEmptyRow,
  TableExpandButton,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
  useExpandedRows,
} from '../../../../ui/table';

type Column = {
  key: ManagerReportSortKey;
  label: string;
  hint: string;
  finance?: boolean;
  /** Показатель менеджера целиком: в строках проектов не показывается. */
  managerOnly?: boolean;
  render: (_row: ManagerReportMetricRow) => string;
};

const MANAGER_HINT =
  'Сотрудник, который был руководителем проекта (PM) в выбранном периоде. Клик по строке открывает его проекты';

const COLUMNS: Column[] = [
  {
    key: 'projects_count',
    label: 'Проекты',
    hint: 'Проекты, где сотрудник был руководителем в выбранном периоде. Архивные проекты входят, только если по ним были часы. Проекты с галкой "Не учитывать часы проекта в оплате" для всех сотрудников не входят',
    managerOnly: true,
    render: (row) => String(row.projects_count),
  },
  {
    key: 'developer_seconds',
    label: 'Часы разработчиков',
    hint: 'Фактическое время разработчиков (роли "Сотрудник" и "Тимлид") на проектах менеджера за время его назначения. Время PM, РПО и руководства сюда не входит. Часы, исключенные из оплаты настройкой проекта, не учитываются',
    render: (row) => formatReportHours(row.developer_seconds),
  },
  {
    key: 'supervised_seconds',
    label: 'Часы под контролем',
    hint: 'Часы проектов, за которые менеджеру начисляется оплата PM. Считаются так же, как в расчете зарплаты: только при включенной оплате PM, по настройке проекта "Начислять всем / пропорционально / не начислять", с исключениями проектов и сотрудников из расчета. Включают время самих PM',
    render: (row) => formatReportHours(row.supervised_seconds),
  },
  {
    key: 'manager_cost',
    label: 'Выплачено менеджеру',
    hint: 'Все начисления менеджеру за период по дате платежа, как в "Расчёте и выплате ФОТ"',
    finance: true,
    managerOnly: true,
    render: (row) => formatReportMoney(row.manager_cost),
  },
  {
    key: 'supervised_hour_cost',
    label: 'Стоимость часа под контролем',
    hint: 'Выплачено менеджеру за период, деленное на часы под контролем за этот же период',
    finance: true,
    managerOnly: true,
    render: (row) => formatReportMoney(row.supervised_hour_cost),
  },
  {
    key: 'total_hour_cost',
    label: 'Стоимость часа разработки',
    hint: 'Общая стоимость часа: все начисления участникам проектов менеджера (разработчикам, РПО, руководству) и самому менеджеру, деленные на все часы этих проектов, включая время менеджера',
    finance: true,
    managerOnly: true,
    render: (row) => formatReportMoney(row.total_hour_cost),
  },
  {
    key: 'developer_hour_cost',
    label: 'Стоимость часа разработчика',
    hint: 'Начисления разработчикам (роли "Сотрудник" и "Тимлид"), деленные на их часы. Чем выше, тем больше с менеджером работают опытные разработчики',
    finance: true,
    render: (row) => formatReportMoney(row.developer_hour_cost),
  },
  {
    key: 'hours_share',
    label: 'Доля по часам',
    hint: 'У менеджера: его часы под контролем от часов под контролем всех менеджеров. У проекта: доля проекта в часах под контролем менеджера, в сумме 100%',
    render: (row) => formatReportShare(row.hours_share),
  },
  {
    key: 'money_share',
    label: 'Доля по деньгам',
    hint: 'У менеджера: расходы на разработку под его контролем от таких расходов всех менеджеров. У проекта: доля проекта в расходах под контролем менеджера, в сумме 100%',
    finance: true,
    render: (row) => formatReportShare(row.money_share),
  },
];

// Строки проектов под строкой менеджера.
const projectRowBackground = 'bg-[#fafbfd]';

/** Менеджеры приходят уже отсортированными: тот же порядок используют карточки графиков. */
export default function ManagerReportTable({
  managers,
  summary,
  canViewFinance,
  sort,
  onSortChange,
}: {
  managers: ManagerReportManagerRow[];
  summary: ManagerReportSummary;
  canViewFinance: boolean;
  sort: ManagerReportSort;
  onSortChange: (_sort: ManagerReportSort) => void;
}) {
  const { isExpanded, toggle } = useExpandedRows<string>();
  const columns = useMemo(
    () => COLUMNS.filter((column) => canViewFinance || !column.finance),
    [canViewFinance],
  );
  const changeSort = (key: ManagerReportSortKey) =>
    onSortChange(
      sort.key === key
        ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'name' ? 'asc' : 'desc' },
    );
  const sortOf = (key: ManagerReportSortKey) =>
    sort.key === key ? sort.direction : null;

  // По скрытому у проектов столбцу проекты сортируются по умолчанию.
  const projectSort = COLUMNS.some(
    (column) => column.key === sort.key && column.managerOnly,
  )
    ? defaultManagerReportSort
    : sort;

  const renderProjects = (projects: ManagerReportProjectRow[]) =>
    sortManagerReportRows(projects, projectSort, (row) => row.project.name).map((row) => (
      <Tr key={row.project.id} background={projectRowBackground}>
        <Td pin='left' className='text-slate-600'>
          <div className='pl-8'>
            <span className='block max-w-80 truncate' title={row.project.name}>
              {row.project.name}
            </span>
            {row.project.is_internal ? (
              <span className='text-xs text-[#7e8fb4]'>Внутренний</span>
            ) : null}
          </div>
        </Td>
        {columns.map((column) => (
          <Td key={column.key} numeric className='text-slate-600'>
            {column.managerOnly ? '' : column.render(row)}
          </Td>
        ))}
      </Tr>
    ));

  return (
    <TableContainer>
      <Table striped={false} className='min-w-240'>
        <THead>
          <tr>
            <Th
              pin='left'
              title={MANAGER_HINT}
              sortDirection={sortOf('name')}
              onSort={() => changeSort('name')}
            >
              Менеджер
            </Th>
            {columns.map((column) => (
              <Th
                key={column.key}
                numeric
                title={column.hint}
                sortDirection={sortOf(column.key)}
                onSort={() => changeSort(column.key)}
              >
                {column.label}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {managers.length === 0 ? (
            <TableEmptyRow>Нет данных за выбранный период</TableEmptyRow>
          ) : null}
          {managers.map((row) => {
            const expanded = isExpanded(row.manager.id);
            return (
              <Fragment key={row.manager.id}>
                <Tr className='cursor-pointer' onClick={() => toggle(row.manager.id)}>
                  <Td pin='left'>
                    <div className='flex items-center gap-2'>
                      <TableExpandButton
                        expanded={expanded}
                        label={expanded ? 'Скрыть проекты' : 'Показать проекты'}
                        onToggle={() => toggle(row.manager.id)}
                      />
                      <span className='font-medium whitespace-nowrap text-[#2d6ff7]'>
                        {row.manager.name}
                      </span>
                    </div>
                  </Td>
                  {columns.map((column) => (
                    <Td key={column.key} numeric>
                      {column.render(row)}
                    </Td>
                  ))}
                </Tr>
                {expanded ? (
                  row.projects.length > 0 ? (
                    renderProjects(row.projects)
                  ) : (
                    <Tr background={projectRowBackground} hoverable={false}>
                      <Td colSpan={columns.length + 1} className='text-[#7e8fb4]'>
                        <div className='pl-8'>Нет проектов</div>
                      </Td>
                    </Tr>
                  )
                ) : null}
              </Fragment>
            );
          })}
        </TBody>
        {managers.length > 0 ? (
          <TFoot>
            <tr>
              <Td pin='left'>Итого</Td>
              {columns.map((column) => (
                <Td key={column.key} numeric>
                  {column.render(summary)}
                </Td>
              ))}
            </tr>
          </TFoot>
        ) : null}
      </Table>
    </TableContainer>
  );
}
