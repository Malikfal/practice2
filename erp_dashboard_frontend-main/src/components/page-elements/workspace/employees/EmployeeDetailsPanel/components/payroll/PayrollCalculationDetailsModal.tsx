import { useRef, type MouseEvent, type ReactNode } from 'react';

import type {
  EmployeePayrollCalculationRow,
  PayrollFormula,
  PayrollFormulaRegularLine,
} from '../../../../../../../types/app';
import Button from '../../../../../../ui/Button';
import {
  Table,
  TableContainer,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
} from '../../../../../../ui/table';

import { PROJECT_HOURS_TYPE_LABELS } from './constants';
import { PayrollIcon } from './PayrollIcon';
import {
  formatFormulaRangeList,
  formatHours,
  formatMoney,
  formatPeriod,
  formatRangeLabel,
  getRangeMethodLabel,
  getRateTypeLabel,
  rowTotalSeconds,
} from './payrollUtils';
import { HintToolTip } from '../../../../../../ui/HintTooltip';

export function PayrollCalculationDetailsModal({
  row,
  employeeName,
  onClose,
}: {
  row: EmployeePayrollCalculationRow | null;
  employeeName?: string;
  onClose: () => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);

  if (!row) return null;

  const formulas = row.formulas ?? [];
  const detailsTotal = row.details.reduce(
    (acc, detail) => ({
      own_seconds: acc.own_seconds + detail.own_seconds,
      duration_seconds: acc.duration_seconds + detail.duration_seconds,
      supervised_seconds: acc.supervised_seconds + detail.supervised_seconds,
      amount_kopecks: acc.amount_kopecks + detail.amount_kopecks,
    }),
    {
      own_seconds: 0,
      duration_seconds: 0,
      supervised_seconds: 0,
      amount_kopecks: 0,
    },
  );

  const projectRateLines = formulas.flatMap((formula) =>
    (formula.project_rates ?? []).map((projectRate) => ({ formula, projectRate })),
  );
  const regularLines = formulas.flatMap((formula) =>
    (formula.regular_lines ?? []).map((line) => ({ formula, line })),
  );

  const downloadCalculation = () => {
    const lines = [
      `Расчет за неделю ${formatPeriod(row.period_from, row.period_to)}`,
      `Общие часы: ${formatHours(rowTotalSeconds(row))}`,
      `Часы под контролем: ${formatHours(row.supervised_seconds)}`,
      `Сумма: ${formatMoney(row.amount_kopecks)}`,
      '',
      'Проект;Собственные часы;Часы под контролем;Всего часов;Сумма',
      ...row.details.map((detail) =>
        [
          detail.project_name ?? 'Без проекта',
          formatHours(detail.own_seconds),
          formatHours(detail.supervised_seconds),
          formatHours(detail.duration_seconds),
          formatMoney(detail.amount_kopecks),
        ].join(';'),
      ),
      ...(regularLines.length
        ? [
            '',
            'Обычные часы;Тип ставки;Часы;Ставка;Сумма',
            ...regularLines.map(({ formula, line }) =>
              [
                regularLineLabel(formula, line),
                getRateTypeLabel(formula.rate_type),
                formatHours(line.hours_seconds),
                formatMoney(line.rate_kopecks),
                formatMoney(line.amount_kopecks),
              ].join(';'),
            ),
          ]
        : []),
      ...(projectRateLines.length
        ? [
            '',
            'Отдельная ставка по проекту;Тип ставки;Часы;Ставка;Сумма',
            ...projectRateLines.map(({ formula, projectRate }) =>
              [
                projectRate.project_name,
                getRateTypeLabel(formula.rate_type),
                formatHours(projectRate.hours_seconds),
                formatMoney(projectRate.rate_kopecks),
                formatMoney(projectRate.amount_kopecks),
              ].join(';'),
            ),
          ]
        : []),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-${row.period_from}-${row.period_to}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const summaryCards = [
    {
      label: 'Общие часы',
      value: formatHours(rowTotalSeconds(row)),
      icon: 'clock' as const,
      valueClassName: 'text-[#10275a]',
      hint: 'Суммарное время, учтённое по всем проектам сотрудника за неделю',
    },
    {
      label: 'Часы под контролем',
      value: formatHours(row.supervised_seconds),
      icon: 'shield' as const,
      valueClassName: 'text-[#10275a]',
      hint: 'Часы сотрудников, которыми руководит данный сотрудник. Учитываются в расчёте ставки «За часы под контролем».',
    },
    {
      label: 'Итог',
      value: formatMoney(row.amount_kopecks),
      icon: 'calculator' as const,
      valueClassName: 'text-[#10275a]',
    },
  ];

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose) onClose();
      }}
    >
      <div
        className='flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white shadow-2xl shadow-slate-900/20 md:max-h-[92vh] md:rounded-2xl'
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <div className='flex items-start justify-between gap-3 border-b border-[#e3e9f3] p-3 md:px-5 md:py-4'>
          <div>
            <h2 className='text-lg leading-tight font-semibold text-[#10275a] md:text-[22px]'>
              Детали расчета за неделю
            </h2>
            <p className='mt-1 text-[13px] text-[#7e8fb4]'>
              {employeeName ? `${employeeName} · ` : null}
              {formatPeriod(row.period_from, row.period_to)}
            </p>
          </div>
          <button
            type='button'
            className='grid size-8 shrink-0 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-[18px] leading-none text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
            onClick={onClose}
            aria-label='Закрыть детали расчета'
            title='Закрыть'
          >
            x
          </button>
        </div>

        <div className='grid min-w-0 gap-4 overflow-auto p-3 md:px-5 md:py-4'>
          <div className='grid grid-cols-2 gap-2 lg:grid-cols-5'>
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className='rounded-lg border border-[#e3e9f3] bg-white px-3 py-3 shadow-sm shadow-[#10275a]/5'
              >
                <div className='flex items-center gap-2 text-[11px] font-semibold leading-tight text-[#1f3565]'>
                  <span className='grid size-5 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#2d6ff7]'>
                    <PayrollIcon name={card.icon} />
                  </span>
                  {card.label}
                  {card.hint ? <HintToolTip content={card.hint} /> : null}
                </div>
                <p
                  className={`mt-3 text-[17px] leading-none font-bold ${card.valueClassName}`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <section className='grid gap-3'>
            <h3 className='text-[16px] font-semibold text-[#10275a]'>
              Примененная формула
            </h3>
            {formulas.length ? (
              <div className='grid gap-2'>
                {formulas.map((formula, formulaIndex) => {
                  const reachedRanges = formula.reached_ranges.length
                    ? formula.reached_ranges
                    : formula.reached_range
                      ? [formula.reached_range]
                      : [];
                  const baseRate = formula.is_advanced
                    ? formula.default_rate_kopecks
                    : formula.base_rate_kopecks;

                  return (
                    <article
                      key={`${formula.rate_type}:${formula.rate_id ?? formulaIndex}`}
                      className='grid gap-3 rounded-lg border border-[#e3e9f3] bg-white px-3 py-3'
                    >
                      <div className='grid gap-3 md:grid-cols-[1.2fr_1fr_1.7fr_1.3fr]'>
                        <div>
                          <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                            Тип ставки
                          </p>
                          <p className='mt-1 text-[13px] font-bold leading-tight text-[#10275a]'>
                            {getRateTypeLabel(formula.rate_type)}
                          </p>
                          <p className='mt-1 text-[11px] text-[#7e8fb4]'>
                            База: {formatMoney(baseRate)}
                          </p>
                        </div>
                        <div>
                          <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                            Режим
                          </p>
                          <p className='mt-1 flex items-center gap-1.5 text-[13px] font-bold leading-tight text-[#10275a]'>
                            <span className='text-[#2d6ff7]'>
                              <PayrollIcon name='swap' />
                            </span>
                            {formula.is_advanced
                              ? 'Расширенная формула'
                              : 'Обычная ставка'}
                          </p>
                        </div>
                        <div>
                          <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                            Логика диапазонов
                          </p>
                          <p className='mt-1 text-[13px] font-bold leading-tight text-[#10275a]'>
                            {getRangeMethodLabel(formula.range_calculation_method)}
                          </p>
                          <p className='mt-1 text-[11px] text-[#7e8fb4]'>
                            Часы: {formatHours(formula.calculation_hours_seconds)}
                          </p>
                        </div>
                        <div>
                          <div className='flex items-center gap-1.5 text-[11px] font-semibold text-[#7e8fb4]'>
                            Достигнутый диапазон
                            <HintToolTip content='Диапазон часов, в который попал сотрудник по итогам недели. Определяет применяему ставку.' />
                          </div>
                          <p className='mt-1 inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-bold leading-tight text-emerald-700'>
                            {formatFormulaRangeList(
                              reachedRanges,
                              formula.default_rate_kopecks,
                            )}
                          </p>
                        </div>
                      </div>

                      <FormulaCalculation formula={formula} />
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className='rounded-xl border border-[#e3e9f3] bg-white p-3 text-[13px] text-[#7e8fb4]'>
                Формулы расчета не переданы API.
              </div>
            )}
            <div className='rounded-lg bg-[#edf3ff] px-3 py-2 text-[12px] leading-relaxed text-[#1f3565]'>
              В итоговую сумму входят все расходные финансы сотрудника за период.
              Финансовые операции можно сверить по связанным идентификаторам.
            </div>
          </section>

          <section className='grid gap-3'>
            <h3 className='text-[16px] font-semibold text-[#10275a]'>
              Распределение по проектам
            </h3>
            <div className='grid gap-2 md:hidden'>
              {row.details.map((detail) => (
                <article
                  key={detail.project_id}
                  className='grid gap-2 rounded-xl border border-[#e3e9f3] bg-white p-3 text-xs'
                >
                  <div className='flex items-start justify-between gap-3'>
                    <p className='min-w-0 break-words font-semibold text-[#10275a]'>
                      {detail.project_name ?? 'Без проекта'}
                    </p>
                    <p className='shrink-0 font-semibold text-[#10275a]'>
                      {formatMoney(detail.amount_kopecks)}
                    </p>
                  </div>
                  <div className='grid grid-cols-2 gap-2 text-[#66728d]'>
                    <span>Свои: {formatHours(detail.own_seconds)}</span>
                    <span>Под контролем: {formatHours(detail.supervised_seconds)}</span>
                  </div>
                </article>
              ))}
              <div className='grid grid-cols-2 gap-2 rounded-xl bg-[#fbfcff] p-3 text-xs font-semibold text-[#10275a]'>
                <span>Итого часов</span>
                <span className='text-right'>{formatHours(rowTotalSeconds(row))}</span>
                <span>Итого сумма</span>
                <span className='text-right'>
                  {formatMoney(detailsTotal.amount_kopecks || row.amount_kopecks)}
                </span>
              </div>
            </div>

            <TableContainer className='hidden md:block'>
              <Table density='compact' className='min-w-[680px]'>
                <THead>
                  <tr>
                    <Th>Проект</Th>
                    <Th numeric>Собственные часы</Th>
                    <Th numeric>Часы под контролем</Th>
                    <Th numeric>Сумма</Th>
                  </tr>
                </THead>
                <TBody>
                  {row.details.map((detail) => (
                    <Tr key={detail.project_id}>
                      <Td className='font-semibold text-[#10275a]'>
                        {detail.project_name ?? 'Без проекта'}
                      </Td>
                      <Td numeric>{formatHours(detail.own_seconds)}</Td>
                      <Td numeric>{formatHours(detail.supervised_seconds)}</Td>
                      <Td numeric className='font-semibold'>
                        {formatMoney(detail.amount_kopecks)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
                <TFoot>
                  <tr>
                    <Td>Итого</Td>
                    <Td numeric>
                      {formatHours(detailsTotal.own_seconds || row.own_seconds)}
                    </Td>
                    <Td numeric>
                      {formatHours(
                        detailsTotal.supervised_seconds || row.supervised_seconds,
                      )}
                    </Td>
                    <Td numeric>
                      {formatMoney(detailsTotal.amount_kopecks || row.amount_kopecks)}
                    </Td>
                  </tr>
                </TFoot>
              </Table>
            </TableContainer>
          </section>
        </div>

        <div className='grid gap-2 border-t border-[#e3e9f3] p-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between md:px-5'>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Назад
          </Button>
          <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={downloadCalculation}
            >
              Скачать расчет
            </Button>
            <Button type='button' size='sm' onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function regularLineLabel(formula: PayrollFormula, line: PayrollFormulaRegularLine) {
  if (line.from_hours === null) return 'По базовой ставке';

  const range = formatRangeLabel(line.from_hours, line.to_hours);

  return formula.split_by_project_type
    ? `${PROJECT_HOURS_TYPE_LABELS[line.project_hours_type]}, ${range}`
    : range;
}

function CalculationLine({
  label,
  value,
  muted = false,
}: {
  label: ReactNode;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`grid gap-0.5 text-[13px] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-3 ${
        muted ? 'text-[#7e8fb4]' : 'text-[#1f3565]'
      }`}
    >
      <span
        className={`min-w-0 break-words ${muted ? '' : 'font-semibold text-[#10275a]'}`}
      >
        {label}
      </span>
      <span className='text-[12px] sm:text-right'>{value}</span>
    </div>
  );
}

function hoursTimesRate(seconds: number, rateKopecks: number, amountKopecks: number) {
  return (
    <>
      {formatHours(seconds)} x {formatMoney(rateKopecks)} ={' '}
      <b className='text-[#10275a]'>{formatMoney(amountKopecks)}</b>
    </>
  );
}

/** Расчет суммы по формуле: обычные часы по ставкам и часы проектов с отдельной ставкой. */
function FormulaCalculation({ formula }: { formula: PayrollFormula }) {
  const regularLines = formula.regular_lines ?? [];
  const projectRates = formula.project_rates ?? [];
  const previousPart = formula.previous_part ?? null;

  if (!regularLines.length && !projectRates.length) return null;

  const regularTotal = regularLines.reduce((sum, line) => sum + line.amount_kopecks, 0);

  return (
    <div className='grid gap-3 border-t border-[#e3e9f3] pt-2'>
      {regularLines.length ? (
        <div className='grid gap-1'>
          <div className='flex items-center gap-1.5 text-[11px] font-semibold text-[#7e8fb4]'>
            {previousPart && formula.regular_from && formula.regular_to
              ? `Обычные часы за неделю ${formatPeriod(formula.regular_from, formula.regular_to)}`
              : 'Обычные часы'}
            <HintToolTip
              content={
                previousPart
                  ? 'Неделя разделена концом месяца. Диапазон выбирается по часам всей недели, поэтому эта часть доводит начисление до суммы за неделю.'
                  : 'Часы без отдельной ставки проекта по ставкам формулы.'
              }
            />
          </div>
          {regularLines.map((line, index) => (
            <CalculationLine
              key={`${line.project_hours_type}:${line.from_hours}:${index}`}
              label={regularLineLabel(formula, line)}
              value={hoursTimesRate(
                line.hours_seconds,
                line.rate_kopecks,
                line.amount_kopecks,
              )}
            />
          ))}
          {previousPart ? (
            <>
              <CalculationLine
                muted
                label={`Начислено за ${formatPeriod(previousPart.from, previousPart.to)}`}
                value={`- ${formatMoney(previousPart.amount_kopecks)}`}
              />
              <CalculationLine
                label='В этой части'
                value={
                  <b className='text-[#10275a]'>
                    {formatMoney(regularTotal - previousPart.amount_kopecks)}
                  </b>
                }
              />
            </>
          ) : null}
        </div>
      ) : null}

      {projectRates.length ? (
        <div className='grid gap-1'>
          <div className='flex items-center gap-1.5 text-[11px] font-semibold text-[#7e8fb4]'>
            Отдельная ставка по проектам
            <HintToolTip content='Часы проекта учтены в диапазонах, но оплачены по ставке проекта.' />
          </div>
          {projectRates.map((projectRate) => (
            <CalculationLine
              key={projectRate.project_id}
              label={projectRate.project_name || 'Проект'}
              value={hoursTimesRate(
                projectRate.hours_seconds,
                projectRate.rate_kopecks,
                projectRate.amount_kopecks,
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
