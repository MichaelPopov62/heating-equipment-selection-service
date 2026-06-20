/**
 * Назначение: конфигурация JWT-аутентификации для API проектов.
 * Описание: Production — auth обязателен; dev — по умолчанию выключен (PROJECTS_AUTH_ENABLED=true для проверки).
 */

/**
 * @returns {boolean}
 */
function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

/**
 * @returns {boolean}
 */
export function isProjectsAuthRequired() {
  if (!isProductionRuntime()) {
    return process.env.PROJECTS_AUTH_ENABLED === 'true';
  }
  return true;
}

/**
 * @returns {boolean}
 */
export function hasProjectsJwtConfig() {
  const jwks = process.env.AUTH_JWKS_URI?.trim();
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  return Boolean(jwks || secret);
}

/**
 * @returns {string}
 */
export function resolveProjectsDevOwnerId() {
  const fromEnv = process.env.PROJECTS_DEV_OWNER_ID?.trim();
  return fromEnv || 'dev-local';
}

/**
 * @returns {void}
 */
export function assertProjectsAuthConfiguredForProduction() {
  if (!isProductionRuntime()) return;
  if (!hasProjectsJwtConfig()) {
    process.stderr.write(
      'NODE_ENV=production: задайте AUTH_JWKS_URI или AUTH_JWT_SECRET для API проектов.\n',
    );
    process.exitCode = 1;
  }
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
