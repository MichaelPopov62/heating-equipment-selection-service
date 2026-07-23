/**
 * Назначение: JWT pipeline verify → map → resolve (без attach к Request).
 */

import { mapJwtPayload } from './mapJwtPayload.js';
import { resolveUser } from './resolveUser.js';
import { verifyAccessToken } from './verifyAccessToken.js';

/**
 * @param {string} bearerToken — без префикса Bearer
 * @returns {Promise<import('../types/auth.js').AuthUser>}
 */
export async function runAuthPipeline(bearerToken) {
  const payload = await verifyAccessToken(bearerToken);
  const identity = mapJwtPayload(payload);
  return resolveUser(identity);
}
