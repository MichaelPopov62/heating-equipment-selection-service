/**
 * Назначение: конфигурация JWT-аутентификации для API проектов.
 * Описание: Clerk/Auth0 — OIDC + JWKS (RS256/ES256); HS256 только для изолированных unit-тестов.
 * Режимы AUTH_JWKS_URI и AUTH_JWT_SECRET взаимоисключающие.
 */

import mongoose from 'mongoose';

/** @type {readonly import('../types/auth.js').AuthProvider[]} */
const AUTH_PROVIDERS = ['clerk', 'auth0'];

/**
 * @returns {boolean}
 */
function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Auth enforced на runtime (production или dev с PROJECTS_AUTH_ENABLED=true).
 * @returns {boolean}
 */
export function isAuthEnforcedByConfig() {
  return isProductionRuntime() || process.env.PROJECTS_AUTH_ENABLED === 'true';
}

/**
 * @returns {boolean}
 */
export function isProjectsAuthRequired() {
  return isAuthEnforcedByConfig();
}

/**
 * @returns {boolean}
 */
export function hasConflictingJwtConfig() {
  const jwks = process.env.AUTH_JWKS_URI?.trim();
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  return Boolean(jwks && secret);
}

/**
 * @returns {import('../types/auth.js').AuthJwtMode | null}
 */
export function resolveAuthJwtMode() {
  if (hasConflictingJwtConfig()) return null;

  const jwks = process.env.AUTH_JWKS_URI?.trim();
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (jwks) return 'jwks';
  if (secret) return 'hs256';
  return null;
}

/**
 * @returns {import('../types/auth.js').AuthProvider | null}
 */
export function resolveAuthProvider() {
  const raw = process.env.AUTH_PROVIDER?.trim().toLowerCase();
  if (raw === 'clerk' || raw === 'auth0') {
    return raw;
  }
  return null;
}

/**
 * @returns {boolean}
 */
export function hasProjectsJwtConfig() {
  return resolveAuthJwtMode() !== null;
}

/**
 * @param {{ production?: boolean; authEnforced?: boolean }} [options]
 * @returns {import('../types/auth.js').AuthConfigValidationResult}
 */
export function validateAuthConfiguration(options = {}) {
  const production = options.production ?? isProductionRuntime();
  const authEnforced = options.authEnforced ?? isAuthEnforcedByConfig();
  /** @type {string[]} */
  const errors = [];

  if (hasConflictingJwtConfig()) {
    errors.push(
      'Задайте либо AUTH_JWKS_URI (Clerk/Auth0 OIDC), либо AUTH_JWT_SECRET (локальный HS256 для unit-тестов), но не оба одновременно.',
    );
    return { ok: false, mode: null, errors };
  }

  const mode = resolveAuthJwtMode();

  if (!mode) {
    errors.push(
      'Задайте AUTH_JWKS_URI (Clerk/Auth0: JWKS + issuer + audience) или AUTH_JWT_SECRET (только unit-тесты без PROJECTS_AUTH_ENABLED).',
    );
    return { ok: false, mode: null, errors };
  }

  if (mode === 'jwks') {
    if (!process.env.AUTH_JWKS_URI?.trim()) {
      errors.push('AUTH_JWKS_URI обязателен для режима OIDC/JWKS (Clerk/Auth0).');
    }
    if (!process.env.AUTH_ISSUER?.trim()) {
      errors.push('AUTH_ISSUER обязателен для режима OIDC/JWKS.');
    }
    if (!process.env.AUTH_AUDIENCE?.trim()) {
      errors.push('AUTH_AUDIENCE обязателен для режима OIDC/JWKS.');
    }
    if ((production || authEnforced) && !resolveAuthProvider()) {
      errors.push('AUTH_PROVIDER обязателен при включённой auth (clerk | auth0).');
    }
  }

  if (mode === 'hs256') {
    if (!process.env.AUTH_JWT_SECRET?.trim()) {
      errors.push('AUTH_JWT_SECRET обязателен для режима HS256.');
    }
    if (production || authEnforced) {
      errors.push(
        'При включённой auth (production или PROJECTS_AUTH_ENABLED=true) используйте Clerk/Auth0: AUTH_JWKS_URI, AUTH_ISSUER, AUTH_AUDIENCE, AUTH_PROVIDER=clerk. AUTH_JWT_SECRET — не для runtime.',
      );
    }
  }

  const provider = resolveAuthProvider();
  if (provider && !AUTH_PROVIDERS.includes(provider)) {
    errors.push(`AUTH_PROVIDER="${provider}" недопустим; допустимо: clerk | auth0.`);
  }

  return { ok: errors.length === 0, mode, errors };
}

