/**
 * Назначение: проверка JWT pipeline (verify → map → resolve → attach).
 * Запуск: cd backend && npm run verify:auth-pipeline
 * Примечание: использует AUTH_JWT_SECRET (HS256) без JWKS — только unit-тест, не Clerk runtime.
 */
import * as jose from 'jose';
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachRequestContext } from '../src/auth/attachRequestContext.js';
import { mapJwtPayload } from '../src/auth/mapJwtPayload.js';
import { resolveUser } from '../src/auth/resolveUser.js';
import { verifyAccessToken } from '../src/auth/verifyAccessToken.js';
import { User } from '../src/models/public.js';
import { ensureMongoReferenceConnection } from '../src/utils/mongoReferenceConnection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

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

const prevSecret = process.env.AUTH_JWT_SECRET;
const prevIssuer = process.env.AUTH_ISSUER;
const prevAudience = process.env.AUTH_AUDIENCE;
const prevProvider = process.env.AUTH_PROVIDER;
const prevJwks = process.env.AUTH_JWKS_URI;
const prevNodeEnv = process.env.NODE_ENV;
const prevAuthEnabled = process.env.PROJECTS_AUTH_ENABLED;

process.env.NODE_ENV = 'test';
delete process.env.PROJECTS_AUTH_ENABLED;
delete process.env.AUTH_JWKS_URI;
process.env.AUTH_JWT_SECRET = 'verify-auth-pipeline-secret';
process.env.AUTH_ISSUER = 'https://verify-auth.test';
process.env.AUTH_AUDIENCE = 'verify-api';
process.env.AUTH_PROVIDER = 'clerk';

/** @type {string | null} */
let createdUserId = null;

try {
  const clerkLikePayload = {
    sub: 'user_verify_pipeline_1',
    email: 'verify@example.com',
    email_verified: true,
    name: 'Verify User',
    iss: 'https://verify-auth.test',
    aud: 'verify-api',
  };

  const identity = mapJwtPayload(clerkLikePayload);
  tally(
    logCheck(
      identity.provider === 'clerk' &&
        identity.providerUserId === 'user_verify_pipeline_1' &&
        identity.email === 'verify@example.com' &&
        identity.emailVerified === true &&
        identity.name === 'Verify User',
      'mapJwtPayload — clerk-like payload',
    ),
  );

  let mapError = null;
  try {
    mapJwtPayload({ email: 'no-sub@example.com' });
  } catch (err) {
    mapError = err;
  }
  tally(
    logCheck(
      mapError instanceof Error &&
        /** @type {import('../src/types/shared-types.js').AppErrorLike} */ (mapError).code ===
          'PROJECTS_AUTH_FORBIDDEN',
      'mapJwtPayload без sub → PROJECTS_AUTH_FORBIDDEN',
    ),
  );

  mapError = null;
  try {
    mapJwtPayload({ sub: 'user-no-email' });
  } catch (err) {
    mapError = err;
  }
  tally(
    logCheck(
      mapError instanceof Error &&
        /** @type {import('../src/types/shared-types.js').AppErrorLike} */ (mapError).code ===
          'PROJECTS_AUTH_FORBIDDEN',
      'mapJwtPayload без email → PROJECTS_AUTH_FORBIDDEN',
    ),
  );

  const secretKey = new TextEncoder().encode(process.env.AUTH_JWT_SECRET);
  const signedJwt = await new jose.SignJWT({
    sub: 'user_verify_pipeline_jwt',
    email: 'jwt@example.com',
    email_verified: false,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(process.env.AUTH_ISSUER)
    .setAudience(process.env.AUTH_AUDIENCE)
    .setExpirationTime('5m')
    .sign(secretKey);

  const verifiedPayload = await verifyAccessToken(signedJwt);
  const fromVerify = mapJwtPayload(verifiedPayload);
  tally(
    logCheck(
      fromVerify.providerUserId === 'user_verify_pipeline_jwt' &&
        fromVerify.email === 'jwt@example.com' &&
        fromVerify.emailVerified === false,
      'verifyAccessToken(HS256) + mapJwtPayload',
    ),
  );

  const mongoOk = await ensureMongoReferenceConnection();
  if (!mongoOk) {
    console.log('SKIP — resolveUser (MongoDB не настроена в .env)');
  } else {
    const resolved = await resolveUser(fromVerify);
    createdUserId = resolved.id;
    tally(
      logCheck(
        resolved.id.length > 0 &&
          resolved.authProvider === 'clerk' &&
          resolved.providerUserId === 'user_verify_pipeline_jwt' &&
          resolved.role === 'user' &&
          resolved.subscription === 'free',
        'resolveUser — create/find AuthUser',
      ),
    );

    const resolvedAgain = await resolveUser(fromVerify);
    tally(
      logCheck(resolvedAgain.id === resolved.id, 'resolveUser — повторный find без нового create'),
    );

    /** @type {import('express').Request} */
    const mockReq = /** @type {import('express').Request} */ ({
      requestId: 'verify-req-id',
      ip: '127.0.0.1',
      get(name) {
        if (name.toLowerCase() === 'set-cookie') return undefined;
        return name.toLowerCase() === 'user-agent' ? 'verify-auth-pipeline/1.0' : undefined;
      },
      socket: { remoteAddress: '127.0.0.1' },
    });
    const ctx = attachRequestContext(mockReq, resolved);
    tally(
      logCheck(
        mockReq.user?.id === resolved.id &&
          ctx.requestId === 'verify-req-id' &&
          ctx.ip === '127.0.0.1' &&
          ctx.userAgent === 'verify-auth-pipeline/1.0',
        'attachRequestContext — req.user и метаданные',
      ),
    );
  }
} finally {
  if (createdUserId && (await ensureMongoReferenceConnection())) {
    await User.deleteOne({ _id: createdUserId }).catch(() => undefined);
  }

  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;
  if (prevAuthEnabled === undefined) delete process.env.PROJECTS_AUTH_ENABLED;
  else process.env.PROJECTS_AUTH_ENABLED = prevAuthEnabled;
  if (prevSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = prevSecret;
  if (prevIssuer === undefined) delete process.env.AUTH_ISSUER;
  else process.env.AUTH_ISSUER = prevIssuer;
  if (prevAudience === undefined) delete process.env.AUTH_AUDIENCE;
  else process.env.AUTH_AUDIENCE = prevAudience;
  if (prevProvider === undefined) delete process.env.AUTH_PROVIDER;
  else process.env.AUTH_PROVIDER = prevProvider;
  if (prevJwks === undefined) delete process.env.AUTH_JWKS_URI;
  else process.env.AUTH_JWKS_URI = prevJwks;

  if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
    await mongoose.disconnect().catch(() => undefined);
  }
}

if (failed > 0) {
  console.error(`\nverify:auth-pipeline — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:auth-pipeline — все проверки пройдены');
}
