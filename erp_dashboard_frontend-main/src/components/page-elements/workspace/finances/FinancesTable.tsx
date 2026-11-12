import { Fragment } from 'react';

import {
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TableMessageRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../ui/table';
import type { TableDensity } from '../../../ui/table';
import { formatDateLocal } from '../../../../utils/formatters';
import type {
  Finance,
  FinanceSource,
  PlannedExpensePayment,
} from '../../../../types/app';
import {
  financeToForm,
  FINANCE_TYPE_LABELS,
  formatFinanceCurrency,
  formatFinanceEmployeeName,
  joinClassNames,
} from './financeUtils';
import type { FinanceForm } from './types';

type Props = {
  finances: Finance[];
  plannedExpenses?: PlannedExpensePayment[];
  isLoading: boolean;
  isLoadingPlannedExpenses?: boolean;
  canManage: boolean;
  selectedFinanceIds: string[];
  groupBy?: FinanceTableGroupBy;
  showTypeColumn?: boolean;
  /** `compact` — во вкладках карточек клиента и проекта. */
  density?: TableDensity;
  onSelectedFinanceIdsChange: (_ids: string[]) => void;
  onEditFinance: (_financeId: string, _form: FinanceForm) => void;
  onDeleteFinance: (_finance: Finance) => void;
};

export type FinanceTableGroupBy = 'week' | 'month';

const FINANCE_SOURCE_LABELS: Record<FinanceSource, string> = {
  PAYROLL_DAILY: 'Ежедневное начисление зарплаты',
  PAYROLL_RECALCULATION: 'Перерасчёт зарплаты',
  MANUAL: 'Ручное начисление',
  IMPORT: 'Импортированный платеж',
};

const FINANCE_SOURCE_CLASSES: Record<FinanceSource, string> = {
  PAYROLL_DAILY: 'bg-blue-50 text-blue-700',
  PAYROLL_RECALCULATION: 'bg-violet-50 text-violet-700',
  MANUAL: 'bg-slate-100 text-slate-700',
  IMPORT: 'bg-amber-50 text-amber-700',
};

function parsePaymentDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function getGroupMeta(finance: Finance, groupBy: FinanceTableGroupBy) {
  const date = parsePaymentDate(finance.dateOfPayment);

  if (groupBy === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);

    return {
      key: toInputDate(start),
      label: start.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      }),
    };
  }

  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return {
    key: toInputDate(start),
    label: `${formatShortDate(start)} - ${formatShortDate(end)}`,
  };
}

function groupFinances(finances: Finance[], groupBy: FinanceTableGroupBy) {
  const groups = new Map<
    string,
    { key: string; label: string; income: number; expenses: number; items: Finance[] }
  >();

  finances.forEach((finance) => {
    const meta = getGroupMeta(finance, groupBy);
    const group = groups.get(meta.key) ?? {
      ...meta,
      income: 0,
      expenses: 0,
      items: [],
    };

    if (finance.type === 'ENTRANCE') {
      group.income += finance.amount;
    } else {
      group.expenses += finance.amount;
    }

    group.items.push(finance);
    groups.set(group.key, group);
  });

  return [...groups.values()].sort((left, right) => right.key.localeCompare(left.key));
}

