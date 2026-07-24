/**
 * Назначение: проверка requireRole middleware (Фаза 2 PR-10).
 * Запуск: cd backend && npm run verify:authorization-middleware
 */
import { requireRole } from '../src/auth/requireRole.js';

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

/**
 * @param {import('express').Request} req
 * @returns {Promise<{ statusCode: number; body: Record<string, unknown> | null }>}
 */
async function runMiddleware(req) {
  const middleware = requireRole('admin');
  /** @type {{ statusCode: number; body: Record<string, unknown> | null }} */
  const result = { statusCode: 0, body: null };

  await new Promise((resolve) => {
    const res = {
      /** @param {number} code */
      status(code) {
        result.statusCode = code;
        return this;
      },
      /** @param {Record<string, unknown>} payload */
      json(payload) {
        result.body = payload;
        resolve(undefined);
        return this;
      },
    };
    middleware(req, /** @type {import('express').Response} */ (res), () => {
      result.statusCode = 200;
      resolve(undefined);
    });
  });

  return result;
}

const prevAuthEnabled = process.env.PROJECTS_AUTH_ENABLED;
const prevNodeEnv = process.env.NODE_ENV;

process.env.NODE_ENV = 'test';
process.env.PROJECTS_AUTH_ENABLED = 'true';

(async () => {
  const noUser = await runMiddleware(/** @type {import('express').Request} */ ({}));
  const noUserError = /** @type {{ error?: { code?: string } } | undefined} */ (noUser.body)
    ?.error;
  tally(
    logCheck(
      noUser.statusCode === 401 && noUserError?.code === 'PROJECTS_AUTH_REQUIRED',
      'requireRole без req.user → 401',
    ),
  );

  const notAdmin = await runMiddleware(
    /** @type {import('express').Request} */ ({
      user: {
        id: '507f1f77bcf86cd799439011',
        role: 'user',
        subscription: 'free',
      },
    }),
  );
  const notAdminError = /** @type {{ error?: { code?: string } } | undefined} */ (
    notAdmin.body
  )?.error;
  tally(
    logCheck(
      notAdmin.statusCode === 403 && notAdminError?.code === 'ADMIN_REQUIRED',
      'requireRole user → 403 ADMIN_REQUIRED',
    ),
  );

  const adminOk = await runMiddleware(
    /** @type {import('express').Request} */ ({
      user: {
        id: '507f1f77bcf86cd799439011',
        role: 'admin',
        subscription: 'pro',
      },
    }),
  );
  tally(logCheck(adminOk.statusCode === 200, 'requireRole admin → next()'));

  process.env.PROJECTS_AUTH_ENABLED = 'false';
  const devBlocked = await runMiddleware(
    /** @type {import('express').Request} */ ({
      user: {
        id: '507f1f77bcf86cd799439011',
        role: 'admin',
        subscription: 'pro',
      },
    }),
  );
  const devBlockedError = /** @type {{ error?: { code?: string } } | undefined} */ (
    devBlocked.body
  )?.error;
  tally(
    logCheck(
      devBlocked.statusCode === 403 && devBlockedError?.code === 'ADMIN_REQUIRED',
      'requireRole при auth disabled → 403',
    ),
  );

  if (prevAuthEnabled === undefined) delete process.env.PROJECTS_AUTH_ENABLED;
  else process.env.PROJECTS_AUTH_ENABLED = prevAuthEnabled;
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;

  if (failed > 0) {
    console.error(`\nverify:authorization-middleware — ${failed} проверок провалено`);
    process.exitCode = 1;
  } else {
    console.log('\nverify:authorization-middleware — все проверки пройдены');
  }
})();
