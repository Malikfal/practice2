import type { ApiErrorBody } from '../../types/app';
import { toDateFromApiTime } from '../../utils/formatters';

const ERROR_TRANSLATIONS: Record<string, string> = {
  'Failed to fetch':
    'Не удалось связаться с сервером. Проверьте подключение к интернету.',
  'NetworkError when attempting to fetch resource.':
    'Не удалось связаться с сервером. Проверьте подключение к интернету.',
  'Load failed': 'Не удалось связаться с сервером. Проверьте подключение к интернету.',
  'The given data was invalid.': 'Проверьте правильность заполнения полей.',
  'Unauthenticated.': 'Необходимо войти в систему.',
  Unauthorized: 'Необходимо войти в систему.',
  'This action is unauthorized.': 'Недостаточно прав для выполнения действия.',
  Forbidden: 'Недостаточно прав для выполнения действия.',
  'Not Found': 'Запрашиваемые данные не найдены.',
  'The requested resource was not found.': 'Запрашиваемые данные не найдены.',
  'CSRF token mismatch.': 'Сессия истекла. Обновите страницу и повторите попытку.',
  'Page Expired': 'Сессия истекла. Обновите страницу и повторите попытку.',
  'Too Many Requests': 'Слишком много запросов. Попробуйте немного позже.',
  'Internal Server Error': 'Внутренняя ошибка сервера. Попробуйте ещё раз.',
  'Server Error': 'Внутренняя ошибка сервера. Попробуйте ещё раз.',
  'Method Not Allowed': 'Это действие не поддерживается.',
  'Bad Request': 'Некорректный запрос.',
  'Request Timeout': 'Время ожидания ответа истекло.',
  Conflict: 'Действие невозможно из-за конфликта данных.',
  'Payload Too Large': 'Размер отправленных данных слишком велик.',
  'Unsupported Media Type': 'Неподдерживаемый формат данных.',
  'Service Unavailable': 'Сервис временно недоступен. Попробуйте немного позже.',
  'Gateway Timeout': 'Сервер не успел обработать запрос. Попробуйте ещё раз.',
};

const ATTRIBUTE_TRANSLATIONS: Record<string, string> = {
  distribution_project_ids: 'проекты для распределения',
  default_distribution_project_ids: 'проекты для распределения по умолчанию',
  distribution_project_mode: 'режим распределения по проектам',
  default_distribution_project_mode: 'режим распределения по проектам по умолчанию',
  finance_article_id: 'статья',
  finance_article_ids: 'статьи',
  salary_finance_article_id: 'зарплатная финансовая статья',
  project_id: 'проект',
  project_ids: 'проекты',
  employee_id: 'сотрудник',
  employee_ids: 'сотрудники',
  created_by_id: 'создатель проекта',
  client_id: 'клиент',
  client_ids: 'клиенты',
  dateOfPayment: 'дата платежа',
  distribution_from: 'дата начала распределения',
  distribution_to: 'дата окончания распределения',
  default_distribution_period: 'диапазон распределения по умолчанию',
  distribution_method: 'способ распределения',
  calculation_period: 'период расчёта',
  is_active: 'активность',
  amount: 'сумма',
  percentage: 'процент',
  formula: 'формула',
  type: 'тип',
  name: 'название',
  email: 'электронная почта',
  password: 'пароль',
  password_confirmation: 'подтверждение пароля',
  comment: 'комментарий',
  title: 'заголовок',
  description: 'описание',
  file: 'файл',
  files: 'файлы',
};

export class ApiRequestError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(extractApiErrorMessage(body, status));
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

export function extractApiFieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined;
  return error.body.errors?.[field]?.[0];
}

export function extractApiErrorMessage(body: ApiErrorBody, status?: number): string {
  const overlapStart = body?.conflict?.started_at;
  const overlapEnd = body?.conflict?.ended_at;

  if (overlapStart && overlapEnd) {
    return formatOverlapMessage(overlapStart, overlapEnd);
  }

  const firstError = Object.values(
    (body?.errors ?? {}) as Record<string, string[]>,
  )[0]?.[0];

  return translateErrorMessage(firstError ?? body?.message ?? body?.error, status);
}

