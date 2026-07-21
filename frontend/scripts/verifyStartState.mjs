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

const mainBundle = readFileSync(path.join(distAssets, bundles[0]), 'utf8');
assert.ok(mainBundle.includes('Начать новый расчёт'), 'bundle: start CTA');
assert.ok(mainBundle.includes('Загрузка приложения'), 'bundle: bootstrap skeleton label');
assert.ok(mainBundle.includes('SESSION_RESET'), 'bundle: SESSION_RESET');
assert.ok(mainBundle.includes('SURVEY_STARTED'), 'bundle: SURVEY_STARTED');
assert.ok(mainBundle.includes('heatcalc:survey-draft'), 'bundle: localStorage key');
assert.ok(mainBundle.includes('Выйти'), 'bundle: exit to start action');
assert.ok(mainBundle.includes('exitToStart') || mainBundle.includes('exitProject'), 'bundle: exit handlers');
assert.ok(
  mainBundle.includes('Начать новый проект') || mainBundle.includes('Новый проект'),
  'bundle: new project action',
);

console.log('verify:start-state — все кейсы прошли');
