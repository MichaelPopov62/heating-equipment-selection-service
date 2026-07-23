/**
 * Назначение: unit-проверки логики миграции legacy projects.ownerId (PR-6).
 * Запуск: cd backend && npm run verify:migrate-project-owner-ids
 */
import mongoose from 'mongoose';

import {
  classifyLegacyOwnerId,
  isLegacyDevOwnerString,
  parseOwnerIdHexString,
  pickUserOwnerLookupHit,
  resolveMigrationTarget,
  summarizeMigrationResolutions,
} from '../src/projects/migrateLegacyProjectOwnerId.js';
import { DEFAULT_DEV_OWNER_OBJECT_ID_HEX } from '../src/auth/projectsAuthConfig.js';

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

const devOwnerObjectId = new mongoose.Types.ObjectId(DEFAULT_DEV_OWNER_OBJECT_ID_HEX);
const userAId = new mongoose.Types.ObjectId();
const userBId = new mongoose.Types.ObjectId();

tally(logCheck(classifyLegacyOwnerId(null) === 'missing', 'null → missing'));
tally(logCheck(classifyLegacyOwnerId(undefined) === 'missing', 'undefined → missing'));
tally(
  logCheck(
    classifyLegacyOwnerId(new mongoose.Types.ObjectId()) === 'object_id',
    'ObjectId → object_id',
  ),
);
tally(logCheck(classifyLegacyOwnerId('user_clerk_1') === 'string', 'string → string'));

tally(logCheck(isLegacyDevOwnerString('dev-local'), 'dev-local — legacy dev string'));
tally(logCheck(isLegacyDevOwnerString(''), 'пустая строка — legacy dev string'));
tally(logCheck(!isLegacyDevOwnerString('user_clerk_1'), 'JWT sub — не dev string'));

tally(
  logCheck(
    parseOwnerIdHexString(DEFAULT_DEV_OWNER_OBJECT_ID_HEX)?.equals(devOwnerObjectId) === true,
    'parseOwnerIdHexString — dev hex',
  ),
);
tally(logCheck(parseOwnerIdHexString('user_clerk_1') === null, 'parseOwnerIdHexString — не hex'));

tally(
  logCheck(
    pickUserOwnerLookupHit(
      [
        { _id: userAId, authProvider: 'auth0' },
        { _id: userBId, authProvider: 'clerk' },
      ],
      'auth0',
    )?._id.equals(userAId) === true,
    'pickUserOwnerLookupHit — preferred auth0',
  ),
);
tally(
  logCheck(
    pickUserOwnerLookupHit([{ _id: userAId, authProvider: 'auth0' }], null)?._id.equals(userAId) ===
      true,
    'pickUserOwnerLookupHit — single hit',
  ),
);

(async () => {
  const skipObjectId = await resolveMigrationTarget(new mongoose.Types.ObjectId(), {
    devOwnerObjectId,
    findUsersByProviderUserId: async () => [],
  });
  tally(logCheck(skipObjectId.action === 'skip' && skipObjectId.reason === 'already_object_id', 'skip уже ObjectId'));

  const missing = await resolveMigrationTarget(null, {
    devOwnerObjectId,
    findUsersByProviderUserId: async () => [],
  });
  tally(
    logCheck(
      missing.action === 'update' &&
        missing.reason === 'missing_owner_set_dev' &&
        missing.targetOwnerId?.equals(devOwnerObjectId) === true,
      'missing → dev ObjectId',
    ),
  );

  const devLocal = await resolveMigrationTarget('dev-local', {
    devOwnerObjectId,
    findUsersByProviderUserId: async () => [],
  });
  tally(
    logCheck(
      devLocal.action === 'update' &&
        devLocal.reason === 'dev_local_string' &&
        devLocal.targetOwnerId?.equals(devOwnerObjectId) === true,
      'dev-local → dev ObjectId',
    ),
  );

  const jwtSub = await resolveMigrationTarget('user_clerk_abc', {
    devOwnerObjectId,
    findUsersByProviderUserId: async (sub) =>
      sub === 'user_clerk_abc' ? [{ _id: userAId, authProvider: 'clerk' }] : [],
    preferredAuthProvider: 'clerk',
  });
  tally(
    logCheck(
      jwtSub.action === 'update' &&
        jwtSub.reason === 'provider_user_id' &&
        jwtSub.targetOwnerId?.equals(userAId) === true,
      'JWT sub → users._id',
    ),
  );

  const orphaned = await resolveMigrationTarget('user_unknown', {
    devOwnerObjectId,
    findUsersByProviderUserId: async () => [],
  });
  tally(
    logCheck(
      orphaned.action === 'skip' && orphaned.reason === 'orphaned_provider_user_id',
      'неизвестный sub → orphaned skip',
    ),
  );

  const hexUser = await resolveMigrationTarget(String(userBId), {
    devOwnerObjectId,
    findUsersByProviderUserId: async () => [],
    findUserByObjectId: async (oid) =>
      oid.equals(userBId) ? { _id: userBId, authProvider: 'clerk' } : null,
  });
  tally(
    logCheck(
      hexUser.action === 'update' &&
        hexUser.reason === 'user_object_id_hex_string' &&
        hexUser.targetOwnerId?.equals(userBId) === true,
      'hex string users._id → ObjectId',
    ),
  );

  const summary = summarizeMigrationResolutions([
    {
      action: 'update',
      targetOwnerId: userAId,
      reason: 'provider_user_id',
      legacyValue: 'user_clerk_abc',
    },
    {
      action: 'update',
      targetOwnerId: devOwnerObjectId,
      reason: 'dev_local_string',
      legacyValue: 'dev-local',
    },
  ]);
  tally(
    logCheck(
      summary.provider_user_id === 1 && summary.dev_local_string === 1,
      'summarizeMigrationResolutions',
    ),
  );

  if (failed > 0) {
    console.error(`\nverify:migrate-project-owner-ids — ${failed} проверок провалено`);
    process.exitCode = 1;
  } else {
    console.log('\nverify:migrate-project-owner-ids — все проверки пройдены');
  }
})();
