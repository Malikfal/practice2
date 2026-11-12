import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { api } from '../api/api';
import { extractApiFieldError } from '../api/core/error';
import AuthField, {
  authInputErrorClasses,
  EmailText,
  isValidEmail,
} from '../components/auth/AuthField';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/FormField';

const cardClassName =
  'grid w-full min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)] sm:gap-4 sm:rounded-2xl sm:p-6';

export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const value = email.trim();
    if (!value) {
      setError('Укажите почту.');
      return;
    }
    if (!isValidEmail(value)) {
      setError('Проверьте адрес почты.');
      return;
    }

    try {
      setBusy(true);
      setError(null);
      await api.forgotPassword(value);
      setSentTo(value);
    } catch (err) {
      setError(
        extractApiFieldError(err, 'email') ??
          (err instanceof Error ? err.message : 'Не удалось отправить письмо.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='mx-auto flex min-h-full w-full max-w-xl flex-col justify-start sm:justify-center'>
      {sentTo ? (
        <div className={cardClassName}>
          <h1 className='text-lg leading-tight font-semibold text-slate-800 sm:text-base'>
            Проверьте почту
          </h1>
          <p className='text-sm leading-5 text-slate-600'>
            Если аккаунт с почтой{' '}
            <span className='font-semibold text-slate-800'>
              <EmailText email={sentTo} />
            </span>{' '}
            есть в ФЛОУ, мы отправили на неё ссылку для смены пароля. Ссылка действует
            ограниченное время.
          </p>
          <p className='text-[13px] leading-5 text-slate-500'>
            Письма нет? Проверьте папку «Спам» или отправьте ещё раз.
          </p>
          <div className='grid gap-2 sm:grid-cols-2'>
            <Button variant='secondary' onClick={() => setSentTo(null)}>
              Отправить ещё раз
            </Button>
            <Link
              to='/'
              className='inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700'
            >
              На страницу входа
            </Link>
          </div>
        </div>
      ) : (
        <form
          className={cardClassName}
          aria-busy={busy}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h1 className='text-lg leading-tight font-semibold text-slate-800 sm:text-base'>
            Восстановление пароля
          </h1>
          <p className='text-sm leading-5 text-slate-600'>
            Укажите почту, с которой входите в ФЛОУ. Мы пришлём ссылку для нового пароля.
          </p>
          <AuthField
            label='Email'
            error={error ?? undefined}
            errorId='forgot-email-error'
          >
            <Input
              type='email'
              inputMode='email'
              autoComplete='email'
              autoCapitalize='none'
              spellCheck={false}
              className={`text-base sm:text-sm ${error ? authInputErrorClasses : ''}`}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'forgot-email-error' : undefined}
              required
            />
          </AuthField>
          <Button type='submit' disabled={busy}>
            {busy ? 'Отправляем...' : 'Получить ссылку'}
          </Button>
          <Link
            to='/'
            className='inline-flex min-h-11 items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline sm:min-h-0'
          >
            Вспомнили пароль? Войти
          </Link>
        </form>
      )}
    </div>
  );
}
