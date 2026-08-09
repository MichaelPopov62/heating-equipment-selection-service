/**
 * Назначение: gate user-facing RU поза whitelist (docs/language-policy.md §5, §8).
 * Запуск: npm run verify:language-policy (из корня репозитория)
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} rel */
async function readRepo(rel) {
  return fs.readFile(path.join(root, rel), 'utf8');
}

/** @param {string} line */
function isCommentOrJavadocLine(line) {
  const t = line.trimStart();
  return (
    t.startsWith('//')
    || t.startsWith('*')
    || t.startsWith('/*')
    || t.startsWith('*/')
    || t.startsWith('#')
  );
}

/** @param {string} dir @param {RegExp} exts */
async function walk(dir, exts) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, exts)));
    else if (e.isFile() && exts.test(e.name)) out.push(full);
  }
  return out;
}

/** Whitelist enum/calc payload — не считаем нарушением (§5). */
const WHITELIST_SUBSTRINGS = [
  'наружная стена',
  'стена в неотопливаемый коридор',
  'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
  'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater',
  'singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw',
  'combiBoilerWithBufferElectricStorage',
  'singleCircuitBoilerWithBufferElectricStorage',
  'traditional_high_dt70_95_85',
  'traditional_dt50_75_65',
  'condensing_dt30_55_45',
  "'corner'",
  "'facade'",
  "'internal'",
  "'помещение'",
  "'санузел'",
  "'гостиная'",
  "'котельная'",
  "'прихожая'",
  "'тамбур'",
  "'коридор'",
  "'спальня'",
  "'кухня'",
  "'тех'",
];

/** @param {string} line */
function isWhitelistedLine(line) {
  return WHITELIST_SUBSTRINGS.some((w) => line.includes(w));
}

/** User-facing RU-маркеры в строковых литералах (§8). */
const USER_FACING_PATTERNS = [
  { re: /[ёЁ]/, label: 'буква «ё»' },
  { re: /Выберите|Заполните/, label: 'императив RU (Выберите/Заполните)' },
  { re: /Контур отопления|тёплого пола/, label: 'RU fallback гидравлики' },
  { re: /керамогранит|линолеум для ТП|ламинат, LVT/, label: 'RU label ufhCircuitPresets' },
  { re: /неканонический type/, label: 'RU dev-throw roomTypes' },
  { re: /рассчитан на конденсационный/, label: 'RU normalization warning ТП' },
];

/** @type {{ file: string; line: number; label: string; text: string }[]} */
const hits = [];

/** @param {string} absPath @param {RegExp} exts */
async function scanTree(absPath, exts) {
  for (const file of await walk(absPath, exts)) {
    if (file.endsWith('.d.ts')) continue;
    const rel = path.relative(root, file);
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (isCommentOrJavadocLine(line)) continue;
      if (!/['"`]/.test(line)) continue;
      if (isWhitelistedLine(line)) continue;
      // Dev-throw / config bootstrap — поза scope user-facing (§3)
      if (rel.startsWith('backend\\src\\') || rel.startsWith('backend/src/')) {
        if (/throw new Error|new Error\(|errors\.push\(/.test(line)) continue;
        if (/\/auth\/|validateCatalog|validateWaterNorms|validateAppliances|assertCalc/.test(rel)) continue;
        if (/resolveExternalWallUValue:|Неизвестный ufhPresetId|AUTH_PROVIDER|Архитектурная ошибка/.test(line)) {
          continue;
        }
      }
      for (const { re, label } of USER_FACING_PATTERNS) {
        if (re.test(line)) {
          hits.push({
            file: rel,
            line: i + 1,
            label,
            text: line.trim(),
          });
        }
      }
    }
  }
}

// Явные проверки критичных файлов (post-close fix)
const parseHydraulics = await readRepo('frontend/src/utils/parsers/parseHydraulicsProposalFromReport.ts');
assert.ok(
  parseHydraulics.includes('Контур опалення (радіатори)'),
  'parseHydraulicsProposalFromReport.ts: очікується UA fallback опалення',
);
assert.ok(
  parseHydraulics.includes('Контур теплої підлоги'),
  'parseHydraulicsProposalFromReport.ts: очікується UA fallback ТП',
);
assert.ok(
  !parseHydraulics.includes('отопления'),
  'parseHydraulicsProposalFromReport.ts: не повинно бути RU «отопления»',
);
assert.ok(
  !parseHydraulics.includes('тёплого пола'),
  'parseHydraulicsProposalFromReport.ts: не повинно бути RU «тёплого пола»',
);

const ufhCircuit = await readRepo('shared/ufhCircuitPresets.js');
assert.ok(
  ufhCircuit.includes('керамограніт'),
  'ufhCircuitPresets.js: очікується UA «керамограніт»',
);
assert.ok(
  !ufhCircuit.includes('керамогранит'),
  'ufhCircuitPresets.js: не повинно бути RU «керамогранит»',
);
assert.ok(
  !ufhCircuit.includes('ламинат, LVT'),
  'ufhCircuitPresets.js: не повинно бути RU «ламинат»',
);

const languagePolicy = await readRepo('docs/language-policy.md');
assert.match(languagePolicy, /verify:language-policy/);
assert.match(languagePolicy, /Smoke E2E UI|§10/);
assert.doesNotMatch(languagePolicy, /PR-[0-9]/);

await scanTree(path.join(root, 'frontend', 'src'), /\.(ts|tsx)$/);
await scanTree(path.join(root, 'shared'), /\.(js|ts)$/);
await scanTree(path.join(root, 'backend', 'src'), /\.js$/);

if (hits.length > 0) {
  console.error('verifyLanguagePolicy: FAIL');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  [${h.label}] ${h.text}`);
  }
  process.exit(1);
}

console.log('verifyLanguagePolicy: OK');
