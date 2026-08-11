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
const backendPkg = JSON.parse(readRepo('backend/package.json'));
const hydraulics = appliances.find(
  (/** @type {{ applianceKind?: string }} */ x) => x.applianceKind === 'hydraulics',
);
assert.equal(hydraulics?.schemaVersion, 5, 'appliances.hydraulics.schemaVersion должен быть 5');

const hydraulicsDoc = readRepo('docs/hydraulics-pipeline.md');
assert.match(hydraulicsDoc, /schemaVersion: 5/);
assert.doesNotMatch(hydraulicsDoc, /schemaVersion: 4/);
assert.doesNotMatch(hydraulicsDoc, /schemaVersion 2/);

/** Каждый runtime-модуль hydraulics/ должен быть назван в docs/hydraulics-pipeline.md. */
const hydraulicsSrcDir = path.join(root, 'backend', 'src', 'hydraulics');
const hydraulicsRuntimeFiles = readdirSync(hydraulicsSrcDir).filter((name) =>
  name.endsWith('.js') || name.endsWith('.d.ts'),
);
for (const name of hydraulicsRuntimeFiles) {
  assert.match(
    hydraulicsDoc,
    new RegExp(`hydraulics/${name.replace(/\./g, '\\.')}`),
    `docs/hydraulics-pipeline.md должен упоминать hydraulics/${name}`,
  );
}

/** CalcRuntimeContext: doc ↔ reference/* + composition root. */
const calcRuntimeDoc = readRepo('docs/calc-runtime-context.md');
assert.match(calcRuntimeDoc, /getReferenceBundle/);
assert.match(calcRuntimeDoc, /toCalcRuntimeContext/);
assert.match(calcRuntimeDoc, /assertCalcRuntimeContext/);
assert.match(calcRuntimeDoc, /runCalculation/);
assert.match(calcRuntimeDoc, /\/api\/v1\/system\/invalidate-reference-cache/);
assert.match(calcRuntimeDoc, /verify:calc-runtime-context/);
assert.match(calcRuntimeDoc, /verify:reference-cache-invalidate/);
assert.doesNotMatch(calcRuntimeDoc, /stale-while-revalidate/i);
// Удалённые sync-кэши в доке допустимы только как запрет; на диске файлов быть не должно.
assert.equal(
  existsSync(path.join(root, 'backend', 'src', 'dhw', 'referenceCache.js')),
  false,
  'backend/src/dhw/referenceCache.js не должен существовать',
);
assert.equal(
  existsSync(path.join(root, 'backend', 'src', 'ufh', 'ufhPresetsCache.js')),
  false,
  'backend/src/ufh/ufhPresetsCache.js не должен существовать',
);

const referenceSrcDir = path.join(root, 'backend', 'src', 'reference');
const referenceRuntimeFiles = readdirSync(referenceSrcDir).filter((name) =>
  name.endsWith('.js'),
);
for (const name of referenceRuntimeFiles) {
  assert.match(
    calcRuntimeDoc,
    new RegExp(`reference/${name.replace(/\./g, '\\.')}`),
    `docs/calc-runtime-context.md должен упоминать reference/${name}`,
  );
}
assert.match(calcRuntimeDoc, /api\/systemRoutes\.js/);
assert.match(calcRuntimeDoc, /api\/runCalculation\.js/);

for (const field of ['catalog', 'waterNorms', 'appliances', 'recommendations', 'ufhPresets', 'sources']) {
  assert.match(
    calcRuntimeDoc,
    new RegExp(`\`${field}\``),
    `docs/calc-runtime-context.md должен описывать поле ctx.${field}`,
  );
}

/** 8d: manifold / unibox matching docs ↔ code + OpenAPI + verify. */
const manifoldDoc = readRepo('docs/manifold-matching.md');
const uniboxDoc = readRepo('docs/unibox-matching.md');
assert.match(manifoldDoc, /pickManifolds/);
assert.match(manifoldDoc, /UFH_MANIFOLD_MAX_OUTLETS_PER_NODE/);
assert.match(manifoldDoc, /verify:manifold-matching/);
assert.match(manifoldDoc, /ManifoldsMatchingReport/);
assert.match(manifoldDoc, /Перевищено ліміт петель/);
assert.doesNotMatch(manifoldDoc, /H\.15/);
assert.doesNotMatch(manifoldDoc, /унибоксы skip по сигналу каскада/i);
assert.match(manifoldDoc, /не\*\* блокируются каскадом|не блокируются каскадом/i);

