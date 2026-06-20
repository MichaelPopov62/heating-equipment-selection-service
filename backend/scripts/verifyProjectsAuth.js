/**
 * Назначение: проверка конфигурации auth и фильтров ownerId для API проектов.
 * Запуск: cd backend && npm run verify:projects-auth
 */
import {
  hasProjectsJwtConfig,
  isProjectsAuthRequired,
  isRateLimitDisabled,
  resolveProjectsDevOwnerId,
} from '../src/auth/projectsAuthConfig.js';
import { buildProjectOwnerFilter } from '../src/projects/projectAccess.js';

/** @param {boolean} ok @param {string} label */
function logCheck(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

let failed = 0;

/** @param {boolean} ok */
function tally(ok) {
  if (!ok) failed += 1;
}

const prevNodeEnv = process.env.NODE_ENV;
const prevAuthEnabled = process.env.PROJECTS_AUTH_ENABLED;
const prevJwks = process.env.AUTH_JWKS_URI;
const prevSecret = process.env.AUTH_JWT_SECRET;

try {
  delete process.env.NODE_ENV;
  delete process.env.PROJECTS_AUTH_ENABLED;
  delete process.env.AUTH_JWKS_URI;
  delete process.env.AUTH_JWT_SECRET;

  tally(logCheck(!isProjectsAuthRequired(), 'dev: auth не обязателен по умолчанию'));
  tally(logCheck(resolveProjectsDevOwnerId() === 'dev-local', 'dev owner по умолчанию dev-local'));

  const devFilter = buildProjectOwnerFilter('dev-local');
  tally(
    logCheck(
      Array.isArray(devFilter.$or) && devFilter.$or.length >= 2,
      'dev filter включает legacy без ownerId',
    ),
  );

  process.env.NODE_ENV = 'production';
  delete process.env.PROJECTS_AUTH_ENABLED;
  tally(logCheck(isProjectsAuthRequired(), 'production: auth обязателен'));
  tally(logCheck(!hasProjectsJwtConfig(), 'production без JWT env — hasProjectsJwtConfig false'));

  process.env.AUTH_JWT_SECRET = 'test-secret';
  tally(logCheck(hasProjectsJwtConfig(), 'AUTH_JWT_SECRET — конфиг JWT есть'));

  const prodFilter = buildProjectOwnerFilter('user-abc');
  tally(
    logCheck(
      prodFilter.ownerId === 'user-abc' && prodFilter.$or === undefined,
      'production filter строго по ownerId',
    ),
  );

  delete process.env.NODE_ENV;
  process.env.RATE_LIMIT_DISABLED = 'true';
  tally(logCheck(isRateLimitDisabled(), 'RATE_LIMIT_DISABLED в dev'));
} finally {
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;
  if (prevAuthEnabled === undefined) delete process.env.PROJECTS_AUTH_ENABLED;
  else process.env.PROJECTS_AUTH_ENABLED = prevAuthEnabled;
  if (prevJwks === undefined) delete process.env.AUTH_JWKS_URI;
  else process.env.AUTH_JWKS_URI = prevJwks;
  if (prevSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = prevSecret;
  delete process.env.RATE_LIMIT_DISABLED;
}

if (failed > 0) {
  console.error(`\nverify:projects-auth — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:projects-auth — все проверки пройдены');
}
