import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SmartCaptcha } from '@yandex/smart-captcha';

import { FREE_PLAN_USERS_LABEL } from '../../constants/tariffs';
import { extractPhoneDigits, formatPhoneNumber } from '../../utils/formatters';
import Button from '../ui/Button';
import { Input } from '../ui/FormField';
import PasswordInput from '../ui/PasswordInput';
import AuthField, { authInputErrorClasses, FieldError } from './AuthField';

export const SMARTCAPTCHA_SITE_KEY = String(
  import.meta.env.VITE_SMARTCAPTCHA_SITE_KEY ?? '',
).trim();

export interface RegisterFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  password: string;
  password_confirmation: string;
  personal_data_consent: boolean;
  marketing_consent: boolean;
}

export type RegisterFormErrors = Partial<Record<keyof RegisterFormData | 'form', string>>;

interface RegisterFormProps {
  formData: RegisterFormData;
  errors: RegisterFormErrors;
  onChange: (_data: RegisterFormData) => void;
  onSubmit: (_e: React.FormEvent) => void;
  onCaptchaSuccess: (_token: string) => void;
  /** Меняется после ошибки отправки, чтобы капча показалась заново: её токен одноразовый. */
  captchaKey: number;
  loading?: boolean;
  /** Почта уже зарегистрирована: под ошибкой показываем «Войти» и «Восстановить пароль». */
  isEmailTaken?: boolean;
}

// Телефон в России: 10 цифр, начинающихся с 9, — это номер без кода страны.
function toRussianPhone(value: string) {
  const digits = extractPhoneDigits(value);
  return digits.startsWith('9') ? `7${digits}` : digits;
}

