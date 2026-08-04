/**
 * Назначение: verify admin gate на POST /api/v1/projects/import.
 * Запуск: cd backend && npm run verify:projects-import-admin
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const routesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'api',
  'projectsRoutes.js',
);
const routes = readFileSync(routesPath, 'utf8');

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

tally(
  logCheck(
    routes.includes("requireRole('admin')"),
    "projectsRoutes import — requireRole('admin')",
  ),
);

const importBlock = routes.slice(
  routes.indexOf('/api/v1/projects/import'),
  routes.indexOf('/api/v1/projects/import') + 400,
);
tally(
  logCheck(
    /requireRole\('admin'\)/.test(importBlock),
    'requireRole admin на маршруте import (рядом с POST)',
  ),
);

if (failed > 0) {
  console.error(`\nverify:projects-import-admin — ${failed} failure(s)`);
  process.exitCode = 1;
} else {
  console.log('\nverify:projects-import-admin — all checks passed');
}
