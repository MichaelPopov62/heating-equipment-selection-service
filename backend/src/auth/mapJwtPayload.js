/**
 * Назначение: нормализация verified JWT payload → AuthIdentity.
 * Описание: IdP-agnostic mapping claims; единственное место чтения email/name/sub.
 */

import { resolveAuthProvider } from './projectsAuthConfig.js';

/**
 * @param {import('jose').JWTPayload} payload
 * @returns {import('../types/auth.js').AuthProvider}
 */
function resolveProviderFromPayload(payload) {
  const fromEnv = resolveAuthProvider();
  if (fromEnv) return fromEnv;

  const iss = typeof payload.iss === 'string' ? payload.iss.trim() : '';
  if (iss) {
    const mapRaw = process.env.AUTH_ISSUER_PROVIDER_MAP?.trim();
    if (mapRaw) {
      try {
        const parsed = /** @type {unknown} */ (JSON.parse(mapRaw));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const mapped = /** @type {Record<string, unknown>} */ (parsed)[iss];
          if (mapped === 'clerk' || mapped === 'auth0') {
            return mapped;
          }
        }
      } catch {
        // ignore invalid JSON — fallback ниже
      }
    }
  }

  const err = new Error('AUTH_PROVIDER не задан и issuer не сопоставлен');
  /** @type {import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.code = 'PROJECTS_AUTH_FORBIDDEN';
  appErr.statusCode = 403;
  throw err;
}

/**
 * @param {import('jose').JWTPayload} payload
 * @returns {string}
 */
function requireProviderUserId(payload) {
  const sub = payload.sub;
  if (typeof sub !== 'string' || !sub.trim()) {
    const err = new Error('JWT без claim sub');
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'PROJECTS_AUTH_FORBIDDEN';
    appErr.statusCode = 403;
    throw err;
  }
  return sub.trim();
}

/**
 * @param {import('jose').JWTPayload} payload
 * @returns {string | null}
 */
function readEmailClaim(payload) {
  if (typeof payload.email === 'string' && payload.email.trim()) {
    return payload.email.trim().toLowerCase();
  }
  return null;
}

/**
 * @param {import('jose').JWTPayload} payload
 * @returns {boolean}
 */
function readEmailVerified(payload) {
  return payload.email_verified === true;
}

/**
 * @param {import('jose').JWTPayload} payload
 * @returns {string | undefined}
 */
function readNameClaim(payload) {
  if (typeof payload.name === 'string' && payload.name.trim()) {
    return payload.name.trim();
  }
  const given = typeof payload.given_name === 'string' ? payload.given_name.trim() : '';
  const family = typeof payload.family_name === 'string' ? payload.family_name.trim() : '';
  const combined = [given, family].filter(Boolean).join(' ').trim();
  return combined || undefined;
}

/**
 * @param {import('jose').JWTPayload} payload — только после jose.jwtVerify().
 * @returns {import('../types/auth.js').AuthIdentity}
 */
export function mapJwtPayload(payload) {
  const providerUserId = requireProviderUserId(payload);
  const email = readEmailClaim(payload);
  if (!email) {
    const err = new Error('JWT без claim email');
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'PROJECTS_AUTH_FORBIDDEN';
    appErr.statusCode = 403;
    throw err;
  }

  const name = readNameClaim(payload);

  return {
    provider: resolveProviderFromPayload(payload),
    providerUserId,
    email,
    emailVerified: readEmailVerified(payload),
    ...(name ? { name } : {}),
  };
}
