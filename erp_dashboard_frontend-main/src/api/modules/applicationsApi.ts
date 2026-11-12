export interface ApplicationPayload {
  name: string;
  phone: string;
  tariff: string;
  personal_data_consent: boolean;
  marketing_consent: boolean;
  smartcaptcha_token: string;
}

export function createApplicationsApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  return {
    submitApplication: (payload: ApplicationPayload) =>
      request<{ message: string }>('/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };
}
