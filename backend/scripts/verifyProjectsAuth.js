/**
 * Назначение: проверка конфигурации auth и фильтров ownerId для API проектов.
 * Запуск: cd backend && npm run verify:projects-auth
 */
import {
  assertAuthConfiguredForProduction,
  DEFAULT_DEV_OWNER_OBJECT_ID_HEX,
  hasProjectsJwtConfig,
  isProjectsAuthRequired,
  isRateLimitDisabled,
  resolveAuthJwtMode,
  resolveAuthProvider,
  resolveProjectsDevOwnerId,
  resolveProjectsDevOwnerObjectId,
  validateAuthConfiguration,
} from '../src/auth/projectsAuthConfig.js';
import { buildProjectOwnerFilter } from '../src/projects/projectAccess.js';
import mongoose from 'mongoose';

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
const prevIssuer = process.env.AUTH_ISSUER;
const prevAudience = process.env.AUTH_AUDIENCE;
const prevProvider = process.env.AUTH_PROVIDER;

try {
  delete process.env.NODE_ENV;
  delete process.env.PROJECTS_AUTH_ENABLED;
  delete process.env.AUTH_JWKS_URI;
  delete process.env.AUTH_JWT_SECRET;
  delete process.env.AUTH_ISSUER;
  delete process.env.AUTH_AUDIENCE;
  delete process.env.AUTH_PROVIDER;

  tally(logCheck(!isProjectsAuthRequired(), 'dev: auth не обязателен по умолчанию'));
  tally(logCheck(resolveProjectsDevOwnerId() === DEFAULT_DEV_OWNER_OBJECT_ID_HEX, 'dev owner по умолчанию — фиксированный ObjectId'));
  tally(logCheck(resolveProjectsDevOwnerObjectId().equals(new mongoose.Types.ObjectId(DEFAULT_DEV_OWNER_OBJECT_ID_HEX)), 'resolveProjectsDevOwnerObjectId — дефолтный hex'));

  const devFilter = buildProjectOwnerFilter(resolveProjectsDevOwnerObjectId());
  tally(
    logCheck(
      Array.isArray(devFilter.$or) && devFilter.$or.length >= 2,
      'dev filter включает legacy без ownerId',
    ),
  );

  process.env.AUTH_JWT_SECRET = 'test-secret';
  tally(logCheck(resolveAuthJwtMode() === 'hs256', 'AUTH_JWT_SECRET — режим HS256'));
  const hs256Only = validateAuthConfiguration({ production: false, authEnforced: false });
  tally(logCheck(hs256Only.ok, 'HS256 без auth enforced — конфигурация валидна (unit-тесты)'));

  process.env.PROJECTS_AUTH_ENABLED = 'true';
  const hs256WithAuthEnabled = validateAuthConfiguration({ production: false, authEnforced: true });
  tally(
    logCheck(
      !hs256WithAuthEnabled.ok &&
        hs256WithAuthEnabled.errors.some((e) => e.includes('AUTH_JWKS_URI')),
      'PROJECTS_AUTH_ENABLED + HS256 — отклонено, нужен Clerk JWKS',
    ),
  );
  delete process.env.PROJECTS_AUTH_ENABLED;
  delete process.env.AUTH_JWT_SECRET;

  process.env.AUTH_JWKS_URI = 'https://example.com/.well-known/jwks.json';
  process.env.AUTH_JWT_SECRET = 'also-set';
  const conflict = validateAuthConfiguration({ production: false, authEnforced: false });
  tally(
    logCheck(
      !conflict.ok && conflict.errors.some((e) => e.includes('не оба одновременно')),
      'AUTH_JWKS_URI + AUTH_JWT_SECRET одновременно — конфликт',
    ),
  );
  delete process.env.AUTH_JWT_SECRET;
  tally(logCheck(resolveAuthJwtMode() === 'jwks', 'AUTH_JWKS_URI — режим JWKS'));
  const jwksIncomplete = validateAuthConfiguration({ production: false });
  tally(
    logCheck(
      !jwksIncomplete.ok &&
        jwksIncomplete.errors.some((e) => e.includes('AUTH_ISSUER')) &&
        jwksIncomplete.errors.some((e) => e.includes('AUTH_AUDIENCE')),
      'JWKS без issuer/audience — конфигурация невалидна',
    ),
  );

  process.env.AUTH_ISSUER = 'https://example.com';
  process.env.AUTH_AUDIENCE = 'api';
  const jwksNonProd = validateAuthConfiguration({ production: false });
  tally(logCheck(jwksNonProd.ok, 'JWKS + issuer + audience — конфиг non-prod валиден'));

  process.env.AUTH_PROVIDER = 'clerk';
  const devAuthEnabledJwks = validateAuthConfiguration({ production: false, authEnforced: true });
  tally(logCheck(devAuthEnabledJwks.ok, 'PROJECTS_AUTH_ENABLED + Clerk JWKS — конфигурация валидна'));

  process.env.NODE_ENV = 'production';
  delete process.env.PROJECTS_AUTH_ENABLED;
  delete process.env.AUTH_JWKS_URI;
  delete process.env.AUTH_ISSUER;
  delete process.env.AUTH_AUDIENCE;
  delete process.env.AUTH_PROVIDER;
  delete process.env.AUTH_JWT_SECRET;
  tally(logCheck(isProjectsAuthRequired(), 'production: auth обязателен'));
  tally(logCheck(!hasProjectsJwtConfig(), 'production без JWT env — hasProjectsJwtConfig false'));

  process.env.AUTH_JWKS_URI = 'https://example.com/.well-known/jwks.json';
  process.env.AUTH_ISSUER = 'https://example.com';
  process.env.AUTH_AUDIENCE = 'api';
  const prodJwksMissingProvider = validateAuthConfiguration({ production: true });
  tally(
    logCheck(
      !prodJwksMissingProvider.ok &&
        prodJwksMissingProvider.errors.some((e) => e.includes('AUTH_PROVIDER')),
      'production JWKS без AUTH_PROVIDER — конфигурация невалидна',
    ),
  );

  process.env.AUTH_PROVIDER = 'clerk';
  tally(logCheck(resolveAuthProvider() === 'clerk', 'resolveAuthProvider → clerk'));
  const prodJwksComplete = validateAuthConfiguration({ production: true });
  tally(logCheck(prodJwksComplete.ok, 'production JWKS полный — конфигурация валидна'));

  delete process.env.AUTH_JWKS_URI;
  delete process.env.AUTH_ISSUER;
  delete process.env.AUTH_AUDIENCE;
  delete process.env.AUTH_PROVIDER;
  process.env.AUTH_JWT_SECRET = 'test-secret';
  const prodHs256 = validateAuthConfiguration({ production: true });
  tally(
    logCheck(
      !prodHs256.ok &&
        prodHs256.errors.some((e) => e.includes('Clerk') || e.includes('AUTH_JWKS_URI')),
      'production только HS256 — конфигурация невалидна',
    ),
  );

  delete process.env.AUTH_JWT_SECRET;
  process.exitCode = 0;
  assertAuthConfiguredForProduction();
  tally(logCheck(process.exitCode === 1, 'assertAuthConfiguredForProduction без JWT — exitCode 1'));
  process.exitCode = 0;

  process.env.AUTH_JWKS_URI = 'https://example.com/.well-known/jwks.json';
  process.env.AUTH_ISSUER = 'https://example.com';
  process.env.AUTH_AUDIENCE = 'api';
  process.env.AUTH_PROVIDER = 'clerk';
  assertAuthConfiguredForProduction();
  tally(logCheck(process.exitCode !== 1, 'assertAuthConfiguredForProduction с полным JWKS — exitCode не 1'));

  process.env.AUTH_JWT_SECRET = 'test-secret';
  const prodOwnerId = new mongoose.Types.ObjectId();
  const prodFilter = buildProjectOwnerFilter(prodOwnerId);
  tally(
    logCheck(
      prodFilter.ownerId instanceof mongoose.Types.ObjectId &&
        prodFilter.ownerId.equals(prodOwnerId) &&
        prodFilter.$or === undefined,
      'production filter строго по ownerId (ObjectId)',
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
  if (prevIssuer === undefined) delete process.env.AUTH_ISSUER;
  else process.env.AUTH_ISSUER = prevIssuer;
  if (prevAudience === undefined) delete process.env.AUTH_AUDIENCE;
  else process.env.AUTH_AUDIENCE = prevAudience;
  if (prevProvider === undefined) delete process.env.AUTH_PROVIDER;
  else process.env.AUTH_PROVIDER = prevProvider;
  delete process.env.RATE_LIMIT_DISABLED;
}

if (failed > 0) {
  console.error(`\nverify:projects-auth — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:projects-auth — все проверки пройдены');
}
