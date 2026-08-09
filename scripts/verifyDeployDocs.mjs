/**
 * Назначение: verify раздела docs/deploy/ — файлы, ключевые секции, отсутствие legacy stubs.
 * Запуск: npm run verify:deploy-docs (из корня репозитория)
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} rel */
function readRepo(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const deployDir = path.join(root, 'docs', 'deploy');
const required = [
  'README.md',
  'phase0-audit.md',
  'architecture.md',
  'environments.md',
  'vercel.md',
  'render.md',
  'first-deploy.md',
  'smoke-tests.md',
  'baseline.md',
];

for (const name of required) {
  const filePath = path.join(deployDir, name);
  assert.ok(existsSync(filePath), `missing docs/deploy/${name}`);
  const content = readFileSync(filePath, 'utf8');
  assert.match(
    content,
    /^<!--\s*Назначение:/,
    `docs/deploy/${name}: missing <!-- Назначение: ... --> at file start`,
  );
}

const legacyPaths = ['docs/deployment-architecture.md', 'docs/deployment-baseline.md'];
for (const rel of legacyPaths) {
  assert.ok(!existsSync(path.join(root, rel)), `legacy stub must be removed: ${rel}`);
}

const readme = readRepo('docs/deploy/README.md');
assert.match(readme, /heatcalc-staging-mp62\.vercel\.app/);
assert.match(readme, /heatcalc-api-mp62\.onrender\.com/);
assert.match(readme, /architecture\.md/);

const smoke = readRepo('docs/deploy/smoke-tests.md');
assert.match(smoke, /A1/);
assert.match(smoke, /A7/);
assert.match(smoke, /PLATFORM_ADMIN_EMAILS/);

const vercelDoc = readRepo('docs/deploy/vercel.md');
assert.match(vercelDoc, /vercel-build/);
assert.match(vercelDoc, /Output Directory:\s+build/);

/** @type {{ installCommand?: string; buildCommand?: string; outputDirectory?: string }} */
const vercelJson = JSON.parse(readRepo('vercel.json'));
assert.equal(vercelJson.installCommand, 'npm ci --prefix frontend', 'vercel.json installCommand');
assert.equal(vercelJson.buildCommand, 'npm run vercel-build', 'vercel.json buildCommand');
assert.equal(vercelJson.outputDirectory, 'build', 'vercel.json outputDirectory');
assert.ok(!existsSync(path.join(root, 'frontend', 'vercel.json')), 'frontend/vercel.json must be removed');

const backendEnvExample = readRepo('backend/.env.example');
assert.match(backendEnvExample, /docs\/deploy\/render\.md/);

const operationalDeploy = required.filter((name) => name !== 'phase0-audit.md');
for (const name of operationalDeploy) {
  const content = readFileSync(path.join(deployDir, name), 'utf8');
  assert.doesNotMatch(content, /Статус раздела:/, `docs/deploy/${name}: no phase status block`);
  assert.doesNotMatch(content, /^\*\*Фаза \d/m, `docs/deploy/${name}: no **Фаза N** tracker`);
}

const rootPkg = JSON.parse(readRepo('package.json'));
assert.match(String(rootPkg.scripts.verify), /verify:deploy-docs/);

const plan = readRepo('Plan.md');
assert.match(plan, /docs\/deploy\/README\.md/);
assert.doesNotMatch(plan, /deployment-architecture/);

const auth = readRepo('docs/auth.md');
assert.match(auth, /deploy\/smoke-tests\.md/);
assert.match(auth, /deploy\/render\.md/);

const frontendEnvExample = readRepo('frontend/.env.example');
assert.doesNotMatch(frontendEnvExample, /heatcalc-mp62\.vercel\.app/);
assert.doesNotMatch(frontendEnvExample, /VITE_DEV_TOOLS/);

console.log('verify:deploy-docs OK');
