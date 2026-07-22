/**
 * Назначение: валидация тела POST /api/v1/feedback.
 */

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const TYPE_SET = new Set(['bug', 'contact']);

/**
 * Санитизация строки (без HTML).
 *
 * @param {unknown} value
 * @param {number} maxLen
 * @returns {string | null}
 */
function sanitizeString(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/[<>]/g, '');
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: import('../types/shared-types.js').FeedbackInput } | { ok: false, message: string, code: string }}
 */
export function validateFeedbackBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Ожидается JSON-объект', code: 'FEEDBACK_INVALID_BODY' };
  }

  const raw = /** @type {Record<string, unknown>} */ (body);
  const type = typeof raw.type === 'string' ? raw.type.trim() : '';
  if (!TYPE_SET.has(type)) {
    return { ok: false, message: 'type должен быть bug или contact', code: 'FEEDBACK_INVALID_TYPE' };
  }

  const message = sanitizeString(raw.message, 4000);
  if (!message) {
    return { ok: false, message: 'message обязателен', code: 'FEEDBACK_MESSAGE_REQUIRED' };
  }

  const emailRaw = sanitizeString(raw.email, 200);
  if (type === 'contact' && !emailRaw) {
    return { ok: false, message: 'email обязателен для contact', code: 'FEEDBACK_EMAIL_REQUIRED' };
  }
  if (emailRaw && !EMAIL_RE.test(emailRaw)) {
    return { ok: false, message: 'Некорректный email', code: 'FEEDBACK_EMAIL_INVALID' };
  }

  const name = sanitizeString(raw.name, 120) ?? undefined;
  const pageUrl = sanitizeString(raw.pageUrl, 2000) ?? undefined;
  const appVersion = sanitizeString(raw.appVersion, 40) ?? undefined;
  const buildId = sanitizeString(raw.buildId, 80) ?? undefined;

  /** @type {import('../types/shared-types.js').FeedbackInput} */
  const data = {
    type: /** @type {'bug' | 'contact'} */ (type),
    message,
  };
  if (emailRaw) data.email = emailRaw;
  if (name) data.name = name;
  if (pageUrl) data.pageUrl = pageUrl;
  if (appVersion) data.appVersion = appVersion;
  if (buildId) data.buildId = buildId;

  return {
    ok: true,
    data,
  };
}