/**
 * Fail fast: production не стартует без полной конфигурации Clerk/Auth0 JWKS.
 * @returns {void}
 */
export function assertAuthConfiguredForProduction() {
  if (!isProductionRuntime()) return;

  const result = validateAuthConfiguration({ production: true, authEnforced: true });
  if (result.ok) return;

  process.stderr.write('NODE_ENV=production: конфигурация JWT-аутентификации неполная:\n');
  for (const message of result.errors) {
    process.stderr.write(`  - ${message}\n`);
  }
  process.exitCode = 1;
}

/**
 * Fail fast при PROJECTS_AUTH_ENABLED=true в dev — только JWKS (Clerk).
 * @returns {void}
 */
export function assertAuthConfiguredWhenEnabled() {
  if (!isAuthEnforcedByConfig() || isProductionRuntime()) return;

  const result = validateAuthConfiguration({ production: false, authEnforced: true });
  if (result.ok) return;

  process.stderr.write('PROJECTS_AUTH_ENABLED=true: конфигурация Clerk/JWKS неполная:\n');
  for (const message of result.errors) {
    process.stderr.write(`  - ${message}\n`);
  }
  process.exitCode = 1;
}

/**
 * @deprecated Используйте assertAuthConfiguredForProduction().
 * @returns {void}
 */
export function assertProjectsAuthConfiguredForProduction() {
  assertAuthConfiguredForProduction();
}

/** Фиксированный ObjectId dev-владельца, если PROJECTS_DEV_OWNER_ID не задан или невалиден. */
export const DEFAULT_DEV_OWNER_OBJECT_ID_HEX = '000000000000000000000001';

/**
 * ObjectId dev-владельца для локальной разработки без JWT.
 * PROJECTS_DEV_OWNER_ID — 24-символьный hex ObjectId; иначе DEFAULT_DEV_OWNER_OBJECT_ID_HEX.
 *
 * @returns {import('mongoose').Types.ObjectId}
 */
export function resolveProjectsDevOwnerObjectId() {
  const fromEnv = process.env.PROJECTS_DEV_OWNER_ID?.trim();
  if (fromEnv && /^[a-fA-F0-9]{24}$/.test(fromEnv)) {
    return new mongoose.Types.ObjectId(fromEnv);
  }
  return new mongoose.Types.ObjectId(DEFAULT_DEV_OWNER_OBJECT_ID_HEX);
}

/**
 * Hex-строка ObjectId dev-владельца (для логов и verify).
 *
 * @returns {string}
 */
export function resolveProjectsDevOwnerId() {
  return String(resolveProjectsDevOwnerObjectId());
}

/**
 * @returns {boolean}
 */
export function isRateLimitDisabled() {
  return !isProductionRuntime() && process.env.RATE_LIMIT_DISABLED === 'true';
}

/**
 * @returns {number}
 */
export function resolveMaxProjectsPerOwner() {
  const n = Number(process.env.PROJECTS_MAX_PER_OWNER);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

/**
 * @returns {number}
 */
export function resolveMaxCalculationsPerProject() {
  const n = Number(process.env.PROJECTS_MAX_CALCULATIONS_PER_PROJECT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}
