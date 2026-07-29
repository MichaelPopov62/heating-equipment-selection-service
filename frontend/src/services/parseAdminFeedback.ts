/**
 * Назначение: runtime-проверка ответов admin feedback API и SSE без any.
 */

import type {
  AdminFeedbackItem,
  AdminFeedbackListResponse,
  AdminFeedbackStatus,
  AdminFeedbackType,
  AdminFeedbackUpdateResponse,
} from '../types/adminFeedback';
import { isRecord } from '../utils/jsonGuards';

const FEEDBACK_TYPES: readonly AdminFeedbackType[] = ['bug', 'contact'];
const FEEDBACK_STATUSES: readonly AdminFeedbackStatus[] = ['new', 'read', 'resolved'];
const OPTIONAL_STRING_FIELDS = [
  'email',
  'name',
  'pageUrl',
  'appVersion',
  'buildId',
  'ownerSub',
  'readAt',
  'resolvedAt',
] as const;

/**
 * @param value
 */
export function isAdminFeedbackType(value: unknown): value is AdminFeedbackType {
  return typeof value === 'string' && (FEEDBACK_TYPES as readonly string[]).includes(value);
}

/**
 * @param value
 */
export function isAdminFeedbackStatus(value: unknown): value is AdminFeedbackStatus {
  return typeof value === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

/**
 * @param value
 * @param field
 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Некоректна відповідь feedback API: ${field}`);
  }
  return value.trim();
}

/**
 * @param data
 */
export function parseAdminFeedbackItem(data: unknown): AdminFeedbackItem {
  if (!isRecord(data)) {
    throw new Error('Некоректна відповідь feedback API: item');
  }
  if (!isAdminFeedbackType(data.type)) {
    throw new Error('Некоректна відповідь feedback API: type');
  }
  if (!isAdminFeedbackStatus(data.status)) {
    throw new Error('Некоректна відповідь feedback API: status');
  }

  const item: AdminFeedbackItem = {
    id: requireString(data.id, 'id'),
    type: data.type,
    status: data.status,
    message: requireString(data.message, 'message'),
    createdAt: requireString(data.createdAt, 'createdAt'),
    updatedAt: requireString(data.updatedAt, 'updatedAt'),
  };

  for (const field of OPTIONAL_STRING_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') {
      throw new Error(`Некоректна відповідь feedback API: ${field}`);
    }
    const normalized = value.trim();
    if (normalized) item[field] = normalized;
  }

  return item;
}

/**
 * @param data
 */
export function parseAdminFeedbackListResponse(data: unknown): AdminFeedbackListResponse {
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.items)) {
    throw new Error('Некоректна відповідь списку звернень');
  }
  if (!Number.isInteger(data.limit) || typeof data.limit !== 'number' || data.limit < 1) {
    throw new Error('Некоректна відповідь списку звернень: limit');
  }
  if (
    data.nextCursor !== null &&
    (typeof data.nextCursor !== 'string' || !data.nextCursor.trim())
  ) {
    throw new Error('Некоректна відповідь списку звернень: nextCursor');
  }

  return {
    ok: true,
    items: data.items.map(parseAdminFeedbackItem),
    nextCursor: data.nextCursor?.trim() ?? null,
    limit: data.limit,
  };
}

/**
 * @param data
 */
export function parseAdminFeedbackUpdateResponse(data: unknown): AdminFeedbackUpdateResponse {
  if (!isRecord(data) || data.ok !== true || !('feedback' in data)) {
    throw new Error('Некоректна відповідь оновлення звернення');
  }
  return {
    ok: true,
    feedback: parseAdminFeedbackItem(data.feedback),
  };
}
