import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../../../../../api/api';
import { ApiRequestError } from '../../../../../../api/core/error';
import type {
  PayrollPayoutReport,
  PayrollPayoutReportQuery,
} from '../../../../../../types/payrollPayouts';
import DateRangeFields from '../../../../../ui/DateRangeFields';
import { Field, Select } from '../../../../../ui/FormField';
import {
  Table,
  TableContainer,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
} from '../../../../../ui/table';
import { PayrollEmployeeName } from '../PayrollEmployeeName';

import { PayoutSpinner } from './PayoutParts';
import { PayoutStartCard } from './PayoutStart';
import {
  employeeLabel,
  formatDate,
  formatMoney,
  KIND_LABELS,
  monthTitle,
} from './payoutUtils';

type ReportView = 'summary' | 'list';

function articleName(article: { name: string | null; is_archived: boolean }) {
  return `${article.name ?? 'Без статьи'}${article.is_archived ? ' (архив)' : ''}`;
}

// Отчёт по выплатам: сколько выплачено по каким статьям и каким сотрудникам за период.
export default function PayrollPayoutsReportPanel({
  canManage,
  monthHref,
}: {
  canManage: boolean;
  /** Адрес ведомости за месяц с раскрытой строкой сотрудника. */
  monthHref: (_month: string, _employeeId: string) => string;
}) {
  const [query, setQuery] = useState<PayrollPayoutReportQuery>({});
  const [report, setReport] = useState<PayrollPayoutReport | null>(null);
  const [view, setView] = useState<ReportView>('summary');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setReport(await api.workspace.payrollPayouts.getReport(query));
    } catch (loadError) {
      setError(
        loadError instanceof ApiRequestError && loadError.status === 403
          ? 'У вас нет доступа к отчёту по выплатам.'
          : loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить отчёт по выплатам.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  // Сумма выплат сотрудника по статье для сводной таблицы.
  const cells = useMemo(() => {
    const result = new Map<string, number>();
    for (const row of report?.rows ?? []) {
      const key = `${row.employee_id}:${row.article.id}`;
      result.set(key, (result.get(key) ?? 0) + row.amount);
    }
    return result;
  }, [report]);

  if (!report) {
    return (
      <div className='min-h-0 rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] md:p-4'>
        {isLoading ? (
          <PayoutSpinner />
        ) : (
          <div className='my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {error}
          </div>
        )}
      </div>
    );
  }

  if (!report.start_month) {
    return <PayoutStartCard canManage={canManage} onSaved={() => void load()} />;
  }

  const hasFilters = Boolean(query.employee_id || query.article_id);

  return (
    <div className='grid min-w-0 gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] md:p-4'>
      <div className='flex flex-wrap items-end gap-x-3 gap-y-2'>
        <DateRangeFields
          from={query.from ?? report.from}
          to={query.to ?? report.to}
          fromLabel='Дата выплаты: с'
          toLabel='по'
          required
          commitCompleteRange
          className='w-full sm:w-72 [&_button]:h-9! [&_button]:px-2.5 [&_button]:text-sm'
          onChange={(from, to) => setQuery((current) => ({ ...current, from, to }))}
        />
        <Field label='Сотрудник' className='w-full sm:w-56'>
          <Select
            className='h-9! text-sm'
            value={query.employee_id ?? ''}
            onChange={(event) =>
              setQuery((current) => ({
                ...current,
                employee_id: event.target.value || undefined,
              }))
            }
          >
            <option value=''>Все сотрудники</option>
            {report.filters.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employeeLabel(employee)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label='Статья' className='w-full sm:w-56'>
          <Select
            className='h-9! text-sm'
            value={query.article_id ?? ''}
            onChange={(event) =>
              setQuery((current) => ({
                ...current,
                article_id: event.target.value || undefined,
              }))
            }
          >
            <option value=''>Все статьи</option>
            {report.filters.articles.map((article) => (
              <option key={article.id} value={article.id}>
                {articleName(article)}
              </option>
            ))}
          </Select>
        </Field>
        {hasFilters ? (
          <button
            type='button'
            className='h-9 text-sm font-semibold text-[#2d6ff7] hover:underline'
            onClick={() =>
              setQuery((current) => ({ from: current.from, to: current.to }))
            }
          >
            Сбросить фильтры
          </button>
        ) : null}
        <div
          className='flex overflow-hidden rounded-lg border border-[#d7e1f1] bg-white lg:ml-auto'
          role='group'
          aria-label='Вид отчёта'
        >
          {(
            [
              ['summary', 'Сводная'],
              ['list', 'Все выплаты'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type='button'
              aria-pressed={view === value}
              className={`border-r border-[#e3e9f3] px-3 py-2 text-sm font-semibold last:border-r-0 ${
                view === value
                  ? 'bg-[#edf3ff] text-[#2d6ff7]'
                  : 'text-[#7e8fb4] hover:text-[#1f3565]'
              }`}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <dl className='flex flex-wrap items-end gap-x-7 gap-y-2.5 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3.5 py-3'>
        <div>
          <dt className='text-xs text-[#7e8fb4]'>Выплачено</dt>
          <dd className='text-[17px] font-semibold text-[#10275a] tabular-nums'>
            {formatMoney(report.total.amount)}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-[#7e8fb4]'>Выплат</dt>
          <dd className='text-[17px] font-semibold text-[#10275a] tabular-nums'>
            {report.total.count}
          </dd>
        </div>
        {report.by_article.map((item) => (
          <div key={item.article.id}>
            <dt className='text-xs text-[#7e8fb4]'>{articleName(item.article)}</dt>
            <dd className='font-semibold text-[#1f3565] tabular-nums'>
              {formatMoney(item.amount)}
            </dd>
          </div>
        ))}
      </dl>

      <p className='text-sm text-[#7e8fb4]'>
        Выплаты с {formatDate(report.from)} по {formatDate(report.to)} по дате выплаты.
        Месяц ведомости может отличаться: расчёт за месяц обычно выдают в следующем.
      </p>

      {error ? (
        <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <PayoutSpinner />
      ) : report.rows.length === 0 ? (
        <div className='grid min-h-40 place-items-center text-sm text-[#7e8fb4]'>
          За выбранный период выплат нет.
        </div>
      ) : view === 'summary' ? (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th pin='left'>Сотрудник</Th>
                {report.by_article.map((item) => (
                  <Th key={item.article.id} numeric>
                    {articleName(item.article)}
                  </Th>
                ))}
                <Th numeric>Итого</Th>
              </tr>
            </THead>
            <TBody>
              {report.by_employee.map((item) => (
                <Tr key={item.employee.id}>
                  <Td pin='left'>
                    <PayrollEmployeeName
                      name={employeeLabel(item.employee)}
                      isArchived={item.employee.is_archived}
                      className='min-w-40'
                    />
                  </Td>
                  {report.by_article.map((article) => {
                    const amount = cells.get(`${item.employee.id}:${article.article.id}`);

                    return (
                      <Td
                        key={article.article.id}
                        numeric
                        className={amount ? undefined : 'text-[#b4c0d9]'}
                      >
                        {amount ? formatMoney(amount) : '—'}
                      </Td>
                    );
                  })}
                  <Td numeric className='font-semibold text-[#10275a]'>
                    {formatMoney(item.amount)}
                  </Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <tr>
                <Td pin='left'>Итого: {report.by_employee.length}</Td>
                {report.by_article.map((item) => (
                  <Td key={item.article.id} numeric>
                    {formatMoney(item.amount)}
                  </Td>
                ))}
                <Td numeric>{formatMoney(report.total.amount)}</Td>
              </tr>
            </TFoot>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer>
          <Table className='min-w-215'>
            <THead>
              <tr>
                <Th>Дата выплаты</Th>
                <Th>Ведомость</Th>
                <Th>Сотрудник</Th>
                <Th>Статья</Th>
                <Th>Вид</Th>
                <Th numeric>Сумма</Th>
                <Th>Комментарий</Th>
              </tr>
            </THead>
            <TBody>
              {report.rows.map((row) => (
                // Комментарий переносится на несколько строк, остальные ячейки прижаты к верху.
                <Tr key={row.id} className='[&>td]:align-top'>
                  <Td className='whitespace-nowrap tabular-nums'>
                    {formatDate(row.paid_at)}
                  </Td>
                  <Td>
                    <Link
                      to={monthHref(row.month, row.employee_id)}
                      replace
                      className='font-semibold whitespace-nowrap text-[#2d6ff7] hover:underline'
                      title='Открыть ведомость за этот месяц'
                    >
                      {monthTitle(row.month)}
                    </Link>
                  </Td>
                  <Td className='font-semibold text-[#10275a]'>
                    {row.employee ? employeeLabel(row.employee) : 'Сотрудник'}
                  </Td>
                  <Td>{row.article.name ?? 'Без статьи'}</Td>
                  <Td>{KIND_LABELS[row.kind]}</Td>
                  <Td numeric className='font-semibold text-[#10275a]'>
                    {formatMoney(row.amount)}
                  </Td>
                  <Td className='text-[#7e8fb4]'>{row.comment || '—'}</Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <tr>
                <Td colSpan={5}>Итого: {report.total.count}</Td>
                <Td numeric>{formatMoney(report.total.amount)}</Td>
                <Td />
              </tr>
            </TFoot>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
