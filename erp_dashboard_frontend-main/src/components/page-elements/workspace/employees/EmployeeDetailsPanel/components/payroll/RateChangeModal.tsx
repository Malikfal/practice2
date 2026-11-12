import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';

import { api } from '../../../../../../../api/api';
import { useEscapeToClose } from '../../../../../../../hooks/useEscapeToClose';
import type {
  EmployeeRateForm,
  EmployeeRateProjectRateForm,
  EmployeeRateSettingForm,
  EmployeeRateSettingRangeForm,
  EmployeeRateType,
  PayrollHoursScope,
  PayrollProjectHoursType,
  PayrollRangeCalculationMethod,
  SalaryDistributionScope,
} from '../../../../../../../types/app';

import { HintToolTip } from '../../../../../../ui/HintTooltip';
import Button from '../../../../../../ui/Button';
import { Field, Input, SearchableSelect } from '../../../../../../ui/FormField';

import {
  HOURS_SCOPE_LABELS,
  PROJECT_HOURS_TYPE_LABELS,
  RANGE_METHOD_LABELS,
  RATE_TYPES,
} from './constants';
import {
  createDefaultProjectRate,
  createDefaultRange,
  createDefaultRateSetting,
  numberFromInput,
} from './payrollUtils';

export type RateFieldErrors = Partial<Record<keyof EmployeeRateForm | 'rate', string>>;

/** Первый тип ставки, у которого задано значение или расширенная формула. */
function firstFilledRateType(form: EmployeeRateForm): EmployeeRateType {
  const simpleValues: Record<EmployeeRateType, string> = {
    WEEKLY_SALARY: form.salary,
    HOURLY: form.hourly_rate,
    SUPERVISED_HOURLY: form.supervised_hourly_rate,
    COMPANY_HOURLY: form.company_hourly_rate,
  };
  const filled = RATE_TYPES.find(({ value }) => {
    const setting = form.rate_settings.find((item) => item.rate_type === value);
    if (setting?.is_advanced) return true;
    return (numberFromInput(simpleValues[value] ?? '') ?? 0) > 0;
  });
  return filled?.value ?? 'WEEKLY_SALARY';
}

