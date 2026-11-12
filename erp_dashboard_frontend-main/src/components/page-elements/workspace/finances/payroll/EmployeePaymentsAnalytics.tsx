import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import ExportDataModal from '../../../../modals/ExportDataModal';
import type { FinanceAnalyticsEmployees } from '../../../../../types/financeAnalytics';
import {
  downloadCsv,
  downloadExportXlsx,
  printTableAsPdf,
  type ExportTableData,
} from '../../../../../utils/exportFiles';
import type { CellValue } from '../../../../../utils/xlsx';
import Icon from '../../employees/components/Icon';
import {
  decimalHours,
  formatDecimalHours,
} from '../../employees/EmployeeDetailsPanel/components/payroll/payrollUtils';
import {
  formatAnalyticsHours,
  formatAnalyticsMoney,
  formatAnalyticsPeriod,
  formatAnalyticsPerson,
  getInitials,
} from '../../finance-analytics/financeAnalyticsUtils';
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
} from '../../../../ui/table';

const REPORT_TITLE = 'Оплата работы сотрудников';
const EXPORT_HEADERS = ['ФИО', 'Сумма', 'Проценты', 'Часы', 'Часы под контролем'];

type SortField = 'name' | 'expenses' | 'percent' | 'own_seconds' | 'supervised_seconds';
type EmployeeRow = FinanceAnalyticsEmployees['data'][number];

/** Часы как в «Таблице с расчётами» сотрудника: точное время и сотые в скобках. */
function formatHoursWithDecimal(seconds: number | null | undefined) {
  return `${formatAnalyticsHours(seconds)} (${formatDecimalHours(seconds)})`;
}

/** Число для CSV с запятой, как его ждёт русский Excel при разделителе «;». */
function toCsvNumber(value: number) {
  return String(value).replace('.', ',');
}

function roundToHundredths(value: number) {
  return Math.round(value * 100) / 100;
}

/** Строки выгрузки: сумма в рублях, проценты и часы числами (часы в сотых долях). */
function buildExportRows(rows: EmployeeRow[]) {
  return rows.map((item) => ({
    name: formatAnalyticsPerson(item.employee),
    amount: roundToHundredths(Number(item.expenses ?? 0) / 100),
    percent: roundToHundredths(Number(item.percent ?? 0)),
    ownHours: decimalHours(item.own_seconds),
    supervisedHours: decimalHours(item.supervised_seconds),
  }));
}

