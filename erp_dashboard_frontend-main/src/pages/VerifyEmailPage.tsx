import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { api } from '../api/api';
import { extractApiFieldError } from '../api/core/error';
import { EmailText } from '../components/auth/AuthField';
import ResendVerificationButton from '../components/auth/ResendVerificationButton';
import { Field, Input } from '../components/ui/FormField';
import Preloader from '../components/ui/Preloader';
import { useAppControllerContext } from '../context/AppControllerContext';
import type { User } from '../types/app';

type VerifyOutcome =
  | { kind: 'verified' }
  | { kind: 'already_verified'; email: string }
  | { kind: 'error'; message: string };

// Запрос подтверждения — один на токен за жизнь вкладки. После входа страница
// монтируется заново (StrictMode, смена раскладки), и повтор запроса сломал бы вход.
const verifications = new Map<string, Promise<VerifyOutcome>>();

function verifyOnce(
  token: string,
  completeAuth: (_user: User) => Promise<unknown>,
): Promise<VerifyOutcome> {
  const existing = verifications.get(token);
  if (existing) return existing;

  const verification = (async (): Promise<VerifyOutcome> => {
    try {
      const payload = await api.verifyEmail(token);
      if ('already_verified' in payload) {
        return { kind: 'already_verified', email: payload.email };
      }
      await completeAuth(payload.user);
      toast.success('Почта подтверждена. Добро пожаловать в ФЛОУ!');
      return { kind: 'verified' };
    } catch (err) {
      return {
        kind: 'error',
        message:
          extractApiFieldError(err, 'token') ??
          (err instanceof Error ? err.message : 'Не удалось подтвердить почту.'),
      };
    }
  })();
  verifications.set(token, verification);
  return verification;
}

const cardClassName =
  'grid w-full gap-4 rounded-xl border border-[#e3e9f3] bg-white p-5 shadow-sm sm:p-8';
const primaryLinkClassName =
  'inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400';

// Страница из письма: подтверждает почту и сразу входит в компанию.
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, completeAuth, loginForm, setLoginForm } = useAppControllerContext();
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    void verifyOnce(token, completeAuth).then((result) => {
      if (active) setOutcome(result);
    });
    return () => {
      active = false;
    };
  }, [completeAuth, token]);

  if (token && (!outcome || outcome.kind === 'verified')) {
    return (
      <div className='flex min-h-60 w-full flex-col items-center justify-center gap-3 text-sm text-slate-600'>
        <Preloader size='lg' />
        {outcome ? 'Открываем ФЛОУ...' : 'Подтверждаем почту...'}
      </div>
    );
  }

  if (outcome?.kind === 'already_verified') {
    return (
      <div className='mx-auto flex min-h-full w-full max-w-xl items-start sm:items-center'>
        <div className={`${cardClassName} text-center`}>
          <h1 className='text-xl leading-tight font-bold text-[#1f3565] sm:text-2xl'>
            Почта уже подтверждена
          </h1>
          <p className='text-sm leading-5 text-gray-600'>
            Почта{' '}
            <span className='font-semibold text-[#1f3565]'>
              <EmailText email={outcome.email} />
            </span>{' '}
            подтверждена раньше.
            {user ? '' : ' Войдите в ФЛОУ со своим паролем.'}
          </p>
          {/* «/» сам откроет ФЛОУ, если сессия жива, иначе покажет вход с этой почтой. */}
          <Link
            to='/'
            className={primaryLinkClassName}
            onClick={() => {
              if (!user) setLoginForm({ ...loginForm, email: outcome.email });
            }}
          >
            {user ? 'Перейти в ФЛОУ' : 'Войти'}
          </Link>
        </div>
      </div>
    );
  }

  const failure =
    outcome?.kind === 'error'
      ? outcome.message
      : 'Ссылка неполная. Откройте её из письма целиком.';

  return (
    <div className='mx-auto flex min-h-full w-full max-w-xl items-start sm:items-center'>
      <div className={cardClassName}>
        <div className='text-center'>
          <h1 className='text-xl leading-tight font-bold text-[#1f3565] sm:text-2xl'>
            Не удалось подтвердить почту
          </h1>
          <p className='mt-2 text-sm leading-5 text-gray-600'>{failure}</p>
          <p className='mt-1 text-sm leading-5 text-gray-600'>
            Отправим новое письмо: укажите почту, на которую регистрировали компанию.
          </p>
        </div>
        <Field label='Email'>
          <Input
            type='email'
            inputMode='email'
            autoComplete='email'
            autoCapitalize='none'
            spellCheck={false}
            className='text-base sm:text-sm'
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <ResendVerificationButton email={email} variant='primary' className='w-full' />
        <Link
          to='/'
          className='inline-flex min-h-11 items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline'
        >
          На страницу входа
        </Link>
      </div>
    </div>
  );
}
