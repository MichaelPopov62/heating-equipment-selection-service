/**
 * Назначение: verify документации auth (PR-8) — наличие SSOT и перекрёстных ссылок.
 * Запуск: npm run verify:auth-docs (из корня репозитория)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} rel */
function readRepo(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const authDoc = readRepo('docs/auth.md');
const projectsApi = readRepo('docs/projects-api.md');
const projectStructure = readRepo('docs/project-structure.md');
const openapi = readRepo('openapi.yaml');
const rootPkg = JSON.parse(readRepo('package.json'));

const requiredSections = [
  '## Цепочка identity',
  '## Backend',
  '## Frontend',
  '## Переменные окружения',
  '## Настройка Clerk',
  '## Миграция legacy',
  '## Коды ошибок auth',
  '## Verify и smoke-check',
  '## Roadmap Фазы 1',
];

for (const section of requiredSections) {
  assert.ok(authDoc.includes(section), `docs/auth.md должен содержать "${section}"`);
}

assert.match(authDoc, /JWT\.sub → users\.providerUserId|providerUserId.*users\._id|req\.user\.id/s);
assert.match(authDoc, /verify:projects-auth/);
assert.match(authDoc, /verify:frontend-auth/);
assert.match(authDoc, /verify:migrate-project-owner-ids/);
assert.match(authDoc, /VITE_CLERK_PUBLISHABLE_KEY/);
assert.match(authDoc, /AUTH_JWKS_URI/);

assert.match(projectsApi, /auth\.md/, 'projects-api.md должен ссылаться на auth.md');
assert.match(projectStructure, /auth\.md/, 'project-structure.md должен ссылаться на auth.md');

assert.match(openapi, /ProjectsBearerAuth/);
assert.match(openapi, /users\._id → projects\.ownerId/);

assert.match(String(rootPkg.scripts.verify), /verify:auth-docs/, 'корневой verify должен включать verify:auth-docs');

console.log('verify:auth-docs OK');
