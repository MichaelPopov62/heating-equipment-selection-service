/**
 * Назначение: одноразовая миграция projects.ownerId string → ObjectId ref User.
 * Запуск: cd backend && npm run migrate:project-owner-ids [-- --apply]
 * По умолчанию dry-run; --apply выполняет update в MongoDB.
 */
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAuthProvider } from '../src/auth/projectsAuthConfig.js';
import { resolveProjectsDevOwnerObjectId } from '../src/auth/projectsAuthConfig.js';
import { Project } from '../src/models/Project.js';
import { User } from '../src/models/User.js';
import {
  resolveMigrationTarget,
  summarizeMigrationResolutions,
} from '../src/projects/migrateLegacyProjectOwnerId.js';
import { ensureMongoReferenceConnection } from '../src/utils/mongoReferenceConnection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');

/** @param {boolean} ok @param {string} label */
function logLine(ok, label) {
  console.log(ok ? 'OK' : 'INFO', '—', label);
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const connected = await ensureMongoReferenceConnection();
  if (!connected) {
    console.error('MongoDB недоступна. Задайте MONGODB_URI в backend/.env');
    process.exitCode = 1;
    return;
  }

  const devOwnerObjectId = resolveProjectsDevOwnerObjectId();
  const preferredAuthProvider = resolveAuthProvider();

  /** @type {Map<string, import('../src/projects/migrateLegacyProjectOwnerId.js').UserOwnerLookupHit[]>} */
  const userCacheBySub = new Map();

  /**
   * @param {string} providerUserId
   * @returns {Promise<import('../src/projects/migrateLegacyProjectOwnerId.js').UserOwnerLookupHit[]>}
   */
  async function findUsersByProviderUserId(providerUserId) {
    const cached = userCacheBySub.get(providerUserId);
    if (cached) return cached;

    const docsRaw = await User.find({ providerUserId })
      .select({ _id: 1, authProvider: 1 })
      .lean();
    /** @type {import('../src/types/shared-types.js').UserMongoDoc[]} */
    const docs = docsRaw;
    /** @type {import('../src/projects/migrateLegacyProjectOwnerId.js').UserOwnerLookupHit[]} */
    const hits = docs
      .filter((doc) => doc._id != null)
      .map((doc) => ({
        _id: /** @type {import('mongoose').Types.ObjectId} */ (doc._id),
        authProvider: doc.authProvider,
      }));
    userCacheBySub.set(providerUserId, hits);
    return hits;
  }

  /**
   * @param {import('mongoose').Types.ObjectId} ownerObjectId
   * @returns {Promise<import('../src/projects/migrateLegacyProjectOwnerId.js').UserOwnerLookupHit | null>}
   */
  async function findUserByObjectId(ownerObjectId) {
    const doc = await User.findById(ownerObjectId).select({ _id: 1, authProvider: 1 }).lean();
    if (!doc?._id) return null;
    return { _id: doc._id, authProvider: doc.authProvider };
  }

  const legacyFilter = {
    $or: [
      { ownerId: { $type: 'string' } },
      { ownerId: { $exists: false } },
      { ownerId: null },
    ],
  };

  const cursor = Project.collection.find(legacyFilter, {
    projection: { _id: 1, ownerId: 1, clientName: 1 },
  });

  /** @type {Array<{ projectId: string; resolution: import('../src/projects/migrateLegacyProjectOwnerId.js').MigrateOwnerIdResolution }>} */
  const planned = [];
  /** @type {Record<string, number>} */
  const skippedReasons = {};

  for await (const doc of cursor) {
    const resolution = await resolveMigrationTarget(doc.ownerId, {
      devOwnerObjectId,
      findUsersByProviderUserId,
      findUserByObjectId,
      preferredAuthProvider,
    });

    if (resolution.action === 'skip') {
      skippedReasons[resolution.reason] = (skippedReasons[resolution.reason] ?? 0) + 1;
      console.warn(
        'SKIP',
        String(doc._id),
        doc.clientName ?? '',
        resolution.reason,
        resolution.legacyValue ?? '',
      );
      continue;
    }

    planned.push({ projectId: String(doc._id), resolution });
  }

  const updateSummary = summarizeMigrationResolutions(
    planned.map((item) => /** @type {import('../src/projects/migrateLegacyProjectOwnerId.js').MigrateOwnerIdResolution & { action: 'update' }} */ (item.resolution)),
  );

  console.log('\n--- migrate:project-owner-ids summary ---');
  console.log('mode:', APPLY ? 'apply' : 'dry-run');
  console.log('devOwnerObjectId:', String(devOwnerObjectId));
  console.log('preferredAuthProvider:', preferredAuthProvider ?? '(none)');
  console.log('toUpdate:', planned.length);
  console.log('updateReasons:', updateSummary);
  console.log('skipped:', skippedReasons);

  if (!APPLY) {
    logLine(true, 'dry-run завершён; для записи добавьте --apply');
    return;
  }

  let updated = 0;
  for (const item of planned) {
    const targetOwnerId = item.resolution.targetOwnerId;
    if (!targetOwnerId) continue;

    const result = await Project.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(item.projectId) },
      { $set: { ownerId: targetOwnerId } },
    );
    if (result.modifiedCount === 1) updated += 1;
  }

  logLine(true, `обновлено документов: ${updated}/${planned.length}`);

  const remaining = await Project.collection.countDocuments(legacyFilter);
  if (remaining > 0) {
    console.warn(`WARN — после миграции осталось legacy ownerId: ${remaining}`);
    process.exitCode = 1;
  } else {
    logLine(true, 'legacy ownerId в projects не осталось');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
      await mongoose.disconnect();
    }
  });
