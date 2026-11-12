import type { ReactNode } from 'react';

import { Field, Input, SearchableSelect } from '../../../../../../ui/FormField';
import type { EmployeeDayTimelineForm, User } from '../../../../../../../types/app';
import { formatName } from '../../../../../../../utils/formatters';

import { formatDateInputValue } from './dayTimelineUtils';

type Props = {
  form: EmployeeDayTimelineForm;
  employees: User[];
  isLoading: boolean;
  canSelectEmployee: boolean;
  rightAction?: ReactNode;
  onFormChange: (_next: EmployeeDayTimelineForm) => void;
};

export default function DayTimelineFilters({
  form,
  employees,
  isLoading,
  canSelectEmployee,
  rightAction,
  onFormChange,
}: Props) {
  const shiftDate = (days: number) => {
    const currentDate = new Date(`${form.date}T00:00:00`);
    currentDate.setDate(currentDate.getDate() + days);
    onFormChange({
      ...form,
      date: formatDateInputValue(currentDate),
    });
  };

  return (
    <div className='grid gap-3'>
      {canSelectEmployee ? (
        <Field label='Сотрудник'>
          <SearchableSelect
            value={form.user_id}
            onValueChange={(userId) => onFormChange({ ...form, user_id: userId })}
            options={employees.map((employee) => ({
              value: employee.id,
              label: formatName(employee),
            }))}
            placeholder='Выберите сотрудника'
            isLoading={isLoading}
          />
        </Field>
      ) : null}
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='grid w-full min-w-0 gap-1 sm:w-auto'>
          <h3 className='text-[18px] leading-tight font-semibold text-[#10275a] sm:text-[20px]'>
            День сотрудника
          </h3>
          <div className='grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden sm:w-auto sm:grid-cols-[auto_minmax(0,190px)_auto] sm:overflow-visible'>
            <button
              type='button'
              className='grid size-11 shrink-0 place-items-center rounded-lg border border-[#c9d8f8] bg-white text-[#1f3565] transition-colors duration-150 hover:bg-[#f3f7ff] sm:size-9'
              onClick={() => shiftDate(-1)}
              aria-label='Предыдущий день'
            >
              <svg
                viewBox='0 0 20 20'
                className='h-4 w-4 fill-none stroke-current stroke-2'
              >
                <path d='M12.5 5L7.5 10L12.5 15' />
              </svg>
            </button>
            <Input
              type='date'
              value={form.date}
              onChange={(event) => onFormChange({ ...form, date: event.target.value })}
              className='h-11 min-w-0 max-w-full rounded-lg border-[#c9d8f8] bg-white px-2 text-base text-[#1f3565] sm:h-9 sm:px-3 sm:text-[14px]'
            />
            <button
              type='button'
              className='grid size-11 shrink-0 place-items-center rounded-lg border border-[#c9d8f8] bg-white text-[#1f3565] transition-colors duration-150 hover:bg-[#f3f7ff] sm:size-9'
              onClick={() => shiftDate(1)}
              aria-label='Следующий день'
            >
              <svg
                viewBox='0 0 20 20'
                className='h-4 w-4 fill-none stroke-current stroke-2'
              >
                <path d='M7.5 5L12.5 10L7.5 15' />
              </svg>
            </button>
          </div>
        </div>
        {rightAction ? (
          <div className='w-full shrink-0 sm:w-auto'>{rightAction}</div>
        ) : null}
      </div>
    </div>
  );
}