export default function FinancesTable({
  finances,
  plannedExpenses = [],
  isLoading,
  isLoadingPlannedExpenses = false,
  canManage,
  selectedFinanceIds,
  groupBy,
  showTypeColumn = false,
  density = 'list',
  onSelectedFinanceIdsChange,
  onEditFinance,
  onDeleteFinance,
}: Props) {
  const visibleFinanceIds = finances.map((finance) => finance.id);
  const selectedSet = new Set(selectedFinanceIds);
  const selectedVisibleCount = visibleFinanceIds.filter((id) =>
    selectedSet.has(id),
  ).length;
  const isAllVisibleSelected =
    visibleFinanceIds.length > 0 && selectedVisibleCount === visibleFinanceIds.length;
  const isPartiallySelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleFinanceIds.length;
  // Строки-заголовки групп и плашка плановых расходов растягиваются на все колонки.
  const columnsCount = showTypeColumn ? 12 : 11;
  const groupedFinances = groupBy ? groupFinances(finances, groupBy) : [];
  const financeGroupByFirstItemId = new Map(
    groupedFinances
      .filter((group) => group.items[0])
      .map((group) => [group.items[0].id, group]),
  );

  const toggleAllVisible = () => {
    if (isAllVisibleSelected) {
      onSelectedFinanceIdsChange(
        selectedFinanceIds.filter((id) => !visibleFinanceIds.includes(id)),
      );
      return;
    }

    onSelectedFinanceIdsChange(
      Array.from(new Set([...selectedFinanceIds, ...visibleFinanceIds])),
    );
  };

  const toggleFinance = (financeId: string) => {
    if (selectedSet.has(financeId)) {
      onSelectedFinanceIdsChange(selectedFinanceIds.filter((id) => id !== financeId));
      return;
    }

    onSelectedFinanceIdsChange([...selectedFinanceIds, financeId]);
  };

  return (
    <TableContainer className='min-h-[360px] flex-none lg:min-h-0 lg:flex-1'>
      <Table className='min-w-340' density={density} striped={!groupBy}>
        <THead sticky>
          <tr>
            <Th align='center' className='w-10'>
              <input
                type='checkbox'
                aria-label='Выбрать все платежи'
                checked={isAllVisibleSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isPartiallySelected;
                }}
                disabled={!finances.length}
                onChange={toggleAllVisible}
              />
            </Th>
            <Th>Дата</Th>
            {showTypeColumn ? <Th>Тип</Th> : null}
            <Th>Проект</Th>
            <Th>Клиент</Th>
            <Th>Участник</Th>
            <Th numeric>Сумма</Th>
            <Th>Комментарий</Th>
            <Th>Статья</Th>
            <Th>Распределение</Th>
            <Th>Источник</Th>
            <Th align='center' className='w-24'>
              Действия
            </Th>
          </tr>
        </THead>
        <TBody>
          {isLoadingPlannedExpenses ? (
            <TableMessageRow className='bg-amber-50/70 py-3!'>
              <div className='mx-auto h-5 w-5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600' />
            </TableMessageRow>
          ) : null}

          {plannedExpenses.length > 0 ? (
            <tr className='bg-amber-50'>
              <td
                colSpan={columnsCount}
                className='border-b border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800'
              >
                Планируемые расходы — расчётные значения, не являющиеся реальными
                платежами
              </td>
            </tr>
          ) : null}

          {plannedExpenses.map((plannedExpense) => (
            <tr
              key={plannedExpense.id}
              className='bg-amber-50/60 transition-colors hover:bg-amber-100/70 [&>td]:border-amber-200/80'
            >
              <Td align='center' className='text-amber-600' title='Планируемый расход'>
                <svg
                  className='mx-auto size-5 fill-none stroke-current stroke-[1.8]'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path d='M4 19V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11' />
                  <path d='M8 6V4m8 2V4M3 19h18M8 11h3m2 0h3m-8 4h3m2 0h3' />
                </svg>
              </Td>
              <Td>
                <div className='font-semibold whitespace-nowrap text-amber-900'>
                  до {formatDateLocal(`${plannedExpense.period_to}T00:00:00`)}
                </div>
              </Td>
              {showTypeColumn ? (
                <Td>
                  <span className='inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800'>
                    Расход
                  </span>
                </Td>
              ) : null}
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td numeric className='font-semibold text-amber-700'>
                - {formatFinanceCurrency(plannedExpense.amount)}
                <div className='mt-1 text-[10px] font-normal text-amber-700/80'>
                  {plannedExpense.fixed_amount !== null
                    ? 'Фиксированная сумма'
                    : `${plannedExpense.percentage ?? 0}% от ${formatFinanceCurrency(
                        plannedExpense.income_amount,
                      )}`}
                </div>
              </Td>
              <Td
                className='max-w-56 truncate'
                title={`${plannedExpense.formula_label}, ${plannedExpense.calculation_period_label.toLowerCase()}`}
              >
                {plannedExpense.formula_label},{' '}
                {plannedExpense.calculation_period_label.toLowerCase()}
              </Td>
              <Td>
                <div className='flex max-w-56 flex-wrap items-center gap-1.5'>
                  <span
                    className='max-w-44 truncate rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900'
                    title={plannedExpense.article.name}
                  >
                    {plannedExpense.article.name}
                  </span>
                  <span className='rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase'>
                    Планируемый
                  </span>
                </div>
              </Td>
              <Td>
                <div className='text-xs whitespace-nowrap text-amber-800'>
                  {formatDateLocal(`${plannedExpense.period_from}T00:00:00`)} —{' '}
                  {formatDateLocal(`${plannedExpense.period_to}T00:00:00`)}
                </div>
                <div className='mt-1 text-[10px] text-amber-700'>
                  {plannedExpense.calculation_period_label}
                </div>
              </Td>
              <Td>
                <span className='inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800'>
                  Планируемый
                </span>
              </Td>
              <Td align='center'>
                <span
                  className='inline-flex size-7 items-center justify-center rounded-md text-amber-600'
                  title='Редактируется в настройках планируемых расходов'
                >
                  <svg
                    className='size-4 fill-none stroke-current stroke-[1.8]'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <rect x='5' y='10' width='14' height='10' rx='2' />
                    <path d='M8 10V7a4 4 0 0 1 8 0v3' />
                  </svg>
                </span>
              </Td>
            </tr>
          ))}

          {isLoading ? (
            <TableLoadingRow />
          ) : finances.length ? (
            finances.map((finance) => {
              const articleName =
                finance.article?.name ??
                finance.type_label ??
                FINANCE_TYPE_LABELS[finance.type];
              const group = financeGroupByFirstItemId.get(finance.id);

              return (
                <Fragment key={finance.id}>
                  {groupBy && group ? (
                    <tr className='bg-[#f8fbff]'>
                      <Td colSpan={columnsCount}>
                        <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                          <span className='font-bold text-[#10275a]'>{group.label}</span>
                          <div className='flex flex-wrap items-center gap-2 font-semibold'>
                            <span className='rounded-full bg-emerald-50 px-2 py-1 text-emerald-700'>
                              Поступление: {formatFinanceCurrency(group.income)}
                            </span>
                            <span className='rounded-full bg-rose-50 px-2 py-1 text-rose-700'>
                              Расход: {formatFinanceCurrency(group.expenses)}
                            </span>
                          </div>
                        </div>
                      </Td>
                    </tr>
                  ) : null}
                  <Tr>
                    <Td align='center'>
                      <input
                        type='checkbox'
                        aria-label={`Выбрать ${articleName}`}
                        checked={selectedSet.has(finance.id)}
                        onChange={() => toggleFinance(finance.id)}
                      />
                    </Td>
                    <Td className='whitespace-nowrap'>
                      {formatDateLocal(`${finance.dateOfPayment}T00:00:00`)}
                    </Td>
                    {showTypeColumn ? (
                      <Td>
                        <span
                          className={joinClassNames(
                            'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                            finance.type === 'ENTRANCE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700',
                          )}
                        >
                          {FINANCE_TYPE_LABELS[finance.type]}
                        </span>
                      </Td>
                    ) : null}
                    <Td>
                      {finance.project ? (
                        <a
                          href={`/projects?project_id=${finance.project.id}`}
                          className='font-semibold text-[#2d6ff7] hover:underline'
                        >
                          {finance.project.name}
                        </a>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      {finance.project?.client ? (
                        <a
                          href={`/clients?client_id=${finance.project.client.id}`}
                          className='font-semibold text-[#2d6ff7] hover:underline'
                        >
                          {finance.project.client.name}
                        </a>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>{formatFinanceEmployeeName(finance.employee)}</Td>
                    <Td
                      numeric
                      className={joinClassNames(
                        'font-semibold',
                        finance.type === 'ENTRANCE'
                          ? 'text-emerald-600'
                          : 'text-rose-600',
                      )}
                    >
                      {finance.type === 'ENTRANCE' ? '+' : '-'}{' '}
                      {formatFinanceCurrency(finance.amount)}
                    </Td>
                    <Td className='max-w-56 truncate' title={finance.comment ?? ''}>
                      {finance.comment || '—'}
                    </Td>
                    <Td>
                      <span
                        className={joinClassNames(
                          'inline-flex max-w-52 truncate rounded-full px-2 py-1 text-xs font-semibold',
                          finance.type === 'ENTRANCE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700',
                        )}
                        title={articleName}
                      >
                        {articleName}
                      </span>
                    </Td>
                    <Td>
                      <div className='text-xs whitespace-nowrap text-[#1f3565]'>
                        {formatDateLocal(`${finance.distribution_from}T00:00:00`)} —{' '}
                        {formatDateLocal(`${finance.distribution_to}T00:00:00`)}
                      </div>
                      <div className='mt-1 text-[10px] text-[#7e8fb4]'>
                        {finance.distribution_method_label}
                      </div>
                      <div className='mt-1 text-[10px] whitespace-nowrap text-[#7e8fb4]'>
                        {finance.distribution_project_mode === 'SELECTED'
                          ? `Выбрано проектов: ${finance.distribution_project_ids.length}`
                          : (finance.distribution_project_mode_label ??
                            'Без распределения по проектам')}
                      </div>
                    </Td>
                    <Td>
                      {finance.source ? (
                        <span
                          className={joinClassNames(
                            'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                            FINANCE_SOURCE_CLASSES[finance.source],
                          )}
                        >
                          {FINANCE_SOURCE_LABELS[finance.source]}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td align='center'>
                      {canManage ? (
                        <TableActions>
                          <TableActionButton
                            label='Редактировать'
                            onClick={() =>
                              onEditFinance(finance.id, financeToForm(finance))
                            }
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M12 20h9' />
                              <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' />
                            </svg>
                          </TableActionButton>
                          <TableActionButton
                            label='Удалить'
                            tone='danger'
                            onClick={() => onDeleteFinance(finance)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M3 6h18' />
                              <path d='M8 6V4h8v2' />
                              <path d='M19 6l-1 14H6L5 6' />
                            </svg>
                          </TableActionButton>
                        </TableActions>
                      ) : (
                        <span className='text-[#7e8fb4]'>—</span>
                      )}
                    </Td>
                  </Tr>
                </Fragment>
              );
            })
          ) : plannedExpenses.length > 0 || isLoadingPlannedExpenses ? null : (
            <TableEmptyRow>Платежи не найдены</TableEmptyRow>
          )}
        </TBody>
      </Table>
    </TableContainer>
  );
}
