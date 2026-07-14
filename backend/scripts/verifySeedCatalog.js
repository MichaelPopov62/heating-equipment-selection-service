/**
 * Назначение: проверка эталонного каталога без подключения к MongoDB.
 * Описание: Прогоняет test_data.json.example через validateAndNormalizeCatalog
 * (тот же контракт, что seed.js и loadCatalog).
 */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  summarizeNormalizedCatalog,
  validateAndBuildProductDocuments,
} from './utils/catalogSeedBuild.js';
import { assertAt } from './fixtures/scriptAssert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplePath = path.join(__dirname, '..', 'test_data.json.example');

let raw;
try {
  raw = await fs.readFile(examplePath, 'utf-8');
} catch (err) {
  console.error(`Не найден эталон каталога: ${examplePath}`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
  process.exit(process.exitCode);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {import('../src/catalog/types.js').PumpCatalogItemNormalized} pump
 * @param {number} idx
 */
function assertPumpContract(pump, idx) {
  if (!isNonEmptyString(pump?.id)) {
    throw new Error(`verify: pumps[${idx}].id обязателен`);
  }
  if (!isNonEmptyString(pump?.brand)) {
    throw new Error(`verify: pumps[${idx}].brand обязателен`);
  }
  if (!isNonEmptyString(pump?.model)) {
    throw new Error(`verify: pumps[${idx}].model обязателен`);
  }
  if (typeof pump?.price !== 'number' || pump.price < 1) {
    throw new Error(`verify: pumps[${idx}].price должен быть числом ≥ 1`);
  }
  if (Object.prototype.hasOwnProperty.call(pump, 'commercial')) {
    throw new Error(`verify: pumps[${idx}] содержит legacy-поле commercial (нужен price на верхнем уровне)`);
  }
  if (Object.prototype.hasOwnProperty.call(pump, 'currency')) {
    throw new Error(`verify: pumps[${idx}] содержит currency (валюта — только currency каталога)`);
  }
}

/**
 * @param {import('../src/catalog/types.js').PipeCatalogItemNormalized} pipe
 * @param {number} idx
 */
function assertPipeContract(pipe, idx) {
  if (!isNonEmptyString(pipe?.model)) {
    throw new Error(`verify: pipes[${idx}].model отсутствует после validateAndNormalizeCatalog`);
  }
  if (!isNonEmptyString(pipe?.id)) {
    throw new Error(`verify: pipes[${idx}].id обязателен`);
  }
  if (!isNonEmptyString(pipe?.brand)) {
    throw new Error(`verify: pipes[${idx}].brand обязателен`);
  }
  if (!isNonEmptyString(pipe?.material)) {
    throw new Error(`verify: pipes[${idx}].material обязателен`);
  }
  if (typeof pipe?.diameter !== 'number' || pipe.diameter < 1) {
    throw new Error(`verify: pipes[${idx}].diameter должен быть числом ≥ 1`);
  }
  if (typeof pipe?.wallThickness !== 'number' || pipe.wallThickness < 0.1) {
    throw new Error(`verify: pipes[${idx}].wallThickness должен быть числом ≥ 0.1`);
  }
  if (typeof pipe?.price !== 'number' || pipe.price < 1) {
    throw new Error(`verify: pipes[${idx}].price должен быть числом ≥ 1`);
  }
}

try {
  const parsed = JSON.parse(raw);
  const pipesBefore =
    Array.isArray(parsed.products?.pipes) && parsed.products.pipes[0]
      ? JSON.stringify(parsed.products.pipes[0])
      : null;

  const { normalized, docs } = validateAndBuildProductDocuments(parsed);

  if (pipesBefore != null && Array.isArray(parsed.products?.pipes) && parsed.products.pipes[0]) {
    const pipesAfter = JSON.stringify(parsed.products.pipes[0]);
    if (pipesAfter !== pipesBefore) {
      throw new Error(
        'verify: validateAndNormalizeCatalog изменил исходный parsed (ожидался structuredClone на входе)',
      );
    }
  }

  const summary = summarizeNormalizedCatalog(normalized);

  const pipesNorm = normalized.pipes ?? [];
  for (let i = 0; i < pipesNorm.length; i += 1) {
    assertPipeContract(assertAt(pipesNorm, i, `pipesNorm[${i}]`), i);
  }

  const pumpsNorm = normalized.pumps ?? [];
  for (let i = 0; i < pumpsNorm.length; i += 1) {
    assertPumpContract(assertAt(pumpsNorm, i, `pumpsNorm[${i}]`), i);
  }

  const pipeDocs = docs.filter((d) => d.kind === 'pipe');
  for (let i = 0; i < pipeDocs.length; i += 1) {
    const doc = assertAt(pipeDocs, i, `pipeDocs[${i}]`);
    if (Object.prototype.hasOwnProperty.call(doc, 'data')) {
      throw new Error(`verify: pipe-документ [${i}] содержит legacy-поле data (нужен flat seed)`);
    }
    if (!isNonEmptyString(doc.model)) {
      throw new Error(`verify: pipe-документ [${i}] без model после buildProductDocumentsFromNormalized`);
    }
    const normModel = pipesNorm[i]?.model;
    if (typeof normModel === 'string' && doc.model !== normModel) {
      throw new Error(
        `verify: pipe [${i}] model в docs ("${doc.model}") не совпал с normalized ("${normModel}")`,
      );
    }
  }

  process.stdout.write(
    `verify:seed-catalog OK — ${docs.length} документов products ` +
      `(boiler ${summary.boilerDouble + summary.boilerSingle}, ` +
      `radiator ${summary.radiators}, waterHeater ${summary.waterHeaters}, ` +
      `pipe ${summary.pipes}, pump ${summary.pumps}, indirect ${summary.indirectWaterHeaters}, ` +
      `manifold ${summary.manifolds}, boilerManifold ${summary.boilerManifolds}, ` +
      `unibox ${summary.uniboxes})\n`,
  );
} catch (err) {
  console.error('verify:seed-catalog FAILED: каталог не прошёл validateAndNormalizeCatalog');
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
