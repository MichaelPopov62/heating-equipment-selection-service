/**
 * Назначение: материализация AuthIdentity → AuthUser (MongoDB users).
 * Описание: find по (authProvider, providerUserId) или create один раз; без upsert на каждый request.
 */

import { User } from '../models/public.js';
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';

/**
 * @param {import('../types/shared-types.js').UserMongoDoc} doc
 * @returns {import('../types/auth.js').AuthUser}
 */
export function userDocumentToAuthUser(doc) {
  const id = doc._id != null ? String(doc._id) : '';
  if (!id) {
    throw new Error('User document без _id');
  }

  return {
    id,
    authProvider: doc.authProvider,
    providerUserId: doc.providerUserId,
    email: doc.email,
    emailVerified: doc.emailVerified,
    ...(doc.name ? { name: doc.name } : {}),
    role: doc.role,
    subscription: doc.subscription,
  };
}

/**
 * @param {import('../types/auth.js').AuthIdentity} identity
 * @returns {Promise<import('../types/auth.js').AuthUser>}
 */
export async function resolveUser(identity) {
  const connected = await ensureMongoReferenceConnection();
  if (!connected) {
    const err = new Error('MongoDB недоступна для resolveUser');
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'MONGODB_UNAVAILABLE';
    appErr.statusCode = 503;
    throw err;
  }

  let user = await User.findOne({
    authProvider: identity.provider,
    providerUserId: identity.providerUserId,
  });

  if (!user) {
    try {
      user = await User.create({
        authProvider: identity.provider,
        providerUserId: identity.providerUserId,
        email: identity.email,
        emailVerified: identity.emailVerified,
        ...(identity.name ? { name: identity.name } : {}),
      });
    } catch (createErr) {
      const code =
        createErr && typeof createErr === 'object'
          ? /** @type {{ code?: number }} */ (createErr).code
          : undefined;
      if (code === 11000) {
        user = await User.findOne({
          authProvider: identity.provider,
          providerUserId: identity.providerUserId,
        });
      }
      if (!user) throw createErr;
    }
  }

  return userDocumentToAuthUser(user);
}
