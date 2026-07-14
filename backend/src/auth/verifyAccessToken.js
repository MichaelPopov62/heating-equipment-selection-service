/**
 * Назначение: проверка Bearer JWT для API проектов.
 * Описание: JWKS (Auth0/Clerk) или HS256 через AUTH_JWT_SECRET; опционально iss/aud.
 */

import * as jose from 'jose';
import { hasProjectsJwtConfig } from './projectsAuthConfig.js';

/** @type {ReturnType<typeof jose.createRemoteJWKSet> | null} */
let remoteJwks = null;

/**
 * @returns {ReturnType<typeof jose.createRemoteJWKSet> | null}
 */
function getRemoteJwks() {
  const jwksUri = process.env.AUTH_JWKS_URI?.trim();
  if (!jwksUri) return null;
  if (!remoteJwks) {
    remoteJwks = jose.createRemoteJWKSet(new URL(jwksUri));
  }
  return remoteJwks;
}

/**
 * @param {string} bearerToken — без префикса Bearer
 * @returns {Promise<{ sub: string }>}
 */
export async function verifyAccessToken(bearerToken) {
  if (!hasProjectsJwtConfig()) {
    const err = new Error('AUTH_NOT_CONFIGURED');
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'PROJECTS_AUTH_NOT_CONFIGURED';
    appErr.statusCode = 503;
    throw err;
  }

  const verifyOptions = /** @type {jose.JWTVerifyOptions} */ ({});
  const issuer = process.env.AUTH_ISSUER?.trim();
  const audience = process.env.AUTH_AUDIENCE?.trim();
  if (issuer) verifyOptions.issuer = issuer;
  if (audience) verifyOptions.audience = audience;

  const jwks = getRemoteJwks();
  /** @type {jose.JWTVerifyResult<jose.JWTPayload>} */
  let result;
  if (jwks) {
    result = await jose.jwtVerify(bearerToken, jwks, verifyOptions);
  } else {
    const secret = process.env.AUTH_JWT_SECRET?.trim();
    if (!secret) {
      const err = new Error('AUTH_NOT_CONFIGURED');
      /** @type {import('../types/shared-types.js').AppErrorLike} */
      const appErr = err;
      appErr.code = 'PROJECTS_AUTH_NOT_CONFIGURED';
      appErr.statusCode = 503;
      throw err;
    }
    const key = new TextEncoder().encode(secret);
    result = await jose.jwtVerify(bearerToken, key, verifyOptions);
  }

  const sub = result.payload.sub;
  if (typeof sub !== 'string' || !sub.trim()) {
    const err = new Error('JWT без sub');
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'PROJECTS_AUTH_FORBIDDEN';
    appErr.statusCode = 403;
    throw err;
  }

  return { sub: sub.trim() };
}