assert.match(uniboxDoc, /pickUniboxes/);
assert.match(uniboxDoc, /UNIBOX_MAX_LOOPS_FOR_MATCHING/);
assert.match(uniboxDoc, /verify:unibox-matching/);
assert.match(uniboxDoc, /UniboxesMatchingReport/);
assert.match(uniboxDoc, /hasUnderfloorManifoldCascade/);
assert.doesNotMatch(uniboxDoc, /H\.15/);
assert.match(uniboxDoc, /не\*\* блокируется каскадом|не блокируется каскадом/i);

assert.ok(existsSync(path.join(root, 'backend', 'src', 'matching', 'manifold.js')));
assert.ok(existsSync(path.join(root, 'backend', 'src', 'matching', 'unibox.js')));
assert.ok(
  existsSync(path.join(root, 'backend', 'src', 'matching', 'internal', 'uniboxRoomAirPresets.js')),
);
assert.ok(existsSync(path.join(root, 'components', 'schemas', 'ManifoldsMatchingReport.yaml')));
assert.ok(existsSync(path.join(root, 'components', 'schemas', 'UniboxesMatchingReport.yaml')));
assert.ok(existsSync(path.join(root, 'components', 'schemas', 'ManifoldCatalogItem.yaml')));
assert.ok(existsSync(path.join(root, 'components', 'schemas', 'UniboxCatalogItem.yaml')));
assert.ok(backendPkg.scripts['verify:manifold-matching']);
assert.ok(backendPkg.scripts['verify:unibox-matching']);
assert.match(String(backendPkg.scripts.verify), /verify:manifold-matching/);
assert.match(String(backendPkg.scripts.verify), /verify:unibox-matching/);

const matchingPublic = readRepo('backend/src/matching/public.js');
assert.match(matchingPublic, /pickManifolds/);
assert.match(matchingPublic, /pickUniboxes/);
assert.match(matchingPublic, /buildEmptyManifoldsFailure/);
assert.match(matchingPublic, /buildOkManifoldsReport/);

for (const rel of [
  'docs/manifold-matching.md',
  'docs/unibox-matching.md',
  'docs/hydraulics-pipeline.md',
]) {
  assert.match(
    readRepo(rel),
    /pickManifolds[\s\S]{0,200}?→[\s\S]{0,40}?pickUniboxes/,
    `${rel}: порядок pickManifolds → pickUniboxes должен совпадать`,
  );
}

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
assert.doesNotMatch(
  projectStructure,
  /matching\/hydraulics\.js/,
  'project-structure.md не должен упоминать matching/hydraulics.js',
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

/**
 * Считает файлы в каталоге рекурсивно (без скрытых).
 * @param {string} dir
 * @returns {number}
 */
function countFilesRecursive(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) n += countFilesRecursive(abs);
    else n += 1;
  }
  return n;
}

for (const dir of BACKEND_SRC_TOP_DIRS) {
  const actual = countFilesRecursive(path.join(backendSrc, dir));
  const m = projectStructure.match(new RegExp(`##### \`${dir}/\` \\((\\d+) файлов\\)`));
  assert.ok(m, `project-structure.md должен иметь заголовок дерева для ${dir}/`);
  assert.equal(
    Number(m[1]),
    actual,
    `project-structure.md: ${dir}/ заявлено ${m[1]} файлов, на диске ${actual}`,
  );
}

const renderEstimatePdf = path.join(backendSrc, 'projects', 'renderEstimatePdf.js');
assert.ok(existsSync(renderEstimatePdf), 'backend/src/projects/renderEstimatePdf.js обязателен');
assert.match(
  projectStructure,
  /backend\/src\/projects\/renderEstimatePdf\.js/,
  'project-structure.md должен указывать актуальный путь PDF-оркестратора',
);
assert.doesNotMatch(
  projectStructure,
  /backend\/projects\/renderEstimatePdf/,
  'project-structure.md: запрещён устаревший путь без src/',
);

const ufhReportSchema = readRepo('components/schemas/UnderfloorHeatingReport.yaml');
assert.doesNotMatch(
  ufhReportSchema,
  /roadmap/i,
  'UnderfloorHeatingReport.yaml не должен содержать roadmap',
);
assert.doesNotMatch(
  ufhReportSchema,
  /фазы\s*1/i,
  'UnderfloorHeatingReport.yaml не должен ссылаться на фазы плана',
);

