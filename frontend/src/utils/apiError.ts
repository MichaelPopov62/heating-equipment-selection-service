/**
 * Назначение: Разбор ошибок API.
 * Описание: Извлечение текста из ответа { ok: false, error: { message } }.
 */

import { isRecord } from './jsonGuards';

/** Сообщение об ошибке из тела `{ ok: false, error: { message } }`. */
export function parseApiErrorMessage(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;
  const errNode = data.error;
  if (!isRecord(errNode)) return fallback;
  const m = errNode.message;
  if (typeof m === 'string') return m;
  if (m != null && typeof m !== 'object') return String(m);
  return fallback;
}
