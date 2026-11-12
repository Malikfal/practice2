import type {
  EmployeePayrollCalculationRow,
  EmployeeRate,
  EmployeeRateSetting,
  EmployeeRateForm,
  EmployeeRateProjectRateForm,
  EmployeeRateSettingForm,
  EmployeeRateSettingRangeForm,
  EmployeeRateType,
  PayrollFormulaRange,
  PayrollHoursScope,
  PayrollProjectHoursType,
  PayrollRangeCalculationMethod,
  SalaryDistributionScope,
  User,
} from '../../../../../../../types/app';

import { DEFAULT_RANGE_METHOD_LABEL, RANGE_METHOD_LABELS, RATE_TYPES } from './constants';

export function employeeName(employee: User) {
  return (
    `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() ||
    employee.name ||
    employee.email ||
    'Сотрудник'
  );
}

export function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function rateEffectiveFromInputValue(rate: EmployeeRate | null | undefined) {
  return rate?.effective_from?.slice(0, 10) || todayInputValue();
}

export function nextRateEffectiveFromInputValue(rate: EmployeeRate | null | undefined) {
  const effectiveFrom = rate?.effective_from?.slice(0, 10);
  if (!effectiveFrom) return undefined;

  const date = new Date(`${effectiveFrom}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return 'Не указано';

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function getRateSetting(
  rate: EmployeeRate | null | undefined,
  rateType: EmployeeRateType,
) {
  return rate?.rate_settings?.find((setting) => setting.rate_type === rateType);
}

export function isAdvancedRateSetting(
  rate: EmployeeRate | null | undefined,
  rateType: EmployeeRateType,
) {
  return Boolean(getRateSetting(rate, rateType)?.is_advanced);
}

export function getSimpleRateValue(
  rate: EmployeeRate | null | undefined,
  rateType: EmployeeRateType,
) {
  if (rateType === 'WEEKLY_SALARY') return rate?.salary;
  if (rateType === 'HOURLY') return rate?.hourly_rate;
  if (rateType === 'SUPERVISED_HOURLY') return rate?.supervised_hourly_rate;

  return rate?.company_hourly_rate;
}

export function formatRateValue(
  rate: EmployeeRate | null | undefined,
  rateType: EmployeeRateType,
) {
  return isAdvancedRateSetting(rate, rateType)
    ? 'Продвинутая ставка'
    : formatMoney(getSimpleRateValue(rate, rateType));
}

export function advancedRateSettingsCount(rate: EmployeeRate | null | undefined) {
  return rate?.rate_settings?.filter((setting) => setting.is_advanced).length ?? 0;
}

export function projectRatesCount(
  rate: EmployeeRate | null | undefined,
  rateType?: EmployeeRateType,
) {
  return (rate?.rate_settings ?? [])
    .filter(
      (setting) =>
        setting.rate_type !== 'WEEKLY_SALARY' &&
        (!rateType || setting.rate_type === rateType),
    )
    .reduce((count, setting) => count + (setting.project_rates?.length ?? 0), 0);
}

export function pluralProjects(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} проект`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} проекта`;

  return `${count} проектов`;
}

/** Короткая подпись к ставке, если у нее есть отдельные ставки по проектам. */
export function formatProjectRatesNote(
  rate: EmployeeRate | null | undefined,
  rateType: EmployeeRateType,
) {
  const count = projectRatesCount(rate, rateType);

  return count ? `+ ${pluralProjects(count)} отдельно` : null;
}

/** Есть ли у ставки настройки, которые видны только в деталях. */
export function hasRateDetails(rate: EmployeeRate | null | undefined) {
  return advancedRateSettingsCount(rate) > 0 || projectRatesCount(rate) > 0;
}

/** Часы в сотых долях: 1:30 → 1.5, 2:00 → 2. Для выгрузок, где нужно число. */
export function decimalHours(seconds?: number | null) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds ?? 0)));

  return Math.round((totalSeconds / 3600) * 100) / 100;
}

/** Часы в сотых долях для подписи: 1:30 → «1,5», 2:00 → «2». */
export function formatDecimalHours(seconds?: number | null) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(decimalHours(seconds));
}

export function formatHours(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return 'Не указано';

  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const exactTime = [
    hours,
    String(minutes).padStart(2, '0'),
    String(remainingSeconds).padStart(2, '0'),
  ].join(':');

  return `${exactTime} (${formatDecimalHours(totalSeconds)})`;
}