const rootReadme = readRepo('README.md');
assert.match(rootReadme, /project-structure\.md/, 'корневой README должен ссылаться на SSOT структуры');
assert.doesNotMatch(
  rootReadme,
  /Карта модулей — \[`Plan\.md`\].*\[`docs\/project-structure/,
  'корневой README не должен ставить Plan.md как карту структуры впереди SSOT',
);

const surveyDraft = readRepo('docs/survey-draft.md');
assert.match(surveyDraft, /SurveyDraft/);
assert.match(surveyDraft, /SURVEY_DRAFT_SCHEMA_VERSION = 4/);
assert.match(surveyDraft, /frontend\/src\/types\/surveyDraft\.ts/);
assert.match(surveyDraft, /frontend\/src\/surveySession\/migrateDerivedState\.ts/);
assert.match(surveyDraft, /verify:survey-session/);
assert.match(surveyDraft, /verify:start-state/);
assert.doesNotMatch(surveyDraft, /Hard Reset/i);
assert.doesNotMatch(surveyDraft, /до релиза/i);

/** 8e: frontend domain docs ↔ entry/orchestrators / layers (без правок frontend/src). */
const frontendCalcRunner = readRepo('docs/frontend-calc-runner.md');
const startStateDoc = readRepo('docs/start-state.md');
assert.match(frontendCalcRunner, /frontend\/src\/query\/useReferenceData\.ts/);
assert.match(frontendCalcRunner, /frontend\/src\/surveySession\/buildCalcInputSnapshot\.ts/);
assert.match(frontendCalcRunner, /frontend\/src\/query\/useSurveyCalc\.ts/);
assert.match(frontendCalcRunner, /SurveySessionProvider/);
assert.match(frontendCalcRunner, /verify:survey-session/);
assert.match(frontendCalcRunner, /verify:start-state/);
assert.doesNotMatch(
  frontendCalcRunner,
  /query\/queries\/\*`, композиция — `useReferenceData\.ts`/,
);

assert.match(startStateDoc, /sync resolve|синхронно/i);
assert.match(startStateDoc, /retryBootstrap/);
assert.match(startStateDoc, /RESOLVING_TIMEOUT_MS|3 s|3\s*s/);
assert.doesNotMatch(startStateDoc, /~200\s*ms/);
assert.doesNotMatch(
  startStateDoc,
  /Первые ~200 ms после mount/,
);
assert.match(startStateDoc, /verify:start-state/);
assert.match(startStateDoc, /verify:seo/);
assert.match(startStateDoc, /Static LCP shell|#static-app-shell/i);
assert.match(startStateDoc, /static-start-screen/);
assert.match(startStateDoc, /staticAppShellTransition/);
assert.match(startStateDoc, /фейкового header|static-app-shell__header/i);
assert.match(startStateDoc, /frontend\/src\/AppRoot\.tsx/);
assert.match(startStateDoc, /frontend\/src\/hooks\/useSurveyBootstrap\.ts/);

assert.doesNotMatch(projectStructure, /useSurveyBootstrap → resolving \| start \| error/);
assert.match(projectStructure, /cold open: sync resolve/i);
assert.match(projectStructure, /ClerkLazyRoot/);
assert.match(projectStructure, /#static-app-shell|static-app-shell/);
assert.match(projectStructure, /verifySeoStatic\.mjs/);

for (const rel of [
  'frontend/src/AppRoot.tsx',
  'frontend/src/StartAppRoot.tsx',
  'frontend/src/SurveyAppRoot.tsx',
  'frontend/src/AppSurveyContent.tsx',
  'frontend/src/surveySession/SurveySessionProvider.tsx',
  'frontend/src/query/useSurveyCalc.ts',
  'frontend/src/query/useReferenceData.ts',
  'frontend/src/surveySession/buildCalcInputSnapshot.ts',
  'frontend/src/hooks/useSurveyBootstrap.ts',
  'frontend/src/types/surveyDraft.ts',
  'frontend/src/constants/surveySteps.ts',
]) {
  assert.ok(existsSync(path.join(root, rel)), `${rel} должен существовать`);
}

const frontendPkg = JSON.parse(readRepo('frontend/package.json'));
assert.ok(frontendPkg.scripts['verify:survey-session']);
assert.ok(frontendPkg.scripts['verify:start-state']);
assert.match(String(frontendPkg.scripts.verify), /verify:survey-session/);
assert.match(String(frontendPkg.scripts.verify), /verify:start-state/);

const languagePolicy = readRepo('docs/language-policy.md');
assert.doesNotMatch(languagePolicy, /PR-[0-9]/);
assert.doesNotMatch(languagePolicy, /✅ 20/);

assert.ok(
  !existsSync(path.join(root, 'docs/ufh-roadmap-test-checklist.md')),
  'docs/ufh-roadmap-test-checklist.md должен быть удалён',
);
assert.ok(existsSync(path.join(root, 'docs/ufh-test-checklist.md')), 'docs/ufh-test-checklist.md должен существовать');

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
  { pattern: /matching\/hydraulics\.js/, label: 'matching/hydraulics.js' },
  { pattern: /backend\/projects\/renderEstimatePdf/, label: 'PDF path без src/' },
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
