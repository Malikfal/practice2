import type { Project, User } from '../types/app';

export function extractPhoneDigits(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

export function normalizePhoneDigits(value: string | null | undefined): string {
  let digits = extractPhoneDigits(value);
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  return digits.slice(0, 11);
}

export function formatPhoneNumber(value: string | null | undefined): string {
  let digits = extractPhoneDigits(value);
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  digits = digits.slice(0, 11);
  if (!digits) return '';

  const country = digits.slice(0, 1);
  const operator = digits.slice(1, 4);
  const part1 = digits.slice(4, 7);
  const part2 = digits.slice(7, 9);
  const part3 = digits.slice(9, 11);

  let result = `+${country}`;
  if (operator) result += ` (${operator}`;
  if (operator.length === 3) result += ')';
  if (part1) result += ` ${part1}`;
  if (part2) result += `-${part2}`;
  if (part3) result += `-${part3}`;
  return result;
}

export function isValidPhone(value: string | null | undefined): boolean {
  const digits = normalizePhoneDigits(value);
  return digits.length === 11 && digits.startsWith('7');
}

export function formatHours(seconds: number | string | null | undefined) {
  return (Number(seconds || 0) / 3600).toFixed(2);
}

export function formatDurationHms(seconds: number | string | null | undefined) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
}

/** Часы без лишних нулей: 40 ч → «40», 37,5 ч → «37,5». */
export function formatHoursCompact(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  return String(Math.round((seconds / 3600) * 100) / 100).replace('.', ',');
}

/**
 * Часы из текстового поля → секунды. Принимает «1,5» и «1.5».
 * null — поле пустое, undefined — не число или вне диапазона.
 */
export function parseHoursInput(
  value: string,
  maxHours: number,
): number | null | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;

  const hours = Number(normalized);
  if (hours > maxHours) return undefined;

  return Math.round(hours * 3600);
}

export function formatDuration(seconds: number | string | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return `${hours} ч ${minutes} мин`;
}

export function toDateFromApiTime(value: string | number | Date): Date {
  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    return new Date(value * 1000);
  }

  return new Date(value);
}

export function formatTimeLocal(
  value: string | number | Date | null | undefined,
  options: { includeSeconds?: boolean } = {},
) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    ...(options.includeSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(toDateFromApiTime(value));
}

export function formatDateLocal(value: string | number | Date | null | undefined) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(toDateFromApiTime(value));
}

export function calendarDateInputValue(value: string | null | undefined): string {
  if (!value) return '';

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export function formatCalendarDate(value: string | null | undefined): string {
  const date = calendarDateInputValue(value);
  if (!date) return '';

  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

export function formatEmployeeArchiveLabel(employee: User): string {
  if (employee.status !== 'BLOCKED' || !employee.archived_at) return '';

  const date = formatCalendarDate(employee.archived_at);
  return date ? `В архиве с ${date}` : '';
}

export function formatTimeRangeLocal(
  startedAt: string | number | Date | null | undefined,
  endedAt: string | number | Date | null | undefined,
  options: { includeSeconds?: boolean } = {},
) {
  return `${formatTimeLocal(startedAt, options)} - ${formatTimeLocal(endedAt, options)}`;
}

export function formatName(person: User | null | undefined) {
  if (!person) return '—';

  const fullName =
    `${person.name ?? person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
  return fullName || person.email || person.name || '—';
}

export function normalizeEmployeeStatus(status: string | null | undefined) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  if (normalized === 'BLOCKED') return 'BLOCKED';
  if (normalized === 'ACTIVE') return 'ACTIVE';
  return normalized;
}

export function isEmployeeBlocked(status: string | null | undefined) {
  return normalizeEmployeeStatus(status) === 'BLOCKED';
}

export function formatEmployeeStatus(status: string | null | undefined) {
  const normalized = normalizeEmployeeStatus(status);
  if (normalized === 'ACTIVE') return 'Активный';
  if (normalized === 'BLOCKED') return 'Заблокирован';
  return normalized || '—';
}

export function normalizeProjectStatus(status: string | null | undefined) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  if (normalized === 'ARCHIVED') return 'ARCHIVED';
  if (normalized === 'ACTIVE') return 'ACTIVE';
  return normalized;
}

export function isProjectArchived(status: string | null | undefined) {
  return normalizeProjectStatus(status) === 'ARCHIVED';
}

export function formatProjectStatus(status: string | null | undefined) {
  const normalized = normalizeProjectStatus(status);
  if (normalized === 'ACTIVE') return 'Активный';
  if (normalized === 'ARCHIVED') return 'Архив';
  return normalized || '—';
}

export function formatProjectArchiveLabel(project: Project): string {
  if (!isProjectArchived(project.status)) return '';

  const period = project.latest_activity_period;
  if (!period || period.is_current || !period.ended_on) return '';

  const date = formatCalendarDate(period.ended_on);
  return date ? `с ${date}` : '';
}

export const formatPhoneForApi = (phone: string): string => {
  if (!phone) return '';
  const normalized = normalizePhoneDigits(phone);
  return normalized ? '+' + normalized : '';
};

export const formatBirthdayForApi = (birthday: string | number): string => {
  if (!birthday && birthday !== 0) return '';
  if (typeof birthday === 'number' || /^\d+$/.test(String(birthday))) {
    const excelDate = Number(birthday);
    if (excelDate > 0 && excelDate < 100000) {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  const dateStr = String(birthday).trim();
  const date = new Date(dateStr);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  return '';
};
