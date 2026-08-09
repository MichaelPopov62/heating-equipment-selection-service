/**
 * Назначение: verify colocation хелперов отчётов (has*ReportContent, format*).
 * Запуск: npm run verify:report-colocation (из frontend/)
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/**
 * Whitelist: файл-хелпер → папка отчёта + допустимые внешние импортёры (форма шага / агрегатор).
 * @type {Record<string, { reportDir: string, extraImporters: string[] }>}
 */
const REPORT_HELPER_WHITELIST = {
  'components/BoilerReport/hasBoilerReportContent.ts': {
    reportDir: 'components/BoilerReport',
    extraImporters: ['components/BoilerSurveyForm', 'components/RecommendationsBlock'],
  },
  'components/BoilerReport/formatBoilerProposalShortLabel.ts': {
    reportDir: 'components/BoilerReport',
    extraImporters: [],
  },
  'components/HydraulicsReport/hasHydraulicsReportContent.ts': {
    reportDir: 'components/HydraulicsReport',
    extraImporters: ['components/HydraulicsSection', 'components/RecommendationsBlock'],
  },
  'components/HotWaterReport/hasHotWaterReportContent.ts': {
    reportDir: 'components/HotWaterReport',
    extraImporters: ['components/HotWaterForm'],
  },
  'components/HotWaterReport/hasHotWaterSummaryContent.ts': {
    reportDir: 'components/HotWaterReport',
    extraImporters: ['components/RecommendationsBlock'],
  },
  'components/RadiatorsReport/hasRadiatorsReportContent.ts': {
    reportDir: 'components/RadiatorsReport',
    extraImporters: ['components/RadiatorsSurveyForm', 'components/RecommendationsBlock'],
  },
  'components/WaterHeaterReport/hasWaterHeaterReportContent.ts': {
    reportDir: 'components/WaterHeaterReport',
    extraImporters: ['components/WaterHeaterForm'],
  },
  'components/UnderfloorHeatingReport/hasUnderfloorHeatingReportContent.ts': {
    reportDir: 'components/UnderfloorHeatingReport',
    extraImporters: ['components/WarmFloorSection'],
  },
};

/** @param {string} p */
function norm(p) {
  return p.replace(/\\/g, '/');
}

/** @param {string} dir */
function collectSourceFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** @param {string} helperRel */
function helperBasename(helperRel) {
  return path.basename(helperRel, '.ts');
}

/**
 * @param {string} helperRel — components/.../file.ts
 * @param {string} importerRel — components/.../File.tsx
 * @param {{ reportDir: string, extraImporters: string[] }} rule
 */
function isAllowedImporter(helperRel, importerRel, rule) {
  if (importerRel === helperRel) return true;
  if (importerRel.startsWith(`${rule.reportDir}/`)) return true;
  return rule.extraImporters.some(
    (extra) => importerRel.startsWith(`${extra}/`) || importerRel === `${extra}.tsx`,
  );
}

for (const helperRel of Object.keys(REPORT_HELPER_WHITELIST)) {
  assert.ok(
    existsSync(path.join(srcRoot, helperRel)),
    `whitelist: отсутствует ${helperRel}`,
  );
}

const importRe = /from\s+['"]([^'"]+)['"]/g;

for (const [helperRel, rule] of Object.entries(REPORT_HELPER_WHITELIST)) {
  const base = helperBasename(helperRel);
  const reportDir = rule.reportDir;

  for (const filePath of collectSourceFiles(srcRoot)) {
    const content = readFileSync(filePath, 'utf8');
    if (!content.includes(base)) continue;

    const importerRel = norm(path.relative(srcRoot, filePath));
    let match;
    importRe.lastIndex = 0;
    while ((match = importRe.exec(content)) !== null) {
      const spec = match[1];
      if (!spec.includes(base)) continue;

      const resolvesToHelper =
        spec.endsWith(`/${base}`)
        || spec === `./${base}`
        || spec === `../${path.basename(reportDir)}/${base}`;

      if (!resolvesToHelper) continue;

      assert.ok(
        isAllowedImporter(helperRel, importerRel, rule),
        `${importerRel} не может импортировать ${base} (вне whitelist colocation)`,
      );
    }
  }
}

console.log('verify:report-colocation — OK');
