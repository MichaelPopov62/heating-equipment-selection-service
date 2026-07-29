/**
 * Назначение: verify документации auth — SSOT, перекрёстные ссылки.
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
const clientShare = readRepo('docs/client-share-and-layers.md');
const queryInventory = readRepo('docs/frontend-query-inventory.md');
const openapi = readRepo('openapi.yaml');
const rootPkg = JSON.parse(readRepo('package.json'));
const frontendPkg = JSON.parse(readRepo('frontend/package.json'));

const requiredSections = [
  '## Цепочка identity',
  '## Backend',
  '## Frontend',
  '## Переменные окружения',
  '## Настройка Clerk',
  '## Миграция ownerId',
  '## Коды ошибок auth',
  '## Authorization (tier и role)',
  '## Verify и smoke-check',
  '## Frontend tier UX',
];

for (const section of requiredSections) {
  assert.ok(authDoc.includes(section), `docs/auth.md должен содержать "${section}"`);
}

assert.doesNotMatch(authDoc, /## Roadmap Фазы/);

assert.match(authDoc, /JWT\.sub → users\.providerUserId|providerUserId.*users\._id|req\.user\.id/s);
assert.match(authDoc, /verify:projects-auth/);
assert.match(authDoc, /verify:frontend-auth/);
assert.match(authDoc, /verify:frontend-me/);
assert.match(authDoc, /verify:migrate-project-owner-ids/);
assert.match(authDoc, /VITE_CLERK_PUBLISHABLE_KEY/);
assert.match(authDoc, /AUTH_JWKS_URI/);
assert.match(authDoc, /\/sign-up\/\*/);
assert.match(authDoc, /SignUpPage/);
assert.match(authDoc, /resolveClerkJwtTemplateForApi|getToken\(\{ template \}\)/);
assert.match(authDoc, /JWT без claim email/);

assert.match(authDoc, /verify:authorization-policy/);
assert.match(authDoc, /verify:me-endpoint/);
assert.match(authDoc, /GET \/api\/v1\/me/);
assert.match(authDoc, /marketplace/);
assert.match(authDoc, /AccountBar/);
assert.match(authDoc, /publisherPresentation/);
assert.match(authDoc, /Smoke tier UX/);
assert.match(authDoc, /нет 403.*subscription|без gating/i);

assert.match(projectsApi, /auth\.md/, 'projects-api.md должен ссылаться на auth.md');
assert.match(projectsApi, /publisherPresentation/, 'projects-api.md — publisherPresentation');
assert.match(projectStructure, /auth\.md/, 'project-structure.md должен ссылаться на auth.md');
assert.match(projectStructure, /AccountBar/);
assert.match(projectStructure, /meApi/);
assert.match(clientShare, /publisherPresentation/);
assert.match(clientShare, /PublisherContactBlock/);
assert.match(queryInventory, /useMeQuery/);
assert.match(queryInventory, /verify:frontend-me/);

assert.match(openapi, /\/api\/v1\/me/);
assert.match(openapi, /ProjectsBearerAuth/);
assert.match(openapi, /SharePublisherPresentation/);
assert.match(openapi, /users\._id → projects\.ownerId/);

assert.match(String(rootPkg.scripts.verify), /verify:auth-docs/, 'корневой verify должен включать verify:auth-docs');
assert.match(String(frontendPkg.scripts.verify), /verify:frontend-me/, 'frontend verify должен включать verify:frontend-me');

console.log('verify:auth-docs OK');
