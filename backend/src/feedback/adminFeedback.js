/**
 * Назначение: чистые функции контракта admin feedback API.
 */

import mongoose from 'mongoose';

const FEEDBACK_STATUSES = new Set(['new', 'read', 'resolved']);
const FEEDBACK_TYPES = new Set(['bug', 'contact']);

/**
 * @param {unknown} value
 * @returns {string}
 */
function singleQueryValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {unknown} value
 * @returns {import('../types/shared-types.js').FeedbackStatus | null}
 */
function parseStatus(value) {
  const status = singleQueryValue(value);
  return FEEDBACK_STATUSES.has(status)
    ? /** @type {import('../types/shared-types.js').FeedbackStatus} */ (status)
    : null;
}

/**
 * @param {unknown} value
 * @returns {import('../types/shared-types.js').FeedbackType | null}
 */
function parseType(value) {
  const type = singleQueryValue(value);
  return FEEDBACK_TYPES.has(type)
    ? /** @type {import('../types/shared-types.js').FeedbackType} */ (type)
    : null;
}

/**
 * @param {unknown} value
 * @returns {Date | undefined}
 */
function optionalDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function optionalString(value) {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requiredDateIso(value, field) {
  const date = optionalDate(value);
  if (!date) throw new TypeError(`Feedback ${field} отсутствует`);
  return date.toISOString();
}

/**
 * @param {{ createdAt: Date, id: import('mongoose').Types.ObjectId }} cursor
 * @returns {string}
 */
export function encodeFeedbackCursor(cursor) {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: String(cursor.id) }),
    'utf8',
  ).toString('base64url');
}

/**
 * @param {unknown} value
 * @returns {{ createdAt: Date, id: import('mongoose').Types.ObjectId } | null}
 */
export function decodeFeedbackCursor(value) {
  const raw = singleQueryValue(value);
  if (!raw) return null;

  try {
    /** @type {unknown} */
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object') return null;
    const record = /** @type {Record<string, unknown>} */ (decoded);
    if (typeof record.createdAt !== 'string' || typeof record.id !== 'string') return null;
    const createdAt = new Date(record.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || !mongoose.Types.ObjectId.isValid(record.id)) {
      return null;
    }
    const id = new mongoose.Types.ObjectId(record.id);
    if (String(id) !== record.id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * @param {import('express').Request['query']} query
 * @returns {{ ok: true, value: { limit: number, status?: import('../types/shared-types.js').FeedbackStatus, type?: import('../types/shared-types.js').FeedbackType, cursor?: { createdAt: Date, id: import('mongoose').Types.ObjectId } } } | { ok: false, message: string }}
 */
export function parseAdminFeedbackListQuery(query) {
  for (const field of ['limit', 'status', 'type', 'cursor']) {
    if (query[field] !== undefined && typeof query[field] !== 'string') {
      return { ok: false, message: `${field} должен быть единственным строковым значением` };
    }
  }

  const limitRaw = singleQueryValue(query.limit);
  const limit = limitRaw === '' ? 20 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { ok: false, message: 'limit должен быть целым числом от 1 до 100' };
  }

  const statusRaw = singleQueryValue(query.status);
  const status = statusRaw ? parseStatus(statusRaw) : null;
  if (statusRaw && !status) {
    return { ok: false, message: 'status должен быть new, read или resolved' };
  }

  const typeRaw = singleQueryValue(query.type);
  const type = typeRaw ? parseType(typeRaw) : null;
  if (typeRaw && !type) {
    return { ok: false, message: 'type должен быть bug или contact' };
  }

  const cursorRaw = singleQueryValue(query.cursor);
  const cursor = cursorRaw ? decodeFeedbackCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) {
    return { ok: false, message: 'Некорректный cursor' };
  }

  return {
    ok: true,
    value: {
      limit,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(cursor ? { cursor } : {}),
    },
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, status: import('../types/shared-types.js').FeedbackStatus } | { ok: false, message: string }}
 */
export function parseAdminFeedbackPatchBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Тело запроса должно быть объектом { status }' };
  }
  const record = /** @type {Record<string, unknown>} */ (body);
  if (Object.keys(record).length !== 1) {
    return { ok: false, message: 'Допускается только поле status' };
  }
  const status = parseStatus(record.status);
  return status
    ? { ok: true, status }
    : { ok: false, message: 'status должен быть new, read или resolved' };
}

/**
 * @param {import('../types/shared-types.js').FeedbackStatus} status
 * @param {Date | undefined} currentReadAt
 * @param {Date} now
 * @returns {{ $set: { status: import('../types/shared-types.js').FeedbackStatus, readAt?: Date, resolvedAt?: Date }, $unset?: { readAt?: 1, resolvedAt?: 1 } }}
 */
export function buildFeedbackStatusUpdate(status, currentReadAt, now) {
  if (status === 'new') {
    return { $set: { status }, $unset: { readAt: 1, resolvedAt: 1 } };
  }
  if (status === 'read') {
    return {
      $set: { status, readAt: currentReadAt ?? now },
      $unset: { resolvedAt: 1 },
    };
  }
  return {
    $set: {
      status,
      readAt: currentReadAt ?? now,
      resolvedAt: now,
    },
  };
}

/**
 * @param {import('../types/shared-types.js').FeedbackMongoDoc} doc
 * @returns {import('../types/shared-types.js').AdminFeedbackItem}
 */
export function serializeAdminFeedback(doc) {
  if (!doc._id) throw new TypeError('Feedback _id отсутствует');
  const status = doc.status === undefined ? 'new' : parseStatus(doc.status);
  if (!status) throw new TypeError('Feedback status некорректен');

  const readAt = optionalDate(doc.readAt);
  const resolvedAt = optionalDate(doc.resolvedAt);
  return {
    id: String(doc._id),
    type: doc.type,
    status,
    message: doc.message,
    ...(optionalString(doc.email) ? { email: doc.email } : {}),
    ...(optionalString(doc.name) ? { name: doc.name } : {}),
    ...(optionalString(doc.pageUrl) ? { pageUrl: doc.pageUrl } : {}),
    ...(optionalString(doc.appVersion) ? { appVersion: doc.appVersion } : {}),
    ...(optionalString(doc.buildId) ? { buildId: doc.buildId } : {}),
    ...(optionalString(doc.ownerSub) ? { ownerSub: doc.ownerSub } : {}),
    ...(readAt ? { readAt: readAt.toISOString() } : {}),
    ...(resolvedAt ? { resolvedAt: resolvedAt.toISOString() } : {}),
    createdAt: requiredDateIso(doc.createdAt, 'createdAt'),
    updatedAt: requiredDateIso(doc.updatedAt, 'updatedAt'),
  };
}
