import { useMemo } from 'react';

import type {
  PayrollSummary,
  PayrollSummaryEmployee,
  PayrollSummaryGroupBy,
} from '../../../../../../types/payrollSummary';
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
  useTableSort,
} from '../../../../../ui/table';
import { PayrollEmployeeName } from '../PayrollEmployeeName';

import {
  AmountCells,
  DetailsButton,
  EmployeeWeekRows,
  GroupLabel,
  NESTED_ROW_BACKGROUND,
  OPEN_ROW_BACKGROUND,
  ToggleAllHeader,
  type OpenDetails,
} from './PayrollSummaryRows';
import { employeeName, periodsOfGroup } from './payrollSummaryUtils';

type SortKey = 'name' | 'own_seconds' | 'supervised_seconds' | 'amount_kopecks';

const COUNT_HEADERS: Record<PayrollSummaryGroupBy, string> = {
  week: 'Недель',
  month: 'Месяцев',
  quarter: 'Кварталов',
  year: 'Лет',
};

// Вкладка "Расчёт по сотрудникам": сотрудники, внутри их периоды, внутри недели.
export default function PayrollSummaryEmployeesTable({
  summary,
  search,
  expanded,
  onToggle,
  loadingKey,
  onOpenDetails,
  allExpanded,
  onToggleAll,
}: {
  summary: PayrollSummary;
  search: string;
  expanded: Set<string>;
  onToggle: (_key: string) => void;
  loadingKey: string | null;
  onOpenDetails: OpenDetails;
  allExpanded: boolean;
  onToggleAll: () => void;
}) {
  // Имя сортируется сначала по возрастанию, суммы и часы — сначала по убыванию.
  const { sort, toggleSort, directionOf } = useTableSort<SortKey>({
    initial: { key: 'name', direction: 'asc' },
    firstDirection: (key) => (key === 'name' ? 'asc' : 'desc'),
  });
  const groupBy = summary.group_by;
  const isWeek = groupBy === 'week';

  const groupsByEmployee = useMemo(() => {
    const result = new Map<string, number>();
    for (const group of summary.groups) {
      for (const value of group.values) {
        result.set(value.employee_id, (result.get(value.employee_id) ?? 0) + 1);
      }
    }
    return result;
  }, [summary.groups]);

  const employees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    const filtered = query
      ? summary.employees.filter((employee) =>
          employeeName(employee).toLocaleLowerCase('ru').includes(query),
        )
      : summary.employees;
    const key = sort.key ?? 'name';
    const direction = sort.direction === 'desc' ? -1 : 1;

    // Свой порядок вместо sortRows: при равных суммах сотрудники идут по имени.
    return [...filtered].sort((left, right) => {
      const byName = employeeName(left).localeCompare(employeeName(right), 'ru');
      if (key === 'name') return byName * direction;
      return (left[key] - right[key]) * direction || byName;
    });
  }, [search, sort, summary.employees]);

  const totals = useMemo(
    () =>
      employees.reduce(
        (result, employee) => ({
          own_seconds: result.own_seconds + employee.own_seconds,
          supervised_seconds: result.supervised_seconds + employee.supervised_seconds,
          amount_kopecks: result.amount_kopecks + employee.amount_kopecks,
        }),
        { own_seconds: 0, supervised_seconds: 0, amount_kopecks: 0 },
      ),
    [employees],
  );

  if (summary.employees.length === 0) {
    return (
      <div className='grid min-h-40 place-items-center rounded-xl border border-dashed border-[#d7e1f1] text-sm text-[#7e8fb4]'>
        За выбранный период нет сотрудников с часами или начислениями.
      </div>
    );
  }

  const renderEmployee = (employee: PayrollSummaryEmployee) => {
    const isOpen = expanded.has(employee.id);
    const groups = summary.groups.filter((group) =>
      group.values.some((value) => value.employee_id === employee.id),
    );

    return (
      <TBody key={employee.id}>
        <Tr
          background={isOpen ? OPEN_ROW_BACKGROUND : undefined}
          hoverable={!isOpen}
          className='cursor-pointer'
          onClick={() => onToggle(employee.id)}
        >
          <Td align='center'>
            <TableExpandButton
              expanded={isOpen}
              label={isOpen ? 'Свернуть сотрудника' : 'Развернуть сотрудника'}
              onToggle={() => onToggle(employee.id)}
            />
          </Td>
          <Td>
            <PayrollEmployeeName
              name={employeeName(employee)}
              isArchived={employee.is_archived}
            />
          </Td>
          <Td numeric>{groupsByEmployee.get(employee.id) ?? 0}</Td>
          <AmountCells value={employee} />
        </Tr>
        {isOpen
          ? groups.map((group) => {
              const value = group.values.find(
                (item) => item.employee_id === employee.id,
              )!;
              const periods = periodsOfGroup(summary.periods, group.key);
              const weeksKey = `${employee.id}:${group.key}`;
              const weeksOpen = !isWeek && expanded.has(weeksKey);

              return [
                <Tr
                  key={group.key}
                  background={NESTED_ROW_BACKGROUND}
                  hoverable={!isWeek}
                  className={isWeek ? undefined : 'cursor-pointer'}
                  onClick={isWeek ? undefined : () => onToggle(weeksKey)}
                >
                  <Td />
                  <Td>
                    <span className='flex items-center gap-1.5 pl-1.5'>
                      {isWeek ? (
                        <span className='w-6 shrink-0' />
                      ) : (
                        <TableExpandButton
                          expanded={weeksOpen}
                          label={weeksOpen ? 'Скрыть недели' : 'Показать недели'}
                          onToggle={() => onToggle(weeksKey)}
                        />
                      )}
                      <GroupLabel
                        group={group}
                        groupBy={groupBy}
                        period={isWeek ? periods[0] : undefined}
                        today={summary.today}
                        weeksCount={
                          periods.filter((period) =>
                            period.values.some(
                              (item) => item.employee_id === employee.id,
                            ),
                          ).length
                        }
                      />
                      {isWeek && periods[0] ? (
                        <DetailsButton
                          loading={loadingKey === `${employee.id}:${periods[0].key}`}
                          onClick={() => onOpenDetails(employee.id, periods[0])}
                        />
                      ) : null}
                    </span>
                  </Td>
                  <Td numeric />
                  <AmountCells value={value} strong={false} />
                </Tr>,
                weeksOpen ? (
                  <EmployeeWeekRows
                    key={`${group.key}:weeks`}
                    employeeId={employee.id}
                    periods={periods}
                    indentClass='pl-9.5'
                    loadingKey={loadingKey}
                    onOpenDetails={onOpenDetails}
                  />
                ) : null,
              ];
            })
          : null}
      </TBody>
    );
  };

  return (
    <TableContainer>
      <Table striped={false} className='min-w-215'>
        <THead>
          <tr>
            <ToggleAllHeader allExpanded={allExpanded} onToggleAll={onToggleAll} />
            <Th sortDirection={directionOf('name')} onSort={() => toggleSort('name')}>
              Сотрудник / период
            </Th>
            <Th numeric className='w-28 whitespace-nowrap'>
              {COUNT_HEADERS[groupBy]}
            </Th>
            <Th
              numeric
              className='w-48 whitespace-nowrap'
              sortDirection={directionOf('own_seconds')}
              onSort={() => toggleSort('own_seconds')}
            >
              Свои часы
            </Th>
            <Th
              numeric
              className='w-48 whitespace-nowrap'
              sortDirection={directionOf('supervised_seconds')}
              onSort={() => toggleSort('supervised_seconds')}
            >
              Под контролем
            </Th>
            <Th
              numeric
              className='w-44 whitespace-nowrap'
              sortDirection={directionOf('amount_kopecks')}
              onSort={() => toggleSort('amount_kopecks')}
            >
              Начислено
            </Th>
          </tr>
        </THead>
        {employees.length ? (
          employees.map(renderEmployee)
        ) : (
          <TBody>
            <TableEmptyRow>Никого не нашли по запросу "{search.trim()}".</TableEmptyRow>
          </TBody>
        )}
        <TFoot>
          <tr>
            <Td />
            <Td>
              {employees.length === summary.employees.length
                ? 'Итого по сотрудникам'
                : `Итого по найденным: ${employees.length} из ${summary.employees.length}`}
            </Td>
            <Td numeric />
            <AmountCells value={totals} />
          </tr>
        </TFoot>
      </Table>
    </TableContainer>
  );
}
