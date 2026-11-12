import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Link } from 'react-router';

import Button from '../ui/Button';
import { Field, Input } from '../ui/FormField';
import PasswordInput from '../ui/PasswordInput';
import type { LoginForm as LoginFormModel } from '../../types/app';

export default function LoginForm({
  form,
  onChange,
  onSubmit,
  loading,
  notice,
}: {
  form: LoginFormModel;
  onChange: (_next: LoginFormModel) => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  /** Сообщение над кнопкой входа, например о неподтверждённой почте. */
  notice?: ReactNode;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event);
      }}
      className='grid w-full min-w-0 self-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)] sm:gap-4 sm:rounded-2xl sm:p-6'
      aria-busy={loading}
    >
      <h1 className='text-lg leading-tight font-semibold text-slate-800 sm:text-base'>
        Вход в систему
      </h1>
      <Field label='Email'>
        <Input
          type='email'
          inputMode='email'
          autoComplete='email'
          autoCapitalize='none'
          spellCheck={false}
          className='text-base sm:text-sm'
          value={form.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...form, email: e.target.value })
          }
          required
        />
      </Field>
      <div className='grid gap-1.5'>
        <Field label='Пароль'>
          <PasswordInput
            className='text-base sm:text-sm'
            value={form.password}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...form, password: e.target.value })
            }
            autoComplete='current-password'
            required
          />
        </Field>
        <Link
          to={
            form.email.trim()
              ? `/forgot-password?email=${encodeURIComponent(form.email.trim())}`
              : '/forgot-password'
          }
          className='inline-flex min-h-11 items-center justify-self-end rounded text-[13px] font-medium text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:min-h-0'
        >
          Забыли пароль?
        </Link>
      </div>
      {notice}
      <p className='text-xs leading-5 text-slate-500'>
        Нажимая кнопку «Войти», вы принимаете условия{' '}
        <a
          href='https://flow-erp.ru/policy'
          target='_blank'
          rel='noopener noreferrer'
          className='break-words text-blue-600 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
        >
          «Политики обработки персональных данных»
        </a>{' '}
        и даёте{' '}
        <a
          href='https://flow-erp.ru/approval'
          target='_blank'
          rel='noopener noreferrer'
          className='break-words text-blue-600 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
        >
          «Согласие на обработку персональных данных»
        </a>
        .
      </p>
      <Button disabled={loading} type='submit'>
        {loading ? 'Входим...' : 'Войти'}
      </Button>
    </form>
  );
}