export function formatPeriod(from: string, to: string) {
  return `${formatDate(from)}-${formatDate(to)}`;
}

export function formatDate(value?: string | null) {
  if (!value) return 'Не указано';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Не указано';

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

export function formatChanger(rate: EmployeeRate) {
  const changer = rate.changed_by;
  if (!changer) return 'Не указано';

  const fullName = `${changer.name ?? ''} ${changer.last_name ?? ''}`.trim();

  return fullName || changer.email || 'Не указано';
}

export function kopecksToInput(value?: number | null) {
  if (value === null || value === undefined) return '';

  return String(value / 100);
}

export function createDefaultRange(
  projectHoursType: PayrollProjectHoursType = 'ALL',
): EmployeeRateSettingRangeForm {
  return {
    project_hours_type: projectHoursType,
    from_hours: '0',
    to_hours: '',
    rate: '',
  };
}

export function createDefaultProjectRate(): EmployeeRateProjectRateForm {
  return { project_id: '', project_name: '', rate: '' };
}

export function createDefaultRateSetting(
  rateType: EmployeeRateType,
): EmployeeRateSettingForm {
  return {
    rate_type: rateType,
    is_advanced: false,
    default_rate: '',
    split_by_project_type: false,
    hours_scope:
      rateType === 'HOURLY'
        ? 'OWN'
        : rateType === 'SUPERVISED_HOURLY'
          ? 'SUPERVISED'
          : rateType === 'COMPANY_HOURLY'
            ? 'COMPANY'
            : 'COMPANY',
    range_calculation_method: 'THRESHOLD',
    ranges: [createDefaultRange()],
    has_project_rates: false,
    project_rates: [],
  };
}

export function rateSettingToForm(setting: EmployeeRateSetting): EmployeeRateSettingForm {
  return {
    rate_type: setting.rate_type,
    is_advanced: setting.is_advanced,
    default_rate: kopecksToInput(setting.default_rate),
    split_by_project_type: setting.split_by_project_type,
    hours_scope: normalizePayrollHoursScope(setting.hours_scope),
    range_calculation_method: setting.range_calculation_method,
    ranges: setting.ranges.length
      ? setting.ranges.map((range) => ({
          project_hours_type: range.project_hours_type,
          from_hours: String(range.from_hours),
          to_hours: range.to_hours === null ? '' : String(range.to_hours),
          rate: kopecksToInput(range.rate),
        }))
      : [createDefaultRange()],
    has_project_rates: Boolean(setting.project_rates?.length),
    project_rates: (setting.project_rates ?? []).map((projectRate) => ({
      project_id: projectRate.project_id,
      project_name: projectRate.project_name ?? '',
      rate: kopecksToInput(projectRate.rate),
    })),
  };
}

export function normalizePayrollHoursScope(
  value?: PayrollHoursScope | 'ALL' | null,
): PayrollHoursScope | '' {
  return value === 'SUPERVISED' || value === 'COMPANY' || value === 'OWN' ? value : '';
}

export function mergeRateSettings(
  settings: EmployeeRateSetting[] | undefined,
): EmployeeRateSettingForm[] {
  return RATE_TYPES.map((rateType) => {
    const loaded = settings?.find((setting) => setting.rate_type === rateType.value);
    return loaded ? rateSettingToForm(loaded) : createDefaultRateSetting(rateType.value);
  });
}

export function rateFormFromRate(
  rate: EmployeeRate | null,
  options: { preserveEffectiveFrom?: boolean } = {},
): EmployeeRateForm {
  return {
    salary: kopecksToInput(rate?.salary),
    salary_distribution_scope: normalizeSalaryDistributionScope(
      rate?.salary_distribution_scope,
    ),
    hourly_rate: kopecksToInput(rate?.hourly_rate),
    supervised_hourly_rate: kopecksToInput(rate?.supervised_hourly_rate),
    company_hourly_rate: kopecksToInput(rate?.company_hourly_rate),
    exclude_from_supervised_hours: Boolean(rate?.exclude_from_supervised_hours),
    effective_from: options.preserveEffectiveFrom
      ? rateEffectiveFromInputValue(rate)
      : todayInputValue(),
    rate_settings: mergeRateSettings(rate?.rate_settings),
  };
}

export function normalizeSalaryDistributionScope(
  value?: SalaryDistributionScope | 'ALL' | null,
): SalaryDistributionScope | '' {
  return value === 'SUPERVISED' || value === 'COMPANY' || value === 'OWN' ? value : '';
}

export function numberFromInput(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateRateForm(form: EmployeeRateForm) {
  if (!form.effective_from) {
    return 'Укажите дату начала действия.';
  }

  if (!['OWN', 'SUPERVISED', 'COMPANY'].includes(form.salary_distribution_scope)) {
    return 'Выберите область часов для распределения оклада.';
  }

  for (const setting of form.rate_settings) {
    const label =
      RATE_TYPES.find((rateType) => rateType.value === setting.rate_type)?.label ??
      'Ставка';
    const projectRatesError = validateProjectRates(setting, label);

    if (projectRatesError) return projectRatesError;

    if (!setting.is_advanced) continue;

    const defaultRate = numberFromInput(setting.default_rate);

    if (!['OWN', 'SUPERVISED', 'COMPANY'].includes(setting.hours_scope)) {
      return `${label}: выберите, какие часы учитывать в диапазонах.`;
    }

    if (defaultRate === null || defaultRate < 0) {
      return `${label}: укажите дефолтную ставку.`;
    }

    if (!setting.ranges.length) {
      return `${label}: добавьте хотя бы один диапазон.`;
    }

    if (
      setting.rate_type === 'WEEKLY_SALARY' &&
      setting.range_calculation_method === 'PROGRESSIVE'
    ) {
      return `${label}: прогрессивный расчет недоступен для оклада.`;
    }

    for (const range of setting.ranges) {
      const fromHours = numberFromInput(range.from_hours);
      const toHours = numberFromInput(range.to_hours);
      const rate = numberFromInput(range.rate);

      if (fromHours === null || fromHours < 0) {
        return `${label}: значение "От" должно быть не меньше 0.`;
      }

      if (toHours !== null && toHours <= fromHours) {
        return `${label}: значение "До" должно быть больше "От".`;
      }

      if (rate === null || rate < defaultRate) {
        return `${label}: ставка диапазона должна быть не ниже дефолтной.`;
      }
    }
  }

  return null;
}

export function hasProjectRates(setting: EmployeeRateSettingForm) {
  return setting.rate_type !== 'WEEKLY_SALARY' && setting.has_project_rates;
}

function validateProjectRates(setting: EmployeeRateSettingForm, label: string) {
  if (!hasProjectRates(setting)) return null;

  if (!setting.project_rates.length) {
    return `${label}: добавьте проект с отдельной ставкой или снимите отметку.`;
  }

  const projectIds = new Set<string>();

  for (const projectRate of setting.project_rates) {
    const rate = numberFromInput(projectRate.rate);

    if (!projectRate.project_id) {
      return `${label}: выберите проект для отдельной ставки.`;
    }

    if (projectIds.has(projectRate.project_id)) {
      return projectRate.project_name
        ? `${label}: проект "${projectRate.project_name}" выбран дважды.`
        : `${label}: проект выбран дважды.`;
    }

    if (rate === null || rate < 0) {
      return `${label}: укажите ставку проекта.`;
    }

    projectIds.add(projectRate.project_id);
  }

  return null;
}

export function rowTotalSeconds(row: EmployeePayrollCalculationRow) {
  return row.total_seconds ?? (row.own_seconds ?? 0) + (row.supervised_seconds ?? 0);
}

function formatHoursNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

/** Подпись диапазона часов: "0-20 ч" или "от 20 ч" для открытого диапазона. */
export function formatRangeLabel(fromHours: number, toHours: number | null) {
  if (toHours === null) return `от ${formatHoursNumber(fromHours)} ч`;

  return `${formatHoursNumber(fromHours)}-${formatHoursNumber(toHours)} ч`;
}

export function getRateTypeLabel(rateType: EmployeeRateType) {
  return RATE_TYPES.find((item) => item.value === rateType)?.label ?? 'Ставка';
}

export function getRangeMethodLabel(method: PayrollRangeCalculationMethod | null) {
  return method ? RANGE_METHOD_LABELS[method] : DEFAULT_RANGE_METHOD_LABEL;
}

export function formatFormulaRangeList(
  ranges: PayrollFormulaRange[],
  defaultRate?: number | null,
) {
  if (!ranges.length) return 'Не определен';

  return ranges
    .map((range) => {
      const delta =
        defaultRate === null || defaultRate === undefined
          ? null
          : range.rate_kopecks - defaultRate;
      const deltaText = delta && delta > 0 ? ` + ${formatMoney(delta)}` : '';

      return `${formatRangeLabel(range.from_hours, range.to_hours)}${deltaText}`;
    })
    .join(', ');
}
