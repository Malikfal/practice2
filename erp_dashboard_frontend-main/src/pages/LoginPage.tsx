import { useAppControllerContext } from '../context/AppControllerContext';
import LoginForm from '../components/auth/LoginForm';
import { EmailText } from '../components/auth/AuthField';
import ResendVerificationButton from '../components/auth/ResendVerificationButton';
import { Link } from 'react-router';

export default function LoginPage() {
  const { loginForm, setLoginForm, onLogin, loading, unverifiedEmail } =
    useAppControllerContext();

  return (
    <div className='mx-auto flex min-h-full w-full max-w-xl flex-col justify-start sm:justify-center'>
      <LoginForm
        form={loginForm}
        onChange={setLoginForm}
        onSubmit={onLogin}
        loading={loading}
        notice={
          unverifiedEmail ? (
            <div
              role='alert'
              className='grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900'
            >
              <p>
                Почта{' '}
                <span className='font-semibold'>
                  <EmailText email={unverifiedEmail} />
                </span>{' '}
                ещё не подтверждена. Перейдите по ссылке из письма, которое мы отправили
                при регистрации.
              </p>
              <ResendVerificationButton email={unverifiedEmail} className='w-full' />
            </div>
          ) : null
        }
      />
      <p className='mt-3 text-center text-sm leading-5 text-slate-600 sm:mt-4'>
        <span className='block sm:inline'>У вас ещё нет компании?</span>{' '}
        <Link
          to='/register-company'
          className='inline-flex min-h-11 items-center justify-center font-semibold text-blue-600 hover:text-blue-800 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:min-h-0 sm:font-medium'
        >
          Зарегистрировать бесплатно
        </Link>
      </p>
    </div>
  );
}
