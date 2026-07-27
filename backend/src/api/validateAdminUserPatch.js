/**
 * Назначение: валидация PATCH /api/v1/admin/users/{id}.
 */

import {
  normalizeSubscriptionTier,
  normalizeUserRole,
} from '../auth/authorizationPolicy.js';

/**
 * @param {unknown} body
 * @returns {{ role?: import('../types/auth.js').UserRole; subscription?: import('../types/auth.js').SubscriptionTier }}
 */
export function validateAdminUserPatchBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const err = new Error('Тіло запиту має бути JSON-обʼєктом');
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'VALIDATION_FAILED';
    appErr.statusCode = 400;
    throw err;
  }

  const rec = /** @type {Record<string, unknown>} */ (body);
  /** @type {{ role?: import('../types/auth.js').UserRole; subscription?: import('../types/auth.js').SubscriptionTier }} */
  const patch = {};

  if ('role' in rec) {
    patch.role = normalizeUserRole(rec.role);
  }
  if ('subscription' in rec) {
    patch.subscription = normalizeSubscriptionTier(rec.subscription);
  }

  if (patch.role === undefined && patch.subscription === undefined) {
    const err = new Error('Вкажіть role та/або subscription');
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'VALIDATION_FAILED';
    appErr.statusCode = 400;
    throw err;
  }

  return patch;
}
