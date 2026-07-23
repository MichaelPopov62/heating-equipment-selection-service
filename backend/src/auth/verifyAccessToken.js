/**
 * Назначение: проверка Bearer JWT для API проектов.
 * Описание: Clerk/Auth0 — OIDC + JOSE + JWKS (RS256/ES256); HS256 только для unit-тестов.
 */

import * as jose from 'jose';
import { hasProjectsJwtConfig, resolveAuthJwtMode } from './projectsAuthConfig.js';

/** @type {ReturnType<typeof jose.createRemoteJWKSet> | null} */
let remoteJwks = null;

/**
 * @returns {ReturnType<typeof jose.createRemoteJWKSet>}
 */
function getRemoteJwks() {
  const jwksUri = process.env.AUTH_JWKS_URI?.trim();
  if (!jwksUri) {
    throw new Error('AUTH_JWKS_URI не задан');
  }
  if (!remoteJwks) {
    remoteJwks = jose.createRemoteJWKSet(new URL(jwksUri));
  }
  return remoteJwks;
}

/**
 * @returns {jose.JWTVerifyOptions}
 */
function buildVerifyOptions() {
  const verifyOptions = /** @type {jose.JWTVerifyOptions} */ ({});
  const issuer = process.env.AUTH_ISSUER?.trim();
  const audience = process.env.AUTH_AUDIENCE?.trim();
  if (issuer) verifyOptions.issuer = issuer;
  if (audience) verifyOptions.audience = audience;
  return verifyOptions;
}

/**
 * @param {string} bearerToken — без префикса Bearer
 * @returns {Promise<jose.JWTPayload>}
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

  const mode = resolveAuthJwtMode();
  const verifyOptions = buildVerifyOptions();

  /** @type {jose.JWTVerifyResult<jose.JWTPayload>} */
  let result;
  try {
    if (mode === 'jwks') {
      result = await jose.jwtVerify(bearerToken, getRemoteJwks(), verifyOptions);
    } else if (mode === 'hs256') {
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
    } else {
      const err = new Error('AUTH_NOT_CONFIGURED');
      /** @type {import('../types/shared-types.js').AppErrorLike} */
      const appErr = err;
      appErr.code = 'PROJECTS_AUTH_NOT_CONFIGURED';
      appErr.statusCode = 503;
      throw err;
    }
  } catch (verifyErr) {
    if (
      verifyErr &&
      typeof verifyErr === 'object' &&
      /** @type {import('../types/shared-types.js').AppErrorLike} */ (verifyErr).code ===
        'PROJECTS_AUTH_NOT_CONFIGURED'
    ) {
      throw verifyErr;
    }
    const err = new Error(
      verifyErr instanceof Error ? verifyErr.message : 'JWT verify failed',
    );
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'PROJECTS_AUTH_FORBIDDEN';
    appErr.statusCode = 403;
    throw err;
  }

  return result.payload;
}
