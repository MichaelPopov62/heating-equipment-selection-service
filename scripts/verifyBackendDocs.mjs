/**
 * Назначение: verify соответствия документации текущему коду (только актуальное состояние).
 * Запуск: npm run verify:backend-docs (из корня репозитория)
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Домены верхнего уровня backend/src (SSOT — сверка с docs/project-structure.md). */
const BACKEND_SRC_TOP_DIRS = [
  'api',
  'auth',
  'catalog',
  'climate',
  'data',
  'dhw',
  'feedback',
  'hydraulics',
  'logic',
  'matching',
  'models',
  'projects',
  'recommendations',
  'reference',
  'report',
  'types',
  'ufh',
  'utils',
];

/** Barrels public.js в backend/src. */
const BACKEND_PUBLIC_BARRELS = [
  'api/public.js',
  'catalog/public.js',
  'hydraulics/public.js',
  'matching/public.js',
  'models/public.js',
  'reference/public.js',
  'report/public.js',
];

/** Ключевые файлы api/, которые должны быть отражены в project-structure.md. */
const BACKEND_API_DOC_MARKERS = [
  'routes.js',
  'runCalculation.js',
  'validate.js',
  'errorCodes.js',
  'sendErrorEnvelope.js',
  'adminFeedbackRoutes.js',
  'projectsRoutes.js',
  'publicSharesRoutes.js',
];

/** @param {string} rel */
function readRepo(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

/** @param {string} relDir */
function listMdInDir(relDir) {
  const abs = path.join(root, relDir);
  return readdirSync(abs)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(relDir, name).replace(/\\/g, '/'));
}

const appliances = JSON.parse(readRepo('backend/data/appliances.json'));
const hydraulics = appliances.find(
  (/** @type {{ applianceKind?: string }} */ x) => x.applianceKind === 'hydraulics',
);
assert.equal(hydraulics?.schemaVersion, 5, 'appliances.hydraulics.schemaVersion должен быть 5');

const hydraulicsDoc = readRepo('docs/hydraulics-pipeline.md');
assert.match(hydraulicsDoc, /schemaVersion: 5/);
assert.doesNotMatch(hydraulicsDoc, /schemaVersion: 4/);
assert.doesNotMatch(hydraulicsDoc, /schemaVersion 2/);

const envExample = readRepo('backend/.env.example');
assert.match(envExample, /schemaVersion 5/);

const cursorrules = readRepo('.cursorrules');
assert.doesNotMatch(cursorrules, /"type":"living"/);
assert.doesNotMatch(cursorrules, /"type": "living"/);
assert.match(cursorrules, /\/api\/v1\/presets\/underfloor-heating\/modes/);
assert.match(cursorrules, /underfloor_heating_presets/);
assert.match(cursorrules, /uniboxes/);
assert.match(cursorrules, /ufhPresetsSource/);
assert.match(cursorrules, /schemaVersion: 5/);
assert.doesNotMatch(cursorrules, /до freeze/i);
assert.doesNotMatch(cursorrules, /до релиза/i);

const calcValidation = readRepo('docs/calc-input-validation.md');
assert.match(calcValidation, /ROOM_TYPE_INVALID.*living/s);

const plan = readRepo('Plan.md');
assert.match(plan, /project-structure\.md/);
assert.match(plan, /survey-draft\.md/);
assert.match(plan, /ufh-test-checklist\.md/);
assert.doesNotMatch(plan, /✅/);
assert.doesNotMatch(plan, /Roadmap/i);
assert.doesNotMatch(plan, /phase0-audit/);
assert.doesNotMatch(plan, /baseline\.md/);
assert.doesNotMatch(
  plan,
  /## `backend\/` — REST API/,
  'Plan.md не должен дублировать детальную таблицу backend/ (SSOT — project-structure.md)',
);

