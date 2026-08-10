/**
 * Назначение: unit-проверки authorizationPolicy (Фаза 2 PR-9).
 * Запуск: cd backend && npm run verify:authorization-policy
 */
import {
  canAccessAdmin,
  hasRole,
  isPublisherSubscriptionTier,
  normalizeAuthUserAuthorization,
  normalizeSubscriptionTier,
  normalizeUserRole,
  PUBLISHER_SUBSCRIPTION_TIERS,
  SUBSCRIPTION_TIERS,
  USER_ROLES,
} from '../src/auth/authorizationPolicy.js';

/** @param {boolean} ok @param {string} label */
function logCheck(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

let failed = 0;

/** @param {boolean} ok */
function tally(ok) {
  if (!ok) failed += 1;
}

tally(logCheck(USER_ROLES.length === 2, 'USER_ROLES — user | admin'));
tally(logCheck(SUBSCRIPTION_TIERS.length === 3, 'SUBSCRIPTION_TIERS — free | pro | marketplace'));
tally(
  logCheck(
    PUBLISHER_SUBSCRIPTION_TIERS.length === 2 &&
      PUBLISHER_SUBSCRIPTION_TIERS.includes('pro') &&
      PUBLISHER_SUBSCRIPTION_TIERS.includes('marketplace') &&
      !PUBLISHER_SUBSCRIPTION_TIERS.includes('free'),
    'PUBLISHER_SUBSCRIPTION_TIERS — pro | marketplace (без free)',
  ),
);
tally(logCheck(isPublisherSubscriptionTier('pro') === true, 'isPublisherSubscriptionTier pro'));
tally(
  logCheck(isPublisherSubscriptionTier('marketplace') === true, 'isPublisherSubscriptionTier marketplace'),
);
tally(logCheck(isPublisherSubscriptionTier('free') === false, 'isPublisherSubscriptionTier free → false'));
tally(logCheck(isPublisherSubscriptionTier(null) === false, 'isPublisherSubscriptionTier null → false'));
tally(logCheck(normalizeUserRole('user') === 'user', 'normalizeUserRole user'));
tally(logCheck(normalizeUserRole('admin') === 'admin', 'normalizeUserRole admin'));
tally(logCheck(normalizeSubscriptionTier('free') === 'free', 'normalizeSubscriptionTier free'));
tally(logCheck(normalizeSubscriptionTier('pro') === 'pro', 'normalizeSubscriptionTier pro'));
tally(logCheck(normalizeSubscriptionTier('marketplace') === 'marketplace', 'normalizeSubscriptionTier marketplace'));

let roleErr = null;
try {
  normalizeUserRole('superuser');
} catch (err) {
  roleErr = err;
}
tally(
  logCheck(
    roleErr instanceof Error &&
      /** @type {import('../src/types/shared-types.js').AppErrorLike} */ (roleErr).code ===
        'INVALID_USER_ROLE',
    'normalizeUserRole invalid → INVALID_USER_ROLE',
  ),
);

let tierErr = null;
try {
  normalizeSubscriptionTier('enterprise');
} catch (err) {
  tierErr = err;
}
tally(
  logCheck(
    tierErr instanceof Error &&
      /** @type {import('../src/types/shared-types.js').AppErrorLike} */ (tierErr).code ===
        'INVALID_SUBSCRIPTION_TIER',
    'normalizeSubscriptionTier invalid → INVALID_SUBSCRIPTION_TIER',
  ),
);

const baseUser = {
  id: '507f1f77bcf86cd799439011',
  authProvider: /** @type {const} */ ('clerk'),
  providerUserId: 'user_1',
  email: 'a@example.com',
  emailVerified: true,
  role: /** @type {const} */ ('user'),
  subscription: /** @type {const} */ ('free'),
};

tally(logCheck(hasRole(baseUser, 'user'), 'hasRole user'));
tally(logCheck(!hasRole(baseUser, 'admin'), 'user не admin'));
tally(logCheck(!canAccessAdmin(baseUser), 'canAccessAdmin false для user'));

const adminUser = { ...baseUser, role: /** @type {const} */ ('admin') };
tally(logCheck(canAccessAdmin(adminUser), 'canAccessAdmin true для admin'));

const normalized = normalizeAuthUserAuthorization({ ...baseUser, subscription: 'pro' });
tally(
  logCheck(normalized.subscription === 'pro' && normalized.role === 'user', 'normalizeAuthUserAuthorization'),
);

if (failed > 0) {
  console.error(`\nverify:authorization-policy — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:authorization-policy — все проверки пройдены');
}
