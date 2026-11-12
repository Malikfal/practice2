export type EmployeePayloadField = {
  key: string;
  value: string;
};

function stringifyPayloadValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value);
}

function normalizePayload(payload: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(
    Object.entries(payload ?? {})
      .map(([key, value]) => [key.trim(), stringifyPayloadValue(value).trim()])
      .filter(([key]) => key)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function payloadToFields(
  payload: Record<string, unknown> | null | undefined,
): EmployeePayloadField[] {
  return Object.entries(payload ?? {}).map(([key, value]) => ({
    key,
    value: stringifyPayloadValue(value),
  }));
}

export function fieldsToPayload(fields: EmployeePayloadField[]): {
  payload: Record<string, string> | null;
  hasMissingKeys: boolean;
} {
  const filledFields = fields
    .map((field) => ({
      key: field.key.trim(),
      value: field.value.trim(),
    }))
    .filter((field) => field.key || field.value);

  return {
    payload: filledFields.length
      ? Object.fromEntries(filledFields.map((field) => [field.key, field.value]))
      : null,
    hasMissingKeys: filledFields.some((field) => !field.key),
  };
}

export function arePayloadsEqual(
  first: Record<string, unknown> | null | undefined,
  second: Record<string, unknown> | null | undefined,
) {
  return (
    JSON.stringify(normalizePayload(first)) === JSON.stringify(normalizePayload(second))
  );
}
