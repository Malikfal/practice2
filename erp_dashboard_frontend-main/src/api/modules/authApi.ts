import type { ApiMutationResponse, AuthPayload } from '../../types/app';

export interface RegisterCompanyPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  password: string;
  password_confirmation: string;
  personal_data_consent: boolean;
  marketing_consent: boolean;
  smartcaptcha_token?: string;
}

export function createAuthApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  return {
    login: (credentials: { email: string; password: string }) =>
      request<AuthPayload>('/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),

    logout: () =>
      request<ApiMutationResponse>('/logout', {
        method: 'POST',
      }),

    // Самостоятельная регистрация компании: компания стартует на тарифе ФРИ.
    registerCompany: (payload: RegisterCompanyPayload) =>
      request<{ message: string; email: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    resendVerificationEmail: (email: string) =>
      request<{ message: string }>('/auth/email/resend', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    // Подтверждение почты сразу выполняет вход: сервер ставит cookies сессии.
    // Повторный переход по ссылке уже подтверждённой почты не входит: already_verified.
    verifyEmail: (token: string) =>
      request<AuthPayload | { already_verified: true; email: string }>(
        '/auth/email/verify',
        {
          method: 'POST',
          body: JSON.stringify({ token }),
        },
      ),

    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (payload: {
      token: string;
      password: string;
      password_confirmation: string;
    }) =>
      request<{ message: string; email?: string }>('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    // Проверяет ссылку смены пароля до показа формы, токен при этом не расходуется.
    checkResetToken: (token: string) =>
      request<{ valid: boolean; email: string }>('/auth/password/check', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  };
}
