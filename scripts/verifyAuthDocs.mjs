/**
 * Назначение: verify документации auth — SSOT, перекрёстные ссылки.
 * Запуск: npm run verify:auth-docs (из корня репозитория)
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
const backendPkg = JSON.parse(readRepo('backend/package.json'));

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
assert.match(authDoc, /verify:projects-admin-access/);
assert.match(authDoc, /verify:frontend-auth/);
assert.match(authDoc, /verify:frontend-me/);
assert.match(authDoc, /verify:migrate-project-owner-ids/);
assert.match(authDoc, /verify:feedback/);
assert.match(authDoc, /verify:admin-feedback/);
assert.match(authDoc, /VITE_CLERK_PUBLISHABLE_KEY/);
assert.match(authDoc, /AUTH_JWKS_URI/);
assert.match(authDoc, /\/sign-up\/\*/);
assert.match(authDoc, /SignUpPage/);
assert.match(authDoc, /resolveClerkJwtTemplateForApi|getToken\(\{ template \}\)/);
assert.match(authDoc, /JWT без claim email/);

assert.match(authDoc, /verify:authorization-policy/);
assert.match(authDoc, /verify:me-endpoint/);
assert.match(authDoc, /verify:platform-admin/);
assert.match(authDoc, /PLATFORM_ADMIN_EMAILS/);
assert.match(authDoc, /Platform admin/);
assert.match(authDoc, /platformAdminAllowlist/);
assert.match(authDoc, /Delegated admin/);
assert.match(authDoc, /GET \/api\/v1\/me/);
assert.match(authDoc, /marketplace/);
assert.match(authDoc, /AccountBar/);
assert.match(authDoc, /publisherPresentation/);
assert.match(authDoc, /Smoke tier UX/);
assert.match(authDoc, /нет 403.*subscription|без gating/i);
assert.match(
  authDoc,
  /Состояние Phase 2 \(кратко\):[\s\S]*метка аудитории[\s\S]*вручную админом[\s\S]*не\*\* гейтятся|не гейтятся/i,
);

const subscriptionTierSchema = readRepo('components/schemas/SubscriptionTier.yaml');
assert.match(
  subscriptionTierSchema,
  /метка аудитории[\s\S]*назначение вручную[\s\S]*self-serve/i,
);

/** Каждый runtime-модуль auth/ должен быть назван в docs/auth.md. */
const authSrcDir = path.join(root, 'backend', 'src', 'auth');
for (const name of readdirSync(authSrcDir).filter((n) => n.endsWith('.js'))) {
  assert.match(
    authDoc,
    new RegExp(name.replace(/\./g, '\\.')),
    `docs/auth.md должен упоминать auth-модуль ${name}`,
  );
}

assert.match(authDoc, /auth\/ProtectedRoute\.tsx/);
assert.doesNotMatch(authDoc, /routing\/ProtectedRoute\.tsx/);
assert.match(authDoc, /auth\/ClerkProviderWithRouter\.tsx/);
assert.match(authDoc, /auth\/ClerkLazyRoot\.tsx|ClerkLazyRoot/);
assert.match(authDoc, /shouldLoadClerkForPath/);
assert.match(authDoc, /clerk-sticky/);
assert.match(authDoc, /ClerkAuthLoadingFallback/);
assert.match(authDoc, /start-state\.md/);
assert.match(authDoc, /extractBearerToken\.js/);
assert.match(authDoc, /adminFeedbackRoutes\.js/);
assert.equal(
  existsSync(path.join(root, 'frontend', 'src', 'auth', 'ProtectedRoute.tsx')),
  true,
  'frontend/src/auth/ProtectedRoute.tsx должен существовать',
);
assert.equal(
  existsSync(path.join(root, 'frontend', 'src', 'routing', 'ProtectedRoute.tsx')),
  false,
  'frontend/src/routing/ProtectedRoute.tsx не должен существовать (SSOT — auth/)',
);

assert.match(projectsApi, /auth\.md/, 'projects-api.md должен ссылаться на auth.md');
assert.match(projectsApi, /publisherPresentation/, 'projects-api.md — publisherPresentation');
assert.match(projectsApi, /verify:projects-import-admin/);

/** Полный набор REST projects из OpenAPI / routers — должен быть в projects-api.md. */
const projectsApiPaths = [
  '/api/v1/projects',
  '/api/v1/projects/{id}',
  '/api/v1/projects/{id}/calc',
  '/api/v1/projects/{id}/calculations',
  '/api/v1/projects/{projectId}/calculations/{calcId}',
  '/api/v1/projects/import',
  '/api/v1/projects/{id}/share',
  '/api/v1/projects/{id}/pdf',
  '/api/v1/public/shares/{shareToken}',
  '/api/v1/public/shares/{shareToken}/pdf',
];
for (const p of projectsApiPaths) {
  assert.match(
    projectsApi,
    new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `docs/projects-api.md должен документировать ${p}`,
  );
  assert.match(
    openapi,
    new RegExp(`^  ${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'm'),
    `openapi.yaml должен содержать путь ${p}`,
  );
}

/** Auth-матрица из auth.md — пути в OpenAPI. */
for (const p of [
  '/api/v1/me',
  '/api/v1/feedback',
  '/api/v1/admin/users/{id}',
  '/api/v1/admin/feedback',
  '/api/v1/admin/feedback/stream',
  '/api/v1/admin/feedback/{id}',
  '/api/v1/calc',
  '/health',
]) {
  assert.match(
    openapi,
    new RegExp(`^  ${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'm'),
    `openapi.yaml должен содержать путь ${p}`,
  );
  assert.match(authDoc, new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

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
assert.match(
  String(backendPkg.scripts.verify),
  /verify:platform-admin/,
  'backend verify должен включать verify:platform-admin',
);
assert.ok(
  backendPkg.scripts['verify:projects-admin-access'],
  'backend/package.json должен содержать verify:projects-admin-access',
);
assert.ok(
  backendPkg.scripts['verify:projects-import-admin'],
  'backend/package.json должен содержать verify:projects-import-admin',
);

const deploySmoke = readRepo('docs/deploy/smoke-tests.md');
const deployRender = readRepo('docs/deploy/render.md');
assert.match(deployRender, /PLATFORM_ADMIN_EMAILS/);
assert.match(deploySmoke, /Platform admin — ops runbook/);
assert.match(deploySmoke, /Acceptance checklist \(A1–A7\)/);

assert.match(String(frontendPkg.scripts.verify), /verify:frontend-me/, 'frontend verify должен включать verify:frontend-me');

console.log('verify:auth-docs OK');
