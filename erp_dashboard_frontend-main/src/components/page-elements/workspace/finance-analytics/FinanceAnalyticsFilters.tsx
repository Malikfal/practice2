import type {
  FinanceAnalyticsFilters,
  FinanceAnalyticsGranularity,
} from '../../../../types/financeAnalytics';
import Button from '../../../ui/Button';
import DateRangeFields from '../../../ui/DateRangeFields';
import { Field, MultiSelect } from '../../../ui/FormField';

type Option = { value: string; label: string };

const granularityOptions: Array<{ value: FinanceAnalyticsGranularity; label: string }> = [
  { value: 'day', label: 'Дни' },
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
  { value: 'quarter', label: 'Кварталы' },
];

type Props = {
  filters: FinanceAnalyticsFilters;
  projectOptions: Option[];
  clientOptions: Option[];
  managerOptions: Option[];
  isLoading: boolean;
  onChange: (_filters: FinanceAnalyticsFilters) => void;
  onApply: () => void;
};

export default function FinanceAnalyticsFilters({
  filters,
  projectOptions,
  clientOptions,
  managerOptions,
  isLoading,
  onChange,
  onApply,
}: Props) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-white p-3 md:p-4'>
      {/* В одну строку семь фильтров не помещаются: период и группировка сверху, списки ниже. */}
      <div className='grid min-w-0 gap-3 xl:grid-cols-4 xl:items-end'>
        <div className='min-w-0 xl:col-span-2'>
          <DateRangeFields
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => onChange({ ...filters, from, to })}
          />
        </div>

        <Field label='Группировка' className='min-w-0 xl:col-span-2'>
          <div className='flex h-11 overflow-hidden rounded-lg border border-[#d3dcec] bg-white'>
            {granularityOptions.map((option) => (
              <button
                key={option.value}
                type='button'
                className={`flex-1 px-2 text-xs font-semibold transition-colors ${
                  filters.granularity === option.value
                    ? 'bg-[#2d6ff7] text-white'
                    : 'text-[#53617c] hover:bg-[#eef3fc]'
                }`}
                onClick={() => onChange({ ...filters, granularity: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label='Проекты'>
          <MultiSelect
            values={filters.project_ids}
            onValuesChange={(project_ids) => onChange({ ...filters, project_ids })}
            options={projectOptions}
            placeholder='Все проекты'
            searchable
          />
        </Field>
        <Field label='Клиенты'>
          <MultiSelect
            values={filters.client_ids}
            onValuesChange={(client_ids) => onChange({ ...filters, client_ids })}
            options={clientOptions}
            placeholder='Все клиенты'
            searchable
          />
        </Field>
        <Field label='Менеджеры'>
          <MultiSelect
            values={filters.manager_ids}
            onValuesChange={(manager_ids) => onChange({ ...filters, manager_ids })}
            options={managerOptions}
            placeholder='Все менеджеры'
            searchable
          />
        </Field>
        <Button
          type='button'
          className='h-11 w-full'
          disabled={isLoading}
          onClick={onApply}
        >
          {isLoading ? 'Обновление...' : 'Применить'}
        </Button>
      </div>
    </div>
  );
}
