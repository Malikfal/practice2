import type { ChangeEvent } from 'react';

import Button from '../ui/Button';
import { Field, inputBaseClasses } from '../ui/FormField';
import PasswordInput from '../ui/PasswordInput';
import type { PasswordForm } from '../../types/app';

export default function PasswordSection({
  form,
  isUpdatingPassword,
  onChange,
  onSubmit,
}: {
  form: PasswordForm;
  isUpdatingPassword: boolean;
  onChange: (_next: PasswordForm) => void;
  onSubmit: () => void;
}) {
  return (
    <section className='grid gap-3 rounded-2xl border border-slate-200 bg-white p-4'>
      <h2 className='text-base font-semibold text-slate-800'>Смена пароля</h2>
      <Field label='Текущий пароль'>
        <PasswordInput
          className={inputBaseClasses}
          value={form.current_password}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...form, current_password: e.target.value })
          }
          autoComplete='current-password'
          required
        />
      </Field>
      <Field label='Новый пароль'>
        <PasswordInput
          className={inputBaseClasses}
          value={form.password}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...form, password: e.target.value })
          }
          autoComplete='new-password'
          required
        />
      </Field>
      <Field label='Повтор нового пароля'>
        <PasswordInput
          className={inputBaseClasses}
          value={form.password_confirmation}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...form, password_confirmation: e.target.value })
          }
          autoComplete='new-password'
          required
        />
      </Field>
      <Button
        onClick={onSubmit}
        type='button'
        size='md'
        className='justify-self-start h-9 px-4 text-sm'
        disabled={isUpdatingPassword}
        variant={isUpdatingPassword ? 'secondary' : 'primary'}
      >
        {isUpdatingPassword ? 'Обновление пароля...' : 'Обновить пароль'}
      </Button>
    </section>
  );
}