const projectStructure = readRepo('docs/project-structure.md');
for (const dir of BACKEND_SRC_TOP_DIRS) {
  assert.match(
    projectStructure,
    new RegExp(`\`${dir}/\``),
    `project-structure.md должен описывать backend/src/${dir}/`,
  );
}
assert.match(projectStructure, /feedback\//);
assert.match(projectStructure, /catalog-language/);
assert.match(projectStructure, /auth-pipeline/);
assert.doesNotMatch(projectStructure, /Фазы 1–3/);
assert.doesNotMatch(
  projectStructure,
  /legacy hydraulics snapshot/,
  'устаревший matching hydraulics snapshot не должен быть в docs',
);
assert.ok(
  !existsSync(path.join(root, 'backend', 'src', 'matching', 'hydraulics.js')),
  'backend/src/matching/hydraulics.js не должен существовать',
);

for (const marker of BACKEND_API_DOC_MARKERS) {
  assert.match(
    projectStructure,
    new RegExp(marker.replace(/\./g, '\\.')),
    `project-structure.md должен упоминать api/${marker}`,
  );
}

const backendSrc = path.join(root, 'backend', 'src');
const actualDirs = readdirSync(backendSrc)
  .filter((name) => statSync(path.join(backendSrc, name)).isDirectory())
  .sort();
assert.deepEqual(
  actualDirs,
  [...BACKEND_SRC_TOP_DIRS].sort(),
  'backend/src top-level dirs должны совпадать с BACKEND_SRC_TOP_DIRS',
);

for (const rel of BACKEND_PUBLIC_BARRELS) {
  assert.ok(
    existsSync(path.join(backendSrc, rel)),
    `отсутствует barrel backend/src/${rel}`,
  );
}
assert.ok(existsSync(path.join(backendSrc, 'index.js')), 'backend/src/index.js обязателен');

const surveyDraft = readRepo('docs/survey-draft.md');
assert.match(surveyDraft, /SurveyDraft/);
assert.doesNotMatch(surveyDraft, /Hard Reset/i);
assert.doesNotMatch(surveyDraft, /до релиза/i);

const languagePolicy = readRepo('docs/language-policy.md');
assert.doesNotMatch(languagePolicy, /PR-[0-9]/);
assert.doesNotMatch(languagePolicy, /✅ 20/);

assert.ok(
  !existsSync(path.join(root, 'docs/ufh-roadmap-test-checklist.md')),
  'docs/ufh-roadmap-test-checklist.md должен быть удалён',
);
assert.ok(existsSync(path.join(root, 'docs/ufh-test-checklist.md')), 'docs/ufh-test-checklist.md должен существовать');

const backendPkg = JSON.parse(readRepo('backend/package.json'));
assert.equal(
  backendPkg.scripts['verify:hydraulics-pipeline-input'],
  undefined,
  'verify:hydraulics-pipeline-input должен быть удалён',
);

assert.ok(existsSync(path.join(root, 'backend/README.md')), 'backend/README.md должен существовать');
const backendReadme = readRepo('backend/README.md');
assert.match(backendReadme, /project-structure\.md/);
assert.doesNotMatch(
  backendReadme,
  /Карта модулей:.*Plan\.md.*project-structure/,
  'backend/README не должен дублировать две карты структуры',
);

const rootPkg = JSON.parse(readRepo('package.json'));
assert.match(String(rootPkg.scripts.verify), /verify:backend-docs/);

/** @type {Array<{ pattern: RegExp, label: string, skip?: string[] }>} */
const docHistoryBans = [
  { pattern: /Hard Reset/i, label: 'Hard Reset' },
  { pattern: /roadmap фазы/i, label: 'roadmap фазы' },
  { pattern: /PR-[0-9]/, label: 'PR-N', skip: ['docs/auth.md'] },
  { pattern: /✅ 20\d{2}-\d{2}-\d{2}/, label: '✅ с датой' },
  { pattern: /до релиза/i, label: 'до релиза' },
  { pattern: /снятия freeze/i, label: 'снятия freeze' },
  { pattern: /ufh-roadmap-test-checklist/, label: 'ufh-roadmap-test-checklist' },
];

const docPaths = [
  ...listMdInDir('docs'),
  'Plan.md',
  'README.md',
  '.cursorrules',
];

for (const rel of docPaths) {
  const text = readRepo(rel);
  for (const ban of docHistoryBans) {
    if (ban.skip?.includes(rel)) continue;
    assert.doesNotMatch(
      text,
      ban.pattern,
      `${rel}: не должно быть исторического маркера «${ban.label}»`,
    );
  }
}

console.log('verify:backend-docs OK');
