/**
 * Назначение: метаданные владельца проекта для admin list/detail.
 * Описание: batch-загрузка email из users по ownerId.
 */

import { User } from '../models/public.js';
import { parseObjectIdParam } from './parseObjectId.js';

/**
 * @param {import('../types/shared-types.js').ProjectMongoDoc[]} docs
 * @returns {Promise<Map<string, string>>} ownerId hex → email
 */
export async function loadOwnerEmailByOwnerId(docs) {
  /** @type {import('mongoose').Types.ObjectId[]} */
  const ownerIds = [];
  const seen = new Set();
  for (const doc of docs) {
    const raw = doc.ownerId;
    const hex = raw != null ? String(raw) : '';
    if (!hex || seen.has(hex)) continue;
    const oid = parseObjectIdParam(hex);
    if (!oid) continue;
    seen.add(hex);
    ownerIds.push(oid);
  }

  if (ownerIds.length === 0) return new Map();

  const users = await User.find({ _id: { $in: ownerIds } })
    .select('email')
    .lean();

  /** @type {Map<string, string>} */
  const map = new Map();
  for (const user of users) {
    const id = user._id != null ? String(user._id) : '';
    if (id && typeof user.email === 'string' && user.email.trim()) {
      map.set(id, user.email.trim());
    }
  }
  return map;
}

/**
 * @param {unknown} email
 * @returns {Promise<import('mongoose').Types.ObjectId | null>}
 */
export async function resolveOwnerObjectIdByEmail(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed) return null;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const user = await User.findOne({
    email: { $regex: new RegExp(`^${escaped}$`, 'i') },
  })
    .select('_id')
    .lean();

  if (!user?._id) return null;
  return parseObjectIdParam(String(user._id));
}
