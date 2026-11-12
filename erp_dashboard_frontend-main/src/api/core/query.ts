export type QueryPrimitive = string | number | null | undefined;
export type QueryValue = QueryPrimitive | Array<string | number>;

export function buildQuery(params: Record<string, QueryValue> = {}): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && String(item) !== '') {
          searchParams.append(`${key}[]`, String(item));
        }
      });

      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}
