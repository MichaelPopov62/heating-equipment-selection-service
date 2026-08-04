/**
 * Назначение: SSOT platform admin — список email из PLATFORM_ADMIN_EMAILS (backend env).
 * Описание: Один список на все окружения Render; повышение до admin — в resolveUser.
 */

/** @type {Set<string> | null} */
let cachedAllowlist = null;

/** @type {string | null} */
let cachedRawEnv = null;

/**
 * Нормализует email для сравнения с allowlist.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizePlatformAdminEmail(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Парсит PLATFORM_ADMIN_EMAILS (comma-separated). Пустая переменная → пустой Set.
 *
 * @param {string | undefined} rawEnv
 * @returns {Set<string>}
 */
export function parsePlatformAdminEmails(rawEnv) {
  const raw = rawEnv?.trim() ?? '';
  if (!raw) return new Set();

  /** @type {Set<string>} */
  const emails = new Set();
  for (const segment of raw.split(',')) {
    const normalized = normalizePlatformAdminEmail(segment);
    if (normalized) emails.add(normalized);
  }
  return emails;
}

/**
 * @returns {Set<string>}
 */
export function getPlatformAdminEmailAllowlist() {
  const rawEnv = process.env.PLATFORM_ADMIN_EMAILS;
  const rawKey = rawEnv ?? '';

  if (cachedAllowlist !== null && cachedRawEnv === rawKey) {
    return cachedAllowlist;
  }

  cachedRawEnv = rawKey;
  cachedAllowlist = parsePlatformAdminEmails(rawEnv);
  return cachedAllowlist;
}

/**
 * Сброс кэша (unit-тесты / verify).
 */
export function resetPlatformAdminAllowlistCache() {
  cachedAllowlist = null;
  cachedRawEnv = null;
}

/**
 * @param {unknown} email
 * @returns {boolean}
 */
export function isPlatformAdminEmail(email) {
  const normalized = normalizePlatformAdminEmail(email);
  if (!normalized) return false;
  return getPlatformAdminEmailAllowlist().has(normalized);
}