export default function RegisterForm({
  formData,
  errors,
  onChange,
  onSubmit,
  onCaptchaSuccess,
  captchaKey,
  loading = false,
  isEmailTaken = false,
}: RegisterFormProps) {
  const set = <K extends keyof RegisterFormData>(key: K, value: RegisterFormData[K]) =>
    onChange({ ...formData, [key]: value });

  const inputProps = (key: keyof RegisterFormData) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `register-${key}-error` : undefined,
    className: `text-base sm:text-sm ${errors[key] ? authInputErrorClasses : ''}`,
  });

  return (
    <div className='mx-auto w-full max-w-2xl pb-2 sm:pb-4'>
      <div className='mb-2 sm:mb-4'>
        <Link
          to='/'
          className='inline-flex min-h-11 items-center rounded text-sm text-gray-500 hover:text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:min-h-0'
        >
          ← Вернуться на страницу входа
        </Link>
      </div>

      <div className='rounded-xl border border-[#e3e9f3] bg-white p-4 shadow-sm sm:p-6 md:p-8'>
        <form
          onSubmit={onSubmit}
          noValidate
          className='min-w-0 space-y-5 sm:space-y-6'
          aria-busy={loading}
        >
          <div className='text-center'>
            <h1 className='text-xl leading-tight font-bold text-[#1f3565] sm:text-2xl md:text-3xl'>
              Регистрация компании в <span className='text-blue-600'>ФЛОУ</span>
            </h1>
            <p className='mt-2 text-sm leading-5 text-gray-600'>
              Создайте компанию и начните работать сразу после подтверждения почты
            </p>
          </div>

          <div className='flex items-start gap-3 rounded-lg border border-[#dce7ff] bg-[#f5f8ff] p-3 text-sm leading-5 text-[#1f3565]'>
            <span className='mt-0.5 inline-flex shrink-0 items-center rounded-md bg-[#2d6ff7] px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-white uppercase'>
              ФРИ
            </span>
            <p className='min-w-0'>
              Компания начнёт работу на бесплатном тарифе ФРИ: до {FREE_PLAN_USERS_LABEL}{' '}
              пользователей, без привязки карты. Перейти на ПРО можно в любой момент в
              настройках.
            </p>
          </div>

          <fieldset className='grid gap-4'>
            <legend className='sr-only'>Владелец компании</legend>
            <div className='grid gap-4 sm:grid-cols-2'>
              <AuthField
                label='Имя'
                error={errors.first_name}
                errorId='register-first_name-error'
              >
                <Input
                  {...inputProps('first_name')}
                  name='first_name'
                  autoComplete='given-name'
                  autoCapitalize='words'
                  value={formData.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  required
                />
              </AuthField>
              <AuthField
                label='Фамилия'
                error={errors.last_name}
                errorId='register-last_name-error'
              >
                <Input
                  {...inputProps('last_name')}
                  name='last_name'
                  autoComplete='family-name'
                  autoCapitalize='words'
                  value={formData.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  required
                />
              </AuthField>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <AuthField
                label='Email'
                error={errors.email}
                errorId='register-email-error'
                errorActions={
                  isEmailTaken ? (
                    <span className='flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium'>
                      <Link to='/' className='text-blue-600 hover:underline'>
                        Войти
                      </Link>
                      <Link
                        to={`/forgot-password?email=${encodeURIComponent(formData.email.trim())}`}
                        className='text-blue-600 hover:underline'
                      >
                        Восстановить пароль
                      </Link>
                    </span>
                  ) : null
                }
              >
                <Input
                  {...inputProps('email')}
                  type='email'
                  name='email'
                  inputMode='email'
                  autoComplete='email'
                  autoCapitalize='none'
                  spellCheck={false}
                  value={formData.email}
                  onChange={(e) => set('email', e.target.value)}
                  required
                />
              </AuthField>
              <AuthField
                label='Телефон'
                error={errors.phone}
                errorId='register-phone-error'
              >
                <Input
                  {...inputProps('phone')}
                  type='tel'
                  name='phone'
                  inputMode='tel'
                  autoComplete='tel'
                  placeholder='+7 (900) 000-00-00'
                  value={formData.phone}
                  onChange={(e) => {
                    // Маска как в профиле: стирание скобки или дефиса убирает и цифру перед ним.
                    const next = e.target.value;
                    let formatted = formatPhoneNumber(toRussianPhone(next));
                    if (
                      next.length < formData.phone.length &&
                      formatted === formData.phone
                    ) {
                      formatted = formatPhoneNumber(toRussianPhone(next).slice(0, -1));
                    }
                    set('phone', formatted);
                  }}
                  required
                />
              </AuthField>
            </div>

            <AuthField
              label='Название компании'
              error={errors.company_name}
              errorId='register-company_name-error'
            >
              <Input
                {...inputProps('company_name')}
                name='company_name'
                autoComplete='organization'
                value={formData.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                required
              />
            </AuthField>

            <div className='grid gap-4 sm:grid-cols-2'>
              <AuthField
                label='Пароль'
                error={errors.password}
                errorId='register-password-error'
                hint='Не короче 8 символов.'
              >
                <PasswordInput
                  {...inputProps('password')}
                  name='password'
                  autoComplete='new-password'
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => set('password', e.target.value)}
                  required
                />
              </AuthField>
              <AuthField
                label='Повторите пароль'
                error={errors.password_confirmation}
                errorId='register-password_confirmation-error'
              >
                <PasswordInput
                  {...inputProps('password_confirmation')}
                  name='password_confirmation'
                  autoComplete='new-password'
                  minLength={8}
                  value={formData.password_confirmation}
                  onChange={(e) => set('password_confirmation', e.target.value)}
                  required
                />
              </AuthField>
            </div>
          </fieldset>

          <div className='grid gap-1.5'>
            <label className='flex min-w-0 cursor-pointer items-start gap-3 text-sm leading-5 text-gray-600'>
              <input
                type='checkbox'
                name='personal_data_consent'
                className='mt-0.5 size-5 shrink-0 accent-blue-600'
                checked={formData.personal_data_consent}
                onChange={(e) => set('personal_data_consent', e.target.checked)}
                aria-invalid={errors.personal_data_consent ? true : undefined}
                required
              />
              <span className='min-w-0 text-slate-500'>
                Принимаю условия{' '}
                <a
                  href='https://flow-erp.ru/policy'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='break-words text-blue-600 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
                >
                  «Политики обработки персональных данных»
                </a>{' '}
                и даю{' '}
                <a
                  href='https://flow-erp.ru/approval'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='break-words text-blue-600 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
                >
                  «Согласие на обработку персональных данных»
                </a>
              </span>
            </label>
            <FieldError
              id='register-personal_data_consent-error'
              message={errors.personal_data_consent}
            />
          </div>

          <label className='flex min-w-0 cursor-pointer items-start gap-3 text-sm leading-5 text-gray-600'>
            <input
              type='checkbox'
              name='marketing_consent'
              className='mt-0.5 size-5 shrink-0 accent-blue-600'
              checked={formData.marketing_consent}
              onChange={(e) => set('marketing_consent', e.target.checked)}
            />
            <span className='min-w-0 text-slate-500'>
              Принимаю условия{' '}
              <a
                href='/docs/marketing-consent.pdf'
                target='_blank'
                rel='noopener noreferrer'
                className='break-words text-blue-600 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
              >
                «Согласия на получение рекламных и информационных сообщений»
              </a>
            </span>
          </label>

          {SMARTCAPTCHA_SITE_KEY ? (
            <div className='registration-captcha min-w-0 overflow-hidden'>
              <SmartCaptcha
                key={captchaKey}
                sitekey={SMARTCAPTCHA_SITE_KEY}
                onSuccess={onCaptchaSuccess}
              />
            </div>
          ) : null}

          {errors.form ? (
            <p
              role='alert'
              className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700'
            >
              {errors.form}
            </p>
          ) : null}

          <Button type='submit' disabled={loading} className='w-full'>
            {loading ? 'Создаём компанию...' : 'Зарегистрировать компанию'}
          </Button>

          <p className='text-center text-sm text-slate-600'>
            Уже есть аккаунт?{' '}
            <Link
              to='/'
              className='font-medium text-blue-600 hover:text-blue-800 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
            >
              Войти
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
