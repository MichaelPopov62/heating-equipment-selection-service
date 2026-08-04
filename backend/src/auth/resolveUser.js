/**
 * Назначение: материализация AuthIdentity → AuthUser (MongoDB users).
 * Описание: find по (authProvider, providerUserId) или create один раз; без upsert на каждый request.
 */
import { normalizeAuthUserAuthorization } from './authorizationPolicy.js';
import { isPlatformAdminEmail } from './platformAdminAllowlist.js';
import { User } from '../models/public.js';
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';
import { logger } from '../utils/logger.js';

/**
 * @param {import('../types/shared-types.js').UserMongoDoc} doc
 * @returns {import('../types/auth.js').AuthUser}
 */
export function userDocumentToAuthUser(doc) {
  const id = doc._id != null ? String(doc._id) : '';
  if (!id) {
    throw new Error('User document без _id');
  }

  return normalizeAuthUserAuthorization({
    id,
    authProvider: doc.authProvider,
    providerUserId: doc.providerUserId,
    email: doc.email,
    emailVerified: doc.emailVerified,
    ...(doc.name ? { name: doc.name } : {}),
    role: doc.role,
    subscription: doc.subscription,
  });
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
    const platformAdmin = isPlatformAdminEmail(identity.email);
    try {
      user = await User.create({
        authProvider: identity.provider,
        providerUserId: identity.providerUserId,
        email: identity.email,
        emailVerified: identity.emailVerified,
        ...(identity.name ? { name: identity.name } : {}),
        ...(platformAdmin ? { role: 'admin' } : {}),
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

  if (isPlatformAdminEmail(identity.email) && user.role !== 'admin') {
    const userId = user._id != null ? String(user._id) : '';
    user = await User.findByIdAndUpdate(
      user._id,
      { $set: { role: 'admin' } },
      { new: true, runValidators: true },
    );
    if (!user) {
      throw new Error('Platform admin sync: пользователь не найден после update');
    }
    if (userId) {
      logger.info('auth.platform_admin.sync', null, { userId });
    }
  }

  return userDocumentToAuthUser(user);
}
