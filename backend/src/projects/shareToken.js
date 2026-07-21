/**
 * Назначение: генерация непрозрачного shareToken для публичной ссылки проекта.
 */

import { randomBytes } from 'node:crypto';

/** Длина токена в байтах до base64url (≥128 bit). */
const SHARE_TOKEN_BYTES = 24;

/**
 * Случайный URL-safe токен (не ObjectId).
 *
 * @returns {string}
 */
export function generateShareToken() {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

/**
 * Нормализация токена из path/query (trim, без пробелов).
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeShareTokenParam(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length < 16 || t.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}