export function translateErrorMessage(message?: string, status?: number): string {
  const normalizedMessage = message?.trim();

  if (normalizedMessage && ERROR_TRANSLATIONS[normalizedMessage]) {
    return ERROR_TRANSLATIONS[normalizedMessage];
  }

  if (normalizedMessage) {
    const validationMessage = translateValidationMessage(normalizedMessage);
    if (validationMessage) return validationMessage;

    if (/[А-Яа-яЁё]/.test(normalizedMessage)) return normalizedMessage;
  }

  const statusMessage = getStatusMessage(status);
  if (statusMessage) return statusMessage;

  if (normalizedMessage && /[A-Za-z]/.test(normalizedMessage)) {
    return 'Произошла ошибка. Повторите попытку.';
  }

  return normalizedMessage || 'Запрос завершился ошибкой.';
}

function translateValidationMessage(message: string): string | null {
  const patterns: Array<[RegExp, (_match: RegExpMatchArray) => string]> = [
    [
      /^The (.+) field is required\.$/,
      (match) => `Поле «${humanizeAttribute(match[1])}» обязательно.`,
    ],
    [
      /^The (.+) field must have at least (\d+) items?\.$/,
      (match) =>
        `Минимальное количество элементов в поле «${humanizeAttribute(match[1])}» — ${match[2]}.`,
    ],
    [
      /^The selected (.+) is invalid\.$/,
      (match) => `Выбрано недопустимое значение поля «${humanizeAttribute(match[1])}».`,
    ],
    [
      /^The (.+) field must be an array\.$/,
      (match) => `Поле «${humanizeAttribute(match[1])}» должно быть списком.`,
    ],
    [
      /^The (.+) field must be a string\.$/,
      (match) => `Поле «${humanizeAttribute(match[1])}» должно быть строкой.`,
    ],
    [
      /^The (.+) field must be an integer\.$/,
      (match) => `Поле «${humanizeAttribute(match[1])}» должно быть целым числом.`,
    ],
    [
      /^The (.+) field must be a number\.$/,
      (match) => `Поле «${humanizeAttribute(match[1])}» должно быть числом.`,
    ],
    [
      /^The (.+) field must be a valid date\.$/,
      (match) =>
        `Поле «${humanizeAttribute(match[1])}» должно содержать корректную дату.`,
    ],
    [
      /^The (.+) field must be at least (.+)\.$/,
      (match) =>
        `Минимальное значение поля «${humanizeAttribute(match[1])}» — ${match[2]}.`,
    ],
    [
      /^The (.+) field must not be greater than (.+)\.$/,
      (match) =>
        `Максимальное значение поля «${humanizeAttribute(match[1])}» — ${match[2]}.`,
    ],
    [
      /^The (.+) field has a duplicate value\.$/,
      (match) => `Поле «${humanizeAttribute(match[1])}» содержит повторяющееся значение.`,
    ],
    [
      /^The (.+) has already been taken\.$/,
      (match) => `Значение поля «${humanizeAttribute(match[1])}» уже используется.`,
    ],
  ];

  for (const [pattern, translate] of patterns) {
    const match = message.match(pattern);
    if (match) return translate(match);
  }

  return null;
}

function humanizeAttribute(attribute: string): string {
  const normalizedAttribute = attribute.replace(/\.\d+(?=\.|$)/g, '.*');

  return (
    ATTRIBUTE_TRANSLATIONS[normalizedAttribute] ??
    ATTRIBUTE_TRANSLATIONS[attribute] ??
    attribute.replaceAll('_', ' ').replaceAll('.', ' ')
  );
}

function getStatusMessage(status?: number): string | null {
  if (status === 400) return 'Некорректный запрос.';
  if (status === 401) return 'Необходимо войти в систему.';
  if (status === 403) return 'Недостаточно прав для выполнения действия.';
  if (status === 404) return 'Запрашиваемые данные не найдены.';
  if (status === 405) return 'Это действие не поддерживается.';
  if (status === 408) return 'Время ожидания ответа истекло.';
  if (status === 409) return 'Действие невозможно из-за конфликта данных.';
  if (status === 413) return 'Размер отправленных данных слишком велик.';
  if (status === 415) return 'Неподдерживаемый формат данных.';
  if (status === 419) return 'Сессия истекла. Обновите страницу и повторите попытку.';
  if (status === 422) return 'Проверьте правильность заполнения полей.';
  if (status === 429) return 'Слишком много запросов. Попробуйте немного позже.';
  if (status && status >= 500) return 'Внутренняя ошибка сервера. Попробуйте ещё раз.';
  return null;
}

function formatOverlapMessage(startedAt: number, endedAt: number): string {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `У сотрудника уже есть рабочий интервал с ${formatter.format(toDateFromApiTime(startedAt))} до ${formatter.format(toDateFromApiTime(endedAt))}.`;
}
