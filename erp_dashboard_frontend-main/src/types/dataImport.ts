export type DataImportType = 'FINANCES' | 'PROJECTS' | 'EMPLOYEES' | 'EMPLOYEE_PAYROLL';
export type DataImportStatus =
  | 'QUEUED'
  | 'PARSING'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED';
export type DataImportRowStatus = 'CREATED' | 'SKIPPED' | 'FAILED';

export type DataImportLog = {
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
};

export type DataImport = {
  id: string;
  type: DataImportType;
  status: DataImportStatus;
  original_name: string;
  extension: string;
  mime_type: string | null;
  file_size: number;
  progress: number;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  metrics: { duration_seconds?: number; rows_per_second?: number } | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  logs?: DataImportLog[];
};

export type DataImportRow = {
  id: number;
  row_number: number;
  status: DataImportRowStatus;
  raw_data: Record<string, unknown> | null;
  normalized_data: Record<string, unknown> | null;
  errors: Record<string, string[]> | null;
  warnings: string[] | Record<string, string[]> | null;
  entity_type: string | null;
  entity_id: string | null;
};

export type ImportPaginationMeta = {
  current_page: number;
  last_page: number;
  per_page?: number;
  total: number;
  /** Типы импорта, доступные пользователю; приходит в списке импортов. */
  allowed_types?: DataImportType[];
};
