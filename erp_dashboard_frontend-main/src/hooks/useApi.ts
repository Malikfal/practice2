import { useCallback } from 'react';
import { extractApiErrorMessage, translateErrorMessage } from '../api/core/error';
import { API_URL } from '../constants/app';
import type { ApiErrorBody } from '../types/app';

export function useApi() {
  return useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers ?? {}),
    };

    let response: Response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      throw new Error(translateErrorMessage(message));
    }

    const body: ApiErrorBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(extractApiErrorMessage(body, response.status));
    }

    return body;
  }, []);
}