export function RateChangeModal({
  isOpen,
  form,
  initialRateType,
  isSaving,
  errors = {},
  isEditing = false,
  minEffectiveFrom,
  onFormChange,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  form: EmployeeRateForm;
  initialRateType?: EmployeeRateType;
  isSaving: boolean;
  errors?: RateFieldErrors;
  isEditing?: boolean;
  minEffectiveFrom?: string;
  onFormChange: (_form: EmployeeRateForm) => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  // Окно монтируется заново при каждом открытии, поэтому вкладка выбирается по открываемой
  // ставке: открывается тип, который задан, а не всегда «Оклад (неделя)».
  const [activeRateType, setActiveRateType] = useState<EmployeeRateType>(
    () => initialRateType ?? firstFilledRateType(form),
  );
  const { projects, isLoadingProjects } = useRateProjects(isOpen);
  useEscapeToClose(() => {
    if (!isSaving) onClose();
  }, isOpen);

  if (!isOpen) return null;

  const updateSetting = (
    rateType: EmployeeRateType,
    updater: (_setting: EmployeeRateSettingForm) => EmployeeRateSettingForm,
  ) => {
    onFormChange({
      ...form,
      rate_settings: form.rate_settings.map((setting) =>
        setting.rate_type === rateType ? updater(setting) : setting,
      ),
    });
  };

  const updateRange = (
    rateType: EmployeeRateType,
    rangeIndex: number,
    patch: Partial<EmployeeRateSettingRangeForm>,
  ) => {
    updateSetting(rateType, (setting) => ({
      ...setting,
      ranges: setting.ranges.map((range, index) =>
        index === rangeIndex ? { ...range, ...patch } : range,
      ),
    }));
  };

  const simpleRateValue = (rateType: EmployeeRateType) => {
    if (rateType === 'WEEKLY_SALARY') return form.salary;
    if (rateType === 'HOURLY') return form.hourly_rate;
    if (rateType === 'SUPERVISED_HOURLY') return form.supervised_hourly_rate;
    return form.company_hourly_rate;
  };

  const simpleRateError = (rateType: EmployeeRateType) => {
    if (rateType === 'WEEKLY_SALARY') return errors.salary;
    if (rateType === 'HOURLY') return errors.hourly_rate;
    if (rateType === 'SUPERVISED_HOURLY') return errors.supervised_hourly_rate;
    return errors.company_hourly_rate;
  };

  const updateSimpleRate = (rateType: EmployeeRateType, value: string) => {
    if (rateType === 'WEEKLY_SALARY') onFormChange({ ...form, salary: value });
    if (rateType === 'HOURLY') onFormChange({ ...form, hourly_rate: value });
    if (rateType === 'SUPERVISED_HOURLY') {
      onFormChange({ ...form, supervised_hourly_rate: value });
    }
    if (rateType === 'COMPANY_HOURLY') {
      onFormChange({ ...form, company_hourly_rate: value });
    }
  };

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

        if (shouldClose) {
          onClose();
        }
      }}
    >
      <div
        data-modal
        className='max-h-[calc(100dvh-1rem)] w-full max-w-5xl overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:max-h-[90vh] md:overflow-auto md:rounded-2xl md:p-4'
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
            {isEditing ? 'Изменение ставки' : 'Новая ставка'}
          </h2>
          <button
            type='button'
            className='grid size-8 shrink-0 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-[18px] leading-none text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
            onClick={onClose}
            aria-label='Закрыть окно изменения ставки'
            title='Закрыть'
          >
            x
          </button>
        </div>

        <form onSubmit={onSubmit} className='grid gap-3'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 text-[13px] font-semibold text-[#1f3565]'>
              Тип ставки
              <HintToolTip
                content={
                  <ul className='grid gap-1'>
                    <li>
                      <b>Оклад (неделя)</b> - фиксированная сумма за неделю.
                    </li>
                    <li>
                      <b>Ставка за час</b> - оплата за каждый собственный час сотрудника.
                    </li>
                    <li>
                      <b>За часы под контролем</b> - оплата за часы сотрудников, которыми
                      он руководит.
                    </li>
                    <li>
                      <b>За часы всей компании</b> - оплата за каждый час, отработанный
                      всей компанией.
                    </li>
                  </ul>
                }
              />
            </div>

            <div className='flex flex-wrap gap-2'>
              {RATE_TYPES.map((rateType) => {
                const isActive = activeRateType === rateType.value;

                return (
                  <button
                    key={rateType.value}
                    type='button'
                    className={`h-10 rounded-xl border px-4 text-[13px] font-semibold transition-colors ${
                      isActive
                        ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
                        : 'border-[#d7e1f1] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
                    }`}
                    onClick={() => setActiveRateType(rateType.value)}
                  >
                    {rateType.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className='grid gap-3'>
            {RATE_TYPES.filter((rateType) => rateType.value === activeRateType).map(
              (rateType) => {
                const setting =
                  form.rate_settings.find((item) => item.rate_type === rateType.value) ??
                  createDefaultRateSetting(rateType.value);
                const visibleRanges = setting.split_by_project_type
                  ? (['COMMERCIAL', 'INTERNAL'] as PayrollProjectHoursType[])
                  : (['ALL'] as PayrollProjectHoursType[]);

                return (
                  <section
                    key={rateType.value}
                    className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <h3 className='text-[15px] font-semibold text-[#10275a]'>
                        {rateType.label}
                      </h3>
                      <label className='flex items-center gap-2 text-sm font-semibold text-[#1f3565]'>
                        <input
                          type='checkbox'
                          checked={setting.is_advanced}
                          onChange={(event) =>
                            updateSetting(rateType.value, (current) => ({
                              ...current,
                              is_advanced: event.target.checked,
                              default_rate:
                                current.default_rate || simpleRateValue(rateType.value),
                              ranges: current.ranges.length
                                ? current.ranges
                                : [createDefaultRange()],
                            }))
                          }
                        />
                        <span>Расширенная формула</span>
                        <HintToolTip content='Позволяет задать разные ставки для разных диапазонов часов. Ежедневно начисления идут по стандартной ставке, в конце недели система пересчитывает и создаёт корректировку.' />
                      </label>
                    </div>

                    {!setting.is_advanced ? (
                      <div className='grid gap-3 md:grid-cols-2'>
                        <Field label={rateType.inputLabel}>
                          <Input
                            type='number'
                            min='0'
                            step='0.01'
                            value={simpleRateValue(rateType.value)}
                            placeholder='Не указано'
                            onChange={(event) =>
                              updateSimpleRate(rateType.value, event.target.value)
                            }
                            className='h-11 rounded-xl border-[#e3e9f3] text-base text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff] md:h-10 md:text-sm'
                          />
                          {simpleRateError(rateType.value) ? (
                            <span className='text-[12px] leading-tight text-rose-600'>
                              {simpleRateError(rateType.value)}
                            </span>
                          ) : null}
                        </Field>
                        {rateType.value === 'WEEKLY_SALARY' ? (
                          <Field label='Распределять оклад по часам'>
                            <select
                              value={form.salary_distribution_scope}
                              onChange={(event) =>
                                onFormChange({
                                  ...form,
                                  salary_distribution_scope: event.target
                                    .value as SalaryDistributionScope,
                                })
                              }
                              className='h-10 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[13px] text-[#1f3565] outline-none focus:border-[#2d6ff7] focus:ring-2 focus:ring-[#edf3ff]'
                            >
                              <option value='' disabled>
                                Не выбрано
                              </option>
                              {Object.entries(HOURS_SCOPE_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                            {errors.salary_distribution_scope ? (
                              <span className='text-[12px] leading-tight text-rose-600'>
                                {errors.salary_distribution_scope}
                              </span>
                            ) : null}
                          </Field>
                        ) : null}
                      </div>
                    ) : (
                      <div className='grid gap-3'>
                        <div className='rounded-xl bg-[#edf3ff] px-3 py-2 text-[13px] leading-relaxed text-[#1f3565]'>
                          Диапазоны указываются для часов в неделю. Ежедневные начисления
                          выполняются по дефолтной ставке. По итогам недели система
                          создает корректирующий платеж.
                        </div>

                        <div
                          className={`grid gap-3 ${
                            rateType.value === 'WEEKLY_SALARY'
                              ? 'md:grid-cols-3'
                              : 'md:grid-cols-2'
                          }`}
                        >
                          <Field label='Стандартная ставка, руб.'>
                            <Input
                              type='number'
                              min='0'
                              step='0.01'
                              value={setting.default_rate}
                              onChange={(event) =>
                                updateSetting(rateType.value, (current) => ({
                                  ...current,
                                  default_rate: event.target.value,
                                }))
                              }
                              className='h-11 rounded-xl border-[#e3e9f3] text-base text-[#1f3565] md:h-10 md:text-sm'
                            />
                          </Field>
                          {rateType.value === 'WEEKLY_SALARY' ? (
                            <Field label='Распределять оклад по часам'>
                              <select
                                value={form.salary_distribution_scope}
                                onChange={(event) =>
                                  onFormChange({
                                    ...form,
                                    salary_distribution_scope: event.target
                                      .value as SalaryDistributionScope,
                                  })
                                }
                                className='h-10 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[13px] text-[#1f3565] outline-none focus:border-[#2d6ff7] focus:ring-2 focus:ring-[#edf3ff]'
                              >
                                <option value='' disabled>
                                  Не выбрано
                                </option>
                                {Object.entries(HOURS_SCOPE_LABELS).map(
                                  ([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                              {errors.salary_distribution_scope ? (
                                <span className='text-[12px] leading-tight text-rose-600'>
                                  {errors.salary_distribution_scope}
                                </span>
                              ) : null}
                            </Field>
                          ) : null}
                          <Field label='Какие часы учитывать в диапазонах'>
                            <select
                              disabled={rateType.value !== 'WEEKLY_SALARY'}
                              value={setting.hours_scope}
                              onChange={(event) =>
                                updateSetting(rateType.value, (current) => ({
                                  ...current,
                                  hours_scope: event.target.value as PayrollHoursScope,
                                }))
                              }
                              className='h-10 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[13px] text-[#1f3565] outline-none focus:border-[#2d6ff7] focus:ring-2 focus:ring-[#edf3ff]'
                            >
                              <option value='' disabled>
                                Не выбрано
                              </option>
                              {Object.entries(HOURS_SCOPE_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </Field>
                        </div>

                        <label className='flex items-center gap-2 text-[13px] font-semibold text-[#1f3565]'>
                          <input
                            type='checkbox'
                            checked={setting.split_by_project_type}
                            onChange={(event) =>
                              updateSetting(rateType.value, (current) => ({
                                ...current,
                                split_by_project_type: event.target.checked,
                                ranges: event.target.checked
                                  ? [
                                      createDefaultRange('COMMERCIAL'),
                                      createDefaultRange('INTERNAL'),
                                    ]
                                  : [createDefaultRange()],
                              }))
                            }
                          />
                          <span>Делить проекты на коммерческие и внутренние</span>
                        </label>

                        <div className='grid gap-3 md:grid-cols-2'>
                          {visibleRanges.map((projectHoursType) => {
                            const ranges = setting.ranges.filter(
                              (range) =>
                                (setting.split_by_project_type
                                  ? range.project_hours_type
                                  : 'ALL') === projectHoursType,
                            );

                            return (
                              <div
                                key={projectHoursType}
                                className='grid gap-2 rounded-xl border border-[#e3e9f3] bg-white p-3'
                              >
                                <p className='text-sm font-semibold text-[#10275a]'>
                                  {PROJECT_HOURS_TYPE_LABELS[projectHoursType]}
                                </p>
                                <div className='grid gap-2'>
                                  {ranges.map((range) => {
                                    const rangeIndex = setting.ranges.indexOf(range);

                                    return (
                                      <div
                                        key={rangeIndex}
                                        className='grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]'
                                      >
                                        <Input
                                          type='number'
                                          min='0'
                                          step='0.01'
                                          value={range.from_hours}
                                          placeholder='От'
                                          onChange={(event) =>
                                            updateRange(rateType.value, rangeIndex, {
                                              from_hours: event.target.value,
                                            })
                                          }
                                        />
                                        <Input
                                          type='number'
                                          min='0'
                                          step='0.01'
                                          value={range.to_hours}
                                          placeholder='До'
                                          onChange={(event) =>
                                            updateRange(rateType.value, rangeIndex, {
                                              to_hours: event.target.value,
                                            })
                                          }
                                        />
                                        <Input
                                          type='number'
                                          min='0'
                                          step='0.01'
                                          value={range.rate}
                                          placeholder='Ставка'
                                          onChange={(event) =>
                                            updateRange(rateType.value, rangeIndex, {
                                              rate: event.target.value,
                                            })
                                          }
                                        />
                                        <button
                                          type='button'
                                          className='grid size-10 place-items-center rounded-xl border border-[#e3e9f3] text-[#7e8fb4] hover:bg-rose-50 hover:text-rose-600'
                                          title='Удалить диапазон'
                                          onClick={() =>
                                            updateSetting(rateType.value, (current) => ({
                                              ...current,
                                              ranges: current.ranges.filter(
                                                (_, index) => index !== rangeIndex,
                                              ),
                                            }))
                                          }
                                        >
                                          x
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className='flex items-center gap-1.5 justify-self-start'>
                                  <button
                                    type='button'
                                    className='justify-self-start rounded-lg px-2 py-1 text-[13px] font-semibold text-[#2d6ff7] hover:bg-[#edf3ff]'
                                    onClick={() =>
                                      updateSetting(rateType.value, (current) => ({
                                        ...current,
                                        ranges: [
                                          ...current.ranges,
                                          createDefaultRange(projectHoursType),
                                        ],
                                      }))
                                    }
                                  >
                                    + Добавить диапазон
                                  </button>
                                  <HintToolTip content='Каждый диапазон задаёт ставку для указанного интервала часов в неделю. Например: 0-40 ч - одна ставка, 40+ ч - другая' />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {rateType.value !== 'WEEKLY_SALARY' ? (
                          <div className='grid gap-2 text-[13px] text-[#1f3565]'>
                            <div className='flex items-center gap-2 font-semibold'>
                              Как учитывать диапазоны
                              <HintToolTip
                                content={
                                  <>
                                    <b>Пересчёт</b> — все часы считаются по ставке
                                    достигнутого диапазона.
                                    <br />
                                    <b>Раздельный</b> — часы в каждом диапазоне считаются
                                    по своей ставке.
                                  </>
                                }
                              />
                            </div>
                            {Object.entries(RANGE_METHOD_LABELS).map(([value, label]) => (
                              <label key={value} className='flex items-center gap-2'>
                                <input
                                  type='radio'
                                  name={`range-method-${rateType.value}`}
                                  value={value}
                                  checked={setting.range_calculation_method === value}
                                  onChange={() =>
                                    updateSetting(rateType.value, (current) => ({
                                      ...current,
                                      range_calculation_method:
                                        value as PayrollRangeCalculationMethod,
                                    }))
                                  }
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {rateType.value !== 'WEEKLY_SALARY' ? (
                      <ProjectRatesFields
                        rateType={rateType.value}
                        hasProjectRates={setting.has_project_rates}
                        projectRates={setting.project_rates}
                        projects={projects}
                        isLoadingProjects={isLoadingProjects}
                        onChange={(patch) =>
                          updateSetting(rateType.value, (current) => ({
                            ...current,
                            ...patch,
                          }))
                        }
                      />
                    ) : null}
                  </section>
                );
              },
            )}
          </div>

          <label className='flex items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white p-3 text-sm font-semibold text-[#1f3565]'>
            <input
              type='checkbox'
              checked={form.exclude_from_supervised_hours}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  exclude_from_supervised_hours: event.target.checked,
                })
              }
            />
            <span>Не учитывать часы как подконтрольные</span>
            <HintToolTip content='Часы этого сотрудника не будут учитываться как «подконтрольные» у его руководителя. Не влияет на собственный расчёт сотрудника.' />
          </label>

          <Field label='Дата начала действия'>
            <Input
              type='date'
              min={minEffectiveFrom}
              value={form.effective_from}
              onChange={(event) =>
                onFormChange({ ...form, effective_from: event.target.value })
              }
              required
              className='h-11 rounded-xl border-[#e3e9f3] text-base text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff] md:h-10 md:text-sm'
            />
            {errors.effective_from ? (
              <span className='text-[12px] leading-tight text-rose-600'>
                {errors.effective_from}
              </span>
            ) : null}
            <p className='mt-1 text-[12px] text-[#7e8fb4]'>
              {minEffectiveFrom
                ? `Новая ставка должна начинаться не раньше ${minEffectiveFrom}.`
                : isEditing
                  ? 'Можно изменить дату начала действия последней ставки.'
                  : 'Укажите дату начала действия ставки.'}
            </p>
          </Field>

          {errors.rate ? (
            <div className='rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] leading-relaxed text-rose-700'>
              {errors.rate}
            </div>
          ) : null}

          {errors.rate_settings ? (
            <div className='rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] leading-relaxed text-rose-700'>
              {errors.rate_settings}
            </div>
          ) : null}

          <Button
            type='submit'
            variant='secondary'
            disabled={isSaving}
            className='mt-1 min-h-11 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! md:h-10 md:min-h-0 md:w-auto'
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </form>
      </div>
    </div>
  );
}

type ProjectOption = { value: string; label: string };

/**
 * Загружает активные проекты компании для выбора отдельной ставки при первом открытии окна.
 * Архивный проект из сохраненной ставки остается в своей строке с названием из ставки.
 */
function useRateProjects(isOpen: boolean) {
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const shouldLoad = isOpen && projects === null;

  useEffect(() => {
    if (!shouldLoad) return;

    let isActive = true;

    api.workspace.projects
      .getMany({
        status: 'active',
        per_page: 1000,
        sort_by: 'name',
        sort_direction: 'asc',
      })
      .then((response) => {
        if (!isActive) return;

        setProjects(
          (response.data ?? []).map((project) => ({
            value: project.id,
            label: project.name,
          })),
        );
      })
      .catch(() => {
        if (isActive) setProjects([]);
      });

    return () => {
      isActive = false;
    };
  }, [shouldLoad]);

  return { projects: projects ?? [], isLoadingProjects: shouldLoad };
}

function ProjectRatesFields({
  rateType,
  hasProjectRates,
  projectRates,
  projects,
  isLoadingProjects,
  onChange,
}: {
  rateType: EmployeeRateType;
  hasProjectRates: boolean;
  projectRates: EmployeeRateProjectRateForm[];
  projects: ProjectOption[];
  isLoadingProjects: boolean;
  onChange: (_patch: {
    has_project_rates?: boolean;
    project_rates?: EmployeeRateProjectRateForm[];
  }) => void;
}) {
  const updateProjectRate = (
    index: number,
    patch: Partial<EmployeeRateProjectRateForm>,
  ) => {
    onChange({
      project_rates: projectRates.map((projectRate, projectRateIndex) =>
        projectRateIndex === index ? { ...projectRate, ...patch } : projectRate,
      ),
    });
  };

  return (
    <div className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'>
      <label className='flex items-center gap-2 text-[13px] font-semibold text-[#1f3565]'>
        <input
          type='checkbox'
          checked={hasProjectRates}
          onChange={(event) =>
            onChange({
              has_project_rates: event.target.checked,
              project_rates:
                event.target.checked && !projectRates.length
                  ? [createDefaultProjectRate()]
                  : projectRates,
            })
          }
        />
        <span>Установить отдельную ставку по проектам</span>
        <HintToolTip content='Часы проекта учитываются в диапазонах вместе с остальными часами, но оплачиваются по ставке проекта. Признак проекта (коммерческий или внутренний) на ставку не влияет.' />
      </label>

      {hasProjectRates ? (
        <div className='grid gap-3 sm:gap-2'>
          {projectRates.map((projectRate, index) => {
            const selectedElsewhere = new Set(
              projectRates
                .filter((_, otherIndex) => otherIndex !== index)
                .map((otherRate) => otherRate.project_id),
            );
            const options = projects.filter(
              (project) => !selectedElsewhere.has(project.value),
            );
            // Проект из сохраненной ставки может отсутствовать в списке: архивный или удаленный.
            if (
              projectRate.project_id &&
              !options.some((option) => option.value === projectRate.project_id)
            ) {
              options.unshift({
                value: projectRate.project_id,
                label: projectRate.project_name || 'Проект не найден',
              });
            }

            return (
              <div
                key={`${rateType}:${index}`}
                className='grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[2fr_1fr_auto]'
              >
                <div className='col-span-2 min-w-0 sm:col-span-1'>
                  <SearchableSelect
                    value={projectRate.project_id}
                    onValueChange={(nextValue) =>
                      updateProjectRate(index, {
                        project_id: nextValue,
                        project_name:
                          projects.find((project) => project.value === nextValue)
                            ?.label ?? '',
                      })
                    }
                    options={options}
                    placeholder='Выберите проект'
                    className='h-10'
                    isLoading={isLoadingProjects}
                  />
                </div>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={projectRate.rate}
                  placeholder='Ставка, руб.'
                  aria-label='Ставка проекта, руб.'
                  onChange={(event) =>
                    updateProjectRate(index, { rate: event.target.value })
                  }
                />
                <button
                  type='button'
                  className='grid size-10 place-items-center rounded-xl border border-[#e3e9f3] text-[#7e8fb4] hover:bg-rose-50 hover:text-rose-600'
                  title='Удалить проект'
                  aria-label='Удалить проект'
                  onClick={() =>
                    onChange({
                      project_rates: projectRates.filter(
                        (_, projectRateIndex) => projectRateIndex !== index,
                      ),
                    })
                  }
                >
                  x
                </button>
              </div>
            );
          })}
          <button
            type='button'
            className='justify-self-start rounded-lg px-2 py-1 text-[13px] font-semibold text-[#2d6ff7] hover:bg-[#edf3ff]'
            onClick={() =>
              onChange({ project_rates: [...projectRates, createDefaultProjectRate()] })
            }
          >
            + Добавить проект
          </button>
        </div>
      ) : null}
    </div>
  );
}
