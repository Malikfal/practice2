import type {
  DataImportLog,
  DataImportRowStatus,
  DataImportStatus,
  DataImportType,
} from '../types/dataImport';

export const DATA_IMPORT_TYPES: DataImportType[] = [
  'FINANCES',
  'PROJECTS',
  'EMPLOYEES',
  'EMPLOYEE_PAYROLL',
];

export const DATA_IMPORT_TYPE_LABELS: Record<DataImportType, string> = {
  FINANCES: 'Финансы',
  PROJECTS: 'Проекты',
  EMPLOYEES: 'Сотрудники: общие данные',
  EMPLOYEE_PAYROLL: 'Сотрудники: оплата труда',
};

export const DATA_IMPORT_TYPE_DESCRIPTIONS: Record<DataImportType, string> = {
  FINANCES: 'Поступления и расходы с датой, статьёй, проектом и участником.',
  PROJECTS: 'Проекты с клиентом и статусом.',
  EMPLOYEES: 'Новые сотрудники: ФИО, email, роль, должность и контакты.',
  EMPLOYEE_PAYROLL:
    'Текущие ставки с датой начала действия, финансовая статья и остаток к выплате на начало учёта.',
};

/** Пояснение к колонкам, которые нельзя понять по одному названию. */
export const DATA_IMPORT_TYPE_HINTS: Partial<Record<DataImportType, string[]>> = {
  EMPLOYEE_PAYROLL: [
    'Сотрудник ищется по email, а если email не указан, по ФИО.',
    'Ставки в рублях. Если последняя ставка сотрудника начинается той же датой, она обновляется, иначе создаётся новая запись в истории ставок.',
    'Продвинутая ставка: «Ставка за час: 0-40 = 500; 40+ = 700». Часы за неделю, несколько ставок разделяются «|» или переносом строки, для прогрессивного расчёта добавьте «(прогрессивно)» после типа. Стандартную ставку укажите в колонке этого типа.',
    'Остаток к выплате со знаком минус означает переплату сотруднику.',
  ],
};

export type DataImportTemplate = { label: string; href: string };

const templateLinks = (fileName: string): DataImportTemplate[] => [
  { label: 'CSV', href: `/templates/${fileName}.csv` },
  { label: 'XLS', href: `/templates/${fileName}.xls` },
  { label: 'XLSX', href: `/templates/${fileName}.xlsx` },
];

export const DATA_IMPORT_TEMPLATES: Record<DataImportType, DataImportTemplate[]> = {
  FINANCES: templateLinks('finances_import_tpl'),
  PROJECTS: templateLinks('projects_import_tpl'),
  EMPLOYEES: templateLinks('employees_import_tpl'),
  EMPLOYEE_PAYROLL: templateLinks('employee_payroll_import_tpl'),
};

/**
 * Импорты, которые предлагаются вместе в модалке раздела: со страницы сотрудников
 * доступны и общие данные, и оплата труда.
 */
export const RELATED_DATA_IMPORT_TYPES: Partial<
  Record<DataImportType, DataImportType[]>
> = {
  EMPLOYEES: ['EMPLOYEES', 'EMPLOYEE_PAYROLL'],
  EMPLOYEE_PAYROLL: ['EMPLOYEES', 'EMPLOYEE_PAYROLL'],
};

export const ACTIVE_DATA_IMPORT_STATUSES = new Set<DataImportStatus>([
  'QUEUED',
  'PARSING',
  'IMPORTING',
]);

export const DATA_IMPORT_STATUS_LABELS: Record<DataImportStatus, string> = {
  QUEUED: 'В очереди',
  PARSING: 'Чтение файла',
  IMPORTING: 'Импорт данных',
  COMPLETED: 'Завершён',
  COMPLETED_WITH_ERRORS: 'Завершён с ошибками',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
};

export const DATA_IMPORT_STATUS_CLASSES: Record<DataImportStatus, string> = {
  QUEUED: 'bg-slate-100 text-slate-600',
  PARSING: 'bg-blue-50 text-blue-700',
  IMPORTING: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  COMPLETED_WITH_ERRORS: 'bg-orange-50 text-orange-700',
  FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export const DATA_IMPORT_ROW_STATUS_LABELS: Record<DataImportRowStatus, string> = {
  CREATED: 'Создано',
  SKIPPED: 'Пропущено',
  FAILED: 'Ошибка',
};

export const DATA_IMPORT_ROW_STATUS_CLASSES: Record<DataImportRowStatus, string> = {
  CREATED: 'bg-emerald-50 text-emerald-700',
  SKIPPED: 'bg-slate-100 text-slate-600',
  FAILED: 'bg-red-50 text-red-700',
};

export const DATA_IMPORT_LOG_LEVEL_LABELS: Record<DataImportLog['level'], string> = {
  INFO: '',
  WARNING: 'Предупреждение',
  ERROR: 'Ошибка',
};

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** Размер файла в байтах, КБ или МБ в зависимости от величины. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${numberFormat.format(bytes / 1024)} КБ`;
  return `${numberFormat.format(bytes / 1024 / 1024)} МБ`;
}

/** Длительность обработки: «меньше секунды», «1 с», «2 мин 5 с», «1 ч 3 мин». */
export function formatImportDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds < 0.5) return 'меньше секунды';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  if (minutes) return secs ? `${minutes} мин ${secs} с` : `${minutes} мин`;
  return `${secs} с`;
}

export const DATA_IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024;

export const DATA_IMPORTS_PATH = '/settings/imports';
export const DATA_IMPORT_NEW_PATH = '/settings/imports/new';
export const DATA_IMPORT_HISTORY_PATH = '/settings/imports/history';

/** Адрес подробностей импорта во вкладке «Статистика». */
export const dataImportDetailsPath = (importId: string) =>
  `${DATA_IMPORT_HISTORY_PATH}?import=${encodeURIComponent(importId)}`;
