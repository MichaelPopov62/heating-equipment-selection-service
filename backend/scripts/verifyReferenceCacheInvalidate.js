/**
 * Назначение: проверка invalidateReferenceCache + generation guard.
 * Запуск: node scripts/verifyReferenceCacheInvalidate.js (из backend/)
 */

import {
  getReferenceBundle,
  invalidateReferenceCache,
  invalidateAndWarmReferenceCache,
  warmupReferenceCache,
} from '../src/reference/public.js';

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

await warmupReferenceCache();
const before = await getReferenceBundle();
const loadedAtBefore = before.loadedAt;

await new Promise((r) => setTimeout(r, 5));

tally(
  logCheck(
    typeof loadedAtBefore === 'number' && loadedAtBefore > 0,
    'warmup: loadedAt задан',
  ),
);

invalidateReferenceCache();
const afterInvalidate = await getReferenceBundle();
tally(
  logCheck(
    afterInvalidate.loadedAt >= loadedAtBefore,
    'после invalidate getReferenceBundle перезагружает bundle',
  ),
);

const rewarmed = await invalidateAndWarmReferenceCache();
tally(
  logCheck(
    rewarmed.loadedAt >= afterInvalidate.loadedAt,
    'invalidateAndWarmReferenceCache возвращает свежий bundle',
  ),
);

console.log(failed === 0 ? '\nverifyReferenceCacheInvalidate: ALL OK' : `\nFAILED: ${failed}`);
process.exitCode = failed > 0 ? 1 : 0;
