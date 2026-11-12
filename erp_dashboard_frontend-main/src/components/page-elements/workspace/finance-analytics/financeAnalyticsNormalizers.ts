import type {
  FinanceAnalyticsEmployees,
  FinanceAnalyticsFilters,
} from '../../../../types/financeAnalytics';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractAnalyticsRows<T>(payload: unknown, namedKeys: string[]): T[] {
  let candidate = payload;

  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(candidate)) return candidate as T[];
    if (!isRecord(candidate)) return [];

    for (const key of namedKeys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }

    if (!('data' in candidate)) return [];
    candidate = candidate.data;
  }

  return Array.isArray(candidate) ? (candidate as T[]) : [];
}

function extractAnalyticsObject(payload: unknown): Record<string, unknown> {
  let candidate = payload;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!isRecord(candidate)) return {};

    const hasPayloadFields =
      'summary' in candidate ||
      'filters' in candidate ||
      Array.isArray(candidate.data) ||
      Array.isArray(candidate.employees);

    if (hasPayloadFields) return candidate;
    if (!('data' in candidate)) return candidate;
    candidate = candidate.data;
  }

  return isRecord(candidate) ? candidate : {};
}

export function normalizeEmployeesResponse(
  payload: unknown,
  fallbackFilters: FinanceAnalyticsFilters,
): FinanceAnalyticsEmployees {
  const source = extractAnalyticsObject(payload);
  const summary = isRecord(source.summary) ? source.summary : {};
  const rows = extractAnalyticsRows<Record<string, unknown>>(payload, [
    'employees',
    'items',
  ]);
  const normalizedRows = rows.map((row, index) => {
    const person = isRecord(row.employee)
      ? row.employee
      : isRecord(row.user)
        ? row.user
        : {};

    return {
      employee: {
        id: String(person.id ?? `unknown-${index}`),
        name: typeof person.name === 'string' ? person.name : undefined,
        first_name: typeof person.first_name === 'string' ? person.first_name : undefined,
        last_name:
          typeof person.last_name === 'string' || person.last_name === null
            ? person.last_name
            : undefined,
        email: typeof person.email === 'string' ? person.email : undefined,
      },
      expenses: Number(row.expenses ?? row.amount ?? row.total ?? 0),
      own_seconds: Number(row.own_seconds ?? 0),
      supervised_seconds: Number(row.supervised_seconds ?? 0),
      percent:
        row.percent === undefined &&
        row.percentage === undefined &&
        row.share === undefined
          ? null
          : Number(row.percent ?? row.percentage ?? row.share ?? 0),
    };
  });
  const calculatedTotal = normalizedRows.reduce((total, row) => total + row.expenses, 0);
  const totalExpenses = Number(summary.expenses ?? summary.amount ?? calculatedTotal);

  return {
    filters: isRecord(source.filters)
      ? (source.filters as FinanceAnalyticsFilters)
      : fallbackFilters,
    summary: {
      expenses: totalExpenses,
    },
    data: normalizedRows.map((row) => ({
      ...row,
      percent:
        row.percent ?? (totalExpenses > 0 ? (row.expenses / totalExpenses) * 100 : 0),
    })),
  };
}
