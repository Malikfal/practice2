import { useRef, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';

import Button from '../../ui/Button';
import { Field, Input, PhoneInput, Select, SuggestInput } from '../../ui/FormField';
import type { EmployeeCreateForm, RoleOption } from '../../../types/app';

import PasswordGeneratorField from './components/PasswordGeneratorField';

export default function EmployeeModal({
  isOpen,
  isAdding,
  form,
  onChange,
  onClose,
  onSubmit,
  onGeneratePassword,
  roleOptions = [],
  positionSuggestions = [],
}: {
  isOpen: boolean;
  isAdding: boolean;
  form: EmployeeCreateForm;
  onChange: (_nextForm: EmployeeCreateForm) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  onGeneratePassword?: () => void;
  roleOptions?: RoleOption[];
  positionSuggestions?: string[];
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);

  if (!isOpen) return null;

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
        className='max-h-[calc(100dvh-1rem)] w-full max-w-259.25 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:max-h-[90vh] md:overflow-auto md:rounded-2xl md:p-5'
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <h2 className='mb-5 text-[18px] leading-none font-semibold'>Новый сотрудник</h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(event);
          }}
          className='grid gap-3'
        >
          <div className='grid gap-3 md:grid-cols-2'>
            <Field label='Имя *'>
              <Input
                value={form.first_name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...form, first_name: e.target.value })
                }
                required
                placeholder='Введите имя'
                className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
              />
            </Field>
            <Field label='Фамилия *'>
              <Input
                value={form.last_name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...form, last_name: e.target.value })
                }
                required
                placeholder='Введите фамилию'
                className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
              />
            </Field>
          </div>

          <Field label='Email *'>
            <Input
              type='email'
              value={form.email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...form, email: e.target.value })
              }
              required
              placeholder='Введите email'
              className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
            />
          </Field>

          <PasswordGeneratorField
            value={form.password}
            onChange={(password) => onChange({ ...form, password })}
            onGeneratePassword={onGeneratePassword}
          />

          <div className='grid gap-3'>
            <Field label='Роль *'>
              <Select
                value={form.role}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  onChange({ ...form, role: e.target.value })
                }
                required
                className='rounded-xl border-[#e3e9f3] text-[#1f3565] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
              >
                {!roleOptions.length ? (
                  <option value='' disabled>
                    Роли загружаются...
                  </option>
                ) : null}
                {roleOptions.map((role) => (
                  <option
                    key={role.role_id || role.value}
                    value={role.role_id || role.value}
                  >
                    {role.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label='Должность'>
              <SuggestInput
                value={form.position}
                onValueChange={(next) => onChange({ ...form, position: next })}
                suggestions={positionSuggestions}
                placeholder='Выберите должность или введите новую здесь...'
                className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
              />
            </Field>

            <div className='grid gap-3 md:grid-cols-2'>
              <Field label='Дата рождения'>
                <Input
                  type='date'
                  value={form.birthday}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange({ ...form, birthday: e.target.value })
                  }
                  className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
                />
              </Field>

              <Field label='Телефон'>
                <PhoneInput
                  value={form.phone}
                  onValueChange={(next) => onChange({ ...form, phone: next })}
                  placeholder='+7 (XXX) XXX-XX-XX'
                />
              </Field>
            </div>

            <div className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3'>
              <div className='text-[13px] leading-none font-medium text-[#1f3565]'>
                Контакты
              </div>
              <div className='grid gap-3'>
                <Field label='Доп. почта'>
                  <Input
                    type='email'
                    value={form.socials.additional_email ?? ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onChange({
                        ...form,
                        socials: { ...form.socials, additional_email: e.target.value },
                      })
                    }
                    placeholder='email@example.com'
                    className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
                  />
                </Field>
                <Field label='Доп. телефон'>
                  <PhoneInput
                    value={form.socials.additional_phone ?? ''}
                    onValueChange={(next) =>
                      onChange({
                        ...form,
                        socials: { ...form.socials, additional_phone: next },
                      })
                    }
                    placeholder='+7 (XXX) XXX-XX-XX'
                  />
                </Field>
              </div>
              <Field label='Макс'>
                <Input
                  value={form.socials.max_url}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange({
                      ...form,
                      socials: { ...form.socials, max_url: e.target.value },
                    })
                  }
                  placeholder='https://max.example.com/profile'
                  className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
                />
              </Field>
              <Field label='Вконтакте'>
                <Input
                  value={form.socials.vk_url}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange({
                      ...form,
                      socials: { ...form.socials, vk_url: e.target.value },
                    })
                  }
                  placeholder='https://vk.com/id'
                  className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
                />
              </Field>
              <Field label='Телеграм'>
                <Input
                  value={form.socials.telegram_url}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange({
                      ...form,
                      socials: { ...form.socials, telegram_url: e.target.value },
                    })
                  }
                  placeholder='https://t.me/username'
                  className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
                />
              </Field>
            </div>

            <Field label='Компетенции'>
              <Input
                value={form.skills}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...form, skills: e.target.value })
                }
                placeholder='Например: HTML, Node.js'
                className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
              />
            </Field>
          </div>
          <div className='mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end'>
            <Button
              type='button'
              variant='secondary'
              onClick={onClose}
              className='h-10 rounded-xl border-[#e3e9f3] bg-white px-4 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
            >
              Отмена
            </Button>
            <Button
              type='submit'
              disabled={isAdding}
              variant='secondary'
              className='h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-5 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#2d6ff7]! disabled:text-white! disabled:opacity-80'
            >
              {isAdding ? 'Добавление...' : 'Добавить сотрудника'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
