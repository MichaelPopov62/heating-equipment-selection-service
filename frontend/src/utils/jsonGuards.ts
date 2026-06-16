/**
 * Назначение: Type-guards для JSON API.
 * Описание: Безопасное сужение unknown без any: isRecord, readStringArray и др.
 */

/** Объект-пластина JSON (не массив, не null). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Строковый массив из узла JSON: элементы не-строк отбрасываются. */
export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** Поле записи как вложенный объект или null. */
export function readRecordField(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const v = obj[key];
  return isRecord(v) ? v : null;
}
