/**
 * Назначение: verify admin bypass для Projects API (без Mongo — unit).
 * Запуск: cd backend && npm run verify:projects-admin-access
 */
import mongoose from 'mongoose';

import { canAccessAdmin } from '../src/auth/authorizationPolicy.js';
import {
  buildAccessibleProjectByIdFilter,
  buildProjectOwnerFilter,
  isProjectsAdminRequest,
  validateProjectsListQueryForRole,
} from '../src/projects/projectAccess.js';

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

const ownerA = new mongoose.Types.ObjectId();
const ownerB = new mongoose.Types.ObjectId();
const projectId = new mongoose.Types.ObjectId();

/** @type {import('../src/types/auth.js').AuthUser} */
const baseUser = {
  id: String(ownerA),
  role: 'user',
  subscription: 'free',
  authProvider: 'clerk',
  providerUserId: 'user_sub',
  email: 'user@example.com',
  emailVerified: true,
};

/** @type {import('../src/types/auth.js').AuthUser} */
const baseAdmin = {
  id: String(ownerA),
  role: 'admin',
  subscription: 'free',
  authProvider: 'clerk',
  providerUserId: 'admin_sub',
  email: 'admin@example.com',
  emailVerified: true,
};

/** @type {import('express').Request} */
const userReq = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
  user: baseUser,
  query: {},
}));

/** @type {import('express').Request} */
const adminReq = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
  user: baseAdmin,
  query: {},
}));

tally(logCheck(!isProjectsAdminRequest(userReq), 'role=user — не admin request'));
tally(logCheck(isProjectsAdminRequest(adminReq), 'role=admin — admin request'));
tally(logCheck(canAccessAdmin(/** @type {import('../src/types/auth.js').AuthUser} */ (adminReq.user)), 'canAccessAdmin'));

const userFilter = buildAccessibleProjectByIdFilter(projectId, ownerA, userReq);
tally(
  logCheck(
    String(userFilter._id) === String(projectId) &&
      String(userFilter.ownerId) === String(ownerA),
    'user filter — _id + ownerId',
  ),
);

const adminFilter = buildAccessibleProjectByIdFilter(projectId, ownerA, adminReq);
tally(
  logCheck(
    String(adminFilter._id) === String(projectId) && adminFilter.ownerId === undefined,
    'admin filter — только _id',
  ),
);

const legacyOwnerFilter = buildProjectOwnerFilter(ownerB);
tally(
  logCheck(
    String(legacyOwnerFilter.ownerId) === String(ownerB),
    'buildProjectOwnerFilter — ownerId',
  ),
);

/** @type {import('express').Request} */
const userWithOwnerQuery = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
  user: baseUser,
  query: { ownerEmail: 'other@example.com' },
}));

/** @type {import('express').Request} */
const adminWithOwnerQuery = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
  user: baseAdmin,
  query: { ownerEmail: 'other@example.com' },
}));
tally(
  logCheck(
    validateProjectsListQueryForRole(userWithOwnerQuery) != null,
    'user + ownerEmail query — заборонено',
  ),
);
tally(
  logCheck(
    validateProjectsListQueryForRole(adminWithOwnerQuery) === null,
    'admin + ownerEmail query — дозволено',
  ),
);

if (failed > 0) {
  console.error(`\nverify:projects-admin-access — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:projects-admin-access — все проверки пройдены');
}
