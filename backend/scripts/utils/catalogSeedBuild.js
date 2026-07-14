/**
 * Назначение: валидация и сборка документов коллекции products для seed.
 * Описание: Единая точка validateAndNormalizeCatalog + flatten в Mongo-документы.
 * Используется seed.js и verifySeedCatalog.js — контракт SSOT совпадает с loadCatalog().
 */
import { validateAndNormalizeCatalog } from './catalogNormalize.js';

/**
 * Глубокая копия для вставки в Mongo (без прототипов / циклов).
 *
 * @param {unknown} x
 * @returns {unknown}
 */
function cloneJsonSerializable(x) {
  return JSON.parse(JSON.stringify(x));
}

/**
 * Стабильный catalogKey для Mongo из артикула номенклатуры.
 *
 * @param {string} prefix
 * @param {Record<string, unknown>} raw
 * @param {number} index
 * @returns {string}
 */
function resolveProductCatalogKey(prefix, raw, index) {
  const idOrArticle = raw?.id ?? raw?.article;
  if (typeof idOrArticle === 'string' && idOrArticle.trim()) {
    const slug = idOrArticle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug) return `${prefix}-${slug}`;
  }
  return `${prefix}-${index}`;
}

/**
 * Валидация JSON-каталога тем же контрактом, что и runtime loadCatalog().
 *
 * @param {unknown} parsed — распарсенный test_data.json
 * @returns {import('../../src/catalog/types.js').NormalizedCatalog}
 */
export function validateCatalogForSeed(parsed) {
  return validateAndNormalizeCatalog(parsed);
}

/**
 * @typedef {Object} CatalogSeedSummary
 * @property {number} boilerDouble
 * @property {number} boilerSingle
 * @property {number} radiators
 * @property {number} waterHeaters
 * @property {number} pipes
 * @property {number} pumps
 * @property {number} indirectWaterHeaters
 * @property {number} manifolds
 * @property {number} boilerManifolds
 * @property {number} uniboxes
 */

/**
 * Сводка по нормализованному каталогу (логи seed / verify).
 *
 * @param {import('../../src/catalog/types.js').NormalizedCatalog} norm
 * @returns {CatalogSeedSummary}
 */
export function summarizeNormalizedCatalog(norm) {
  return {
    boilerDouble: norm.boilers.doubleCircuit.length,
    boilerSingle: norm.boilers.singleCircuit.length,
    radiators: norm.radiators.length,
    waterHeaters: norm.waterHeaters.length,
    pipes: (norm.pipes ?? []).length,
    pumps: (norm.pumps ?? []).length,
    indirectWaterHeaters: (norm.indirectWaterHeaters ?? []).length,
    manifolds: (norm.manifolds ?? []).length,
    boilerManifolds: (norm.boilerManifolds ?? []).length,
    uniboxes: (norm.uniboxes ?? []).length,
  };
}

/**
 * Плоские документы MongoDB products из уже провалидированного каталога.
 *
 * @param {import('../../src/catalog/types.js').NormalizedCatalog} norm
 * @returns {Record<string, unknown>[]}
 */
export function buildProductDocumentsFromNormalized(norm) {
  const boilers = [
    ...norm.boilers.doubleCircuit.map((x, i) => ({
      ...x,
      kind: 'boiler',
      catalogKey: `boiler-double-${i}`,
    })),
    ...norm.boilers.singleCircuit.map((x, i) => ({
      ...x,
      kind: 'boiler',
      catalogKey: `boiler-single-${i}`,
    })),
  ];

  const radiators = norm.radiators.map((x, i) => ({
    ...x,
    kind: 'radiator',
    catalogKey: `radiator-${i}`,
  }));

  const waterHeaters = norm.waterHeaters.map((x, i) => ({
    ...x,
    kind: 'waterHeater',
    catalogKey: `waterHeater-${i}`,
  }));

  const pipes = (norm.pipes ?? []).map((x, i) => {
    const raw = /** @type {Record<string, unknown>} */ (cloneJsonSerializable(x));
    const id = raw.id != null ? String(raw.id).trim() : '';
    return {
      ...raw,
      kind: 'pipe',
      catalogKey: `pipe-${i}`,
      pipeId: id || undefined,
    };
  });

  const indirectWaterHeaters = (norm.indirectWaterHeaters ?? []).map((x, i) => ({
    .../** @type {Record<string, unknown>} */ (cloneJsonSerializable(x)),
    kind: 'indirectWaterHeater',
    catalogKey: `indirectWaterHeater-${i}`,
  }));

  const pumps = (norm.pumps ?? []).map((x, i) => {
    const raw = /** @type {Record<string, unknown>} */ (cloneJsonSerializable(x));
    const id = raw.id != null ? String(raw.id).trim() : '';
    return {
      ...raw,
      kind: 'pump',
      catalogKey: `pump-${i}`,
      pumpId: id || undefined,
    };
  });

  const manifolds = (norm.manifolds ?? []).map((x, i) => {
    const raw = /** @type {Record<string, unknown>} */ (cloneJsonSerializable(x));
    return {
      ...raw,
      kind: 'manifold',
      catalogKey: resolveProductCatalogKey('manifold', raw, i),
    };
  });

  const boilerManifolds = (norm.boilerManifolds ?? []).map((x, i) => {
    const raw = /** @type {Record<string, unknown>} */ (cloneJsonSerializable(x));
    return {
      ...raw,
      kind: 'boilerManifold',
      catalogKey: resolveProductCatalogKey('boiler-manifold', raw, i),
    };
  });

  const uniboxes = (norm.uniboxes ?? []).map((x, i) => {
    const raw = /** @type {Record<string, unknown>} */ (cloneJsonSerializable(x));
    const id = raw.id != null ? String(raw.id).trim() : '';
    return {
      ...raw,
      kind: 'unibox',
      catalogKey: resolveProductCatalogKey('unibox', raw, i),
      uniboxId: id || undefined,
    };
  });

  return [
    ...boilers,
    ...radiators,
    ...waterHeaters,
    ...pipes,
    ...pumps,
    ...indirectWaterHeaters,
    ...manifolds,
    ...boilerManifolds,
    ...uniboxes,
  ];
}

/**
 * Валидация + сборка документов для seed (блокирует запись в Mongo при ошибке контракта).
 *
 * @param {unknown} parsed
 * @returns {{ normalized: import('../../src/catalog/types.js').NormalizedCatalog, docs: Record<string, unknown>[] }}
 */
export function validateAndBuildProductDocuments(parsed) {
  const normalized = validateCatalogForSeed(parsed);
  const docs = buildProductDocumentsFromNormalized(normalized);
  return { normalized, docs };
}
