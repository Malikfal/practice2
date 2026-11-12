import { useRef, type MouseEvent } from 'react';

import { useEscapeToClose } from '../../../../../../../hooks/useEscapeToClose';
import type { EmployeeRate } from '../../../../../../../types/app';
import Button from '../../../../../../ui/Button';
import {
  Table,
  TableContainer,
  TableEmptyRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../../../../ui/table';

import {
  HOURS_SCOPE_LABELS,
  PROJECT_HOURS_TYPE_LABELS,
  RANGE_METHOD_LABELS,
  RATE_TYPES,
} from './constants';
import {
  formatChanger,
  formatDate,
  formatMoney,
  formatRangeLabel,
  getRateSetting,
  getSimpleRateValue,
  normalizeSalaryDistributionScope,
} from './payrollUtils';

export function EmployeeRateDetailsModal({
  rate,
  title = 'Детали ставки',
  onClose,
}: {
  rate: EmployeeRate | null;
  title?: string;
  onClose: () => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  useEscapeToClose(onClose, Boolean(rate));

  if (!rate) return null;

  return (
    <div
      className='fixed inset-0 z-[1001] grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'
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
              {title}
            </h2>
            <p className='mt-1 text-[13px] text-[#7e8fb4]'>
              Действует с {formatDate(rate.effective_from)}
            </p>
          </div>
          <button
            type='button'
            className='grid size-8 shrink-0 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-[18px] leading-none text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
            onClick={onClose}
            aria-label='Закрыть детали ставки'
            title='Закрыть'
          >
            x
          </button>
        </div>

        <div className='grid min-w-0 gap-4 overflow-auto p-3 md:px-5 md:py-4'>
          <div className='grid gap-2 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 text-[13px] text-[#1f3565] md:grid-cols-3'>
            <div>
              <p className='text-[11px] font-semibold text-[#7e8fb4]'>Дата изменения</p>
              <p className='mt-1 font-semibold text-[#10275a]'>
                {formatDate(rate.created_at)}
              </p>
            </div>
            <div>
              <p className='text-[11px] font-semibold text-[#7e8fb4]'>Кем изменено</p>
              <p className='mt-1 font-semibold text-[#10275a]'>{formatChanger(rate)}</p>
            </div>
            <div>
              <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                Не учитывать как подконтрольные
              </p>
              <p className='mt-1 font-semibold text-[#10275a]'>
                {rate.exclude_from_supervised_hours ? 'Да' : 'Нет'}
              </p>
            </div>
          </div>

          <div className='grid gap-3'>
            {RATE_TYPES.map((rateType) => {
              const setting = getRateSetting(rate, rateType.value);
              const isAdvanced = Boolean(setting?.is_advanced);

              return (
                <section
                  key={rateType.value}
                  className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'
                >
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <h3 className='text-[15px] font-semibold text-[#10275a]'>
                      {rateType.label}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                        isAdvanced
                          ? 'bg-[#edf3ff] text-[#2d6ff7]'
                          : 'bg-slate-50 text-[#7e8fb4]'
                      }`}
                    >
                      {isAdvanced ? 'Продвинутая ставка' : 'Обычная ставка'}
                    </span>
                  </div>

                  {!isAdvanced || !setting ? (
                    <div className='grid gap-2 md:grid-cols-2'>
                      <div>
                        <p className='text-[11px] font-semibold text-[#7e8fb4]'>Ставка</p>
                        <p className='mt-1 text-[17px] font-bold text-[#10275a]'>
                          {formatMoney(getSimpleRateValue(rate, rateType.value))}
                        </p>
                      </div>
                      {rateType.value === 'WEEKLY_SALARY' ? (
                        <div>
                          <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                            Распределять оклад по часам
                          </p>
                          <p className='mt-1 font-bold text-[#10275a]'>
                            {
                              HOURS_SCOPE_LABELS[
                                normalizeSalaryDistributionScope(
                                  rate.salary_distribution_scope,
                                ) || 'OWN'
                              ]
                            }
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className='grid gap-3'>
                      <div
                        className={`grid gap-2 ${
                          rateType.value === 'WEEKLY_SALARY'
                            ? 'md:grid-cols-4'
                            : 'md:grid-cols-3'
                        }`}
                      >
                        <div>
                          <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                            Стандартная ставка
                          </p>
                          <p className='mt-1 font-bold text-[#10275a]'>
                            {formatMoney(setting.default_rate)}
                          </p>
                        </div>
                        {rateType.value === 'WEEKLY_SALARY' ? (
                          <div>
                            <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                              Распределять оклад по часам
                            </p>
                            <p className='mt-1 font-bold text-[#10275a]'>
                              {
                                HOURS_SCOPE_LABELS[
                                  normalizeSalaryDistributionScope(
                                    rate.salary_distribution_scope,
                                  ) || 'OWN'
                                ]
                              }
                            </p>
                          </div>
                        ) : null}
                        <div>
                          <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                            Какие часы учитывать в диапазонах
                          </p>
                          <p className='mt-1 font-bold text-[#10275a]'>
                            {HOURS_SCOPE_LABELS[setting.hours_scope]}
                          </p>
                        </div>
                        <div>
                          <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                            Логика диапазонов
                          </p>
                          <p className='mt-1 font-bold text-[#10275a]'>
                            {RANGE_METHOD_LABELS[setting.range_calculation_method]}
                          </p>
                        </div>
                      </div>

                      <div className='grid gap-2 md:hidden'>
                        {setting.ranges.length ? (
                          setting.ranges.map((range, index) => (
                            <article
                              key={`${range.project_hours_type}:${range.from_hours}:${range.to_hours}:${index}`}
                              className='grid grid-cols-2 gap-2 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 text-xs'
                            >
                              <div className='col-span-2 font-semibold text-[#10275a]'>
                                {PROJECT_HOURS_TYPE_LABELS[range.project_hours_type]}
                              </div>
                              <div>
                                <p className='text-[#7e8fb4]'>Диапазон</p>
                                <p className='mt-0.5 font-medium text-[#1f3565]'>
                                  {formatRangeLabel(range.from_hours, range.to_hours)}
                                </p>
                              </div>
                              <div className='text-right'>
                                <p className='text-[#7e8fb4]'>Ставка</p>
                                <p className='mt-0.5 font-semibold text-[#10275a]'>
                                  {formatMoney(range.rate)}
                                </p>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className='rounded-xl border border-[#e3e9f3] p-3 text-center text-sm text-[#7e8fb4]'>
                            Диапазоны не настроены.
                          </div>
                        )}
                      </div>

                      <TableContainer className='hidden md:block'>
                        <Table density='compact' className='min-w-[560px]'>
                          <THead>
                            <tr>
                              <Th>Проекты</Th>
                              <Th>Диапазон</Th>
                              <Th numeric>Ставка</Th>
                            </tr>
                          </THead>
                          <TBody>
                            {setting.ranges.length ? (
                              setting.ranges.map((range, index) => (
                                <Tr
                                  key={`${range.project_hours_type}:${range.from_hours}:${range.to_hours}:${index}`}
                                >
                                  <Td className='font-semibold text-[#10275a]'>
                                    {PROJECT_HOURS_TYPE_LABELS[range.project_hours_type]}
                                  </Td>
                                  <Td>
                                    {formatRangeLabel(range.from_hours, range.to_hours)}
                                  </Td>
                                  <Td numeric className='font-semibold'>
                                    {formatMoney(range.rate)}
                                  </Td>
                                </Tr>
                              ))
                            ) : (
                              <TableEmptyRow>Диапазоны не настроены.</TableEmptyRow>
                            )}
                          </TBody>
                        </Table>
                      </TableContainer>
                    </div>
                  )}

                  {setting?.project_rates?.length ? (
                    <div className='grid gap-2'>
                      <p className='text-[11px] font-semibold text-[#7e8fb4]'>
                        Отдельная ставка по проектам
                      </p>
                      <div className='grid gap-1 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2'>
                        {setting.project_rates.map((projectRate) => (
                          <div
                            key={projectRate.project_id}
                            className='flex items-start justify-between gap-3 px-1 py-1 text-sm'
                          >
                            <span className='min-w-0 break-words font-semibold text-[#10275a]'>
                              {projectRate.project_name || 'Проект не найден'}
                            </span>
                            <span className='shrink-0 font-semibold text-[#1f3565]'>
                              {formatMoney(projectRate.rate)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>

        <div className='flex justify-end border-t border-[#e3e9f3] p-3 md:px-5'>
          <Button type='button' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
