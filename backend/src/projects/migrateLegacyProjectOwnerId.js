/**
 * Назначение: миграция legacy projects.ownerId (JWT sub / dev-local string) → ObjectId ref User.
 * Описание: PR-6 — чистая логика для скрипта migrateProjectOwnerIds и verify без MongoDB.
 */

import mongoose from 'mongoose';

/** @typedef {'skip' | 'update'} MigrateOwnerIdAction */

/**
 * @typedef {Object} MigrateOwnerIdResolution
 * @property {MigrateOwnerIdAction} action
 * @property {import('mongoose').Types.ObjectId} [targetOwnerId]
 * @property {string} reason
 * @property {string} [legacyValue]
 */

/**
 * @typedef {Object} UserOwnerLookupHit
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {import('../types/auth.js').AuthProvider} authProvider
 */

/**
 * @param {unknown} value
 * @returns {value is import('mongoose').Types.ObjectId}
 */
export function isObjectIdValue(value) {
  return value instanceof mongoose.Types.ObjectId;
}

/**
 * @param {unknown} rawOwnerId
 * @returns {'object_id' | 'missing' | 'string'}
 */
export function classifyLegacyOwnerId(rawOwnerId) {
  if (rawOwnerId === null || rawOwnerId === undefined) return 'missing';
  if (isObjectIdValue(rawOwnerId)) return 'object_id';
  if (typeof rawOwnerId === 'string') return 'string';
  return 'string';
}

/**
 * @param {string} legacyString
 * @returns {boolean}
 */
export function isLegacyDevOwnerString(legacyString) {
  const trimmed = legacyString.trim();
  return trimmed === '' || trimmed === 'dev-local';
}

/**
 * @param {string} legacyString
 * @returns {import('mongoose').Types.ObjectId | null}
 */
export function parseOwnerIdHexString(legacyString) {
  const trimmed = legacyString.trim();
  if (!/^[a-fA-F0-9]{24}$/.test(trimmed)) return null;
  if (String(new mongoose.Types.ObjectId(trimmed)) !== trimmed) return null;
  return new mongoose.Types.ObjectId(trimmed);
}

/**
 * @param {UserOwnerLookupHit[]} hits
 * @param {import('../types/auth.js').AuthProvider | null | undefined} preferredAuthProvider
 * @returns {UserOwnerLookupHit | null}
 */
export function pickUserOwnerLookupHit(hits, preferredAuthProvider) {
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0] ?? null;

  if (preferredAuthProvider) {
    const preferred = hits.find((hit) => hit.authProvider === preferredAuthProvider);
    if (preferred) return preferred;
  }

  const clerk = hits.find((hit) => hit.authProvider === 'clerk');
  if (clerk) return clerk;

  return hits[0] ?? null;
}

/**
 * @param {unknown} rawOwnerId
 * @param {{
 *   devOwnerObjectId: import('mongoose').Types.ObjectId,
 *   findUsersByProviderUserId: (providerUserId: string) => Promise<UserOwnerLookupHit[]>,
 *   findUserByObjectId?: (ownerObjectId: import('mongoose').Types.ObjectId) => Promise<UserOwnerLookupHit | null>,
 *   preferredAuthProvider?: import('../types/auth.js').AuthProvider | null,
 * }} deps
 * @returns {Promise<MigrateOwnerIdResolution>}
 */
export async function resolveMigrationTarget(rawOwnerId, deps) {
  const kind = classifyLegacyOwnerId(rawOwnerId);

  if (kind === 'object_id') {
    return { action: 'skip', reason: 'already_object_id' };
  }

  if (kind === 'missing') {
    return {
      action: 'update',
      targetOwnerId: deps.devOwnerObjectId,
      reason: 'missing_owner_set_dev',
      legacyValue: '',
    };
  }

  const legacyString = String(rawOwnerId);

  if (isLegacyDevOwnerString(legacyString)) {
    return {
      action: 'update',
      targetOwnerId: deps.devOwnerObjectId,
      reason: 'dev_local_string',
      legacyValue: legacyString,
    };
  }

  const parsedHex = parseOwnerIdHexString(legacyString);
  if (parsedHex) {
    if (parsedHex.equals(deps.devOwnerObjectId)) {
      return {
        action: 'update',
        targetOwnerId: parsedHex,
        reason: 'dev_owner_hex_string',
        legacyValue: legacyString,
      };
    }

    if (deps.findUserByObjectId) {
      const userById = await deps.findUserByObjectId(parsedHex);
      if (userById) {
        return {
          action: 'update',
          targetOwnerId: userById._id,
          reason: 'user_object_id_hex_string',
          legacyValue: legacyString,
        };
      }
    }

    const usersBySub = await deps.findUsersByProviderUserId(legacyString);
    const pickedSub = pickUserOwnerLookupHit(usersBySub, deps.preferredAuthProvider);
    if (pickedSub) {
      return {
        action: 'update',
        targetOwnerId: pickedSub._id,
        reason: 'provider_user_id_hex_collision',
        legacyValue: legacyString,
      };
    }

    return {
      action: 'skip',
      reason: 'orphaned_hex_string',
      legacyValue: legacyString,
    };
  }

  const users = await deps.findUsersByProviderUserId(legacyString);
  const picked = pickUserOwnerLookupHit(users, deps.preferredAuthProvider);
  if (!picked) {
    return {
      action: 'skip',
      reason: 'orphaned_provider_user_id',
      legacyValue: legacyString,
    };
  }

  return {
    action: 'update',
    targetOwnerId: picked._id,
    reason: 'provider_user_id',
    legacyValue: legacyString,
  };
}

/**
 * @param {Iterable<MigrateOwnerIdResolution & { action: 'update' }>} updates
 * @returns {Record<string, number>}
 */
export function summarizeMigrationResolutions(updates) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of updates) {
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
  }
  return counts;
}
