/**
 * Назначение: SSOT политики авторизации (Фаза 2) — role/subscription без quota-gates.
 * Описание: Tier не ограничивает точность calc, share или PDF; gates только по role (admin).
 */

/** @type {readonly import('../types/auth.js').UserRole[]} */
export const USER_ROLES = ['user', 'admin'];

/** @type {readonly import('../types/auth.js').SubscriptionTier[]} */
export const SUBSCRIPTION_TIERS = ['free', 'pro', 'marketplace'];

/**
 * @param {unknown} raw
 * @returns {import('../types/auth.js').UserRole}
 */
export function normalizeUserRole(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (USER_ROLES.includes(/** @type {import('../types/auth.js').UserRole} */ (value))) {
    return /** @type {import('../types/auth.js').UserRole} */ (value);
  }
  const err = new Error(`Недопустима role користувача: "${String(raw)}"`);
  /** @type {import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.code = 'INVALID_USER_ROLE';
  appErr.statusCode = 403;
  throw err;
}

/**
 * @param {unknown} raw
 * @returns {import('../types/auth.js').SubscriptionTier}
 */
export function normalizeSubscriptionTier(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (
    SUBSCRIPTION_TIERS.includes(/** @type {import('../types/auth.js').SubscriptionTier} */ (value))
  ) {
    return /** @type {import('../types/auth.js').SubscriptionTier} */ (value);
  }
  const err = new Error(`Недопустимий subscription tier: "${String(raw)}"`);
  /** @type {import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.code = 'INVALID_SUBSCRIPTION_TIER';
  appErr.statusCode = 403;
  throw err;
}

/**
 * @param {Pick<import('../types/auth.js').AuthUser, 'role'>} user
 * @param {...import('../types/auth.js').UserRole} allowed
 * @returns {boolean}
 */
export function hasRole(user, ...allowed) {
  const role = normalizeUserRole(user.role);
  return allowed.includes(role);
}

/**
 * @param {Pick<import('../types/auth.js').AuthUser, 'role'>} user
 * @returns {boolean}
 */
export function canAccessAdmin(user) {
  return hasRole(user, 'admin');
}

/**
 * Нормализует role/subscription на AuthUser после resolveUser (fail closed).
 *
 * @param {import('../types/auth.js').AuthUser} user
 * @returns {import('../types/auth.js').AuthUser}
 */
export function normalizeAuthUserAuthorization(user) {
  return {
    ...user,
    role: normalizeUserRole(user.role),
    subscription: normalizeSubscriptionTier(user.subscription),
  };
}
