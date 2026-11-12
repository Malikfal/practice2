import type {
  DataImport,
  DataImportRow,
  DataImportType,
  ImportPaginationMeta,
} from '../../types/dataImport';
import { buildQuery } from '../core/query';

export function createImportsApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  const prefix = '/imports';

  return {
    imports: {
      create: (type: DataImportType, file: File) => {
        const body = new FormData();
        body.append('type', type);
        body.append('file', file);
        return request<DataImport>(prefix, { method: 'POST', body });
      },
      getMany: (page = 1, perPage = 20) =>
        request<{ data: DataImport[]; meta: ImportPaginationMeta }>(
          `${prefix}${buildQuery({ page, per_page: perPage })}`,
        ),
      get: (id: string) => request<DataImport>(`${prefix}/${id}`),
      getRows: (id: string, page = 1, perPage = 50) =>
        request<{ data: DataImportRow[]; meta: ImportPaginationMeta }>(
          `${prefix}/${id}/rows${buildQuery({ page, per_page: perPage })}`,
        ),
      download: (id: string) => request<Blob>(`${prefix}/${id}/file`),
      retry: (id: string) =>
        request<DataImport>(`${prefix}/${id}/retry`, { method: 'POST' }),
      cancel: (id: string) =>
        request<DataImport>(`${prefix}/${id}/cancel`, { method: 'POST' }),
    },
  };
}
