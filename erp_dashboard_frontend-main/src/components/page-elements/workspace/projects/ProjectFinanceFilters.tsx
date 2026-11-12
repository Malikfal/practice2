import type { FinanceArticle, FinanceSource } from '../../../../types/app';
import DateRangeFields from '../../../ui/DateRangeFields';
import { Field, Input, Select } from '../../../ui/FormField';
import FinanceArticleTreeMultiSelect from '../finances/FinanceArticleTreeMultiSelect';
import FinanceFilterMultiSelect from '../finances/FinanceFilterMultiSelect';
import type { FinanceFilterState } from '../finances/types';

const sourceOptions: Array<{ value: FinanceSource; label: string }> = [
  { value: 'MANUAL', label: 'Ручное создание' },
  { value: 'IMPORT', label: 'Импорт' },
  { value: 'PAYROLL_DAILY', label: 'Ежедневное начисление зарплаты' },
  { value: 'PAYROLL_RECALCULATION', label: 'Перерасчёт зарплаты' },
];

export default function ProjectFinanceFilters({
  filters,
  articles,
  projectOptions,
  employeeOptions,
  onChange,
}: {
  filters: FinanceFilterState;
  articles: FinanceArticle[];
  projectOptions?: Array<{ value: string; label: string }>;
  employeeOptions: Array<{ value: string; label: string }>;
  onChange: (_next: Partial<FinanceFilterState>) => void;
}) {
  return (
    <div className='flex min-w-0 w-full flex-wrap items-start gap-2.5'>
      <DateRangeFields
        from={filters.from}
        to={filters.to}
        fromLabel='Период'
        toLabel='До'
        className='min-w-0 basis-full grow sm:min-w-[180px] sm:basis-[180px] sm:grow-[2] [&_button]:h-9! [&_button]:px-2.5 [&_button]:text-xs'
        onChange={(from, to) => onChange({ from, to })}
      />
      <Field
        label='Сумма от'
        className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[70px] sm:basis-[70px]'
      >
        <Input
          value={filters.amount_from}
          onChange={(event) => onChange({ amount_from: event.target.value })}
          placeholder='0'
          className='h-9! px-2.5 text-xs'
        />
      </Field>
      <Field
        label='Сумма до'
        className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[70px] sm:basis-[70px]'
      >
        <Input
          value={filters.amount_to}
          onChange={(event) => onChange({ amount_to: event.target.value })}
          placeholder='0'
          className='h-9! px-2.5 text-xs'
        />
      </Field>
      <Field
        label='Тип'
        className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[85px] sm:basis-[85px]'
      >
        <Select
          value={filters.type}
          onChange={(event) =>
            onChange({ type: event.target.value, finance_article_ids: [] })
          }
          className='h-9! px-2.5 text-xs'
        >
          <option value=''>Все</option>
          <option value='ENTRANCE'>Поступление</option>
          <option value='EXPENDITURE'>Расход</option>
        </Select>
      </Field>
      <Field
        label='Источники'
        className='min-w-0 basis-[calc(50%-5px)] grow sm:min-w-[125px] sm:basis-[125px]'
      >
        <FinanceFilterMultiSelect
          values={filters.sources}
          onValuesChange={(values) => onChange({ sources: values as FinanceSource[] })}
          options={sourceOptions}
          placeholder='Все источники'
        />
      </Field>
      <Field
        label='Статьи'
        className='min-w-0 basis-full grow sm:min-w-[160px] sm:basis-[160px]'
      >
        <FinanceArticleTreeMultiSelect
          articles={articles}
          values={filters.finance_article_ids}
          onValuesChange={(finance_article_ids) => onChange({ finance_article_ids })}
          className='h-9! px-2.5 text-xs'
        />
      </Field>
      {projectOptions ? (
        <Field
          label='Проекты'
          className='min-w-0 basis-full grow sm:min-w-[150px] sm:basis-[150px]'
        >
          <FinanceFilterMultiSelect
            values={filters.project_ids}
            onValuesChange={(project_ids) => onChange({ project_ids })}
            options={projectOptions}
            placeholder='Все проекты'
            searchable
          />
        </Field>
      ) : null}
      <Field
        label='Участники'
        className='min-w-0 basis-full grow sm:min-w-[125px] sm:basis-[125px]'
      >
        <FinanceFilterMultiSelect
          values={filters.employee_ids}
          onValuesChange={(employee_ids) => onChange({ employee_ids })}
          options={employeeOptions}
          placeholder='Все участники'
          searchable
        />
      </Field>
    </div>
  );
}
