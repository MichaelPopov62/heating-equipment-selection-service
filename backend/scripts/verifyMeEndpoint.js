/**
 * Назначение: unit-проверки serializeMeUser / buildDevMeUser (Фаза 2 PR-12).
 * Запуск: cd backend && npm run verify:me-endpoint
 */
import { DEFAULT_DEV_OWNER_OBJECT_ID_HEX } from '../src/auth/projectsAuthConfig.js';
import { buildDevMeUser, serializeMeUser } from '../src/auth/serializeMeUser.js';
import { validateAdminUserPatchBody } from '../src/api/validateAdminUserPatch.js';

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

const authUser = {
  id: '507f1f77bcf86cd799439011',
  authProvider: /** @type {const} */ ('clerk'),
  providerUserId: 'user_abc',
  email: 'me@example.com',
  emailVerified: true,
  name: 'Me User',
  role: /** @type {const} */ ('user'),
  subscription: /** @type {const} */ ('pro'),
};

const me = serializeMeUser(authUser);
tally(
  logCheck(
    me.id === authUser.id &&
      me.email === authUser.email &&
      me.role === 'user' &&
      me.subscription === 'pro' &&
      me.name === 'Me User' &&
      me.authProvider === 'clerk' &&
      me.devMode === undefined,
    'serializeMeUser',
  ),
);

const devMe = buildDevMeUser();
tally(
  logCheck(
    devMe.id === DEFAULT_DEV_OWNER_OBJECT_ID_HEX &&
      devMe.devMode === true &&
      devMe.role === 'user' &&
      devMe.subscription === 'free',
    'buildDevMeUser',
  ),
);

const patch = validateAdminUserPatchBody({ subscription: 'marketplace' });
tally(logCheck(patch.subscription === 'marketplace' && patch.role === undefined, 'validateAdminUserPatchBody subscription'));

let patchErr = null;
try {
  validateAdminUserPatchBody({});
} catch (err) {
  patchErr = err;
}
tally(
  logCheck(
    patchErr instanceof Error &&
      /** @type {import('../src/types/shared-types.js').AppErrorLike} */ (patchErr).code ===
        'VALIDATION_FAILED',
    'validateAdminUserPatchBody empty → VALIDATION_FAILED',
  ),
);

if (failed > 0) {
  console.error(`\nverify:me-endpoint — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:me-endpoint — все проверки пройдены');
}
