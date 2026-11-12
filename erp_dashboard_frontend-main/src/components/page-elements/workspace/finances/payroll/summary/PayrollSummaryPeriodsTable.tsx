import { useMemo, useState } from 'react';

import type {
  PayrollSummary,
  PayrollSummaryEmployee,
} from '../../../../../../types/payrollSummary';
import TablePagination from '../../../../../ui/TablePagination';
import {
  Table,
  TableContainer,
  TableExpandButton,
  TableMessageRow,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
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

// Вкладка "Расчёт по периодам": периоды, внутри сотрудники, внутри недели сотрудника.
// Страница сбрасывается через key у родителя при смене фильтра.
export default function PayrollSummaryPeriodsTable({
  summary,
  expanded,
  onToggle,
  loadingKey,
  onOpenDetails,
  allExpanded,
  onToggleAll,
}: {
  summary: PayrollSummary;
  expanded: Set<string>;
  onToggle: (_key: string) => void;
  loadingKey: string | null;
  onOpenDetails: OpenDetails;
  allExpanded: boolean;
  onToggleAll: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const groupBy = summary.group_by;
  const isWeek = groupBy === 'week';
  const employees = useMemo(
    () =>
      new Map<string, PayrollSummaryEmployee>(
        summary.employees.map((item) => [item.id, item]),
      ),
    [summary.employees],
  );
  const nameOf = (employeeId: string) => {
    const employee = employees.get(employeeId);
    return employee ? employeeName(employee) : 'Сотрудник';
  };
  const totalPages = Math.max(1, Math.ceil(summary.groups.length / pageSize));
  const groups = summary.groups.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <TableContainer>
        <Table striped={false} className='min-w-215'>
          <THead>
            <tr>
              <ToggleAllHeader allExpanded={allExpanded} onToggleAll={onToggleAll} />
              <Th>Период / сотрудник</Th>
              <Th numeric className='w-28 whitespace-nowrap'>
                Сотрудники
              </Th>
              <Th numeric className='w-48 whitespace-nowrap'>
                Свои часы
              </Th>
              <Th numeric className='w-48 whitespace-nowrap'>
                Под контролем
              </Th>
              <Th numeric className='w-44 whitespace-nowrap'>
                Начислено
              </Th>
            </tr>
          </THead>
          {groups.map((group) => {
            const isOpen = expanded.has(group.key);
            const periods = periodsOfGroup(summary.periods, group.key);
            const values = [...group.values].sort((left, right) =>
              nameOf(left.employee_id).localeCompare(nameOf(right.employee_id), 'ru'),
            );

            return (
              <TBody key={group.key}>
                <Tr
                  background={isOpen ? OPEN_ROW_BACKGROUND : undefined}
                  hoverable={!isOpen}
                  className='cursor-pointer'
                  onClick={() => onToggle(group.key)}
                >
                  <Td align='center'>
                    <TableExpandButton
                      expanded={isOpen}
                      label={isOpen ? 'Свернуть период' : 'Развернуть период'}
                      onToggle={() => onToggle(group.key)}
                    />
                  </Td>
                  <Td>
                    <GroupLabel
                      group={group}
                      groupBy={groupBy}
                      period={isWeek ? periods[0] : undefined}
                      today={summary.today}
                    />
                  </Td>
                  <Td numeric>{group.employees_count}</Td>
                  <AmountCells value={group} />
                </Tr>
                {isOpen && values.length === 0 ? (
                  // Сообщение внутри группы: ниже обычной пустой строки и на фоне вложенных строк.
                  <TableMessageRow className={`${NESTED_ROW_BACKGROUND} py-4!`}>
                    В этом периоде нет часов и начислений.
                  </TableMessageRow>
                ) : null}
                {isOpen
                  ? values.map((value) => {
                      const employee = employees.get(value.employee_id);
                      const weeksKey = `${group.key}:${value.employee_id}`;
                      const weeksOpen = !isWeek && expanded.has(weeksKey);
                      const name = nameOf(value.employee_id);

                      return [
                        <Tr
                          key={value.employee_id}
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
                              <PayrollEmployeeName
                                name={name}
                                isArchived={employee?.is_archived}
                                weight='medium'
                              />
                              {isWeek && periods[0] ? (
                                <DetailsButton
                                  loading={
                                    loadingKey ===
                                    `${value.employee_id}:${periods[0].key}`
                                  }
                                  onClick={() =>
                                    onOpenDetails(value.employee_id, periods[0])
                                  }
                                />
                              ) : null}
                            </span>
                          </Td>
                          <Td numeric />
                          <AmountCells value={value} strong={false} />
                        </Tr>,
                        weeksOpen ? (
                          <EmployeeWeekRows
                            key={`${value.employee_id}:weeks`}
                            employeeId={value.employee_id}
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
          })}
          <TFoot>
            <tr>
              <Td />
              <Td>Итого за период</Td>
              <Td numeric>{summary.totals.employees_count}</Td>
              <AmountCells value={summary.totals} />
            </tr>
          </TFoot>
        </Table>
      </TableContainer>
      {summary.groups.length > 20 ? (
        <div className='mt-3'>
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            showPageSizeSelector={true}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </div>
      ) : null}
    </>
  );
}
