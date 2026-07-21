/**
 * Назначение: сериализация публичного share и полей share в ответе владельца.
 */

import { isPlainObject } from '../utils/isPlainObject.js';

/**
 * @param {import('mongoose').Document | import('../types/shared-types.js').ProjectMongoDoc | Record<string, unknown>} doc
 * @returns {Record<string, unknown>}
 */
function toSharePlainRecord(doc) {
  if (
    doc &&
    typeof doc === 'object' &&
    'toObject' in doc &&
    typeof /** @type {{ toObject?: () => unknown }} */ (doc).toObject === 'function'
  ) {
    const plain = /** @type {{ toObject: () => unknown }} */ (doc).toObject();
    return isPlainObject(plain) ? plain : {};
  }
  if (isPlainObject(doc)) return doc;
  return /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (doc));
}

/**
 * @param {import('mongoose').Document | import('../types/shared-types.js').ProjectMongoDoc | Record<string, unknown>} doc
 * @returns {{ shareToken: string, sharePublishedAt: string, publicPath: string } | null}
 */
export function serializeProjectShareMeta(doc) {
  const rec = toSharePlainRecord(doc);

  const token = typeof rec.shareToken === 'string' ? rec.shareToken.trim() : '';
  if (!token) return null;

  const publishedAt =
    rec.sharePublishedAt instanceof Date
      ? rec.sharePublishedAt.toISOString()
      : typeof rec.sharePublishedAt === 'string'
        ? rec.sharePublishedAt
        : null;

  return {
    shareToken: token,
    sharePublishedAt: publishedAt ?? new Date(0).toISOString(),
    publicPath: `/s/${token}`,
  };
}

/**
 * Публичный DTO (без ownerId / survey / calcInput).
 *
 * @param {import('../types/shared-types.js').ProjectShareSnapshot} snapshot
 * @param {string} shareToken
 * @returns {import('../types/shared-types.js').PublicShareResponse['share']}
 */
export function serializePublicShare(snapshot, shareToken) {
  return {
    shareToken,
    schemaVersion: snapshot.schemaVersion,
    clientName: snapshot.clientName,
    ...(snapshot.label ? { label: snapshot.label } : {}),
    ...(snapshot.objectType ? { objectType: snapshot.objectType } : {}),
    publishedAt: snapshot.publishedAt,
    ...(snapshot.reportGeneratedAt ? { reportGeneratedAt: snapshot.reportGeneratedAt } : {}),
    ...(snapshot.catalogSource ? { catalogSource: snapshot.catalogSource } : {}),
    ...(snapshot.temps ? { temps: snapshot.temps } : {}),
    commercial: snapshot.commercial,
    matching: snapshot.matching ?? {},
    calculations: snapshot.calculations ?? {},
    ...(snapshot.warnings ? { warnings: snapshot.warnings } : {}),
  };
}
