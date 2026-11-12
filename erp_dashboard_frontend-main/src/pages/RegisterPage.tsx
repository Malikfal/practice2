import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { api } from '../api/api';
import { ApiRequestError } from '../api/core/error';
import { EmailText, isValidEmail } from '../components/auth/AuthField';
import ResendVerificationButton from '../components/auth/ResendVerificationButton';
import RegisterForm, {
  SMARTCAPTCHA_SITE_KEY,
  type RegisterFormData,
  type RegisterFormErrors,
} from '../components/auth/RegisterForm';
import { isValidPhone, normalizePhoneDigits } from '../utils/formatters';

const INITIAL_FORM: RegisterFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  company_name: '',
  password: '',
  password_confirmation: '',
  personal_data_consent: false,
  marketing_consent: false,
};

const FORM_FIELDS = Object.keys(INITIAL_FORM) as Array<keyof RegisterFormData>;

// Проверки до отправки: сразу подсвечиваем пустые поля, не дожидаясь ответа сервера.
function validate(form: RegisterFormData): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  if (!form.first_name.trim()) errors.first_name = 'Укажите имя.';
  if (!form.last_name.trim()) errors.last_name = 'Укажите фамилию.';
  if (!form.email.trim()) errors.email = 'Укажите почту.';
  else if (!isValidEmail(form.email)) errors.email = 'Проверьте адрес почты.';
  if (!form.phone.trim()) errors.phone = 'Укажите телефон.';
  else if (!isValidPhone(form.phone))
    errors.phone = 'Введите номер в формате +7 (XXX) XXX-XX-XX.';
  if (!form.company_name.trim()) errors.company_name = 'Укажите название компании.';
  if (!form.password) errors.password = 'Придумайте пароль.';
  else if (form.password.length < 8)
    errors.password = 'Пароль должен быть не короче 8 символов.';
  if (!form.password_confirmation) errors.password_confirmation = 'Повторите пароль.';
  else if (form.password_confirmation !== form.password)
    errors.password_confirmation = 'Пароли не совпадают.';
  if (!form.personal_data_consent)
    errors.personal_data_consent =
      'Необходимо согласие на обработку персональных данных.';
  return errors;
}

function serverErrors(err: unknown): RegisterFormErrors {
  if (!(err instanceof ApiRequestError)) {
    return {
      form: err instanceof Error ? err.message : 'Не удалось зарегистрироваться.',
    };
  }
  const result: RegisterFormErrors = {};
  const fieldErrors = err.body?.errors ?? {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (!message) continue;
    if ((FORM_FIELDS as string[]).includes(key)) {
      result[key as keyof RegisterFormData] = message;
    } else {
      // Капча и прочие ошибки без своего поля показываем над кнопкой.
      result.form = result.form ?? message;
    }
  }
  if (Object.keys(result).length === 0) result.form = err.message;
  return result;
}

// Сервер отвечает так, если почта уже есть в ФЛОУ (у владельца или сотрудника).
function isEmailTakenError(message?: string) {
  return Boolean(message && /уже зарегистрирован/i.test(message));
}

export default function RegisterPage() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isEmailTaken, setIsEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  // Экран «Проверьте почту» живёт в адресе (?sent=почта), чтобы пережить обновление страницы.
  const [searchParams, setSearchParams] = useSearchParams();
  const registeredEmail = searchParams.get('sent');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);

  const updateForm = (next: RegisterFormData) => {
    // Ошибка поля пропадает, как только его начали править.
    setErrors((prev) => {
      const cleaned = { ...prev };
      for (const key of FORM_FIELDS) {
        if (next[key] !== formData[key]) delete cleaned[key];
      }
      delete cleaned.form;
      return cleaned;
    });
    if (next.email !== formData.email) setIsEmailTaken(false);
    setFormData(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const localErrors = validate(formData);
    if (SMARTCAPTCHA_SITE_KEY && !captchaToken) {
      localErrors.form = 'Подтвердите, что вы не робот.';
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await api.registerCompany({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: `+${normalizePhoneDigits(formData.phone)}`,
        company_name: formData.company_name.trim(),
        password: formData.password,
        password_confirmation: formData.password_confirmation,
        personal_data_consent: true,
        marketing_consent: formData.marketing_consent,
        ...(SMARTCAPTCHA_SITE_KEY ? { smartcaptcha_token: captchaToken } : {}),
      });
      setSearchParams(
        { sent: response.email || formData.email.trim() },
        { replace: true },
      );
    } catch (err) {
      const nextErrors = serverErrors(err);
      setErrors(nextErrors);
      setIsEmailTaken(isEmailTakenError(nextErrors.email));
      // Токен капчи одноразовый: после неудачной попытки нужен новый.
      setCaptchaToken('');
      setCaptchaKey((prev) => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <div className='mx-auto flex min-h-full w-full max-w-xl items-start sm:items-center'>
        <div className='w-full rounded-xl border border-[#e3e9f3] bg-white p-5 text-center shadow-sm sm:p-8'>
          <div className='mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-50 sm:mb-5 sm:size-16'>
            <svg
              viewBox='0 0 24 24'
              className='size-8 fill-none stroke-blue-600 stroke-[1.8] sm:size-9 [stroke-linecap:round] [stroke-linejoin:round]'
              aria-hidden='true'
            >
              <rect x='3' y='5' width='18' height='14' rx='2.5' />
              <path d='m4 7 8 6 8-6' />
            </svg>
          </div>
          <h1 className='text-xl leading-tight font-bold text-[#1f3565] sm:text-2xl'>
            Проверьте почту
          </h1>
          <p className='mt-2 text-sm leading-5 text-gray-600'>
            Компания создана. Мы отправили письмо на
          </p>
          <p className='mt-1 text-base leading-6 font-semibold text-[#1f3565]'>
            <EmailText email={registeredEmail} />
          </p>
          <p className='mt-1 text-sm leading-5 text-gray-600'>
            Перейдите по ссылке из письма, чтобы подтвердить почту и войти в ФЛОУ.
          </p>
          <p className='mt-2 text-[13px] leading-5 text-gray-500'>
            Письмо может прийти в течение нескольких минут. Если его нет, проверьте папку
            «Спам».
          </p>
          <div className='mt-6 grid gap-2 sm:flex sm:justify-center'>
            <ResendVerificationButton
              email={registeredEmail}
              startWithCooldown
              className='w-full sm:w-auto'
            />
            <Link
              to='/'
              className='inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
            >
              На страницу входа
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RegisterForm
      formData={formData}
      errors={errors}
      onChange={updateForm}
      onSubmit={handleSubmit}
      loading={loading}
      isEmailTaken={isEmailTaken}
      onCaptchaSuccess={setCaptchaToken}
      captchaKey={captchaKey}
    />
  );
}
