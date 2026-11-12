import type { ProjectDocument, TaskClientApprovalStatus } from '../../types/app';

export type ClientPortalTask = {
  id: string;
  title: string;
  project_id: string;
  project: string | null;
  parent_task_id: string | null;
  status: string | null;
  status_column_id: string | null;
  is_final: boolean;
  approval_status: TaskClientApprovalStatus | null;
  created_at: string | null;
  // Поля ниже приходят как null, если у клиента нет права на их просмотр.
  description: string | null;
  estimation: number | null;
  priority: string | null;
  deadline: string | null;
  spent_seconds: number | null;
};
export type ClientReportTask = ClientPortalTask & { status_changed_at: string };
export type ClientBoardColumn = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  is_final: boolean;
};
export type ClientPortalProject = {
  id: string;
  name: string;
  // Архивный проект клиент только просматривает.
  is_archived: boolean;
  pinned?: boolean;
  columns: ClientBoardColumn[];
  tasks: ClientPortalTask[];
};
export type ClientMessage = {
  id: string;
  text: string | null;
  is_from_client: boolean;
  created_at: string;
  attachments: { id: string; name: string; url: string }[];
};

export function createClientApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  return {
    client: {
      profile: () =>
        request<{
          id: string;
          role: string;
          email: string;
          name: string;
          company_id: string;
          permissions: string[];
          client_id: string;
        }>('/client/profile'),
      logout: () => request('/client/logout', { method: 'POST' }),
      portal: () =>
        request<{ data: ClientPortalProject[] }>('/client/portal').then(
          (response) => response.data,
        ),
      pinProject: (projectId: string) =>
        request(`/client/pinned-projects/${projectId}`, { method: 'POST' }),
      unpinProject: (projectId: string) =>
        request(`/client/pinned-projects/${projectId}`, { method: 'DELETE' }),
      createTask: (
        projectId: string,
        payload: {
          title: string;
          description?: string;
          priority?: string | null;
          deadline?: string | null;
        },
      ) =>
        request<{ data: ClientPortalTask }>(`/client/projects/${projectId}/tasks`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }).then((response) => response.data),
      updateTask: (
        taskId: string,
        payload: { priority?: string | null; deadline?: string },
      ) =>
        request<{ data: ClientPortalTask }>(`/client/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }).then((response) => response.data),
      tasksReport: (params: {
        from: string;
        to: string;
        project_id?: string;
        status_column_id?: string;
      }) =>
        request<{ data: ClientReportTask[] }>(
          `/client/reports/tasks?${new URLSearchParams(params).toString()}`,
        ).then((response) => response.data),
      projectDocuments: (projectId: string) =>
        request<{ data: ProjectDocument[] }>(
          `/client/projects/${projectId}/documents`,
        ).then((response) => response.data),
      messages: (taskId: string) =>
        request<{ data: ClientMessage[]; client_approval_status: string | null }>(
          `/client/tasks/${taskId}/messages`,
        ),
      sendMessage: (taskId: string, text: string, files: File[] = []) => {
        const body = new FormData();
        if (text) body.append('text', text);
        files.forEach((file) => body.append('files[]', file));
        return request(`/client/tasks/${taskId}/messages`, { method: 'POST', body });
      },
      approve: (taskId: string) =>
        request(`/client/tasks/${taskId}/approval`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
        }),
      changePassword: (
        current_password: string,
        password: string,
        password_confirmation: string,
      ) =>
        request('/client/profile/password', {
          method: 'PUT',
          body: JSON.stringify({ current_password, password, password_confirmation }),
        }),
      setPassword: (token: string, password: string, password_confirmation: string) =>
        request('/client/auth/password', {
          method: 'POST',
          body: JSON.stringify({ token, password, password_confirmation }),
        }),
    },
  };
}
