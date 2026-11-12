import type {
  EmployeeDayTimelinePayload,
  PaginatedResponse,
  Project,
  ReportGroupBy,
  TaskBoardResponse,
  TaskReportPayload,
  TimeReportRequest,
  TimeReportResponse,
} from '../../types/app';
import { buildQuery, type QueryValue } from '../core/query';

export function createWorkerApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  const workerPrefix = '/worker';
  const projectsPrefix = `${workerPrefix}/projects`;
  const reportsPrefix = `${workerPrefix}/reports`;

  return {
    worker: {
      projects: {
        getMany: (params: Record<string, string | number>) =>
          request<PaginatedResponse<Project>>(`${projectsPrefix}${buildQuery(params)}`),

        getBoard: (projectId: string) =>
          request<TaskBoardResponse>(`${projectsPrefix}/${projectId}/tasks`).then(
            (response) => ({
              columns: response.columns ?? [],
              data: response.data ?? [],
            }),
          ),

        getTasks: (projectId: string) =>
          request<TaskBoardResponse>(`${projectsPrefix}/${projectId}/tasks`).then(
            (response) => response.data ?? [],
          ),

        getTasksForUser: (projectId: string, userId: string) =>
          request<TaskBoardResponse>(
            `${projectsPrefix}/${projectId}/user/${userId}/tasks`,
          ).then((response) => response.data ?? []),
      },

      reports: {
        getTime: <TGroupBy extends ReportGroupBy>(params: TimeReportRequest<TGroupBy>) =>
          request<TimeReportResponse<TGroupBy>>(
            `${reportsPrefix}/time${buildQuery({ ...params })}`,
          ),

        getTasks: (params: Record<string, QueryValue>) =>
          request<TaskReportPayload>(`${reportsPrefix}/tasks${buildQuery(params)}`),

        getDayTimeline: (params: Record<string, string>) =>
          request<EmployeeDayTimelinePayload>(
            `${reportsPrefix}/day-timeline${buildQuery(params)}`,
          ),
      },
    },
  };
}
