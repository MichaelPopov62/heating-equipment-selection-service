/**
 * Назначение: проверка requireAuth / optionalAuth и rate limit key.
 * Запуск: cd backend && npm run verify:auth-middleware
 */
import { optionalAuth } from '../src/auth/optionalAuth.js';
import { optionalProjectsAuth } from '../src/auth/optionalProjectsAuth.js';
import { requireAuth } from '../src/auth/requireAuth.js';
import { requireProjectsAuth } from '../src/auth/requireProjectsAuth.js';
import { resolveRateLimitKey } from '../src/api/middleware/rateLimiters.js';

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

tally(logCheck(requireAuth === requireProjectsAuth, 'requireProjectsAuth — deprecated alias requireAuth'));
tally(logCheck(optionalAuth === optionalProjectsAuth, 'optionalProjectsAuth — deprecated alias optionalAuth'));
tally(
  logCheck(
    resolveRateLimitKey(
      /** @type {import('express').Request} */ ({
        user: { id: '507f1f77bcf86cd799439011' },
        ip: '203.0.113.10',
      }),
    ) === 'user:507f1f77bcf86cd799439011',
    'resolveRateLimitKey — req.user.id',
  ),
);
tally(
  logCheck(
    !resolveRateLimitKey(
      /** @type {import('express').Request} */ ({
        ip: '203.0.113.10',
      }),
    ).startsWith('user:'),
    'resolveRateLimitKey без req.user — fallback IP',
  ),
);

if (failed > 0) {
  console.error(`\nverify:auth-middleware — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:auth-middleware — все проверки пройдены');
}
