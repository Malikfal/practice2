import { createRequest } from './core/httpClient';
import { createAdminApi } from './modules/adminApi';
import { createApplicationsApi } from './modules/applicationsApi';
import { createAuthApi } from './modules/authApi';
import { createProfileApi } from './modules/profileApi';
import { createWorkerApi } from './modules/workerApi';
import { createWorkspaceApi } from './modules/workspaceApi';
import { createImportsApi } from './modules/importsApi';
import { createClientApi } from './modules/clientApi';
import { createNotificationsApi } from './modules/notificationsApi';

export function createApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  return {
    ...createAdminApi(request),
    ...createApplicationsApi(request),
    ...createAuthApi(request),
    ...createProfileApi(request),
    ...createWorkerApi(request),
    ...createWorkspaceApi(request),
    ...createImportsApi(request),
    ...createClientApi(request),
    ...createNotificationsApi(request),
  };
}

export const api = createApi(createRequest());
