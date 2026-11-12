import { API_URL } from '../../constants/app';
import type { PublicTaskData, TaskClientMessage } from '../../types/app';

function publicRequest<TResponse>(
  path: string,
  options: RequestInit = {},
): Promise<TResponse> {
  const isFormDataBody =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (!isFormDataBody) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_URL}/public/tasks${path}`, {
    ...options,
    headers: { ...headers, ...((options.headers as Record<string, string>) ?? {}) },
  }).then(async (response) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? `Ошибка ${response.status}`);
    }
    return response.json() as Promise<TResponse>;
  });
}

export const publicApi = {
  getTask: (token: string) => publicRequest<PublicTaskData>(`/${token}`),

  sendMessage: (token: string, payload: { text?: string; files?: File[] }) => {
    const formData = new FormData();
    if (payload.text?.trim()) {
      formData.append('text', payload.text.trim());
    }
    for (const file of payload.files ?? []) {
      formData.append('files[]', file);
    }
    return publicRequest<{ data: TaskClientMessage }>(`/${token}/messages`, {
      method: 'POST',
      body: formData,
    }).then((response) => response.data);
  },

  approve: (token: string) =>
    publicRequest<void>(`/${token}/approve`, {
      method: 'POST',
    }),

  getAttachmentDownloadUrl: (token: string, attachmentId: string) =>
    `${API_URL}/public/tasks/${token}/messages/attachments/${attachmentId}`,

  getTaskAttachmentDownloadUrl: (token: string, attachmentId: string) =>
    `${API_URL}/public/tasks/${token}/attachments/${attachmentId}`,
};
