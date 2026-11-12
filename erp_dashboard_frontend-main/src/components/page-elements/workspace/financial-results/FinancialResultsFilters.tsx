import type { FinanceArticle, FinanceSource } from '../../../../types/app';
import type {
  FinancialResultsFilters as Filters,
  FinancialResultsGranularity,
} from '../../../../types/financialResults';
import DateRangeFields from '../../../ui/DateRangeFields';
import { Field, Select } from '../../../ui/FormField';
import FinanceArticleTreeMultiSelect from '../finances/FinanceArticleTreeMultiSelect';
import FinanceFilterMultiSelect from '../finances/FinanceFilterMultiSelect';

type Option = { value: string; label: string };

const granularityOptions: Array<{ value: FinancialResultsGranularity; label: string }> = [
  { value: 'day', label: 'Дни' },
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
  { value: 'quarter', label: 'Кварталы' },
];

const sourceOptions: Array<{ value: FinanceSource; label: string }> = [
  { value: 'MANUAL', label: 'Ручное создание' },
  { value: 'IMPORT', label: 'Импорт' },
  { value: 'PAYROLL_DAILY', label: 'Ежедневное начисление зарплаты' },
  { value: 'PAYROLL_RECALCULATION', label: 'Перерасчёт зарплаты' },
];

type Props = {
  filters: Filters;
  projectOptions: Option[];
  clientOptions: Option[];
  managerOptions: Option[];
  articles: FinanceArticle[];
  employeeOptions: Option[];
  isLoading: boolean;
  onChange: (_filters: Filters) => void;
  onApply: () => void;
};

export default function FinancialResultsFilters({
  filters,
  projectOptions,
  clientOptions,
  managerOptions,
  articles,
  employeeOptions,
  isLoading,
  onChange,
  onApply,
}: Props) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-white p-3'>
      <div className='flex min-w-0 w-full flex-wrap items-start gap-2.5'>
        <DateRangeFields
          from={filters.from}
          to={filters.to}
          fromLabel='Период'
          toLabel='До'
          className='min-w-0 basis-full grow sm:min-w-45 sm:basis-45 sm:grow-2 [&_button]:h-9! [&_button]:px-2.5 [&_button]:text-xs'
          onChange={(from, to) => onChange({ ...filters, from, to })}
        />
        <Field
          label='Группировка'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-26.25 sm:basis-26.25'
        >
          <Select
            value={filters.granularity}
            onChange={(event) =>
              onChange({
                ...filters,
                granularity: event.target.value as FinancialResultsGranularity,
              })
            }
            className='h-9! px-2.5 text-xs'
          >
            {granularityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label='Проекты'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-31.25 sm:basis-31.25'
        >
          <FinanceFilterMultiSelect
            values={filters.project_ids}
            onValuesChange={(project_ids) => onChange({ ...filters, project_ids })}
            options={projectOptions}
            placeholder='Все проекты'
            searchable
          />
        </Field>
        <Field
          label='Клиенты'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-28.75 sm:basis-28.75'
        >
          <FinanceFilterMultiSelect
            values={filters.client_ids}
            onValuesChange={(client_ids) => onChange({ ...filters, client_ids })}
            options={clientOptions}
            placeholder='Все клиенты'
            searchable
          />
        </Field>
        <Field
          label='Менеджеры'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-31.25 sm:basis-31.25'
        >
          <FinanceFilterMultiSelect
            values={filters.manager_ids}
            onValuesChange={(manager_ids) => onChange({ ...filters, manager_ids })}
            options={managerOptions}
            placeholder='Все менеджеры'
            searchable
          />
        </Field>
        <Field label='Статьи' className='min-w-0 basis-full grow sm:min-w-40 sm:basis-40'>
          <FinanceArticleTreeMultiSelect
            articles={articles}
            values={filters.finance_article_ids}
            onValuesChange={(finance_article_ids) =>
              onChange({ ...filters, finance_article_ids })
            }
            placeholder='Все статьи'
            className='h-9! px-2.5 text-xs'
          />
        </Field>
        <Field
          label='Источники'
          className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-31.25 sm:basis-31.25'
        >
          <FinanceFilterMultiSelect
            values={filters.sources}
            onValuesChange={(values) =>
              onChange({ ...filters, sources: values as FinanceSource[] })
            }
            options={sourceOptions}
            placeholder='Все источники'
          />
        </Field>
        <Field
          label='Сотрудники'
          className='min-w-0 basis-full grow sm:min-w-31.25 sm:basis-31.25'
        >
          <FinanceFilterMultiSelect
            values={filters.employee_ids}
            onValuesChange={(employee_ids) => onChange({ ...filters, employee_ids })}
            options={employeeOptions}
            placeholder='Все сотрудники'
            searchable
          />
        </Field>
        <Field
          label=' '
          className='min-w-0 basis-full grow sm:min-w-22.5 sm:basis-22.5 sm:grow-0'
        >
          <button
            type='button'
            className='inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#2d6ff7] px-2 text-xs font-semibold text-white transition-colors hover:bg-[#1f5fe0] disabled:cursor-not-allowed disabled:bg-[#9ab8f5]'
            disabled={isLoading}
            onClick={onApply}
          >
            {isLoading ? 'Обновление...' : 'Применить'}
          </button>
        </Field>
      </div>
    </div>
  );
}
