/**
 * Назначение: verify Start State bootstrap и session reset (node, без DOM).
 * Запуск: npm run verify:start-state (из frontend/)
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distAssets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
const bundles = existsSync(distAssets)
  ? readdirSync(distAssets).filter((f) => f.endsWith('.js'))
  : [];
assert.ok(bundles.length > 0, 'dist/assets/*.js должен существовать (npm run build)');

/** Зеркало createEmptySurveyDraftSnapshot: rooms пустой → canAutoCalc false. */
function canAutoCalcFromDraft(draft) {
  if (draft.rooms.length === 0) return false;
  return draft.rooms.every(
    (r) =>
      typeof r.areaM2 === 'number'
      && r.areaM2 > 0
      && typeof r.heightM === 'number'
      && r.heightM > 0,
  );
}

const emptyDraft = { rooms: [] };
const defaultDraft = { rooms: [{ areaM2: '', heightM: 2.7 }] };

assert.equal(canAutoCalcFromDraft(emptyDraft), false);
assert.equal(canAutoCalcFromDraft(defaultDraft), false);

/** Зеркало resolveAppBootstrap: hash приоритетнее storage. */
function resolveAppBootstrap(hasHash, hasStorage) {
  if (hasHash) return 'survey-hash';
  if (hasStorage) return 'survey-storage';
  return 'start';
}

assert.equal(resolveAppBootstrap(true, true), 'survey-hash');
assert.equal(resolveAppBootstrap(false, true), 'survey-storage');
assert.equal(resolveAppBootstrap(false, false), 'start');

const indexBundleName = bundles.find((f) => f.startsWith('index-') && f.endsWith('.js'));
assert.ok(indexBundleName, 'dist/assets/index-*.js должен существовать (npm run build)');
const mainBundle = readFileSync(path.join(distAssets, indexBundleName), 'utf8');
const allBundles = bundles
  .map((f) => readFileSync(path.join(distAssets, f), 'utf8'))
  .join('\n');
assert.ok(mainBundle.includes('Почати новий розрахунок'), 'index-бандл: start CTA');
assert.ok(mainBundle.includes('Загрузка приложения') || mainBundle.includes('Завантаження'), 'index-бандл: bootstrap skeleton label');
assert.ok(mainBundle.includes('SESSION_RESET'), 'index-бандл: SESSION_RESET');
assert.ok(mainBundle.includes('SURVEY_STARTED'), 'index-бандл: SURVEY_STARTED');
assert.ok(mainBundle.includes('heatcalc:survey-draft'), 'index-бандл: localStorage key');
assert.ok(mainBundle.includes('Вийти') || mainBundle.includes('Выйти'), 'index-бандл: exit to start action');
assert.ok(mainBundle.includes('exitToStart') || mainBundle.includes('exitProject'), 'index-бандл: exit handlers');
assert.ok(
  allBundles.includes('Новий проєкт') || allBundles.includes('Новый проект') || allBundles.includes('Начать новый проект'),
  'бандлы: new project action',
);
assert.ok(mainBundle.includes('HeatCalc Pro'), 'index-бандл: brand');
assert.ok(mainBundle.includes('Політика конфіденційності'), 'index-бандл: footer legal UA');
assert.ok(
  bundles.some((f) => f.startsWith('AppSurveyContent-')),
  'dist/assets: отдельный чанк AppSurveyContent',
);

console.log('verify:start-state — все кейсы прошли');
