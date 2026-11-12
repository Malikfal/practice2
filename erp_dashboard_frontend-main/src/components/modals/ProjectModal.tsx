import { useRef, type FormEvent } from 'react';

import Button from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/FormField';
import { ProjectRateFields } from './ProjectRateModal';
import { ChipsMultiSelect } from './ProjectTeamModal';
import { formatName } from '../../utils/formatters';
import type { Client, ProjectForm, Template, User } from '../../types/app';

export default function ProjectModal({
  isOpen,
  isAdding,
  form,
  templates,
  clients = [],
  employees = [],
  onChange,
  onClose,
  onSubmit,
  showRate = true,
}: {
  isOpen: boolean;
  isAdding: boolean;
  form: ProjectForm;
  templates: Template[];
  clients?: Client[];
  employees?: User[];
  onChange: (_nextForm: ProjectForm) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  /** На ФРИ ставки проектов закрыты тарифом: проект создаётся без ставки. */
  showRate?: boolean;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const isEmployeeSelectionRequired =
    form.exclude_from_payroll &&
    form.payroll_exclusion_scope === 'SELECTED' &&
    form.payroll_excluded_employee_ids.length === 0;

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 sm:p-4'
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
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[907px] overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[90vh] sm:rounded-2xl sm:p-4 md:overflow-auto'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h2 className='text-base font-semibold text-slate-800'>Новый проект</h2>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(event);
          }}
          className='grid gap-3'
        >
          <Field label='Название проекта *'>
            <Input
              value={form.name || ''}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder='Введите название'
              className='text-base sm:text-sm'
              required
            />
          </Field>

          <Field label='Клиент (необязательно)'>
            <Select
              value={form.client_id || ''}
              className='text-base sm:text-sm'
              onChange={(event) => onChange({ ...form, client_id: event.target.value })}
            >
              <option value=''>Без клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label='Описание (необязательно)'>
            <Textarea
              value={form.description || ''}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder='Описание проекта...'
              className='text-base sm:text-sm'
            />
          </Field>

          <Field label='Шаблон проекта (необязательно)'>
            <Select
              value={form.template || ''}
              className='text-base sm:text-sm'
              onChange={(event) => onChange({ ...form, template: event.target.value })}
            >
              <option value=''>Без шаблона</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.is_default_template ? ' (по умолчанию)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <div className='grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <label className='flex items-start gap-2 text-sm font-medium text-slate-700'>
              <input
                type='checkbox'
                className='mt-0.5 size-5 shrink-0 accent-blue-600'
                checked={form.is_internal}
                onChange={(event) =>
                  onChange({ ...form, is_internal: event.target.checked })
                }
              />
              <span>Внутренний проект</span>
            </label>
            <label className='flex items-start gap-2 text-sm font-medium text-slate-700'>
              <input
                type='checkbox'
                className='mt-0.5 size-5 shrink-0 accent-blue-600'
                checked={form.exclude_from_payroll}
                onChange={(event) =>
                  onChange({
                    ...form,
                    exclude_from_payroll: event.target.checked,
                    payroll_exclusion_scope: event.target.checked
                      ? form.payroll_exclusion_scope
                      : 'ALL',
                    payroll_excluded_employee_ids: event.target.checked
                      ? form.payroll_excluded_employee_ids
                      : [],
                  })
                }
              />
              <span>Не учитывать часы проекта в оплате</span>
            </label>
            {form.exclude_from_payroll ? (
              <div className='ml-7 grid gap-3 border-l border-slate-200 pl-3'>
                <div className='grid gap-2 text-sm text-slate-700'>
                  <label className='flex items-center gap-2'>
                    <input
                      type='radio'
                      name='payroll-exclusion-scope'
                      value='ALL'
                      checked={form.payroll_exclusion_scope === 'ALL'}
                      onChange={() =>
                        onChange({
                          ...form,
                          payroll_exclusion_scope: 'ALL',
                          payroll_excluded_employee_ids: [],
                        })
                      }
                    />
                    <span>У всех сотрудников</span>
                  </label>
                  <label className='flex items-center gap-2'>
                    <input
                      type='radio'
                      name='payroll-exclusion-scope'
                      value='SELECTED'
                      checked={form.payroll_exclusion_scope === 'SELECTED'}
                      onChange={() =>
                        onChange({ ...form, payroll_exclusion_scope: 'SELECTED' })
                      }
                    />
                    <span>У определённых сотрудников</span>
                  </label>
                </div>

                {form.payroll_exclusion_scope === 'SELECTED' ? (
                  <div className='grid gap-1.5'>
                    <span className='text-[13px] font-medium text-slate-700'>
                      Сотрудники *
                    </span>
                    <ChipsMultiSelect
                      values={form.payroll_excluded_employee_ids}
                      onChange={(payroll_excluded_employee_ids) =>
                        onChange({ ...form, payroll_excluded_employee_ids })
                      }
                      options={employees.map((employee) => ({
                        value: employee.id,
                        label: formatName(employee),
                      }))}
                      placeholder='Выберите сотрудников'
                      emptyText='Все сотрудники выбраны'
                    />
                    {isEmployeeSelectionRequired ? (
                      <span className='text-xs text-red-500'>
                        Выберите минимум одного сотрудника.
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {showRate ? (
            <ProjectRateFields
              rateLabel='Ставка (валюта / час) *'
              rate={form.rate}
              currency={form.rate_currency}
              vat={form.rate_vat}
              onChange={(patch) =>
                onChange({
                  ...form,
                  ...(patch.rate !== undefined ? { rate: patch.rate } : {}),
                  ...(patch.currency ? { rate_currency: patch.currency } : {}),
                  ...(patch.vat !== undefined ? { rate_vat: patch.vat } : {}),
                })
              }
            />
          ) : null}

          <div className='mt-2 grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3'>
            <Button
              type='button'
              variant='secondary'
              className='w-full sm:w-auto'
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              type='submit'
              disabled={isAdding || isEmployeeSelectionRequired}
              variant={isAdding ? 'secondary' : 'primary'}
              className='w-full sm:w-auto'
            >
              {isAdding ? 'Создание проекта...' : 'Создать проект'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