export default function EmployeePaymentsAnalytics({
  data,
}: {
  data: FinanceAnalyticsEmployees;
}) {
  const navigate = useNavigate();
  const [nameFilter, setNameFilter] = useState('');
  // ФИО сначала по алфавиту, числа — сначала крупные.
  const { sort, toggleSort, directionOf } = useTableSort<SortField>({
    initial: { key: 'expenses', direction: 'desc' },
    firstDirection: (field) => (field === 'name' ? 'asc' : 'desc'),
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const employees = Array.isArray(data.data) ? data.data : [];
  const totalExpenses = Number(data.summary?.expenses ?? 0);
  const totalOwnSeconds = employees.reduce(
    (sum, item) => sum + Number(item.own_seconds ?? 0),
    0,
  );
  const totalSupervisedSeconds = employees.reduce(
    (sum, item) => sum + Number(item.supervised_seconds ?? 0),
    0,
  );
  const normalizedFilter = nameFilter.trim().toLocaleLowerCase('ru-RU');
  const filteredEmployees = employees.filter((item) =>
    formatAnalyticsPerson(item.employee)
      .toLocaleLowerCase('ru-RU')
      .includes(normalizedFilter),
  );
  const max = Math.max(1, ...filteredEmployees.map((item) => Number(item.expenses ?? 0)));
  const visibleEmployees = sortRows(filteredEmployees, sort, (item, field) =>
    field === 'name' ? formatAnalyticsPerson(item.employee) : Number(item[field] ?? 0),
  );

  const period = formatAnalyticsPeriod(data.filters.from, data.filters.to);
  // Выгружаем ровно то, что видно в таблице: период и фильтры уже применены на сервере,
  // поиск по ФИО и сортировка применяются здесь.
  const exportRows = buildExportRows(visibleEmployees);
  const exportFileName = `${REPORT_TITLE} ${period}`;
  const buildTableData = (rows: CellValue[][]): ExportTableData => ({
    headers: EXPORT_HEADERS,
    rows,
    fileName: exportFileName,
    sheetName: REPORT_TITLE,
  });

  const exportXlsx = () => {
    downloadExportXlsx(
      buildTableData(
        exportRows.map((row) => [
          row.name,
          row.amount,
          row.percent,
          row.ownHours,
          row.supervisedHours,
        ]),
      ),
    );
    setIsExportModalOpen(false);
    toast.success('XLSX сохранён.');
  };

  const exportCsv = () => {
    downloadCsv(
      buildTableData(
        exportRows.map((row) => [
          row.name,
          toCsvNumber(row.amount),
          toCsvNumber(row.percent),
          toCsvNumber(row.ownHours),
          toCsvNumber(row.supervisedHours),
        ]),
      ),
    );
    setIsExportModalOpen(false);
    toast.success('CSV сохранён.');
  };

  const exportPdf = () => {
    const formatNumber = (value: number) =>
      new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
    const sum = (field: 'amount' | 'percent' | 'ownHours' | 'supervisedHours') =>
      roundToHundredths(exportRows.reduce((total, row) => total + row[field], 0));
    const search = nameFilter.trim();

    printTableAsPdf({
      ...buildTableData(
        exportRows.map((row) => [
          row.name,
          formatNumber(row.amount),
          `${formatNumber(row.percent)}%`,
          formatNumber(row.ownHours),
          formatNumber(row.supervisedHours),
        ]),
      ),
      title: REPORT_TITLE,
      subtitle: search ? `${period} · Поиск по ФИО: «${search}»` : period,
      footer: [
        'Итого',
        formatNumber(sum('amount')),
        `${formatNumber(sum('percent'))}%`,
        formatNumber(sum('ownHours')),
        formatNumber(sum('supervisedHours')),
      ],
    });
    setIsExportModalOpen(false);
  };

  const sortableHeader = (field: SortField) => ({
    sortDirection: directionOf(field),
    onSort: () => toggleSort(field),
  });

  return (
    <section className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-sm shadow-slate-900/3 md:p-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div>
          <h2 className='text-base font-semibold text-[#27324b]'>{REPORT_TITLE}</h2>
          <p className='mt-1 text-[11px] text-[#7e8fb4]'>За выбранный период</p>
        </div>
        {employees.length > 0 ? (
          <button
            type='button'
            className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#e3e9f3] bg-white px-3 text-xs font-semibold text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
            onClick={() => setIsExportModalOpen(true)}
          >
            <Icon name='download' />
            Выгрузить
          </button>
        ) : null}
      </div>

      {employees.length === 0 ? (
        <div className='grid h-48 place-items-center text-sm text-[#7e8fb4]'>
          Нет расходов по сотрудникам
        </div>
      ) : (
        <div className='mt-5 grid gap-5'>
          <div className='flex min-h-72 min-w-0 items-end gap-4 overflow-x-auto rounded-lg border border-[#e3e9f3] bg-[#fbfcff] px-3 pt-10 md:gap-5 md:px-6'>
            {filteredEmployees.map((item, index) => {
              const name = formatAnalyticsPerson(item.employee);
              const expenses = Number(item.expenses ?? 0);
              const height = Math.max(12, (expenses / max) * 180);
              return (
                <div
                  key={`${item.employee?.id ?? 'employee'}-chart-${index}`}
                  className='flex min-w-16 flex-1 flex-col items-center justify-end'
                >
                  <div className='mb-2 text-[10px] font-medium text-[#7e8fb4]'>
                    {formatAnalyticsMoney(expenses)}
                  </div>
                  <div
                    className='relative w-10 rounded-t-md bg-linear-to-b from-[#8c73e7] to-[#b49ae9]'
                    style={{ height }}
                    title={`${name}: ${formatAnalyticsMoney(expenses)}`}
                  >
                    <span className='absolute -top-3 left-1/2 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-[#7065df] text-[9px] font-semibold text-white'>
                      {getInitials(name)}
                    </span>
                  </div>
                  <div
                    className='mt-2 w-20 truncate text-center text-[10px] text-[#66728d]'
                    title={name}
                  >
                    {name}
                  </div>
                </div>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className='grid min-w-full flex-1 place-items-center self-stretch text-sm text-[#7e8fb4]'>
                Нет данных для диаграммы
              </div>
            )}
          </div>

          <div>
            <label className='mb-3 block max-w-sm'>
              <span className='sr-only'>Фильтр по ФИО</span>
              <input
                type='search'
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder='Поиск по ФИО'
                className='w-full rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 text-sm text-[#414b61] outline-none placeholder:text-[#9aa6bd] focus:border-[#8c73e7] focus:ring-2 focus:ring-[#8c73e7]/15'
              />
            </label>
            <TableContainer>
              <Table className='min-w-200'>
                <THead>
                  <tr>
                    <Th {...sortableHeader('name')}>ФИО</Th>
                    <Th numeric {...sortableHeader('expenses')}>
                      Сумма
                    </Th>
                    <Th numeric {...sortableHeader('percent')}>
                      Проценты
                    </Th>
                    <Th numeric {...sortableHeader('own_seconds')}>
                      Часы
                    </Th>
                    <Th numeric {...sortableHeader('supervised_seconds')}>
                      Часы под контролем
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {visibleEmployees.length === 0 ? (
                    <TableEmptyRow>Сотрудники с таким ФИО не найдены</TableEmptyRow>
                  ) : (
                    visibleEmployees.map((item, index) => {
                      const employeeId = item.employee?.id;
                      const name = formatAnalyticsPerson(item.employee);
                      return (
                        <Tr key={`${employeeId ?? 'employee'}-row-${index}`}>
                          <Td className='font-medium' title={name}>
                            {employeeId ? (
                              <button
                                type='button'
                                className='text-left text-[#3a8de0] hover:underline'
                                onClick={() =>
                                  navigate(`/employees?user_id=${employeeId}`)
                                }
                              >
                                {name}
                              </button>
                            ) : (
                              name
                            )}
                          </Td>
                          <Td numeric>{formatAnalyticsMoney(item.expenses)}</Td>
                          <Td numeric>
                            {new Intl.NumberFormat('ru-RU', {
                              maximumFractionDigits: 2,
                            }).format(item.percent)}
                            %
                          </Td>
                          <Td numeric>{formatHoursWithDecimal(item.own_seconds)}</Td>
                          <Td numeric>
                            {formatHoursWithDecimal(item.supervised_seconds)}
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
                <TFoot>
                  <tr>
                    <Td>Итого</Td>
                    <Td numeric>{formatAnalyticsMoney(totalExpenses)}</Td>
                    <Td numeric>100%</Td>
                    <Td numeric>{formatHoursWithDecimal(totalOwnSeconds)}</Td>
                    <Td numeric>{formatHoursWithDecimal(totalSupervisedSeconds)}</Td>
                  </tr>
                </TFoot>
              </Table>
            </TableContainer>
          </div>
        </div>
      )}

      <ExportDataModal
        isOpen={isExportModalOpen}
        title='Выгрузка отчёта'
        notice='Выгрузка учитывает период, применённые фильтры и поиск по ФИО. Часы в сотых долях: 1:30 → 1,5.'
        isExportDisabled={visibleEmployees.length === 0}
        onClose={() => setIsExportModalOpen(false)}
        onExportXlsx={exportXlsx}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
      />
    </section>
  );
}
