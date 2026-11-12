import { API_URL } from '../../constants/app';
import { TARIFF_FEATURE_LOCKED_EVENT } from '../../constants/tariffs';
import type { ApiErrorBody } from '../../types/app';
import { ApiRequestError, extractApiErrorMessage, translateErrorMessage } from './error';
import { clearTokens } from './tokens';

let refreshPromise: Promise<void> | null = null;

type RequestFn = <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>;

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath === '/') return;

  window.location.replace('/');
}

export function createRequest(): RequestFn {
  return async function request<TResponse>(
    path: string,
    options: RequestInit = {},
  ): Promise<TResponse> {
    const runRequest = async () => {
      const isFormDataBody =
        typeof FormData !== 'undefined' && options.body instanceof FormData;

      const baseHeaders = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };

      const headers = isFormDataBody
        ? {
            ...baseHeaders,
            ...(options.headers ?? {}),
          }
        : {
            ...baseHeaders,
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
          };

      let response: Response;

      try {
        response = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : undefined;
        throw new Error(translateErrorMessage(message));
      }

      const contentType = response.headers.get('content-type') ?? '';
      const body = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : await response.blob();

      return { response, body };
    };

    let { response, body } = await runRequest();

    if (
      response.status === 401 &&
      path !== '/auth/refresh' &&
      path !== '/client/auth/refresh'
    ) {
      try {
        const refreshPath = path.startsWith('/client/')
          ? '/client/auth/refresh'
          : '/auth/refresh';
        refreshPromise ??= fetch(`${API_URL}${refreshPath}`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
        })
          .then(async (refreshResponse) => {
            const refreshBody: ApiErrorBody = await refreshResponse
              .json()
              .catch(() => ({}));

            if (!refreshResponse.ok) {
              throw new Error(
                extractApiErrorMessage(refreshBody, refreshResponse.status),
              );
            }
          })
          .finally(() => {
            refreshPromise = null;
          });

        await refreshPromise;
        ({ response, body } = await runRequest());
      } catch (refreshError) {
        clearTokens();
        redirectToLogin();
        const message = refreshError instanceof Error ? refreshError.message : undefined;
        throw new Error(translateErrorMessage(message));
      }
    }

    if (response.status === 402) {
      window.dispatchEvent(new CustomEvent('subscription_expired'));
    }

    // Тариф компании мог смениться, пока страница открыта: профиль перечитает контроллер входа.
    const errorBody = body as ApiErrorBody;
    if (response.status === 403 && errorBody?.error_code === 'TARIFF_FEATURE_LOCKED') {
      window.dispatchEvent(
        new CustomEvent(TARIFF_FEATURE_LOCKED_EVENT, { detail: errorBody.feature }),
      );
    }

    if (!response.ok) throw new ApiRequestError(response.status, body as ApiErrorBody);

    return body as TResponse;
  };
}
