import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { api } from '../api/api';
import { extractApiFieldError } from '../api/core/error';
import AuthField, {
  authInputErrorClasses,
  EmailText,
} from '../components/auth/AuthField';
import Button from '../components/ui/Button';
import PasswordInput from '../components/ui/PasswordInput';
import Preloader from '../components/ui/Preloader';
import { useAppControllerContext } from '../context/AppControllerContext';

type Errors = { password?: string; password_confirmation?: string };

type TokenCheck =
  | { status: 'checking' }
  | { status: 'valid'; email: string }
  | { status: 'invalid'; message: string };

const cardClassName =
  'grid w-full min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)] sm:gap-4 sm:rounded-2xl sm:p-6';

const INVALID_LINK_MESSAGE = 'Ссылка недействительна или устарела. Запросите новую.';

function validate(password: string, confirmation: string): Errors {
  const errors: Errors = {};
  if (!password) errors.password = 'Придумайте пароль.';
  else if (password.length < 8)
    errors.password = 'Пароль должен быть не короче 8 символов.';
  if (!confirmation) errors.password_confirmation = 'Повторите пароль.';
  else if (confirmation !== password)
    errors.password_confirmation = 'Пароли не совпадают.';
  return errors;
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginForm, setLoginForm } = useAppControllerContext();
  const token = params.get('token') ?? '';
  const [check, setCheck] = useState<TokenCheck>({ status: 'checking' });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  // Ссылку проверяем до показа формы: по устаревшей не нужно придумывать пароль.
  useEffect(() => {
    if (!token) return;
    let active = true;
    api
      .checkResetToken(token)
      .then((response) => {
        if (!active) return;
        setCheck(
          response.valid
            ? { status: 'valid', email: response.email }
            : { status: 'invalid', message: INVALID_LINK_MESSAGE },
        );
      })
      .catch((err: unknown) => {
        if (!active) return;
        setCheck({
          status: 'invalid',
          message: extractApiFieldError(err, 'token') ?? INVALID_LINK_MESSAGE,
        });
      });
    return () => {
      active = false;
    };
  }, [token]);

  const tokenState: TokenCheck = token
    ? check
    : { status: 'invalid', message: 'Ссылка неполная. Откройте её из письма целиком.' };
  const accountEmail = tokenState.status === 'valid' ? tokenState.email : '';

  const submit = async () => {
    const localErrors = validate(password, confirmation);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    try {
      setBusy(true);
      setErrors({});
      const response = await api.resetPassword({
        token,
        password,
        password_confirmation: confirmation,
      });
      // На входе почта уже подставлена: остаётся ввести новый пароль.
      setLoginForm({ ...loginForm, email: response.email || accountEmail, password: '' });
      toast.success(response.message || 'Пароль изменён. Войдите с новым паролем.');
      navigate('/', { replace: true });
    } catch (err) {
      const tokenError = extractApiFieldError(err, 'token');
      if (tokenError) {
        setCheck({ status: 'invalid', message: tokenError });
        return;
      }
      const fieldErrors: Errors = {
        password: extractApiFieldError(err, 'password'),
        password_confirmation: extractApiFieldError(err, 'password_confirmation'),
      };
      setErrors(fieldErrors);
      if (!fieldErrors.password && !fieldErrors.password_confirmation) {
        toast.error(err instanceof Error ? err.message : 'Не удалось сменить пароль.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (tokenState.status === 'checking') {
    return (
      <div className='flex min-h-60 w-full flex-col items-center justify-center gap-3 text-sm text-slate-600'>
        <Preloader size='lg' />
        Проверяем ссылку...
      </div>
    );
  }

  if (tokenState.status === 'invalid') {
    return (
      <div className='mx-auto flex min-h-full w-full max-w-xl flex-col justify-start sm:justify-center'>
        <div className={cardClassName}>
          <h1 className='text-lg leading-tight font-semibold text-slate-800 sm:text-base'>
            Ссылка не подходит
          </h1>
          <p role='alert' className='text-sm leading-5 text-slate-600'>
            {tokenState.message}
          </p>
          <Link
            to='/forgot-password'
            className='inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700'
          >
            Запросить новую ссылку
          </Link>
          <Link
            to='/'
            className='inline-flex min-h-11 items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline sm:min-h-0'
          >
            На страницу входа
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='mx-auto flex min-h-full w-full max-w-xl flex-col justify-start sm:justify-center'>
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
          Новый пароль
        </h1>
        <p className='text-sm leading-5 text-slate-600'>
          Аккаунт{' '}
          <span className='font-semibold text-slate-800'>
            <EmailText email={accountEmail} />
          </span>
        </p>
        {/* Менеджер паролей сохранит новый пароль для этой почты. */}
        <input
          type='email'
          name='username'
          autoComplete='username'
          value={accountEmail}
          readOnly
          hidden
        />
        <AuthField
          label='Новый пароль'
          error={errors.password}
          errorId='reset-password-error'
          hint='Не короче 8 символов.'
        >
          <PasswordInput
            name='password'
            autoComplete='new-password'
            className={`text-base sm:text-sm ${errors.password ? authInputErrorClasses : ''}`}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
          />
        </AuthField>
        <AuthField
          label='Повторите пароль'
          error={errors.password_confirmation}
          errorId='reset-password_confirmation-error'
        >
          <PasswordInput
            name='password_confirmation'
            autoComplete='new-password'
            className={`text-base sm:text-sm ${
              errors.password_confirmation ? authInputErrorClasses : ''
            }`}
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setErrors((prev) => ({ ...prev, password_confirmation: undefined }));
            }}
            aria-invalid={errors.password_confirmation ? true : undefined}
            aria-describedby={
              errors.password_confirmation
                ? 'reset-password_confirmation-error'
                : undefined
            }
          />
        </AuthField>
        <Button type='submit' disabled={busy}>
          {busy ? 'Сохраняем...' : 'Сохранить пароль'}
        </Button>
        <Link
          to='/'
          className='inline-flex min-h-11 items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline sm:min-h-0'
        >
          На страницу входа
        </Link>
      </form>
    </div>
  );
}
