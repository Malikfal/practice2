import { useMemo, useRef, type FormEvent } from 'react';

import Button from '../ui/Button';
import { Field, Input, MultiSelect, SearchableSelect } from '../ui/FormField';
import { isStandardTemplateStatus } from '../../hooks/formFactories';
import { formatName } from '../../utils/formatters';
import type { TemplateForm, User } from '../../types/app';

export default function TemplateModal({
  isOpen,
  isSaving,
  isEditing,
  form,
  employees,
  onChange,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSaving: boolean;
  isEditing: boolean;
  form: TemplateForm;
  employees: User[];
  onChange: (_nextForm: TemplateForm) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: formatName(employee),
      })),
    [employees],
  );

  const updateStatusColumn = (
    index: number,
    patch: Partial<TemplateForm['status_columns'][number]>,
  ) => {
    const status_columns = form.status_columns.map((column, columnIndex) => {
      if (columnIndex !== index) {
        return column;
      }

      return {
        ...column,
        ...patch,
      };
    });

    onChange({ ...form, status_columns });
  };

  const addStatusColumn = () => {
    onChange({
      ...form,
      status_columns: [
        ...form.status_columns,
        {
          name: '',
          color: '#7e8fb4',
          is_final: false,
        },
      ],
    });
  };

  const removeStatusColumn = (index: number) => {
    const nextColumns = form.status_columns.filter(
      (_, columnIndex) => columnIndex !== index,
    );

    onChange({
      ...form,
      status_columns: nextColumns,
    });
  };

  const moveStatusColumn = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.status_columns.length) return;

    const status_columns = [...form.status_columns];
    const [moved] = status_columns.splice(index, 1);
    status_columns.splice(nextIndex, 0, moved);
    onChange({ ...form, status_columns });
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-4'
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
        className='max-h-[90vh] w-full max-w-[907px] overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/20 md:overflow-auto'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h2 className='text-base font-semibold text-slate-800'>
            {isEditing ? 'Редактирование шаблона' : 'Новый шаблон'}
          </h2>
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
          <Field label='Название шаблона *'>
            <Input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder='Введите название'
              required
            />
          </Field>

          <Field label='Команда шаблона'>
            <MultiSelect
              values={form.member_ids}
              onValuesChange={(member_ids) => onChange({ ...form, member_ids })}
              options={employeeOptions}
              placeholder='Выберите участников'
              emptyText='Нет доступных сотрудников'
              searchPlaceholder='Поиск сотрудника...'
              searchable
            />
          </Field>

          <Field label='Руководитель шаблона'>
            <SearchableSelect
              value={form.manager_id}
              onValueChange={(manager_id) => onChange({ ...form, manager_id })}
              options={employeeOptions}
              placeholder='Выберите руководителя'
            />
          </Field>

          <label className='flex items-center gap-2 rounded-xl border border-[#e3e9f3] bg-[#f8fbff] px-3 py-2 text-[14px] text-[#1f3565]'>
            <input
              type='checkbox'
              checked={form.is_default_template}
              onChange={(event) =>
                onChange({ ...form, is_default_template: event.target.checked })
              }
            />
            <span>Использовать как шаблон по умолчанию для новых проектов</span>
          </label>

          <Field label='Стартовые статусы проекта'>
            <div className='grid gap-3 rounded-2xl border border-[#e3e9f3] bg-[#f8fbff] p-3'>
              {form.status_columns.map((column, index) => (
                <div
                  key={index}
                  className='grid gap-3 rounded-xl border border-[#dbe5f5] bg-white p-3'
                >
                  <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]'>
                    <Input
                      value={column.name}
                      onChange={(event) =>
                        updateStatusColumn(index, { name: event.target.value })
                      }
                      placeholder='Название статуса'
                      required
                    />
                    <Input
                      type='color'
                      value={column.color || '#7e8fb4'}
                      onChange={(event) =>
                        updateStatusColumn(index, { color: event.target.value })
                      }
                    />
                    <div className='flex items-center justify-end gap-2'>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => moveStatusColumn(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => moveStatusColumn(index, 1)}
                        disabled={index === form.status_columns.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => removeStatusColumn(index)}
                        disabled={isStandardTemplateStatus(column)}
                        title={
                          isStandardTemplateStatus(column)
                            ? 'Стандартный статус нельзя удалить'
                            : undefined
                        }
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>

                  <div className='flex flex-wrap items-center gap-4 text-[13px] text-[#1f3565]'>
                    <label className='flex items-center gap-2'>
                      <input
                        type='checkbox'
                        checked={Boolean(column.is_final)}
                        onChange={(event) =>
                          updateStatusColumn(index, { is_final: event.target.checked })
                        }
                      />
                      <span>Финальный статус</span>
                    </label>
                  </div>
                </div>
              ))}

              <div className='flex justify-start'>
                <Button type='button' variant='secondary' onClick={addStatusColumn}>
                  + Добавить статус
                </Button>
              </div>
            </div>
          </Field>

          <div className='mt-2 flex items-center justify-end gap-3'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Отмена
            </Button>
            <Button
              type='submit'
              disabled={isSaving}
              variant={isSaving ? 'secondary' : 'primary'}
            >
              {isSaving
                ? isEditing
                  ? 'Сохранение...'
                  : 'Создание шаблона...'
                : isEditing
                  ? 'Сохранить шаблон'
                  : 'Создать шаблон'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
